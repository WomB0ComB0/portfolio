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
 * @file The motion tokens have one value in CSS and JS: the `--motion-*` durations in the first
 * `:root` block of src/styles/globals.css equal DURATION_MS (camelCase keys, kebab-case names),
 * `--ease-out-expo`, `--ease-standard` and `--ease-effect` in `@theme static` equal EASE, and
 * `--ease-spring` is motion's own `spring(0.25, 0)` written as CSS `linear()`, the curve the owner
 * picked in the Fluid UI Lab (lane B). Also covers SPRING, SPRING_PHYSICS and the small helpers in
 * src/lib/design/motion.ts.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spring } from 'motion';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DURATION_MS,
  EASE,
  prefersReducedMotion,
  REDUCED_MOTION_QUERY,
  SPRING,
  SPRING_PHYSICS,
  seconds,
} from '@/lib/design/motion';

// Vitest runs from the repository root (where vitest.config.ts lives); under jsdom
// import.meta.url is not a file: URL, so resolve from the working directory instead.
const GLOBALS_CSS = join(process.cwd(), 'src/styles/globals.css');

const MOTION_PREFIX = 'motion-';

/**
 * The lab's SPRING_STOPS: the hover the owner picked played these, and motion@14.9.1 prints the
 * same for `spring(0.25, 0)`. A literal, so a motion upgrade that changes the curve fails here
 * instead of quietly changing the hover.
 */
const LAB_SPRING_STOPS = [
  0, 0.1402, 0.3764, 0.584, 0.7361, 0.838, 0.9029, 0.9428, 0.9668, 0.9809, 0.9892, 0.9939, 0.9966,
  0.9981, 0.9989, 0.9994, 1,
];

