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

import { existsSync } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';

/**
 * Move top-level interfaces and type aliases from <file>.ts/tsx
 * into a sibling <file>.types.ts, then import them back as `import type`.
 *
 * Usage:
 * ./refactorTypes.ts --include=src/components --dry-run
 *
 * Flags:
 * --root <path>        : Project root (default: cwd)
 * --include <csv>      : Comma-separated paths to include (default: src)
 * --exclude <csv>      : Comma-separated paths to exclude (default: node_modules,.next,dist)
 * --dry-run            : Log changes without saving files
 * --overwrite          : Overwrite existing .types.ts files (default: false, merges)
 */
import fg from 'fast-glob';
import {
  type InterfaceDeclaration,
  Project,
  QuoteKind,
  type SourceFile,
  SyntaxKind,
  type TypeAliasDeclaration,
} from 'ts-morph';

type Opts = {
  root: string;
  include: string[];
  exclude: string[];
  dryRun: boolean;
  overwriteTypes: boolean;
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
  exclude: getFlag('exclude', 'node_modules,.next,dist,build,out')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  dryRun: hasFlag('dry-run'),
  overwriteTypes: hasFlag('overwrite'),
};

const patterns = options.include.map((seg) => `${seg.replace(/\/+$/, '')}/**/*.{ts,tsx}`);
const ignore = [
  ...options.exclude.map((seg) => `${seg.replace(/\/+$/, '')}/**`),
  '**/*.d.ts',
  '**/*.types.ts', // Don't process our own output files
];

function typesCompanionPath(srcPath: string): string {
  const dir = dirname(srcPath);
  const base = basename(srcPath, extname(srcPath));
  return join(dir, `${base}.types.ts`);
}

/**
 * Checks if a declaration is at the top-level of a file (not nested in a
 * function, namespace, module, etc.)
 */
function isTopLevel(d: InterfaceDeclaration | TypeAliasDeclaration): boolean {
  return d.getParent().getKind() === SyntaxKind.SourceFile;
}

function createProject(files: string[]): Project {
  const tsConfigPath = join(options.root, 'tsconfig.json');
  const project = new Project({
    tsConfigFilePath: existsSync(tsConfigPath) ? tsConfigPath : undefined,
    skipAddingFilesFromTsConfig: false,
    manipulationSettings: {
      useTrailingCommas: true,
      quoteKind: QuoteKind.Single,
    },
  });

  project.addSourceFilesAtPaths(files);
  return project;
}

function getOrCreateTypesFile(project: Project, typesPath: string): SourceFile {
  const typesFileExists = project.getSourceFile(typesPath) || existsSync(typesPath);

  if (typesFileExists && !options.overwriteTypes) {
    return project.addSourceFileAtPath(typesPath);
  }
  return project.createSourceFile(typesPath, '', { overwrite: true });
}

function moveInterfaces(interfaces: InterfaceDeclaration[], typesFile: SourceFile): string[] {
  const movedNames: string[] = [];

  for (const intf of interfaces) {
    const struct = intf.getStructure();
    struct.isExported = true;
    typesFile.addInterface(struct);
    if (!options.dryRun) intf.remove();
    if (struct.name) movedNames.push(struct.name);
  }

  return movedNames;
}

function moveTypeAliases(typeAliases: TypeAliasDeclaration[], typesFile: SourceFile): string[] {
  const movedNames: string[] = [];

  for (const ta of typeAliases) {
    const struct = ta.getStructure();
    struct.isExported = true;
    typesFile.addTypeAlias(struct);
    if (!options.dryRun) ta.remove();
    if (struct.name) movedNames.push(struct.name);
  }

  return movedNames;
}

function addTypeImport(sourceFile: SourceFile, typesPath: string, movedNames: string[]): void {
  const importRel = './' + basename(typesPath).replace(/\.ts$/, '');
  const existingImport = sourceFile
    .getImportDeclarations()
    .find((d) => d.isTypeOnly() && d.getModuleSpecifierValue() === importRel);

  if (existingImport) {
    updateExistingImport(existingImport, movedNames);
  } else {
    insertNewImport(sourceFile, importRel, movedNames);
  }
}

function updateExistingImport(existingImport: any, movedNames: string[]): void {
  const existingNames = new Set(existingImport.getNamedImports().map((n: any) => n.getName()));
  for (const name of movedNames) {
    if (!existingNames.has(name)) {
      existingImport.addNamedImport(name);
    }
  }
}

function insertNewImport(sourceFile: SourceFile, importRel: string, movedNames: string[]): void {
  const importString = `import type { ${movedNames.join(', ')} } from '${importRel}';\n`;
  const fullText = sourceFile.getFullText();
  const hasShebang = fullText.startsWith('#!');

  if (hasShebang) {
    const firstNewlinePos = fullText.indexOf('\n');
    const insertPos = firstNewlinePos >= 0 ? firstNewlinePos + 1 : fullText.length;
    sourceFile.insertText(insertPos, importString);
  } else {
    sourceFile.insertImportDeclaration(0, {
      isTypeOnly: true,
      moduleSpecifier: importRel,
      namedImports: movedNames,
    });
  }
}

function processSourceFile(
  sourceFile: SourceFile,
  project: Project,
  files: string[],
): { movedCount: number; modified: boolean } {
  const filePath = sourceFile.getFilePath();
  if (files.every((f) => f !== filePath)) {
    return { movedCount: 0, modified: false };
  }

  const interfaces = sourceFile.getInterfaces().filter(isTopLevel);
  const typeAliases = sourceFile.getTypeAliases().filter(isTopLevel);

  if (interfaces.length === 0 && typeAliases.length === 0) {
    return { movedCount: 0, modified: false };
  }

  const typesPath = typesCompanionPath(filePath);
  const typesFile = getOrCreateTypesFile(project, typesPath);

  const movedNames = [
    ...moveInterfaces(interfaces, typesFile),
    ...moveTypeAliases(typeAliases, typesFile),
  ];

  if (movedNames.length > 0) {
    addTypeImport(sourceFile, typesPath, movedNames);

    if (!options.dryRun) {
      typesFile.organizeImports();
      sourceFile.organizeImports();
      typesFile.formatText();
      sourceFile.formatText();
    }

    const rel = relative(options.root, filePath);
    console.log(
      `  Moved ${movedNames.length.toString().padStart(2)} symbol(s) from ${rel} -> ${relative(
        options.root,
        typesPath,
      )}`,
    );
  }

  return { movedCount: movedNames.length, modified: movedNames.length > 0 };
}

async function main() {
  console.log('Starting type refactor...');
  if (options.dryRun) {
    console.log('*** DRY RUN enabled: No files will be modified. ***');
  }

  const files = await fg(patterns, { cwd: options.root, ignore, absolute: true });

  if (files.length === 0) {
    console.warn('No files matched the include/exclude patterns. Exiting.');
    console.log(`  Patterns: ${patterns.join(', ')}`);
    console.log(`  Ignored: ${ignore.join(', ')}`);
    return;
  }

  const project = createProject(files);
  console.log(`Scanning ${project.getSourceFiles().length} files...`);

  let movedCount = 0;
  let filesModified = 0;

  for (const sourceFile of project.getSourceFiles()) {
    const result = processSourceFile(sourceFile, project, files);
    movedCount += result.movedCount;
    if (result.modified) filesModified++;
  }

  if (!options.dryRun) {
    console.log('\nSaving all file changes...');
    await project.save();
  }

  console.log(
    `\nDone. Moved ${movedCount} type/interface declaration(s) across ${filesModified} file(s).${
      options.dryRun ? ' (dry run)' : ''
    }`,
  );
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
