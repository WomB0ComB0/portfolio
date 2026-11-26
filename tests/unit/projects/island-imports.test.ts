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

import path from 'node:path';
import { importGraph } from '@tests/utils/import-graph';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');
const PROJECTS = path.join(SRC, 'app/(routes)/(main)/(professioal)/projects');
const ISLAND = path.join(PROJECTS, '_components/projects-index.tsx');
const ESTIMATE = path.join(PROJECTS, '_lib/kind-chip-budget.ts');

describe('the /projects filter island', () => {
  const graph = importGraph(ISLAND, { src: SRC, stripComments: true }).files;

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
