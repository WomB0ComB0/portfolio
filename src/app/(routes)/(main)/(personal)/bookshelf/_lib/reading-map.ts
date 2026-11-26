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
 * @file The reading map's slim book: what the map lists for each book and nothing more, so a page
 * that shows one book (/bookshelf/[slug]) can map the whole catalog cheaply. The stage and the
 * book page build the entries; reading-map-dialog.tsx and book-detail-view.tsx draw them. Pure and
 * isomorphic; guarded by tests/unit/bookshelf/slim-shapes.test.ts.
 */

import type { BookItem, BookStatus } from './books';

/**
 * One book as the reading map lists it: what the map draws and nothing more, so a page that
 * shows one book (/bookshelf/[slug]) maps the whole catalog for about a sixth of its bytes.
 */
export interface ReadingMapEntry {
  readonly slug: string;
  readonly title: string;
  readonly authors: string;
  readonly stageLabel: string;
  readonly status: BookStatus;
  readonly topicCount: number;
  /**
   * The number of the book's first topic, absent when it has none. A book's topics are numbered
   * in one run (buildBookshelfCatalog), so its last is `firstTopic + topicCount - 1`.
   */
  readonly firstTopic?: number;
}

/** A book's reading-map entry. */
export function toReadingMapEntry(book: BookItem): ReadingMapEntry {
  const firstTopic = book.topics[0]?.number;
  return {
    slug: book.slug,
    title: book.title,
    authors: book.authors,
    stageLabel: book.stageLabel,
    status: book.status,
    topicCount: book.topics.length,
    ...(firstTopic === undefined ? {} : { firstTopic }),
  };
}

/** The number of an entry's last topic, or undefined when it has none. */
export const lastTopicOf = (entry: ReadingMapEntry): number | undefined =>
  entry.firstTopic === undefined ? undefined : entry.firstTopic + entry.topicCount - 1;
