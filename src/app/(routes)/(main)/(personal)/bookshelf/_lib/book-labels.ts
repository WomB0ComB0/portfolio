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
 * @file The bookshelf's words and numbers: the whole shelf's description from its shelves'
 * titles, zero-padded stage and topic numbers (03, 007), and the summary strip's figures. The
 * catalog loader (load-bookshelf.ts) labels each book's stage; the stage, the controls bar, the
 * detail view and the reading map format numbers the same way. Plain joins and no locale, so the
 * server and the browser render the same text. Pure and isomorphic; guarded by
 * tests/unit/bookshelf/book-labels.test.ts.
 */

import type { StatStripItem } from '@/components/console/stat-strip';
import type { BookItem, ShelfCollection } from './books';

/** "A", "A and B", or "A, B, and C". Plain joins, so the server and browser render the same text. */
export function listTitles(titles: readonly string[]): string {
  if (titles.length <= 2) return titles.join(' and ');
  return `${titles.slice(0, -1).join(', ')}, and ${titles.at(-1)}`;
}

/** The whole shelf's description: its shelves' titles in shelf order, never a fixed subject list. */
export function describeShelves(shelves: readonly ShelfCollection[]): string {
  return shelves.length === 0
    ? 'Foundational books, shelf by shelf.'
    : `Foundational books across ${listTitles(shelves.map((shelf) => shelf.title))}.`;
}

/** A stage number (or a book count beside one) as the shelf shows it: two digits, "03". */
export const formatStageLabel = (stage: number): string => String(stage).padStart(2, '0');

/** A topic number as the detail view and the reading map show it: three digits, "007". */
export const formatTopicNumber = (topic: number): string => String(topic).padStart(3, '0');

/** What the summary strip counts. */
export interface ShelfStatsInput {
  /** The books on the stage. */
  readonly books: readonly BookItem[];
  /** How many of them have been read. */
  readonly readCount: number;
  readonly shelfCount: number;
  /** One shelf's page: its strip has no shelf count, and says "book" for a single book. */
  readonly isSingleShelf: boolean;
}

/** The summary strip's items: books, read, shelves (the whole shelf only) and topics. */
export function shelfStats({
  books,
  readCount,
  shelfCount,
  isSingleShelf,
}: ShelfStatsInput): readonly StatStripItem[] {
  const bookCount = books.length;
  const topicCount = books.reduce((sum, book) => sum + book.topics.length, 0);
  return isSingleShelf
    ? [
        { label: bookCount === 1 ? 'book' : 'books', value: bookCount },
        { label: 'read', value: readCount },
        { label: 'topics', value: topicCount },
      ]
    : [
        { label: 'books', value: bookCount },
        { label: 'read', value: readCount },
        { label: shelfCount === 1 ? 'shelf' : 'shelves', value: shelfCount },
        { label: 'topics', value: topicCount },
      ];
}
