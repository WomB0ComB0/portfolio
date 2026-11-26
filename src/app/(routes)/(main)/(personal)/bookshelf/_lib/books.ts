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
 * @file The bookshelf's model: the shapes the catalog loader (load-bookshelf.ts) builds from
 * Sanity's `book` and `bookshelf` documents and the client islands render (BookItem, BookTopic,
 * ShelfCollection and the non-empty book list), the reading statuses' labels and descriptions,
 * the ISBN registry links and the stage the bookshelf starts on. It holds no catalog content:
 * books and shelves come only from Sanity, through the loader, and reach client islands as props.
 * The rest of the bookshelf's pure helpers sit beside it in single-concern modules (filters,
 * covers, labels, neighbours, the reading map and the spine themes). Pure and isomorphic; guarded
 * by tests/unit/bookshelf/load-bookshelf.test.ts, bookshelf-stage.test.tsx and
 * book-detail-view.test.tsx.
 */

import { BOOK_STATUS_LABELS, type BookStatus, normalizeIsbn } from '@/sanity/bookshelf-rules';
import type { BookSpineTheme } from './spine-themes';

export { BOOK_STATUSES, type BookStatus } from '@/sanity/bookshelf-rules';

export interface BookStatusMeta {
  readonly label: string;
  readonly description: string;
}

export const BOOK_STATUS_META: Readonly<Record<BookStatus, BookStatusMeta>> = {
  completed: {
    label: BOOK_STATUS_LABELS.completed,
    description: 'Finished books with distilled notes and key takeaways.',
  },
  reading: {
    label: BOOK_STATUS_LABELS.reading,
    description: 'Books currently on the desk and actively being annotated.',
  },
  queued: {
    label: BOOK_STATUS_LABELS.queued,
    description: 'Queued on the reading list for upcoming deep dives.',
  },
};

/** One shelf section, in shelf order, with its books' slugs in global stage order. */
export interface ShelfCollection {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly bookSlugs: readonly string[];
  /** The shelf document's `_updatedAt` (ISO 8601). */
  readonly updatedAt: string;
}

export interface IsbnRegistryLinks {
  readonly openLibrary: string;
  readonly worldCat: string;
  readonly isbnSearch: string;
}

/** Authoritative public bibliographic registry URLs for a published ISBN. */
export function getIsbnRegistryLinks(isbn?: string | null): IsbnRegistryLinks | null {
  const cleaned = normalizeIsbn(isbn);
  if (!cleaned) return null;
  return {
    openLibrary: `https://openlibrary.org/isbn/${cleaned}`,
    worldCat: `https://search.worldcat.org/isbn/${cleaned}`,
    isbnSearch: `https://isbnsearch.org/isbn/${cleaned}`,
  };
}

export interface BookTopic {
  readonly number: number;
  readonly title: string;
}

/**
 * One book as the bookshelf renders it, built by the catalog loader from a Sanity `book` document
 * joined to its shelf. Optional facts are absent when Studio leaves them empty: the UI renders
 * them only when present, never a made-up default.
 */
export interface BookItem {
  readonly slug: string;
  /** 1-based position across all shelves (shelf order, then book order). */
  readonly stage: number;
  readonly stageLabel: string;
  readonly title: string;
  readonly spineTitle: string;
  readonly authors: string;
  readonly spineAuthor: string;
  readonly publisher?: string;
  readonly edition?: string;
  readonly year?: number;
  readonly isbn?: string;
  /** The book's shelf title: its track label, never its identity (that is `shelfSlug`). */
  readonly track: string;
  /** The book's shelf slug (/bookshelf/shelf/<shelfSlug>, and the `?shelf=` filter). */
  readonly shelfSlug: string;
  readonly status: BookStatus;
  readonly summary: string;
  readonly coverSrc: string;
  readonly coverAlt: string;
  readonly url?: string;
  readonly spine: BookSpineTheme;
  readonly topics: readonly BookTopic[];
  /** The book document's `_updatedAt` (ISO 8601). */
  readonly updatedAt: string;
}

/** A list with at least one book: what the bookshelf's client islands take. */
export type NonEmptyBooks = readonly [BookItem, ...BookItem[]];

/** The initially active book on /bookshelf: the first stage. */
export const DEFAULT_BOOK_INDEX = 0;
