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
 * @file The Live Console colour tokens as tests read them: a token's literal value from the first
 * `:root { ... }` block of src/styles/globals.css, and OKLCH converted to sRGB (the OKLab matrices
 * from https://bottosson.github.io/posts/oklab/). Constants that hold a token as hex (the theme
 * colour, the link-preview palette) are checked against the token through these, so a change to
 * one without the other fails.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Vitest runs from the repository root; under jsdom import.meta.url is not a file: URL.
const GLOBALS_CSS = join(process.cwd(), 'src/styles/globals.css');

/** The value of `--name` in the first `:root { ... }` block of globals.css. */
export function rootToken(name: string): string {
  const css = readFileSync(GLOBALS_CSS, 'utf8');
  const start = css.search(/^:root\s*\{/m);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const match = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(body);
  if (!match?.[1]) throw new Error(`--${name} is not declared in :root`);
  return match[1].trim();
}

/** An sRGB colour: channels 0-255 and an alpha from 0 to 1. */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
}

const OKLCH =
  /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+)(%?))?\s*\)$/;

/** Gamma-encodes a linear sRGB channel and scales it to a 0-255 byte, clamped to the gamut. */
const toByte = (linear: number): number => {
  const encoded = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, encoded)) * 255);
};

/** Converts a CSS `oklch(L C H)` or `oklch(L C H / A%)` value to sRGB channels and an alpha. */
export function oklchToRgba(value: string): Rgba {
  const match = OKLCH.exec(value);
  if (!match) throw new Error(`unsupported colour value: ${value}`);
  const lightness = Number(match[1]) / (match[2] === '%' ? 100 : 1);
  const chroma = Number(match[3]);
  const hue = (Number(match[4]) * Math.PI) / 180;
  const alpha = match[5] === undefined ? 1 : Number(match[5]) / (match[6] === '%' ? 100 : 1);
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: toByte(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: toByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: toByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    alpha,
  };
}

/** Converts a CSS `oklch(L C H)` value to a lowercase #rrggbb sRGB hex string (alpha dropped). */
export function oklchToHex(value: string): string {
  const { r, g, b } = oklchToRgba(value);
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
