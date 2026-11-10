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
 * @file The checks the /places stylesheet tests share, on synthetic CSS: specificity as
 * Selectors 4 counts it, and the reduced-motion check that catches a reset losing on specificity
 * (the wall's first reset, `.viewport .card:hover`, lost to its hover rule's :not()). Also the
 * calc evaluator the open view's width tests use.
 */

import { describe, expect, it } from 'vitest';

import { evaluateCss } from './css-calc';
import {
  losingReducedMotionResets,
  nonCompositorTransitions,
  specificity,
  styleRules,
  subjectOf,
} from './module-css';

const HOVER = `
  @media (hover: hover) and (pointer: fine) {
    .viewport:not([data-dragging="true"]) .card:hover { translate: 0 -3px; }
  }
`;

describe('specificity', () => {
  it.each([
    ['.card', [0, 1, 0]],
    ['.viewport .card:hover', [0, 3, 0]],
    ['.viewport:not([data-dragging="true"]) .card:hover', [0, 4, 0]],
    ['.thumb:not(:hover, :focus-visible)::after', [0, 2, 1]],
    [':where(.a .b) .c', [0, 1, 0]],
    ['.sliver:nth-child(2)', [0, 2, 0]],
    ['#id a[href]', [1, 1, 1]],
  ] as const)('%s is %j', (selector, expected) => {
    expect(specificity(selector)).toEqual(expected);
  });

  it("names a selector's subject, its last compound", () => {
    expect(subjectOf('.viewport:not([data-dragging="true"]) .card:hover')).toBe('.card:hover');
    expect(subjectOf('.link:hover > .sliver')).toBe('.sliver');
  });
});

describe('losingReducedMotionResets', () => {
  it('flags a reset that loses to the hover rule on specificity', () => {
    const css = `${HOVER} @media (prefers-reduced-motion: reduce) { .viewport .card:hover { translate: none; } }`;
    expect(losingReducedMotionResets(styleRules(css))).toEqual([
      '.viewport:not([data-dragging="true"]) .card:hover { translate }',
    ]);
  });

  it('flags a motion with no reset at all, and passes a reset with the same selector', () => {
    expect(losingReducedMotionResets(styleRules(HOVER))).toHaveLength(1);
    const css = `${HOVER} @media (prefers-reduced-motion: reduce) { .viewport:not([data-dragging="true"]) .card:hover { translate: none; } }`;
    expect(losingReducedMotionResets(styleRules(css))).toEqual([]);
  });

  it('leaves a resting transform alone: only a hover, press or focus has to hold still', () => {
    expect(losingReducedMotionResets(styleRules('.sliver { transform: scale(0.5); }'))).toEqual([]);
  });
});

describe('nonCompositorTransitions', () => {
  it("reads a cubic-bezier's commas as part of the timing, not as more properties", () => {
    const css =
      '.card { transition: transform 200ms cubic-bezier(0.2, 0, 0, 1), opacity 150ms ease; }';
    expect(nonCompositorTransitions(styleRules(css))).toEqual([]);
  });

  it('still flags a layout property beside it', () => {
    const css = '.card { transition: transform 200ms cubic-bezier(0.2, 0, 0, 1), width 200ms; }';
    expect(nonCompositorTransitions(styleRules(css))).toEqual(['.card: width']);
  });
});

describe('evaluateCss', () => {
  it('works out calc, min, max, clamp, var and the window units in px', () => {
    const window = { vw: 1440, vh: 900, vars: { '--r': '0.5', '--h': 'calc(72vh - 6.25rem)' } };
    expect(evaluateCss('min(26rem, calc(100vw - 4rem))', { vw: 390, vh: 844 })).toBe(326);
    expect(evaluateCss('max(10px, calc(var(--h) * var(--r) + 1rem))', window)).toBe(290);
    expect(evaluateCss('clamp(26rem, 68vh, 44rem)', window)).toBe(612);
    expect(evaluateCss('min(100%, 300px)', { ...window, percentOf: 200 })).toBe(200);
    expect(evaluateCss('calc(100dvh - 4rem)', window)).toBe(836);
  });

  it('refuses text it cannot read', () => {
    expect(() => evaluateCss('min(1px, 2px', { vw: 1, vh: 1 })).toThrow();
    expect(() => evaluateCss('1px ; 2px', { vw: 1, vh: 1 })).toThrow();
  });
});
