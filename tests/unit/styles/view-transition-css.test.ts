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
 * @file The view-transition rules in src/styles/globals.css that the FilterBar's crossfade relies
 * on: the overlay never takes the pointer, the page itself does not crossfade during a filter
 * change (only the results do, inside their box, clipped to the clear band, on the motion
 * tokens), and reduced motion stops every view-transition animation. The global reduced-motion
 * rule targets *, ::before and ::after, which never match ::view-transition-* pseudo-elements, so
 * these need their own rule (a probe showed them still running 250ms under reduced motion).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { declaredValue, findRule, styleRules } from './css-rules';

const RULES = styleRules(readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8'));
const REDUCE = '@media (prefers-reduced-motion: reduce)';

describe('view transitions', () => {
  it('never take the pointer while one runs', () => {
    expect(declaredValue(findRule(RULES, '::view-transition'), 'pointer-events')).toBe('none');
  });

  it('keep the page still during a filter change: only the results crossfade', () => {
    const old = findRule(RULES, ':root[data-filter-transition]::view-transition-old(root)');
    const next = findRule(RULES, ':root[data-filter-transition]::view-transition-new(root)');

    expect(declaredValue(old, 'animation')).toBe('none');
    expect(declaredValue(old, 'opacity')).toBe('0');
    expect(declaredValue(next, 'animation')).toBe('none');
  });

  it('crossfade the results inside their box, clipped to the clear band, on the tokens', () => {
    const group = findRule(RULES, '::view-transition-group(filter-results)');
    const pair = findRule(RULES, '::view-transition-image-pair(filter-results)');
    const out = findRule(RULES, '::view-transition-old(filter-results)');
    const into = findRule(RULES, '::view-transition-new(filter-results)');

    expect(declaredValue(group, 'animation')).toBe('none');
    expect(declaredValue(group, 'clip-path')).toBe(
      'inset(var(--filter-vt-top, 0) 0 var(--filter-vt-bottom, 0) 0)',
    );
    expect(declaredValue(pair, 'overflow')).toBe('clip');
    expect(declaredValue(out, 'animation')).toBe(
      'filter-fade-out var(--motion-instant) var(--ease-effect) both',
    );
    expect(declaredValue(into, 'animation')).toBe(
      'filter-fade-in var(--motion-base) var(--ease-effect) both',
    );
    // Opacity only: compositor work, nothing that moves or lays out.
    expect(findRule(RULES, '@keyframes filter-fade-out').body).toMatch(
      /^\s*to\s*\{\s*opacity:\s*0;?\s*\}\s*$/,
    );
    expect(findRule(RULES, '@keyframes filter-fade-in').body).toMatch(
      /^\s*from\s*\{\s*opacity:\s*0;?\s*\}\s*$/,
    );
  });

  it('stop under reduced motion, every group and image of every transition', () => {
    const rule = findRule(
      RULES,
      '::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*)',
      [REDUCE],
    );

    expect(declaredValue(rule, 'animation')).toBe('none !important');
  });
});
