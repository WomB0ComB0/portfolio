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
 * @file The /bookshelf URL contract, on nuqs/server parsers so they are safe to import on the
 * server (src/lib/filters/define-filters.ts does the same). The stage (bookshelf-stage.tsx) reads
 * it on /bookshelf and /bookshelf/shelf/[shelfSlug]:
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
 */

import { parseAsString, parseAsStringLiteral } from 'nuqs/server';
import { BOOK_STATUSES } from '@/sanity/bookshelf-rules';

/** ?status values: 'all' for no filter, or one of the reading statuses. */
export const BOOKSHELF_STATUS_VALUES = ['all', ...BOOK_STATUSES] as const;
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
