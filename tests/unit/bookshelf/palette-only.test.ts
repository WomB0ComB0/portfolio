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
 * @file `/bookshelf*` stays on the Live Console palette (matching `/projects` and `/places`):
 * no hardcoded hex/rgb/hsl/oklch color literals, no `--chart-*` swatches, no Tailwind rainbow
 * scales, and no inline `backgroundColor`/`color`/`borderColor` styles. Real book covers supply
 * the focal color while the shelf chrome, 3D bindings, cards, and directory stay tinted-black
 * plus periwinkle.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const BOOKSHELF_DIR = path.resolve(
  __dirname,
  '../../../src/app/(routes)/(main)/(personal)/bookshelf',
);

const FILES = [
  '_lib/book-covers.ts',
  '_lib/book-labels.ts',
  '_lib/book-neighbors.ts',
  '_lib/books.ts',
  '_lib/bookshelf-filters.ts',
  '_lib/load-bookshelf.ts',
  '_lib/reading-map.ts',
  '_lib/shelf-geometry.ts',
  '_lib/shelf-glide.ts',
  '_lib/spine-themes.ts',
  '_components/book-cover-frame.tsx',
  '_components/book-detail-view.tsx',
  '_components/book-status-badge.tsx',
  '_components/bookshelf-book-slot.tsx',
  '_components/bookshelf-classes.ts',
  '_components/bookshelf-controls-bar.tsx',
  '_components/bookshelf-filters-bar.tsx',
  '_components/bookshelf-stage.tsx',
  '_components/free-library-card.tsx',
  '_components/reading-map-dialog.tsx',
  '_components/shelf-cards-grid.tsx',
  '_components/use-bookshelf-navigation.ts',
  '_components/use-shelf-motion.ts',
  'free/_components/free-books-explorer.tsx',
  'free/_components/free-books-filters.tsx',
  'free/_components/free-books-pagination.tsx',
  'free/_components/free-books-skeleton.tsx',
  'free/_components/free-books-table.tsx',
  'free/_components/use-free-books-query.ts',
];

const codeOf = (file: string): string =>
  readFileSync(path.join(BOOKSHELF_DIR, file), 'utf8')
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
