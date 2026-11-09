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
 * @file The photo strip's look (photo-strip.module.css), as the owner approved it in the lab
 * review (station 1, B): one row at every width (thumbnails 4.5 to 10 rem, centred when few,
 * scrolling when many; 104 px on a phone); the shown photo's steady 1 px rim; pointing at another
 * dims the rest, the shown one included, to 0.55 under a canvas layer that lifts 60 ms late, and
 * lights and lifts only the pointed one with the tile hover's light (--shadow-lift, 3 px on the
 * house spring), with a mouse only; keyboard focus gets the same light at once and never moves;
 * reduced motion never lifts; no JavaScript, no strip. Only opacity and translate move, and every
 * colour is a palette token. The stylesheet is read as text (Vitest runs no PostCSS).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  type CssRule,
  declarations,
  declaredValue,
  findRule,
  styleRules,
} from '../styles/css-rules';

// Vitest runs from the repository root; under jsdom import.meta.url is not a file: URL.
const STRIP_CSS_PATH = join(
  process.cwd(),
  'src/app/(routes)/(main)/(personal)/places/[placeId]/_components/photo-strip.module.css',
);
/** The stylesheet without its comments, which name what it avoids. */
const STRIP_CSS = readFileSync(STRIP_CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const GLOBALS_CSS = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8');

const RULES = styleRules(STRIP_CSS);
const rule = (selector: string, conditions: readonly string[] = []): CssRule =>
  findRule(RULES, selector, conditions);
const value = (selector: string, property: string, conditions: readonly string[] = []) =>
  declaredValue(rule(selector, conditions), property);

const MOUSE = '@media (hover: hover) and (pointer: fine)';
const PHONE = '@media (width < 40rem)';
const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';
const NO_SCRIPT = '@media (scripting: none)';
const FORCED_COLOURS = '@media (forced-colors: active)';

const DIM = '0.55';
/** The focus ring: a 2 px outline 2 px out. */
const RING_PX = 4;
const LIFT_PX = 3;
const REM_PX = 16;

/** A length in px, from rem or px. */
const px = (length: string): number => {
  const match = /^(-?\d*\.?\d+)(rem|px)$/.exec(length.trim());
  if (!match) throw new Error(`not a rem or px length: ${length}`);
  return Number(match[1]) * (match[2] === 'rem' ? REM_PX : 1);
};

/** The four sides of a padding shorthand, as top, right, bottom, left in px. */
const sides = (shorthand: string): [number, number, number, number] => {
  const [top = '0', right = top, bottom = top, left = right] = shorthand.split(/\s+/);
  return [px(top), px(right), px(bottom), px(left)];
};

describe('photo-strip.module.css: one row at every width', () => {
  it('shares the row out between 4.5 and 10 rem a thumbnail, from the photo count', () => {
    expect(value('.strip', 'display')).toBe('grid');
    expect(value('.strip', 'grid-auto-flow')).toBe('column');
    expect(value('.strip', 'grid-auto-columns')).toMatch(
      /^clamp\(4\.5rem, calc\(.*var\(--n, 1\).*\), 10rem\)$/,
    );
  });

  it('centres a few thumbnails, and scrolls sideways (inside itself) when they do not fit', () => {
    expect(value('.strip', 'justify-content')).toBe('safe center');
    expect(value('.strip', 'overflow-x')).toBe('auto');
    expect(value('.strip', 'overscroll-behavior-x')).toBe('contain');
  });

  it('keeps 4:3 thumbnails, whatever the photo', () => {
    expect(value('.thumb', 'aspect-ratio')).toBe('4 / 3');
    expect(value('.img', 'object-fit')).toBe('cover');
  });

  it('gives a phone a sideways strip of 104 px thumbnails from its start', () => {
    expect(px(value('.strip', 'grid-auto-columns', [PHONE]) ?? '')).toBe(104);
    expect(value('.strip', 'justify-content', [PHONE])).toBe('start');
  });

  it('leaves room inside the scroller for the focus ring and the lift', () => {
    const [top, right, bottom, left] = sides(value('.strip', 'padding') ?? '');

    expect(value('.thumb:focus-visible', 'outline')).toBe('2px solid var(--focus)');
    expect(value('.thumb:focus-visible', 'outline-offset')).toBe('2px');
    expect(top).toBeGreaterThanOrEqual(8);
    expect(top).toBeGreaterThanOrEqual(RING_PX + LIFT_PX);
    expect(bottom).toBeGreaterThanOrEqual(8);
    expect(Math.min(left, right)).toBeGreaterThanOrEqual(RING_PX);
    // The padding sits in the margin, so the thumbnails line up with the photo frame's edges.
    expect(px(value('.strip', 'margin-inline') ?? '')).toBe(-left);
  });
});

describe('photo-strip.module.css: the shown photo, the dim and the light', () => {
  it("marks the shown photo with a steady 1 px brand rim, under the dim's layer", () => {
    expect(value('.thumb::before', 'box-shadow')).toBe('inset 0 0 0 1px var(--brand-rim)');
    expect(value('.thumb[aria-current="true"]::before', 'opacity')).toBe('1');
    expect(Number(value('.thumb::before', 'z-index'))).toBeLessThan(
      Number(value('.thumb::after', 'z-index')),
    );
  });

  it('dims every thumbnail but the one pointed at, the shown one too, under a canvas layer', () => {
    expect(value('.thumb::after', 'background')).toBe('var(--canvas)');
    expect(value('.strip:has(.thumb:hover) .thumb:not(:hover)::after', 'opacity', [MOUSE])).toBe(
      DIM,
    );
  });

  it('dims at once and lifts the dim 60 ms late, so crossing a gap never flashes the strip', () => {
    expect(value('.thumb::after', 'transition')).toBe(
      'opacity var(--motion-base) var(--ease-effect) 60ms',
    );
    expect(
      value('.strip:has(.thumb:hover) .thumb:not(:hover)::after', 'transition-delay', [MOUSE]),
    ).toBe('0s');
    expect(value('.thumb:hover::after', 'transition-delay', [MOUSE])).toBe('0s');
  });

  it("lights only the one pointed at with the tile hover's light, over the dim", () => {
    expect(value('.light::before', 'box-shadow')).toBe('var(--shadow-lift)');
    expect(Number(value('.light', 'z-index'))).toBeGreaterThan(
      Number(value('.thumb::after', 'z-index')),
    );
    expect(value('.thumb:hover .light::before', 'opacity', [MOUSE])).toBe('1');
    // In over --motion-base, out over --motion-slow, on the effects curve: the tiles' timing.
    expect(value('.light::before', 'transition')).toBe(
      'opacity var(--motion-slow) var(--ease-effect)',
    );
    expect(value('.thumb:hover .light::before', 'transition-duration', [MOUSE])).toBe(
      'var(--motion-base)',
    );
  });

  it('starts every layer that fades at rest: each is a pseudo-element, never a real element', () => {
    // A real element is styled once before a late stylesheet arrives (at opacity 1), then fades
    // to 0 when it does: on load every thumbnail flashed its light. A pseudo-element only exists
    // once its rule applies, so it has no earlier style to fade from.
    const fading = RULES.filter((candidate) =>
      declarations(candidate.body).some(
        ([name, shorthand]) => name === 'transition' && shorthand.startsWith('opacity'),
      ),
    );

    expect(fading.map((candidate) => candidate.selector)).toEqual([
      '.thumb::before',
      '.thumb::after',
      '.light::before',
    ]);
    expect(value('.light', 'opacity')).toBeUndefined();
    expect(value('.light', 'transition')).toBeUndefined();
  });

  it('lifts the one pointed at 3 px on the house spring, as the tiles do', () => {
    expect(value('.thumb', 'transition')).toBe(
      'translate var(--motion-spring-out) var(--ease-spring)',
    );
    expect(value('.thumb:hover', 'translate', [MOUSE])).toBe(`0 -${LIFT_PX}px`);
    expect(value('.thumb:hover', 'transition-duration', [MOUSE])).toBe('var(--motion-spring-in)');
  });

  it('dims and lifts only for a mouse or trackpad: a phone has no hover', () => {
    // Every rule that reacts to the pointer, but the reduced-motion one that cancels the lift.
    const hovering = RULES.filter(
      (candidate) =>
        candidate.selector.includes(':hover') && !candidate.conditions.includes(REDUCED_MOTION),
    );

    expect(hovering.length).toBeGreaterThan(0);
    for (const candidate of hovering) {
      expect(candidate.conditions, candidate.selector).toContain(MOUSE);
    }
  });

  it('gives keyboard focus the same light and dim at once, and never moves it', () => {
    const focusSelector = '.strip:has(.thumb:focus-visible) .thumb:not(:focus-visible)::after';

    expect(value(focusSelector, 'opacity')).toBe(DIM);
    expect(value(focusSelector, 'transition-duration')).toBe('0s');
    expect(value('.thumb:focus-visible .light::before', 'opacity')).toBe('1');
    expect(value('.thumb:focus-visible .light::before', 'transition-duration')).toBe('0s');
    for (const candidate of RULES.filter((r) => r.selector.includes(':focus-visible'))) {
      expect(declaredValue(candidate, 'translate'), candidate.selector).toBeUndefined();
    }
  });

  it('never lifts under reduced motion', () => {
    expect(value('.thumb, .thumb:hover', 'translate', [REDUCED_MOTION])).toBe('none');
    // The reduced-motion rule comes after the hover rule it overrides (same specificity).
    expect(STRIP_CSS.lastIndexOf(REDUCED_MOTION)).toBeGreaterThan(STRIP_CSS.indexOf(MOUSE));
  });

  it('still lifts the dim 60 ms late under reduced motion, over the global rule that zeroes it', () => {
    // globals.css zeroes every ::after's transition delay under reduced motion, with !important.
    // The delay is not motion: without it, crossing the gap between two thumbnails flashed the
    // whole strip back to full brightness for a frame or two, on every gap.
    const global = findRule(styleRules(GLOBALS_CSS), '*, *::before, *::after', [REDUCED_MOTION]);
    expect(declaredValue(global, 'transition-delay')).toBe('0ms !important');

    const restDelay = value('.thumb::after', 'transition')?.split(' ').at(-1);
    expect(restDelay).toBe('60ms');
    // Only at rest, with nothing pointed at or focused: the dim still comes in at once.
    expect(
      value(
        '.strip:not(:has(.thumb:hover, .thumb:focus-visible)) .thumb::after',
        'transition-delay',
        [REDUCED_MOTION],
      ),
    ).toBe(`${restDelay} !important`);
  });
});

describe('photo-strip.module.css: forced colours', () => {
  it('outlines the photo shown in a system colour, since shadows are dropped there', () => {
    expect(value('.thumb[aria-current="true"]', 'outline', [FORCED_COLOURS])).toMatch(
      /\b(?:CanvasText|Highlight|ButtonText)\b/,
    );
  });
});

describe('photo-strip.module.css: without JavaScript', () => {
  it('draws no strip, whose buttons could not show a photo', () => {
    expect(value('.strip', 'display', [NO_SCRIPT])).toBe('none');
  });
});

describe('photo-strip.module.css: house rules', () => {
  it('moves only opacity and translate, which the compositor animates', () => {
    const moving = RULES.flatMap((candidate) =>
      declarations(candidate.body).filter(([name]) => /^transition(-property)?$/.test(name)),
    );

    expect(moving.length).toBeGreaterThan(0);
    for (const [name, shorthand] of moving) {
      const properties =
        name === 'transition'
          ? shorthand.split(/,\s*/).map((part) => part.split(/\s+/)[0])
          : shorthand.split(/,\s*/);
      for (const property of properties) expect(['opacity', 'translate']).toContain(property);
    }
  });

  it('uses palette tokens only: no colour literals, and every token it reads exists', () => {
    expect(STRIP_CSS).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|color-mix)\(/i);

    const own = new Set(['--n', '--gap']);
    const tokens = [...STRIP_CSS.matchAll(/var\((--[\w-]+)/g)].map(([, name = '']) => name);
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens.filter((name) => !own.has(name))) {
      expect(GLOBALS_CSS, token).toMatch(new RegExp(`^\\s*${token}:`, 'm'));
    }
  });
});
