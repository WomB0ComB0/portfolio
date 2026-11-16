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
 * @file Sticky controls keep sharp foregrounds above a translucent background-only blur.
 * Unsupported blur and accessibility transparency preferences retain opaque surfaces.
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
const GLASS = '@supports (backdrop-filter: blur(1px))';

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
  it('keeps filters and labels unfiltered, with a separate non-interactive backplate', () => {
    const root = ownDeclarations(blockBody(SOURCE, UTILITY));
    expect(root['background-color']).toBe('transparent');
    expect(root).not.toHaveProperty('opacity');
    expect(root).not.toHaveProperty('filter');
    expect(root).not.toHaveProperty('backdrop-filter');
    const backplate = findRule(RULES, '&::before', [UTILITY]);
    expect(declaredValue(backplate, 'pointer-events')).toBe('none');
    expect(declaredValue(backplate, 'z-index')).toBe('-1');
    expect(declaredValue(backplate, 'backdrop-filter')).toBe('var(--stuck-backdrop)');
  });

  it('uses a translucent palette fill only when background blur is supported', () => {
    const root = ownDeclarations(blockBody(SOURCE, UTILITY));
    expect(root['--stuck-fill']).toBe('var(--canvas)');
    expect(root['--stuck-backdrop']).toBe('none');
    const glass = ownDeclarations(blockBody(blockBody(SOURCE, UTILITY), GLASS));
    expect(glass['--stuck-fill']).toBe('var(--sticky-canvas)');
    expect(glass['--stuck-backdrop']).toMatch(/^blur\([1-9][\d.]*px\)$/);
  });

  it('keeps the backplate clear at rest and paints it only while pinned', () => {
    const rest = findRule(RULES, '&::before', [UTILITY, SUPPORTS]);
    const stuck = findRule(RULES, '&::before', [UTILITY, SUPPORTS, STUCK]);
    expect(declaredValue(rest, 'background-color')).toBe('transparent');
    expect(declaredValue(rest, 'backdrop-filter')).toBe('none');
    expect(declaredValue(stuck, 'background-color')).toBe('var(--stuck-fill)');
    expect(declaredValue(stuck, 'backdrop-filter')).toBe('var(--stuck-backdrop)');
    expect(declaredValue(stuck, 'box-shadow')).toBe('var(--stuck-edge, none)');
  });

  it('lets the Places form transmit the backplate while pinned instead of covering it', () => {
    const selector = '&[data-density="bar"] > form';
    const rest = findRule(RULES, selector, [UTILITY, SUPPORTS]);
    const pinned = findRule(RULES, selector, [UTILITY, SUPPORTS, STUCK]);
    expect(declaredValue(rest, 'background-color')).toBe('var(--surface-1)');
    expect(declaredValue(pinned, 'background-color')).toBe('var(--stuck-tile-fill)');
  });

  it('honors reduced transparency and forced colours with opaque unblurred surfaces', () => {
    for (const media of [
      '@media (prefers-reduced-transparency: reduce)',
      '@media (forced-colors: active)',
    ]) {
      const rule = ownDeclarations(blockBody(blockBody(SOURCE, UTILITY), media));
      expect(rule['--stuck-backdrop']).toBe('none');
      expect(rule['--stuck-fill']).toBe(
        media.includes('forced-colors') ? 'Canvas' : 'var(--canvas)',
      );
    }
  });
});
