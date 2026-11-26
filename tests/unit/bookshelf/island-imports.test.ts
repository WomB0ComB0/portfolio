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
 * @file Enforces server/client compartmentalization on `/bookshelf` and `/bookshelf/free`:
 * client islands may import isomorphic types and constants (`free-books-types.ts`,
 * `bookshelf-search-params.ts`, `normalise.ts`), but must NEVER transitively pull server loaders,
 * Upstash Redis manifest code, threat-intel verifiers, the security manifest JSON, DOMPurify, or
 * marked into client bundles.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');
const BOOKSHELF = path.join(SRC, 'app/(routes)/(main)/(personal)/bookshelf');

const CLIENT_ISLANDS = [
  path.join(BOOKSHELF, '_components/bookshelf-stage.tsx'),
  path.join(BOOKSHELF, 'free/_components/free-books-explorer.tsx'),
];

const FORBIDDEN_MODULES = [
  path.join(SRC, 'lib/books/free-programming-books.ts'),
  path.join(SRC, 'lib/books/free-books-loader.ts'),
  path.join(SRC, 'lib/books/free-books-manifest-store.ts'),
  path.join(SRC, 'lib/books/free-books-verifier.ts'),
  path.join(SRC, 'data/free-books-security.json'),
  path.join(BOOKSHELF, '_lib/load-bookshelf.ts'),
];

const FORBIDDEN_PACKAGES = new Set(['dompurify', 'marked', 'server-only']);

const SPECIFIERS =
  /(?:^|[\s;])(?:import|export)\s+([^'";]*?)\s*from\s*['"]([^'"]+)['"]|(?:^|[\s;])import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm;

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

function resolveLocal(specifier: string, from: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = path.join(SRC, specifier.slice(2));
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(from), specifier);
  else return null;

  const candidates = [
    base,
    ...['.ts', '.tsx', '.js', '.mjs', '.json'].map((ext) => `${base}${ext}`),
    ...['index.ts', 'index.tsx'].map((idx) => path.join(base, idx)),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function collectValueGraph(entry: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>([entry]);
  const packages = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.shift();
    if (!file || file.endsWith('.json') || file.endsWith('.css')) continue;
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(SPECIFIERS)) {
      const clause = match[1] ?? '';
      const specifier = match[2] ?? match[3] ?? match[4] ?? '';
      if (!specifier || (match[2] && typeOnly(clause))) continue;

      const resolved = resolveLocal(specifier, file);
      if (resolved) {
        if (!files.has(resolved)) {
          files.add(resolved);
          queue.push(resolved);
        }
      } else {
        packages.add(specifier);
      }
    }
  }

  return { files, packages };
}

describe('bookshelf client island compartmentalization', () => {
  it.each(CLIENT_ISLANDS.map((file) => [path.relative(ROOT, file), file] as const))(
    '%s never reaches server loaders, Redis manifest store, security JSON, or DOMPurify',
    (_label, islandPath) => {
      const { files, packages } = collectValueGraph(islandPath);

      for (const forbidden of FORBIDDEN_MODULES) {
        expect(files.has(forbidden), path.relative(ROOT, forbidden)).toBe(false);
      }
      for (const pkg of FORBIDDEN_PACKAGES) {
        expect(packages.has(pkg), pkg).toBe(false);
      }
    },
  );
});
