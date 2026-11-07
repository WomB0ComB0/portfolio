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
 * @file The console primitives the home bento and the Ledger (/certifications) render follow the
 * refined type: no class string in them sets the mono face, upper case, the chrome's tracked label
 * or a viewport-sized figure. The mono face is left to the mono-token utility, which a tile applies
 * to a machine token itself. PageShell and StatStrip had their refined pass with the Ledger.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HOME_PRIMITIVES = [
  'freshness.tsx',
  'live-number.tsx',
  'page-shell.tsx',
  'segment-bar.tsx',
  'sparkline.tsx',
  'stat-strip.tsx',
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

/**
 * A forbidden utility as a class: alone or after a variant (`sm:`, `[&_span]:`), with or without
 * the important mark either side (`!uppercase`, `uppercase!`) and a line-height modifier
 * (`text-hero/tight`).
 */
const FORBIDDEN =
  /(?:^|[\s:])!?(?:label-mono|font-mono|uppercase|tracking-label|text-(?:label|stat|display|hero))!?(?=[\s/]|$)/;

describe('the forbidden type classes', () => {
  // Review finding CR611-13: a variant prefix, the important mark or a line-height modifier let a
  // forbidden utility through.
  it.each([
    'sm:uppercase',
    'hover:font-mono',
    'md:text-hero',
    'group-hover/tile:tracking-label',
    '[&_span]:uppercase',
    '!uppercase',
    'uppercase!',
    'text-hero/tight',
    'text-label/5',
    'md:text-display/none',
  ])('catches %s', (className) => {
    expect(FORBIDDEN.test(`flex ${className} gap-2`)).toBe(true);
    expect(FORBIDDEN.test(className)).toBe(true);
  });

  it.each(['normal-case', 'text-label-foo', 'aria-label', 'text-muted-foreground'])(
    'lets %s through',
    (className) => {
      expect(FORBIDDEN.test(`flex ${className} gap-2`)).toBe(false);
      expect(FORBIDDEN.test(className)).toBe(false);
    },
  );
});

describe('refined type in the console primitives', () => {
  it.each(HOME_PRIMITIVES)('%s sets no mono face, capitals or viewport-sized figure', (file) => {
    const source = readFileSync(join(process.cwd(), 'src/components/console', file), 'utf8');
    const offending = quotedStrings(source).filter((text) => FORBIDDEN.test(text));

    expect(offending).toEqual([]);
  });
});
