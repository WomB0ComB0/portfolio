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
 * titles, zero-padded stage and topic numbers (03, 007), the nouns it counts (in the site's
 * `{ one, many }` shape, for countOf and noMatchSentence) and the summary strip's figures. The
 * catalog loader (load-bookshelf.ts) labels each book's stage; the stage, the controls bar, the
 * detail view and the reading map format numbers the same way. Plain joins and no locale, so the
 * server and the browser render the same text. Pure and isomorphic; guarded by
 * tests/unit/bookshelf/book-labels.test.ts.
 */

import type { StatStripItem } from '@/components/console/stat-strip';
import type { BookItem, ShelfCollection } from './books';

/** What the bookshelf counts: 'book' for one, 'books' for any other number. */
export const BOOK_NOUN = { one: 'book', many: 'books' } as const;
export const SHELF_NOUN = { one: 'shelf', many: 'shelves' } as const;
export const TOPIC_NOUN = { one: 'topic', many: 'topics' } as const;
/** The reading map's total: every book's topics, numbered across the curriculum. */
export const NUMBERED_TOPIC_NOUN = { one: 'numbered topic', many: 'numbered topics' } as const;

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
  /** One shelf's page: its strip has no shelf count. */
  readonly isSingleShelf: boolean;
}

/**
 * The summary strip's items: books, read, shelves (the whole shelf only) and topics, each label
 * in the singular for one. The strip draws the figure beside it.
 */
export function shelfStats({
  books,
  readCount,
  shelfCount,
  isSingleShelf,
}: ShelfStatsInput): readonly StatStripItem[] {
  const bookCount = books.length;
  const topicCount = books.reduce((sum, book) => sum + book.topics.length, 0);
  const booksItem = { label: bookCount === 1 ? BOOK_NOUN.one : BOOK_NOUN.many, value: bookCount };
  const readItem = { label: 'read', value: readCount };
  const topicsItem = {
    label: topicCount === 1 ? TOPIC_NOUN.one : TOPIC_NOUN.many,
    value: topicCount,
  };
  return isSingleShelf
    ? [booksItem, readItem, topicsItem]
    : [
        booksItem,
        readItem,
        { label: shelfCount === 1 ? SHELF_NOUN.one : SHELF_NOUN.many, value: shelfCount },
        topicsItem,
      ];
}
