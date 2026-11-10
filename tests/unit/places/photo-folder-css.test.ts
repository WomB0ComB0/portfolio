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
 * @file The quiet folder's look (photo-folder.module.css), as the owner kept it from the lab
 * ("Keep B (quiet)"): palette tokens only; the slivers fan and the flap falls open by transform
 * on the house spring (in over --motion-spring-in, back over --motion-spring-out), the light
 * fades by opacity on --ease-effect; hover only with a fine pointer; keyboard focus opens it at
 * once; a press is a transform; reduced motion keeps the rest pose; no lab-only rules; the
 * pending spinner sits outside the pill, so the lit pill hugs its content as in the lab.
 */

import { describe, expect, it } from 'vitest';

import { declaredValue, findRule } from '../styles/css-rules';
import {
  FINE_POINTER_MEDIA,
  hoverOutsideFinePointer,
  nonCompositorTransitions,
  nonKebabClasses,
  OFF_PALETTE,
  PLACES_DIR,
  REDUCED_MOTION_MEDIA,
  readCss,
  styleRules,
  unresolvedVars,
} from './module-css';

const CSS = readCss(`${PLACES_DIR}/_components/photo-folder.module.css`);
const RULES = styleRules(CSS);
const value = (selector: string, property: string, conditions: readonly string[] = []) =>
  declaredValue(findRule(RULES, selector, conditions), property);

const REST_SLIVER =
  'translate(var(--rest-x), calc(var(--ph) * -0.6)) rotate(var(--rest-r)) scale(0.5)';
const OPEN_SLIVER = 'translate(var(--open-x), var(--open-y)) rotate(var(--open-r)) scale(1)';
const REST_FLAP = 'perspective(9rem) rotateX(-14deg)';
const OPEN_FLAP = 'perspective(9rem) rotateX(-38deg)';

describe('photo-folder.module.css', () => {
  it('uses palette tokens only, and every var() resolves', () => {
    expect(CSS).not.toMatch(OFF_PALETTE);
    expect(unresolvedVars(CSS)).toEqual([]);
  });

  it('is the quiet tone: the flap on brand-subtle with a brand-edge rim', () => {
    expect(value('.front', 'background')).toBe('var(--brand-subtle)');
    expect(value('.front', 'box-shadow')).toBe('inset 0 0 0 1px var(--brand-edge)');
    expect(value('.back', 'background')).toBe('var(--surface-3)');
  });

  it('keeps no lab-only rules: no vivid tone and no held-open state', () => {
    expect(CSS).not.toMatch(/\.vivid|\.quiet|data-open/);
    expect(nonKebabClasses(CSS)).toEqual([]);
  });

  it('moves only transform and opacity, on the house spring and the effect curve', () => {
    expect(nonCompositorTransitions(RULES)).toEqual([]);
    expect(value('.sliver', 'transition')).toBe(
      'transform var(--motion-spring-out) var(--ease-spring)',
    );
    expect(value('.front', 'transition')).toBe(
      'transform var(--motion-spring-out) var(--ease-spring)',
    );
    expect(value('.link::before', 'transition')).toBe(
      'opacity var(--motion-slow) var(--ease-effect)',
    );
  });

  it('flips the label colour with no transition (the base link rule fades colour)', () => {
    expect(value('.link', 'transition')).toMatch(/^transform /);
    expect(value('.link:hover', 'color', [FINE_POINTER_MEDIA])).toBe('var(--fg)');
  });

  it('opens on hover only with a fine pointer, springing in faster than it settles', () => {
    expect(hoverOutsideFinePointer(RULES)).toEqual([]);
    expect(value('.link:hover .sliver', 'transform', [FINE_POINTER_MEDIA])).toBe(OPEN_SLIVER);
    expect(value('.link:hover .sliver', 'transition-duration', [FINE_POINTER_MEDIA])).toBe(
      'var(--motion-spring-in)',
    );
    expect(value('.link:hover .front', 'transform', [FINE_POINTER_MEDIA])).toBe(OPEN_FLAP);
    expect(value('.link:hover::before', 'opacity', [FINE_POINTER_MEDIA])).toBe('1');
  });

  it('opens at once on keyboard focus, with no animation', () => {
    expect(value('.link:focus-visible .sliver', 'transform')).toBe(OPEN_SLIVER);
    expect(value('.link:focus-visible .sliver', 'transition-duration')).toBe('0s');
    expect(value('.link:focus-visible .front', 'transition-duration')).toBe('0s');
    expect(value('.link:focus-visible::before', 'opacity')).toBe('1');
  });

  it("keeps the pending spinner out of the pill's flow, so the lit pill hugs its label", () => {
    expect(value('.link', 'position')).toBe('relative');
    expect(value('.pending', 'position')).toBe('absolute');
    expect(value('.pending', 'inset-inline-start')).toBe('calc(100% + 0.5rem)');
    expect(value('.pending', 'margin-inline-start')).toBeUndefined();
  });

  it('presses by transform only', () => {
    expect(value('.link:active', 'transform')).toMatch(/^scale\(/);
  });

  it('holds the rest pose in every state under reduced motion', () => {
    const sliver = findRule(
      RULES,
      '.link .sliver, .link:hover .sliver, .link:focus-visible .sliver',
      [REDUCED_MOTION_MEDIA],
    );
    const flap = findRule(RULES, '.link .front, .link:hover .front, .link:focus-visible .front', [
      REDUCED_MOTION_MEDIA,
    ]);
    expect(declaredValue(sliver, 'transform')).toBe(REST_SLIVER);
    expect(declaredValue(flap, 'transform')).toBe(REST_FLAP);
    expect(value('.link:active', 'transform', [REDUCED_MOTION_MEDIA])).toBe('none');
  });
});
