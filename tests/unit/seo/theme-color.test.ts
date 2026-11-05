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
 * @file One theme colour everywhere: the page background, so browser chrome blends with the page.
 *
 * The expected value is computed from the `--background` token in src/styles/globals.css
 * (OKLCH to sRGB with the OKLab matrices from https://bottosson.github.io/posts/oklab/), so a
 * change to the token without the constant, or the other way round, fails here.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import manifest from '@/app/manifest';
import { constructViewport, THEME_COLOR } from '@/utils/seo/meta';

// Vitest runs from the repository root; under jsdom import.meta.url is not a file: URL.
const GLOBALS_CSS = join(process.cwd(), 'src/styles/globals.css');

/** The value of `--name` in the first `:root { ... }` block of globals.css. */
function rootToken(name: string): string {
  const css = readFileSync(GLOBALS_CSS, 'utf8');
  const start = css.search(/^:root\s*\{/m);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const match = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(body);
  if (!match?.[1]) throw new Error(`--${name} is not declared in :root`);
  return match[1].trim();
}

/** Converts a CSS `oklch(L C H)` value to a lowercase #rrggbb sRGB hex string. */
function oklchToHex(value: string): string {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/.exec(value);
  if (!match) throw new Error(`unsupported colour value: ${value}`);
  const lightness = Number(match[1]) / (match[2] === '%' ? 100 : 1);
  const chroma = Number(match[3]);
  const hue = (Number(match[4]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const encode = (c: number): number =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  const byte = (c: number): string =>
    Math.round(Math.min(1, Math.max(0, encode(c))) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${linear.map(byte).join('')}`;
}

describe('theme colour', () => {
  it('is the page background (--background in globals.css)', () => {
    expect(oklchToHex('oklch(100% 0 0)')).toBe('#ffffff');
    expect(THEME_COLOR.toLowerCase()).toBe(oklchToHex(rootToken('background')));
  });

  it('is emitted once by the viewport, with no light/dark variants', () => {
    const viewport = constructViewport();

    expect(viewport.themeColor).toBe(THEME_COLOR);
    expect(viewport.colorScheme).toBe('dark');
  });

  it('is the manifest theme and splash background colour too', () => {
    const { theme_color, background_color } = manifest();

    expect(theme_color).toBe(THEME_COLOR);
    expect(background_color).toBe(THEME_COLOR);
  });
});
