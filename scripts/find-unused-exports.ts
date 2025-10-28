#!/usr/bin/env tsx
/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fg from 'fast-glob';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  type ClassDeclaration,
  type FunctionDeclaration,
  Node,
  Project, // Removed 'type' to allow using static methods (e.g., Node.isClassDeclaration)
  type ReferencedSymbol, // Added for correct type in findReferences()
  type ReferenceEntry,
  SyntaxKind,
  type VariableDeclaration,
} from 'ts-morph';

/**
 * Finds and lists all unused top-level exported declarations (variables,
 * functions, classes) across the entire project by checking for external references.
 *
 * Usage:
 * ./find-unused-exports.ts --include=src
 *
 * Flags:
 * --root <path>        : Project root (default: cwd)
 * --include <csv>      : Comma-separated paths to include (default: src)
 * --exclude <csv>      : Comma-separated paths to exclude (default: node_modules,.next,dist)
 * --log-all            : Log all exported symbols, even used ones (for debugging)
 */

type Opts = {
  root: string;
  include: string[];
  exclude: string[];
  logAll: boolean;
};

const args = process.argv.slice(2);
const getFlag = (name: string, def = ''): string => {
  const idx = args.findIndex((a) => a === `--${name}`);
  if (idx === -1) return def;
  if (args[idx + 1] && !args[idx + 1]!.startsWith('--')) {
    return args[idx + 1]!;
  }
  return def;
};
const hasFlag = (name: string): boolean => args.includes(`--${name}`);

const options: Opts = {
  root: getFlag('root', process.cwd()),
  include: getFlag('include', 'src')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  exclude: getFlag('exclude', 'node_modules,.next,dist,build,out,src/generated')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  logAll: hasFlag('log-all'),
};

const patterns = options.include.map((seg) => `${seg.replace(/\/+$/, '')}/**/*.{ts,tsx,js,jsx}`);
const ignore = [...options.exclude.map((seg) => `${seg.replace(/\/+$/, '')}/**`), '**/*.d.ts'];

/**
 * Checks if a declaration is at the top-level of a file.
 */
function isTopLevel(d: Node): boolean {
  return d.getParent()?.getKind() === SyntaxKind.SourceFile;
}

/**
 * Returns a type label for the given declaration node.
 */
function getDeclarationType(node: Node): string {
  if (Node.isClassDeclaration(node)) return 'Class';
  if (Node.isFunctionDeclaration(node)) return 'Function';
  if (Node.isVariableDeclaration(node)) return 'Variable';
  return 'Declaration';
}

async function main() {
  console.log('Starting unused exports scan...');

  const files = await fg(patterns, { cwd: options.root, ignore, absolute: true });

  if (files.length === 0) {
    console.warn('No files matched the include/exclude patterns. Exiting.');
    return;
  }

  const tsConfigPath = join(options.root, 'tsconfig.json');
  const project = new Project({
    // Load tsconfig to resolve paths and references correctly
    tsConfigFilePath: existsSync(tsConfigPath) ? tsConfigPath : undefined,
    // Add only the files we want to scan (excluding generated/ignored paths)
    skipAddingFilesFromTsConfig: true,
  });

  project.addSourceFilesAtPaths(files);

  console.log(`Analyzing ${project.getSourceFiles().length} files...`);

  const unusedExports: { name: string; type: string; filePath: string }[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();

    // FIX: Use relative from node:path instead of getFilePathRelativeToProject
    const relativePath = relative(options.root, filePath);

    // Collect exported top-level declarations
    const declarations: (VariableDeclaration | FunctionDeclaration | ClassDeclaration)[] = [];

    // 1. Get exported functions
    sourceFile
      .getFunctions()
      .filter(isTopLevel)
      .filter((f) => f.isExported())
      .forEach((f) => declarations.push(f));

    // 2. Get exported classes
    sourceFile
      .getClasses()
      .filter(isTopLevel)
      .filter((c) => c.isExported())
      .forEach((c) => declarations.push(c));

    // 3. Get exported variable declarations (e.g., const MyVar = 10;)
    sourceFile
      .getVariableStatements()
      .filter((vs) => vs.isExported())
      .forEach((vs) => {
        vs.getDeclarations().forEach((d) => declarations.push(d));
      });

    // Analyze each exported declaration
    for (const declaration of declarations) {
      const name = declaration.getName() || '(anonymous)';
      const type = getDeclarationType(declaration);
      const symbol = declaration.getSymbol();

      if (!symbol) continue;

      // FIX: Use declaration.findReferences() and flatten references
      const references = declaration.findReferences();

      // Filter references to find only external usages (usages outside the defining file)
      const allReferenceEntries = references.flatMap((ref: ReferencedSymbol) =>
        ref.getReferences(),
      );

      const externalUsages = allReferenceEntries.filter((ref: ReferenceEntry) => {
        const referencingFile = ref.getNode().getSourceFile().getFilePath();
        // A declaration is considered "used" if it is referenced in a different file.
        return referencingFile !== filePath;
      });

      const isUsed = externalUsages.length > 0;

      if (!isUsed) {
        unusedExports.push({ name, type, filePath: relativePath });
      }

      if (options.logAll) {
        console.log(`[${isUsed ? 'USED' : 'UNUSED'}] ${type.padEnd(8)}: ${name} (${relativePath})`);
      }
    }
  }

  console.log('\n--- Unused Top-Level Exports Found ---');

  if (unusedExports.length === 0) {
    console.log('🎉 No unused exported symbols found!');
    return;
  }

  // Group by file for cleaner output
  const grouped = unusedExports.reduce(
    (acc, exp) => {
      // FIX: Explicitly initialize array to satisfy type checker
      if (!acc[exp.filePath]) {
        acc[exp.filePath] = [];
      }
      acc[exp.filePath]!.push(exp);
      return acc;
    },
    {} as Record<string, typeof unusedExports>,
  );

  for (const [filePath, exports] of Object.entries(grouped)) {
    console.log(`\n📄 ${filePath}:`);
    for (const exp of exports) {
      console.log(`  - ${exp.type.padEnd(8)}: ${exp.name}`);
    }
  }

  console.log(`\nTotal unused exports: ${unusedExports.length}`);
}

main().catch((err) => {
  console.error('An error occurred during scanning:', err);
  process.exit(1);
});
