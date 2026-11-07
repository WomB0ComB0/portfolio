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
/** WCAG 1.4.11: focus rings and other non-text UI need 3:1 against what is next to them. */
const AA_NON_TEXT = 3;

/** The Live Console surfaces, darkest first: every text tier must read on all of them. */
const CONSOLE_SURFACES = ['canvas', 'surface-1', 'surface-2', 'surface-3'] as const;
/** The Live Console tokens that colour text. */
const CONSOLE_TEXT = [
  'fg',
  'fg-muted',
  'fg-faint',
  'brand',
  'brand-ink',
  'live',
  'ongoing',
  'down',
  'info',
] as const;

/** The status colours; each has a translucent `--<tone>-tint` badge fill. */
const STATUS_TONES = ['live', 'ongoing', 'down', 'info'] as const;

/** LeetCode's difficulty colours (hex): segment bar parts and legend swatches, non-text marks. */
const LEET_TONES = ['leet-easy', 'leet-medium', 'leet-hard'] as const;

/** Linear-light sRGB channels, nominally 0..1. */
type LinearRgb = readonly [number, number, number];

/** A translucent `oklch(L C H / A%)` token split into its opaque colour and its alpha (0..1). */
function splitAlpha(value: string): { readonly opaque: string; readonly alpha: number } {
  const match = /^(oklch\([^/]+?)\s*\/\s*([\d.]+)%\)$/.exec(value);
  if (!match) throw new Error(`not a translucent oklch value: ${value}`);
  return { opaque: `${match[1]})`, alpha: Number(match[2]) / 100 };
}

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

/** Converts a CSS `#rrggbb` value to linear-light sRGB. */
function hexToLinearSrgb(value: string): LinearRgb {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  if (!match) throw new Error(`not a #rrggbb value: ${value}`);
  const channel = (hex = ''): number => decode(Number.parseInt(hex, 16) / 255);
  return [channel(match[1]), channel(match[2]), channel(match[3])];
}

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
    'accent',
    'accent-foreground',
    ...CONSOLE_SURFACES,
    ...CONSOLE_TEXT,
    'hairline',
    'hairline-strong',
    'brand-subtle',
    'focus',
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
    [
      'muted-foreground on bg-card/40 over background (translucent cards)',
      () => color('muted-foreground'),
      () => composite(color('card'), 0.4, color('background')),
    ],
    [
      'foreground on accent (hover:bg-accent rows)',
      () => color('foreground'),
      () => color('accent'),
    ],
    ['accent-foreground on accent', () => color('accent-foreground'), () => color('accent')],
    [
      'fg-faint on bg-primary/5 over background (MagicCard: the place photo drag hint)',
      () => color('fg-faint'),
      () => composite(color('primary'), 0.05, color('background')),
    ],
  ];

  it.each(pairs)('%s meets WCAG AA for normal text (4.5:1)', (name, text, surface) => {
    const ratio = contrastRatio(text(), surface());
    expect(ratio, `${name} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('muted-foreground on accent falls below 4.5:1, so a hover:bg-accent row must lift its muted text', () => {
    // A known failure, kept visible: rows that hover to bg-accent switch muted labels to
    // foreground, which the pairs above check.
    const ratio = contrastRatio(color('muted-foreground'), color('accent'));
    expect(ratio, `muted-foreground on accent is ${ratio.toFixed(2)}:1`).toBeLessThan(
      AA_NORMAL_TEXT,
    );
  });

  const consolePairs = CONSOLE_TEXT.flatMap((text) =>
    CONSOLE_SURFACES.map((surface) => [text, surface] as const),
  );

  it.each(consolePairs)('--%s on --%s meets WCAG AA for normal text (4.5:1)', (text, surface) => {
    const ratio = contrastRatio(color(text), color(surface));
    expect(ratio, `${text} on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it.each([
    ['fg', 'brand-subtle'],
    ['brand-ink', 'brand-subtle'],
    // The current issuer chip's count on /certifications.
    ['fg-muted', 'brand-subtle'],
  ] as const)('--%s on the --%s selected fill meets 4.5:1', (text, surface) => {
    const ratio = contrastRatio(color(text), color(surface));
    expect(ratio, `${text} on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it('fg-faint on the brand-subtle fill falls below 4.5:1, so a selected chip lifts its faint text', () => {
    // A known failure, kept visible: /certifications' current chip switches its count from faint
    // to muted ([[aria-current=true]_&]:text-muted-foreground), which the pairs above check.
    const ratio = contrastRatio(color('fg-faint'), color('brand-subtle'));
    expect(ratio, `fg-faint on brand-subtle is ${ratio.toFixed(2)}:1`).toBeLessThan(AA_NORMAL_TEXT);
  });

  /** A status badge's fill: the `--<tone>-tint` token composited over an opaque surface. */
  const tintOver = (tone: string, surface: string): LinearRgb => {
    const value = tokens.get(`${tone}-tint`);
    if (!value) throw new Error(`--${tone}-tint is not declared in :root`);
    const { opaque, alpha } = splitAlpha(value);
    return composite(clip(oklchToLinearSrgb(opaque)), alpha, color(surface));
  };

  const tintPairs = STATUS_TONES.flatMap((tone) =>
    CONSOLE_SURFACES.map((surface) => [tone, surface] as const),
  );

  it.each(tintPairs)(
    'text-%s on its bg-*-tint badge over --%s meets WCAG AA for normal text (4.5:1)',
    (tone, surface) => {
      const ratio = contrastRatio(color(tone), tintOver(tone, surface));
      expect(
        ratio,
        `${tone} on ${tone}-tint over ${surface} is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    },
  );

  it.each(CONSOLE_SURFACES)('the --focus ring meets 3:1 against --%s', (surface) => {
    const ratio = contrastRatio(color('focus'), color(surface));
    expect(ratio, `focus on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      AA_NON_TEXT,
    );
  });

  const leetPairs = LEET_TONES.flatMap((tone) =>
    CONSOLE_SURFACES.map((surface) => [tone, surface] as const),
  );

  // The bar's parts sit on surface-2 (its track) and the swatches on the tile's surface.
  it.each(leetPairs)('--%s, a bar part and swatch, meets 3:1 against --%s', (tone, surface) => {
    const value = tokens.get(tone);
    if (!value) throw new Error(`--${tone} is not declared in :root`);
    const ratio = contrastRatio(hexToLinearSrgb(value), color(surface));
    expect(ratio, `${tone} on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      AA_NON_TEXT,
    );
  });
});
