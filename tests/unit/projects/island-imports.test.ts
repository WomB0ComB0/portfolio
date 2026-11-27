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
 * through any module in src, may reach that estimate. A project's parts stay on the server too:
 * the index turns them into one number per card (repoCount), so the island never reaches the
 * parts view model (_lib/project-parts.ts) or the repository rules Studio shares
 * (src/sanity/project-part-rules.ts). Each guarded path must exist, so a moved module fails here
 * instead of passing unchecked. Read from the source: every value import, re-export and dynamic
 * import is followed; type-only imports are erased by the compiler, so they are not.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { importGraph } from '@tests/utils/import-graph';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');
const PROJECTS = path.join(SRC, 'app/(routes)/(main)/(professioal)/projects');
const ISLAND = path.join(PROJECTS, '_components/projects-index.tsx');
const ESTIMATE = path.join(PROJECTS, '_lib/kind-chip-budget.ts');
/** Server-only: the island gets each card's repoCount, never the parts themselves. */
const PARTS_MODULES = [
  path.join(PROJECTS, '_lib/project-parts.ts'),
  path.join(SRC, 'sanity/project-part-rules.ts'),
];

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

  it.each(PARTS_MODULES.map((file) => [path.relative(ROOT, file), file] as const))(
    'never imports %s, which only the server reads',
    (_label, file) => {
      // A moved or renamed module would pass the check below without ever being looked for.
      expect(existsSync(file)).toBe(true);
      expect(graph.has(file)).toBe(false);
    },
  );
});
