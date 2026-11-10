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
 * @file The /projects Index stays on the palette (the owner's standing rule): no colour
 * literals (hex, rgb(), hsl(), oklch()), no chart colours (--chart-*, the old per-kind
 * swatches), no Tailwind palette scales and no inline colour styles in its files or the
 * preview's stylesheet. Kinds are told apart by words and position, never by colour.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PROJECTS_DIR = path.resolve(
  __dirname,
  '../../../src/app/(routes)/(main)/(professioal)/projects',
);

const FILES = [
  '_lib/project-text.ts',
  '_lib/project-order.ts',
  '_lib/project-filters.ts',
  '_lib/project-index.ts',
  '_components/project-index-classes.ts',
  '_components/project-row.tsx',
  '_components/project-groups.tsx',
  '_components/project-header.tsx',
  '_components/projects-index.tsx',
  '_components/project-preview-geometry.ts',
  '_components/project-preview.tsx',
  '_components/project-preview-live.tsx',
  '_components/project-preview-card.tsx',
  '_components/project-preview.module.css',
  '_interface/projects-index/projects-index.tsx',
];

/** A file's text without its comments (a licence or doc comment may name a colour). */
const codeOf = (file: string): string =>
  readFileSync(path.join(PROJECTS_DIR, file), 'utf8')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/(^|[^:'"])\/\/.*$/gm, '$1');

describe.each(FILES)('%s', (file) => {
  const code = codeOf(file);

  it('has no colour literals', () => {
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(code).not.toMatch(/\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/i);
  });

  it('uses no chart colours or Tailwind palette scales', () => {
    expect(code).not.toMatch(/--chart-\d/);
    expect(code).not.toMatch(
      /\b(?:bg|text|border|ring|from|to|via)-(?:red|green|blue|emerald|amber|violet|purple|pink|zinc|slate|gray|orange|yellow|teal|cyan|indigo|rose|lime|sky|fuchsia)-\d/,
    );
  });

  it('sets no colour inline', () => {
    expect(code).not.toMatch(/style=\{\{[^}]*\b(?:color|background|backgroundColor|borderColor)\b/);
  });
});
