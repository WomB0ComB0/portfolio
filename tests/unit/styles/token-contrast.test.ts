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
 * @file WCAG 2.x contrast checks for the colour tokens in src/styles/globals.css.
 *
 * Reads the `:root` OKLCH custom properties, converts them to sRGB (OKLab matrices from
 * https://bottosson.github.io/posts/oklab/) and checks the token pairs that carry text against
 * the AA minimum for normal-size text. Translucent backgrounds such as `bg-primary/90` are
 * composited in gamma-encoded sRGB, which is how browsers blend them.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs from the repository root (where vitest.config.ts lives); under jsdom
// import.meta.url is not a file: URL, so resolve from the working directory instead.
const GLOBALS_CSS = join(process.cwd(), 'src/styles/globals.css');
const AA_NORMAL_TEXT = 4.5;

/** Linear-light sRGB channels, nominally 0..1. */
type LinearRgb = readonly [number, number, number];

/** Returns the custom properties declared in the first `:root { ... }` block. */
function rootTokens(css: string): Map<string, string> {
  const start = css.search(/^:root\s*\{/m);
  if (start < 0) throw new Error('no :root block in globals.css');
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);
  const tokens = new Map<string, string>();
  for (const [, name = '', value = ''] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(name, value.trim());
  }
  return tokens;
}

/** Converts a CSS `oklch(L C H)` value to linear-light sRGB, without gamut clipping. */
function oklchToLinearSrgb(value: string): LinearRgb {
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
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// Some tokens sit a hair outside sRGB (--foreground's linear blue channel is 1.0015), and
// browsers map them into the gamut. Within this tolerance, clipping a channel moves relative
// luminance by less than 0.005, so the checks below clip instead of gamut mapping.
const GAMUT_TOLERANCE = 0.005;
const isNearSrgbGamut = (rgb: LinearRgb): boolean =>
  rgb.every((channel) => channel >= -GAMUT_TOLERANCE && channel <= 1 + GAMUT_TOLERANCE);
const clip = ([r, g, b]: LinearRgb): LinearRgb => {
  const unit = (c: number): number => Math.min(1, Math.max(0, c));
  return [unit(r), unit(g), unit(b)];
};

const encode = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const decode = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** `top` at `alpha` opacity over an opaque `bottom`, blended in gamma-encoded sRGB. */
function composite(top: LinearRgb, alpha: number, bottom: LinearRgb): LinearRgb {
  const blend = (i: 0 | 1 | 2): number =>
    decode(encode(top[i]) * alpha + encode(bottom[i]) * (1 - alpha));
  return [blend(0), blend(1), blend(2)];
}

const relativeLuminance = ([r, g, b]: LinearRgb): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function contrastRatio(a: LinearRgb, b: LinearRgb): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('colour token contrast (globals.css :root)', () => {
  const tokens = rootTokens(readFileSync(GLOBALS_CSS, 'utf8'));
  const unclipped = (name: string): LinearRgb => {
    const value = tokens.get(name);
    if (!value) throw new Error(`--${name} is not declared in :root`);
    return oklchToLinearSrgb(value);
  };
  const color = (name: string): LinearRgb => clip(unclipped(name));

  it('converts oklch(100% 0 0) to white and oklch(0% 0 0) to black', () => {
    expect(contrastRatio(oklchToLinearSrgb('oklch(100% 0 0)'), [0, 0, 0])).toBeCloseTo(21, 3);
    expect(relativeLuminance(oklchToLinearSrgb('oklch(0% 0 0)'))).toBeCloseTo(0, 6);
  });

  it.each([
    'background',
    'foreground',
    'card',
    'card-foreground',
    'muted-foreground',
    'primary',
    'primary-foreground',
  ])('--%s is within the sRGB gamut tolerance, so clipping it is accurate', (name) => {
    expect(isNearSrgbGamut(unclipped(name))).toBe(true);
  });

  const pairs: ReadonlyArray<readonly [string, () => LinearRgb, () => LinearRgb]> = [
    ['foreground on background', () => color('foreground'), () => color('background')],
    ['muted-foreground on background', () => color('muted-foreground'), () => color('background')],
    ['primary on background', () => color('primary'), () => color('background')],
    ['primary-foreground on primary', () => color('primary-foreground'), () => color('primary')],
    ['card-foreground on card', () => color('card-foreground'), () => color('card')],
    ['muted-foreground on card', () => color('muted-foreground'), () => color('card')],
    ['primary on card', () => color('primary'), () => color('card')],
    [
      'primary-foreground on bg-primary/90 over background (default button hover)',
      () => color('primary-foreground'),
      () => composite(color('primary'), 0.9, color('background')),
    ],
    [
      'primary on bg-primary/10 over card (tinted badges)',
      () => color('primary'),
      () => composite(color('primary'), 0.1, color('card')),
    ],
  ];

  it.each(pairs)('%s meets WCAG AA for normal text (4.5:1)', (name, text, surface) => {
    const ratio = contrastRatio(text(), surface());
    expect(ratio, `${name} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});