/** A DURATION_MS key as its CSS name: `springIn` is `--motion-spring-in`. */
const cssName = (key: string): string =>
  `${MOTION_PREFIX}${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The body of the first block whose opening matches `opener`, nested blocks included. */
function blockBody(css: string, opener: RegExp): string {
  const start = css.search(opener);
  if (start < 0) throw new Error(`no block matching ${opener} in globals.css`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(open + 1, index);
  }
  throw new Error(`unclosed block matching ${opener} in globals.css`);
}

/** The custom properties declared in a block body, by name without the leading `--`. */
function customProperties(body: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const [, name = '', value = ''] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(name, value.trim());
  }
  return tokens;
}

/** The stops of a CSS `linear(...)` value (plain numbers; no percentages). */
function linearStops(value: string | undefined): number[] {
  const match = /^linear\(([^)]*)\)$/.exec(value ?? '');
  if (!match) throw new Error(`not a linear(): ${value}`);
  return (match[1] ?? '').split(',').map((stop) => Number(stop.trim()));
}

/** The four control points of a CSS `cubic-bezier(...)` value. */
function bezierPoints(value: string | undefined): number[] {
  const match = /^cubic-bezier\(([^)]*)\)$/.exec(value ?? '');
  if (!match) throw new Error(`not a cubic-bezier: ${value}`);
  return (match[1] ?? '').split(',').map((point) => Number(point.trim()));
}

const css = withoutComments(readFileSync(GLOBALS_CSS, 'utf8'));
const rootTokens = customProperties(blockBody(css, /^:root\s*\{/m));
const staticTheme = customProperties(blockBody(css, /^@theme\s+static\s*\{/m));

describe('motion durations', () => {
  it('declares exactly one --motion-* token per DURATION_MS key in the first :root block', () => {
    const declared = [...rootTokens.keys()].filter((name) => name.startsWith(MOTION_PREFIX));
    const expected = Object.keys(DURATION_MS).map(cssName);

    expect(declared.sort()).toEqual(expected.sort());
  });

  it.each(Object.entries(DURATION_MS))('the %s token is %i ms', (key, ms) => {
    expect(rootTokens.get(cssName(key))).toBe(`${ms}ms`);
  });

  it('names the spring durations --motion-spring-in and --motion-spring-out', () => {
    expect(rootTokens.get('motion-spring-in')).toBe('300ms');
    expect(rootTokens.get('motion-spring-out')).toBe('500ms');
  });

  it('springs in faster than it springs out, and within 300 ms', () => {
    // Entering answers the pointer; leaving trails it, so the bento keeps a short wake.
    expect(DURATION_MS.springIn).toBeLessThanOrEqual(300);
    expect(DURATION_MS.springOut).toBeGreaterThan(DURATION_MS.springIn);
  });
});

describe('motion easing', () => {
  it.each([
    ['ease-out-expo', EASE.outExpo],
    ['ease-standard', EASE.standard],
    ['ease-effect', EASE.effect],
  ] as const)('--%s in @theme static equals EASE', (name, points) => {
    expect(bezierPoints(staticTheme.get(name))).toEqual([...points]);
  });

  it('--ease-effect is Material 3 default effects, which never overshoots', () => {
    expect(EASE.effect).toEqual([0.34, 0.8, 0.34, 1]);
    // y1 and y2 inside [0, 1]: the curve never leaves the 0..1 band, so a fade cannot overshoot.
    const [, y1 = 0, , y2 = 0] = EASE.effect;
    expect(Math.max(y1, y2)).toBeLessThanOrEqual(1);
    expect(Math.min(y1, y2)).toBeGreaterThanOrEqual(0);
  });
});

describe('the spring', () => {
  const motionSpring = String(spring(SPRING.visualDuration, SPRING.bounce));

  it('is motion’s spring(0.25, 0) with no bounce, for motion/react', () => {
    expect(SPRING).toEqual({ type: 'spring', visualDuration: 0.25, bounce: 0 });
  });

  it('--ease-spring in @theme static is that spring as CSS linear(), as motion prints it', () => {
    // motion prints "<settle time>ms linear(...)": the curve is the token, the time is spring-out.
    // Whitespace aside: Biome's CSS formatter puts each stop on its own line.
    const [settle, ...curve] = motionSpring.split(' ');
    const withoutSpace = (value: string | undefined): string => (value ?? '').replace(/\s+/g, '');

    expect(withoutSpace(staticTheme.get('ease-spring'))).toBe(withoutSpace(curve.join(' ')));
    expect(settle).toBe(`${DURATION_MS.springOut}ms`);
  });

  it('plays the stops the owner picked in the lab', () => {
    expect(linearStops(staticTheme.get('ease-spring'))).toEqual(LAB_SPRING_STOPS);
  });

  it('never bounces: the stops rise from 0 to 1 and never pass 1', () => {
    const stops = linearStops(staticTheme.get('ease-spring'));

    expect(stops.at(0)).toBe(0);
    expect(stops.at(-1)).toBe(1);
    for (const [index, stop] of stops.entries()) {
      expect(stop).toBeLessThanOrEqual(1);
      if (index > 0) expect(stop).toBeGreaterThanOrEqual(stops[index - 1] ?? 0);
    }
  });

  it('SPRING_PHYSICS plays the same curve as SPRING from rest, as motion resolves both', () => {
    // motion turns a visualDuration into stiffness and damping with a 1.2 period factor; a constant
    // derived without it is a different, faster spring that a self-made formula would not catch.
    const physicsSpring = String(spring({ keyframes: [0, 1], ...SPRING_PHYSICS }));

    expect(SPRING_PHYSICS.type).toBe('spring');
    expect(physicsSpring).toBe(motionSpring);
  });

  it('SPRING_PHYSICS is critically damped: no bounce, like SPRING', () => {
    const { stiffness, damping, mass } = SPRING_PHYSICS;

    expect(damping / (2 * Math.sqrt(stiffness * mass))).toBeCloseTo(1, 9);
  });

  it('SPRING carries a release speed into the settle, exactly as SPRING_PHYSICS does', () => {
    // Since motion 14.12 a visualDuration spring keeps the velocity it inherits (14.9 dropped it),
    // so a value interrupted mid-flight keeps its momentum on SPRING too, not only on the physics
    // spring; from rest the two still play the same curve.
    const RELEASE_SPEED = 5;
    const SAMPLE_MS = 50;
    const at = (options: object, velocity: number): number =>
      spring({ keyframes: [0, 1], velocity, ...options }).next(SAMPLE_MS).value;

    expect(at(SPRING_PHYSICS, 0)).toBeCloseTo(at(SPRING, 0), 9);
    expect(at(SPRING, RELEASE_SPEED)).toBeGreaterThan(at(SPRING, 0));
    expect(at(SPRING, RELEASE_SPEED)).toBeCloseTo(at(SPRING_PHYSICS, RELEASE_SPEED), 9);
  });

  it('SPRING interrupted mid-flight carries on without a hitch and never passes a target it turns back to', () => {
    // What a photo flight closed while opening, a re-shown preview or a held arrow key on the
    // photo wall does: motion restarts SPRING from where the value is, at the speed it has.
    // Interrupted where it is fastest (about 1 / omega in), the same target carries on along the
    // original curve, and a reversal drifts on briefly, then turns back without overshooting,
    // because the spring is critically damped.
    const INTERRUPT_MS = 48;
    const flight = spring({ keyframes: [0, 1], ...SPRING });
    const position = flight.next(INTERRUPT_MS).value;
    // Units per second, by a central difference over 1 ms on each side.
    const speed =
      ((flight.next(INTERRUPT_MS + 1).value - flight.next(INTERRUPT_MS - 1).value) / 2) * 1000;
    const onward = spring({ keyframes: [position, 1], velocity: speed, ...SPRING });
    const back = spring({ keyframes: [position, 0], velocity: speed, ...SPRING });
    const backPath = Array.from({ length: 121 }, (_, step) => back.next(step * 5).value);

    expect(onward.next(60).value).toBeCloseTo(flight.next(INTERRUPT_MS + 60).value, 3);
    expect(Math.max(...backPath)).toBeGreaterThan(position);
    expect(Math.min(...backPath)).toBeGreaterThanOrEqual(0);
  });
});

describe('motion helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('converts milliseconds to the seconds motion/react takes', () => {
    expect(seconds(DURATION_MS.base)).toBe(0.24);
    expect(seconds(DURATION_MS.tween)).toBe(0.6);
  });

  it('asks for reduced motion with the standard media query', () => {
    // A literal, not the constant: an inverted query would otherwise pass with the code it tests.
    expect(REDUCED_MOTION_QUERY).toBe('(prefers-reduced-motion: reduce)');
  });

  it.each([true, false])('reports the reduced-motion query (matches: %s)', (matches) => {
    const matchMedia = vi.fn((query: string) => ({ matches, media: query }));
    vi.stubGlobal('matchMedia', matchMedia);

    expect(prefersReducedMotion()).toBe(matches);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('is false where matchMedia does not exist, such as on the server', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(prefersReducedMotion()).toBe(false);
  });
});
