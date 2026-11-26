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
 * @file Migration-only types for the static bookshelf catalog. Local on purpose: no imports from
 * src/ or the '@/' alias, which `sanity exec` cannot resolve. The status values mirror
 * BOOK_STATUSES in src/sanity/bookshelf-rules.ts.
 */

import type { CatalogShelf, CatalogTrack } from './shelves';

/** A book's reading status, as the Studio schema lists them. */
export type CatalogBookStatus = 'completed' | 'reading' | 'queued';

/**
 * One book as the catalog authors it: no stage (its position in the ordered catalog), no spine
 * palette (a UI constant) and no cover path (`public/assets/bookshelf/<slug>.webp`, uploaded by the
 * migration). Topics are plain titles; the site numbers them continuously.
 */
export interface RawCatalogBook {
  readonly slug: string;
  readonly title: string;
  readonly spineTitle: string;
  readonly authors: string;
  readonly spineAuthor: string;
  readonly publisher: string;
  readonly edition: string;
  readonly year: number;
  readonly isbn: string;
  readonly track: CatalogTrack;
  readonly status: CatalogBookStatus;
  readonly summary: string;
  readonly url: string;
  readonly topics: readonly string[];
}

/** A book in the ordered catalog: `stage` is its 1-based position across all shelves. */
export interface CatalogBook extends RawCatalogBook {
  readonly stage: number;
}

/** The whole catalog: books grouped shelf by shelf in shelf order, and the shelves in order. */
export interface BookshelfCatalogInput {
  readonly books: readonly CatalogBook[];
  readonly shelves: readonly CatalogShelf[];
}
