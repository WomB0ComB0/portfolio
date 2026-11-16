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
 * @file What the /projects filter island sends to the browser. The Kind chips are chosen on the
 * server (kind-chip-budget.ts: about 240 lines of glyph-width tables and an Intl.Segmenter), and
 * the island receives the chosen kinds as data, so nothing the island imports, directly or
 * through any module in src, may reach that estimate. Read from the source: every value import,
 * re-export and dynamic import is followed; type-only imports are erased by the compiler, so
 * they are not.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');
const PROJECTS = path.join(SRC, 'app/(routes)/(main)/(professioal)/projects');
const ISLAND = path.join(PROJECTS, '_components/projects-index.tsx');
const ESTIMATE = path.join(PROJECTS, '_lib/kind-chip-budget.ts');

/** `import … from 'x'`, `export … from 'x'`, `import 'x'` and `import('x')`, with their clause. */
const SPECIFIERS =
  /(?:^|[\s;])(?:import|export)\s+([^'";]*?)\s*from\s*['"]([^'"]+)['"]|(?:^|[\s;])import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm;

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

/** The source file a specifier names inside src, or null for a package. */
function resolve(specifier: string, from: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = path.join(SRC, specifier.slice(2));
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(from), specifier);
  else return null;
  const tries = [
    base,
    ...['.ts', '.tsx', '.js', '.mjs'].map((ext) => `${base}${ext}`),
    ...['index.ts', 'index.tsx'].map((index) => path.join(base, index)),
  ];
  return tries.find((file) => existsSync(file) && /\.(m?js|tsx?)$/.test(file)) ?? null;
}

/** Every file in src the module reaches through value imports, itself included. */
function reached(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8')
      .replaceAll(/\/\*[\s\S]*?\*\//g, '')
      .replaceAll(/(^|[^:'"])\/\/.*$/gm, '$1');
    for (const match of source.matchAll(SPECIFIERS)) {
      const [, clause, fromSpecifier, bare, dynamic] = match;
      if (fromSpecifier && typeOnly(clause ?? '')) continue;
      const target = resolve(fromSpecifier ?? bare ?? dynamic ?? '', file);
      if (target) queue.push(target);
    }
  }
  return seen;
}

describe('the /projects filter island', () => {
  const graph = reached(ISLAND);

  it('is read from its real source (the walk reaches the schema it builds)', () => {
    const names = [...graph].map((file) => path.basename(file));

    expect(names).toContain('projects-index.tsx');
    expect(names.some((name) => /^project-(schema|filters)\.ts$/.test(name))).toBe(true);
  });

  it('never imports the Kind-chip width estimate, which only the server runs', () => {
    const route = [...graph]
      .filter((file) => file === ESTIMATE)
      .map((file) => path.relative(ROOT, file));

    expect(route).toEqual([]);
  });
});
