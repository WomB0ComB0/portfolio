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
 * `:root` block of src/styles/globals.css equal DURATION_MS, and `--ease-out-expo` and
 * `--ease-standard` in `@theme static` equal EASE. Also covers the small helpers in
 * src/lib/design/motion.ts.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DURATION_MS,
  EASE,
  prefersReducedMotion,
  REDUCED_MOTION_QUERY,
  seconds,
} from '@/lib/design/motion';

// Vitest runs from the repository root (where vitest.config.ts lives); under jsdom
// import.meta.url is not a file: URL, so resolve from the working directory instead.
const GLOBALS_CSS = join(process.cwd(), 'src/styles/globals.css');

const MOTION_PREFIX = 'motion-';

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
    const expected = Object.keys(DURATION_MS).map((key) => `${MOTION_PREFIX}${key}`);

    expect(declared.sort()).toEqual(expected.sort());
  });

  it.each(Object.entries(DURATION_MS))('--motion-%s is %i ms', (key, ms) => {
    expect(rootTokens.get(`${MOTION_PREFIX}${key}`)).toBe(`${ms}ms`);
  });
});

describe('motion easing', () => {
  it.each([
    ['ease-out-expo', EASE.outExpo],
    ['ease-standard', EASE.standard],
  ] as const)('--%s in @theme static equals EASE', (name, points) => {
    expect(bezierPoints(staticTheme.get(name))).toEqual([...points]);
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
