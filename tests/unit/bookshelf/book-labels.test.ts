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
 * @file The bookshelf's words and numbers (book-labels.ts):
 * - listTitles / describeShelves: the whole shelf's description, from its shelves' titles;
 * - formatStageLabel / formatTopicNumber: stage numbers in two digits, topic numbers in three;
 * - shelfStats: the summary strip, with a shelf count on the whole shelf only.
 * The books are fixture documents joined by the real buildBookshelfCatalog.
 */

import { makeBook, makeBookshelf } from '@tests/fixtures/sanity-docs';
import { describe, expect, it, vi } from 'vitest';

// The catalog builder draws each cover with the real image URL builder; the client module itself
// reads server configuration on import.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return {
    sanityFetchWithToken: vi.fn(),
    urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source),
  };
});
// Only buildBookshelfCatalog is used here; the cached Sanity loaders are never asked.
vi.mock('@/lib/sanity/loaders', () => ({ loadBookshelf: vi.fn() }));

import {
  describeShelves,
  formatStageLabel,
  formatTopicNumber,
  listTitles,
  shelfStats,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/book-labels';
import { buildBookshelfCatalog } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/load-bookshelf';

/** One shelf of books with these topic counts, joined into a catalog. */
function catalogWithTopics(topicCounts: readonly number[]) {
  const shelf = makeBookshelf({ title: 'Backend' });
  return buildBookshelfCatalog(
    topicCounts.map((count) =>
      makeBook({
        shelfId: shelf._id,
        topics: Array.from({ length: count }, (_, index) => `Topic ${index + 1}`),
      }),
    ),
    [shelf],
  );
}

describe('listTitles', () => {
  it.each([
    [['Backend'], 'Backend'],
    [['Backend', 'AI'], 'Backend and AI'],
    [['Backend', 'AI', 'Humanities'], 'Backend, AI, and Humanities'],
  ] as const)('joins %j as "%s"', (titles, joined) => {
    expect(listTitles(titles)).toBe(joined);
  });
});

describe('describeShelves', () => {
  it('names every shelf in shelf order', () => {
    const { shelves } = catalogWithTopics([1]);

    expect(describeShelves(shelves)).toBe('Foundational books across Backend.');
  });

  it('falls back to a plain line with no shelves', () => {
    expect(describeShelves([])).toBe('Foundational books, shelf by shelf.');
  });
});

describe('formatStageLabel and formatTopicNumber', () => {
  it('pads a stage to two digits and a topic to three, never cutting a longer number', () => {
    expect([3, 12, 120].map(formatStageLabel)).toEqual(['03', '12', '120']);
    expect([7, 42, 1234].map(formatTopicNumber)).toEqual(['007', '042', '1234']);
  });
});

describe('shelfStats', () => {
  it('counts books, read, shelves and topics on the whole shelf', () => {
    const { books } = catalogWithTopics([2, 3, 0]);

    expect(shelfStats({ books, readCount: 1, shelfCount: 1, isSingleShelf: false })).toEqual([
      { label: 'books', value: 3 },
      { label: 'read', value: 1 },
      { label: 'shelf', value: 1 },
      { label: 'topics', value: 5 },
    ]);
  });

  it('leaves the shelf count off one shelf, and says "book" for a single book there', () => {
    const { books } = catalogWithTopics([4]);

    expect(shelfStats({ books, readCount: 0, shelfCount: 1, isSingleShelf: true })).toEqual([
      { label: 'book', value: 1 },
      { label: 'read', value: 0 },
      { label: 'topics', value: 4 },
    ]);
  });
});
