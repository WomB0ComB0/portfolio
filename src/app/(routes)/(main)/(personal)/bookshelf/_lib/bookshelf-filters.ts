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
 * @file The /bookshelf URL contract and the filter maths behind it. The parsers are nuqs/server
 * ones, so they are safe to import on the server (src/lib/filters/define-filters.ts does the
 * same). The stage (bookshelf-stage.tsx) reads the contract on /bookshelf and
 * /bookshelf/shelf/[shelfSlug]:
 * - ?shelf: a shelf's slug. Absent means every shelf: "All" is the reset, not a value.
 * - ?track: legacy and read only, the shelf filter before slugs (a shelf's title, ?track=AI). The
 *   stage maps it to the one shelf with that title (a title two shelves share is no filter) and
 *   rewrites the URL to ?shelf=<slug> once; nothing writes it any more.
 * - ?status: 'all' (the default, left out of the URL) or one reading status.
 * - ?group: how the shelf cards group, 'topic' (the default) or 'status'.
 * - ?book: read only, the book the stage starts on.
 * Writes replace the history entry and stay on the client (BOOKSHELF_URL_OPTIONS); /bookshelf/free
 * keeps its own parsers in free/_lib/free-books-filters.ts and shares these options. Not ported to
 * defineFilters, which would change the URL: repeated keys and boolean flags.
 *
 * The maths turn the URL into what the stage shows: the shelf chips (buildShelfTabs), the shelf a
 * ?shelf or legacy ?track names (resolveShelfFilter), whether a book matches the filters
 * (matchesFilter) and the status chips' counts (countStatuses). The stage, the filters bar, the
 * shelf cards and the navigation hook import them. Pure and isomorphic; guarded by
 * tests/unit/bookshelf/bookshelf-filters.test.ts.
 */

import { parseAsString, parseAsStringLiteral } from 'nuqs/server';
import { BOOK_STATUSES } from '@/sanity/bookshelf-rules';
import type { BookItem } from './books';

/** ?status values: 'all' for no filter, or one of the reading statuses. */
const BOOKSHELF_STATUS_VALUES = ['all', ...BOOK_STATUSES] as const;
/** ?group values: the shelf cards grouped by topic (their shelf) or by reading status. */
export const BOOKSHELF_GROUP_VALUES = ['topic', 'status'] as const;

/** Shared shallow/replace options: instant client updates, zero server round-trips, clean default URLs. */
export const BOOKSHELF_URL_OPTIONS = {
  history: 'replace',
  shallow: true,
  scroll: false,
  clearOnDefault: true,
} as const;

/** URL state for `/bookshelf` and `/bookshelf/shelf/[shelfSlug]`. */
export const bookshelfSearchParsers = {
  /** The shelf filter: a shelf's slug, or absent for every shelf ("All" is the reset, no value). */
  shelf: parseAsString,
  /**
   * Legacy, read only: the shelf filter before slugs, a shelf's title (`?track=AI`). The stage
   * maps it to the one shelf with that title and rewrites the URL to `?shelf=<slug>`; nothing
   * writes it any more.
   */
  track: parseAsString,
  status: parseAsStringLiteral(BOOKSHELF_STATUS_VALUES).withDefault('all'),
  group: parseAsStringLiteral(BOOKSHELF_GROUP_VALUES).withDefault('topic'),
  book: parseAsString,
};

/** The ?status filter: 'all' for none, or one reading status. */
export type BookStatusFilter = (typeof BOOKSHELF_STATUS_VALUES)[number];

/**
 * One shelf filter chip on /bookshelf: the shelf's slug is its identity (`?shelf=<slug>`), its
 * title only the chip's label. "All" is no chip value: it is the reset, a null filter.
 */
export interface ShelfTab {
  readonly slug: string;
  readonly title: string;
  /** The shelf's books on the stage. */
  readonly count: number;
}

/** One chip per shelf on the stage, in stage order (shelf order), each with its book count. */
export function buildShelfTabs(books: readonly BookItem[]): readonly ShelfTab[] {
  const tabs = new Map<string, { readonly title: string; count: number }>();
  for (const book of books) {
    const tab = tabs.get(book.shelfSlug);
    if (tab) tab.count += 1;
    else tabs.set(book.shelfSlug, { title: book.track, count: 1 });
  }
  return [...tabs].map(([slug, { title, count }]) => ({ slug, title, count }));
}

/**
 * The shelf filter the URL names, as the slug of a shelf on the stage, or null for none ("All").
 * In order: `?shelf=<slug>` when that slug is on the stage; else a legacy `?track=<title>` link
 * (the filter before slugs) mapped to the slug of the one shelf with exactly that title; else a
 * slug typed into `?track=`. Anything else is no filter, a title two shelves share included: a
 * value from the URL is never used unless it names a shelf on the stage.
 */
export function resolveShelfFilter(
  shelfParam: string | null,
  trackParam: string | null,
  tabs: readonly ShelfTab[],
): string | null {
  if (shelfParam !== null && tabs.some((tab) => tab.slug === shelfParam)) return shelfParam;
  if (trackParam === null) return null;
  const titled = tabs.filter((tab) => tab.title === trackParam);
  if (titled.length === 1) return titled[0]?.slug ?? null;
  // A title two shelves share is ambiguous: no filter, even if one of them has it as its slug.
  if (titled.length > 1) return null;
  return tabs.some((tab) => tab.slug === trackParam) ? trackParam : null;
}

/** True when `book` is on the shelf `shelfSlug` names (null for every shelf) and has `status`. */
export const matchesFilter = (
  book: BookItem,
  shelfSlug: string | null,
  status: BookStatusFilter,
): boolean =>
  (shelfSlug === null || book.shelfSlug === shelfSlug) &&
  (status === 'all' || book.status === status);

/** How many of `books` each status chip stands for: 'all' is every book. */
export function countStatuses(
  books: readonly BookItem[],
): Readonly<Record<BookStatusFilter, number>> {
  const counts: Record<BookStatusFilter, number> = {
    all: books.length,
    completed: 0,
    reading: 0,
    queued: 0,
  };
  for (const book of books) {
    counts[book.status] += 1;
  }
  return counts;
}
