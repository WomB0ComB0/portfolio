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

type ExportedDeclaration = VariableDeclaration | FunctionDeclaration | ClassDeclaration;

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
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return def;
  const nextArg = args[idx + 1];
  if (nextArg && !nextArg.startsWith('--')) {
    return nextArg;
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

/**
 * Collects all exported top-level declarations from a source file.
 */
function collectExportedDeclarations(
  sourceFile: ReturnType<Project['getSourceFiles']>[number],
): ExportedDeclaration[] {
  const declarations: ExportedDeclaration[] = [];
  // Get exported functions
  for (const f of sourceFile
    .getFunctions()
    .filter(isTopLevel)
    .filter((f) => f.isExported())) {
    declarations.push(f);
  }

  // Get exported classes
  for (const c of sourceFile
    .getClasses()
    .filter(isTopLevel)
    .filter((c) => c.isExported())) {
    declarations.push(c);
  }

  // Get exported variable declarations
  for (const vs of sourceFile.getVariableStatements().filter((vs) => vs.isExported())) {
    for (const d of vs.getDeclarations()) {
      declarations.push(d);
    }
  }

  return declarations;
}

/**
 * Checks if a declaration is used externally (referenced outside its defining file).
 */
function isExternallyUsed(declaration: ExportedDeclaration, filePath: string): boolean {
  const references = declaration.findReferences();
  const allReferenceEntries = references.flatMap((ref: ReferencedSymbol) => ref.getReferences());

  const externalUsages = allReferenceEntries.filter((ref: ReferenceEntry) => {
    const referencingFile = ref.getNode().getSourceFile().getFilePath();
    return referencingFile !== filePath;
  });

  return externalUsages.length > 0;
}

/**
 * Analyzes a single source file for unused exports.
 */
function analyzeSourceFile(
  sourceFile: ReturnType<Project['getSourceFiles']>[number],
  rootPath: string,
  logAll: boolean,
): { name: string; type: string; filePath: string }[] {
  const filePath = sourceFile.getFilePath();
  const relativePath = relative(rootPath, filePath);
  const unusedExports: { name: string; type: string; filePath: string }[] = [];

  const declarations = collectExportedDeclarations(sourceFile);

  for (const declaration of declarations) {
    const name = declaration.getName() || '(anonymous)';
    const type = getDeclarationType(declaration);
    const symbol = declaration.getSymbol();

    if (!symbol) continue;

    const isUsed = isExternallyUsed(declaration, filePath);

    if (!isUsed) {
      unusedExports.push({ name, type, filePath: relativePath });
    }

    if (logAll) {
      console.log(`[${isUsed ? 'USED' : 'UNUSED'}] ${type.padEnd(8)}: ${name} (${relativePath})`);
    }
  }

  return unusedExports;
}

/**
 * Prints the results of the unused exports scan.
 */
function printResults(unusedExports: { name: string; type: string; filePath: string }[]): void {
  console.log('\n--- Unused Top-Level Exports Found ---');

  if (unusedExports.length === 0) {
    console.log('🎉 No unused exported symbols found!');
    return;
  }

  const grouped = unusedExports.reduce(
    (acc, exp) => {
      acc[exp.filePath] ??= [];
      acc[exp.filePath]?.push(exp);
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

async function main() {
  console.log('Starting unused exports scan...');

  const files = await fg(patterns, { cwd: options.root, ignore, absolute: true });

  if (files.length === 0) {
    console.warn('No files matched the include/exclude patterns. Exiting.');
    return;
  }

  const project = createProject(options.root);
  project.addSourceFilesAtPaths(files);

  console.log(`Analyzing ${project.getSourceFiles().length} files...`);

  const unusedExports = scanProjectForUnusedExports(project, options.root, options.logAll);

  printResults(unusedExports);
}

/**
 * Creates a ts-morph Project instance with the appropriate configuration.
 */
function createProject(rootPath: string): Project {
  const tsConfigPath = join(rootPath, 'tsconfig.json');
  return new Project({
    tsConfigFilePath: existsSync(tsConfigPath) ? tsConfigPath : undefined,
    skipAddingFilesFromTsConfig: true,
  });
}

/**
 * Scans all source files in the project and collects unused exports.
 */
function scanProjectForUnusedExports(
  project: Project,
  rootPath: string,
  logAll: boolean,
): { name: string; type: string; filePath: string }[] {
  const unusedExports: { name: string; type: string; filePath: string }[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const fileUnusedExports = analyzeSourceFile(sourceFile, rootPath, logAll);
    unusedExports.push(...fileUnusedExports);
  }

  return unusedExports;
}

try {
  await main();
} catch (err) {
  console.error('An error occurred during scanning:', err);
  process.exit(1);
}
