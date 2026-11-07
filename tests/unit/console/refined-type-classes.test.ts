// @vitest-environment node

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

/**
 * @file The console primitives the home bento renders follow the refined type: no class string in
 * them sets the mono face, upper case, the chrome's tracked label or a viewport-sized figure. The
 * mono face is left to the mono-token utility, which a tile applies to a machine token itself.
 * PageShell and StatStrip are not rendered on the home page and keep the chrome's type.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HOME_PRIMITIVES = [
  'freshness.tsx',
  'live-number.tsx',
  'segment-bar.tsx',
  'sparkline.tsx',
  'stat-tile.tsx',
  'status-dot.tsx',
  'tile-link.tsx',
  'tile.tsx',
] as const;

/** The quoted strings of a source file: where its class names live. */
function quotedStrings(source: string): string[] {
  return [...source.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)].map(
    ([, single, double, template]) => single ?? double ?? template ?? '',
  );
}

const FORBIDDEN =
  /(?:^|\s)(?:label-mono|font-mono|uppercase|tracking-label|text-(?:label|stat|display|hero))(?=\s|$)/;

describe('refined type in the home console primitives', () => {
  it.each(HOME_PRIMITIVES)('%s sets no mono face, capitals or viewport-sized figure', (file) => {
    const source = readFileSync(join(process.cwd(), 'src/components/console', file), 'utf8');
    const offending = quotedStrings(source).filter((text) => FORBIDDEN.test(text));

    expect(offending).toEqual([]);
  });
});
