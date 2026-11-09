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
 * @file The stuck-canvas utility in src/styles/globals.css, which the FilterBar and an IndexTable's
 * year bar and column labels stick with. Painted on the canvas at rest, they read as darker boxes
 * over the page's light glow; so where the browser can tell a sticky element is stuck
 * (container-type: scroll-state), they are clear at rest and painted (with an optional edge,
 * --stuck-edge) only while stuck, at once, so no row ever shows through a half-painted bar. Where
 * it cannot, they are always painted, as before.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { declarations, declaredValue, findRule, styleRules } from './css-rules';

const CSS = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8');
const SOURCE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const RULES = styleRules(CSS);
const UTILITY = '@utility stuck-canvas';
const SUPPORTS = '@supports (container-type: scroll-state)';
const STUCK = '@container scroll-state(stuck: top)';

/** The body of the block `prelude` opens in `source`, its braces balanced. */
function blockBody(source: string, prelude: string): string {
  const head = source.indexOf(`${prelude} {`);
  if (head < 0) throw new Error(`no "${prelude}" block`);
  const open = source.indexOf('{', head);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`"${prelude}" never closes`);
}

/** A block's own declarations, its nested rules left out. */
function ownDeclarations(body: string): Record<string, string> {
  let flat = body;
  for (let previous = ''; flat !== previous; ) {
    previous = flat;
    flat = flat.replace(/[^;{}]*\{[^{}]*\}/g, '');
  }
  return Object.fromEntries(declarations(flat));
}

describe('stuck-canvas', () => {
  it('paints the canvas, with its edge, where a browser cannot tell it is stuck', () => {
    expect(ownDeclarations(blockBody(SOURCE, UTILITY))).toEqual({
      'background-color': 'var(--canvas)',
      'box-shadow': 'var(--stuck-edge, none)',
    });
  });

  it('is clear at rest where a browser can tell, with a ::before ready to paint it', () => {
    const before = findRule(RULES, '&::before', [UTILITY, SUPPORTS]);

    expect(ownDeclarations(blockBody(blockBody(SOURCE, UTILITY), SUPPORTS))).toEqual({
      'container-type': 'scroll-state',
      'background-color': 'transparent',
      'box-shadow': 'none',
    });
    expect(Object.fromEntries(declarations(before.body))).toEqual({
      content: '""',
      position: 'absolute',
      inset: '0',
      'z-index': '-1',
      'pointer-events': 'none',
    });
  });

  it('paints the canvas and its edge only while stuck, at once', () => {
    const stuck = findRule(RULES, '&::before', [UTILITY, SUPPORTS, STUCK]);

    expect(declaredValue(stuck, 'background-color')).toBe('var(--canvas)');
    expect(declaredValue(stuck, 'box-shadow')).toBe('var(--stuck-edge, none)');
    // A fade would let rows show through a half-painted bar.
    expect(blockBody(SOURCE, UTILITY)).not.toMatch(/transition|animation/);
  });
});
