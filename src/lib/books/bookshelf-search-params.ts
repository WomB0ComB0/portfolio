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
 * @file Shared isomorphic `nuqs` search-param schemas for `/bookshelf`, `/bookshelf/shelf/*`,
 * and `/bookshelf/free`. Uses `nuqs/server` parsers so both Server Components (link builders,
 * serializers) and Client Components (`useQueryStates`) stay in lockstep with zero duplicate logic.
 */

import { parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs/server';
import { BOOK_STATUSES } from '@/sanity/bookshelf-rules';

export const BOOKSHELF_STATUS_VALUES = ['all', ...BOOK_STATUSES] as const;
export const BOOKSHELF_GROUP_VALUES = ['topic', 'status'] as const;

export const FREE_BOOKS_SOURCE_VALUES = ['all', 'langs', 'subjects'] as const;
export const FREE_BOOKS_FORMAT_VALUES = [
  'all',
  'PDF',
  'HTML',
  'EPUB',
  'Kindle',
  'Markdown',
  'AsciiDoc',
] as const;
export const FREE_BOOKS_SORT_VALUES = ['title', 'category', 'host'] as const;
export const FREE_BOOKS_DIR_VALUES = ['asc', 'desc'] as const;
export const FREE_BOOKS_PAGE_SIZES = [25, 50, 100] as const;

export type FreeBooksSortField = (typeof FREE_BOOKS_SORT_VALUES)[number];
export type FreeBooksSortDir = (typeof FREE_BOOKS_DIR_VALUES)[number];

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

/** URL state for `/bookshelf/free` table explorer (filters, sorting, pagination). */
export const freeBooksSearchParsers = {
  q: parseAsString.withDefault(''),
  source: parseAsStringLiteral(FREE_BOOKS_SOURCE_VALUES).withDefault('all'),
  category: parseAsString.withDefault('all'),
  format: parseAsStringLiteral(FREE_BOOKS_FORMAT_VALUES).withDefault('all'),
  sort: parseAsStringLiteral(FREE_BOOKS_SORT_VALUES).withDefault('title'),
  dir: parseAsStringLiteral(FREE_BOOKS_DIR_VALUES).withDefault('asc'),
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(50),
  /** Default hides archived entries; `?archived=true` reveals them. */
  archived: parseAsBoolean.withDefault(false),
  /** Default hides confirmed-unavailable entries; `?unavailable=true` reveals them. */
  unavailable: parseAsBoolean.withDefault(false),
  /** Default shows in-progress entries; `?hideWip=true` hides them. */
  hideWip: parseAsBoolean.withDefault(false),
  https: parseAsBoolean.withDefault(false),
  verified: parseAsBoolean.withDefault(false),
};

/** Clamps arbitrary `?perPage=` query input to one of the supported table page sizes. */
export function normalizeFreeBooksPageSize(raw: number): (typeof FREE_BOOKS_PAGE_SIZES)[number] {
  if (raw <= 25) return 25;
  if (raw >= 100) return 100;
  return 50;
}
