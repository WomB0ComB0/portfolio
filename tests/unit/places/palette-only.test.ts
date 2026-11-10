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
 * @file The /places list stays on the palette (the owner's standing rule): no colour literals
 * (hex, rgb(), hsl(), oklch()), no chart colours, no Tailwind palette scales, no white, black or
 * neutral utilities and no inline colour styles in the files its filters and list are built from.
 * Categories are told apart by words and position, never by colour. The map's markers, clusters
 * and place card are scanned too: no white alphas, no glass (backdrop blur), and no opacity
 * modifier on a palette colour (its color-mix() fallback is the colour at full strength).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = path.resolve(__dirname, '../../../src');
const PLACES = 'app/(routes)/(main)/(personal)/places';

const FILES = [
  `${PLACES}/_components/places-explorer.tsx`,
  `${PLACES}/_components/map.tsx`,
  `${PLACES}/_components/map.css`,
  `${PLACES}/_components/use-shown-places.ts`,
  `${PLACES}/_lib/place-filters.ts`,
  `${PLACES}/_lib/past-places.ts`,
  `${PLACES}/_interface/places/places.tsx`,
  `${PLACES}/(list)/page.tsx`,
  'lib/places/categories.ts',
];

/** A file's text without its comments (a licence or doc comment may name a colour). */
const codeOf = (file: string): string =>
  readFileSync(path.join(SRC_DIR, file), 'utf8')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/(^|[^:'"])\/\/.*$/gm, '$1');

describe.each(FILES)('%s', (file) => {
  const code = codeOf(file);

  it('has no colour literals', () => {
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(code).not.toMatch(/\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/i);
  });

  it('uses no chart colours, Tailwind palette scales, or white, black and neutral utilities', () => {
    expect(code).not.toMatch(/--chart-\d/);
    expect(code).not.toMatch(
      /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|shadow|divide)-(?:red|green|blue|emerald|amber|violet|purple|pink|zinc|slate|gray|neutral|stone|orange|yellow|teal|cyan|indigo|rose|lime|sky|fuchsia)-\d/,
    );
    expect(code).not.toMatch(
      /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|shadow|divide)-(?:white|black|neutral)\b/,
    );
  });

  it('uses no glass, no opacity modifier on a palette colour and no literal SVG colour', () => {
    expect(code).not.toMatch(/backdrop-blur/);
    expect(code).not.toMatch(
      /\b(?:bg|text|border|ring|fill|stroke|outline|shadow)-(?:primary|secondary|foreground|muted|accent|card|border|surface-\d|canvas)\/\d+/,
    );
    expect(code).not.toMatch(/\b(?:fill|stroke)="(?!currentColor"|none")[^"]*"/);
  });

  it('sets no colour inline', () => {
    expect(code).not.toMatch(/style=\{\{[^}]*\b(?:color|background|backgroundColor|borderColor)\b/);
  });
});
