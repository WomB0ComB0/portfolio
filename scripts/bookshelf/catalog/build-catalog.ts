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
 * @file Migration-only: the static bookshelf catalog as one ordered list, the input of the one-shot
 * Sanity migration (scripts/bookshelf/migrate-to-sanity.ts). Books are grouped shelf by shelf in
 * {@link CATALOG_TRACKS} order (within a shelf: reading list, then engineering, then humanities,
 * as the site's former static catalog ordered them), and `stage` is the 1-based position across
 * all shelves: the migration writes `order = stage * 10`.
 *
 * Self-contained on purpose: relative imports only (`sanity exec` cannot resolve '@/'), and nothing
 * under src/ imports this, so the catalog ships in no bundle. Deleted with the migration script.
 */

import { ENGINEERING_BOOKS } from './engineering-books';
import { HUMANITIES_BOOKS } from './humanities-books';
import { RAW_PERSONAL_BOOKS } from './reading-list-books';
import { CATALOG_SHELVES, CATALOG_TRACKS } from './shelves';
import type { BookshelfCatalogInput, CatalogBook, RawCatalogBook } from './types';

/** Every book, in authoring order: the reading list, the engineering core, the humanities. */
const ALL_BOOKS: readonly RawCatalogBook[] = [
  ...RAW_PERSONAL_BOOKS,
  ...ENGINEERING_BOOKS,
  ...HUMANITIES_BOOKS,
];

/** The first value that occurs more than once, or undefined. */
function firstDuplicate(values: readonly string[]): string | undefined {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return undefined;
}

/**
 * Builds the ordered catalog. Throws when the catalog contradicts itself: a duplicate book or
 * shelf slug, shelves out of {@link CATALOG_TRACKS} order, or a book whose track has no shelf.
 */
export function buildCatalog(): BookshelfCatalogInput {
  const shelfTitles = CATALOG_SHELVES.map((shelf) => shelf.title);
  if (shelfTitles.join('\n') !== CATALOG_TRACKS.join('\n')) {
    throw new Error('Catalog shelves must list every track once, in CATALOG_TRACKS order');
  }
  const duplicateShelf = firstDuplicate(CATALOG_SHELVES.map((shelf) => shelf.slug));
  if (duplicateShelf) throw new Error(`Duplicate catalog shelf slug: ${duplicateShelf}`);
  const duplicateBook = firstDuplicate(ALL_BOOKS.map((book) => book.slug));
  if (duplicateBook) throw new Error(`Duplicate catalog book slug: ${duplicateBook}`);

  const grouped = CATALOG_TRACKS.flatMap((track) =>
    ALL_BOOKS.filter((book) => book.track === track),
  );
  if (grouped.length !== ALL_BOOKS.length) {
    throw new Error('Every catalog book must sit on one of the catalog shelves');
  }

  const books = grouped.map((book, index): CatalogBook => ({ ...book, stage: index + 1 }));
  return { books, shelves: CATALOG_SHELVES };
}
