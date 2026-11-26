/**
 * Copyright 2026 Mike Odnis
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

/**
 * @file What a module sends to the browser, read from the source: every file in src it reaches
 * through value imports, re-exports and dynamic imports, and every package those name. Type-only
 * imports are erased by the compiler, so they are not followed. Used by the island-imports tests
 * that keep server code out of a client island. Not a test file.
 *
 * @example
 * const { files } = importGraph(ISLAND, { src: SRC, stripComments: true });
 * expect(files.has(SERVER_ONLY_MODULE)).toBe(false);
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface ImportGraphOptions {
  /** The folder `@/` names. */
  readonly src: string;
  /** Extensions of files the walk lists but never reads (data and styles, e.g. '.json'). */
  readonly leaves?: readonly string[];
  /** Drop comments before reading the specifiers, so an import a comment quotes is not followed. */
  readonly stripComments?: boolean;
}

export interface ImportGraph {
  /** Every file in src the entry reaches, itself included. */
  readonly files: ReadonlySet<string>;
  /** Every specifier that names no file in src, such as a package. */
  readonly packages: ReadonlySet<string>;
}

/** `import … from 'x'`, `export … from 'x'`, `import 'x'` and `import('x')`, with their clause. */
const SPECIFIERS =
  /(?:^|[\s;])(?:import|export)\s+([^'";]*?)\s*from\s*['"]([^'"]+)['"]|(?:^|[\s;])import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm;

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs'] as const;
const SOURCE_FILE = /\.(m?js|tsx?)$/;

/** A clause that brings in types only: `type {…}`, or braces whose every name is `type`. */
function typeOnly(clause: string): boolean {
  if (/^type\s/.test(clause)) return true;
  const braces = /^\{([^}]*)\}$/.exec(clause.trim());
  if (!braces) return false;
  const names = (braces[1] ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  return names.length > 0 && names.every((name) => name.startsWith('type '));
}

/** The file in src a specifier names, or null for a package or a file the walk does not list. */
function resolve(
  specifier: string,
  from: string,
  src: string,
  leaves: readonly string[],
): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = path.join(src, specifier.slice(2));
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(from), specifier);
  else return null;
  const listed = (file: string): boolean =>
    SOURCE_FILE.test(file) || leaves.some((extension) => file.endsWith(extension));
  const tries = [
    base,
    ...[...SOURCE_EXTENSIONS, ...leaves].map((extension) => `${base}${extension}`),
    ...['index.ts', 'index.tsx'].map((index) => path.join(base, index)),
  ];
  return tries.find((file) => listed(file) && existsSync(file)) ?? null;
}

/** `source` with its block and line comments removed. */
const withoutComments = (source: string): string =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/(^|[^:'"])\/\/.*$/gm, '$1');

/** Every file in src `entry` reaches through value imports, and every package they name. */
export function importGraph(entry: string, options: ImportGraphOptions): ImportGraph {
  const { src, leaves = [], stripComments = false } = options;
  const files = new Set<string>([entry]);
  const packages = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.shift();
    if (!file || leaves.some((extension) => file.endsWith(extension))) continue;
    const raw = readFileSync(file, 'utf8');
    const source = stripComments ? withoutComments(raw) : raw;
    for (const match of source.matchAll(SPECIFIERS)) {
      const [, clause, fromSpecifier, bare, dynamic] = match;
      const specifier = fromSpecifier ?? bare ?? dynamic ?? '';
      if (!specifier || (fromSpecifier && typeOnly(clause ?? ''))) continue;
      const target = resolve(specifier, file, src, leaves);
      if (!target) packages.add(specifier);
      else if (!files.has(target)) {
        files.add(target);
        queue.push(target);
      }
    }
  }

  return { files, packages };
}
