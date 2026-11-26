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
 * @file The bookshelf's slim shapes and sizes (reading-map.ts, book-neighbors.ts, book-covers.ts,
 * shelf-geometry.ts), pure:
 * - toReadingMapEntry / lastTopicOf: a book as the reading map draws it, and nothing more;
 * - toBookNeighbor / neighborsOf: the Previous and Next books, as their links name them,
 *   wrapping round both ends;
 * - coverAt: a cover at its drawn width through the site's CDN loader, keeping the 520 x 680
 *   crop and never past the source;
 * - slotOffsetFactor: a stage slot's place from the centre, in book heights.
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
  COVER_HEIGHT,
  COVER_WIDTH,
  coverAt,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/book-covers';
import {
  neighborsOf,
  toBookNeighbor,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/book-neighbors';
import type { BookItem } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import { buildBookshelfCatalog } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/load-bookshelf';
import {
  lastTopicOf,
  toReadingMapEntry,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/reading-map';
import { slotOffsetFactor } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/shelf-geometry';

const SHELF = makeBookshelf();
const CATALOG = buildBookshelfCatalog(
  [
    makeBook({ shelfId: SHELF._id, title: 'Topical', topics: ['One', 'Two', 'Three'] }),
    makeBook({ shelfId: SHELF._id, title: 'Topicless', topics: [] }),
    makeBook({ shelfId: SHELF._id, title: 'Later', topics: ['Four', 'Five'] }),
  ],
  [SHELF],
);

function bookTitled(title: string): BookItem {
  const book = CATALOG.books.find((item) => item.title === title);
  if (!book) throw new Error(`no fixture book ${title}`);
  return book;
}

const [FIRST, ...REST] = CATALOG.books;
if (!FIRST) throw new Error('expected fixture books');
const BOOKS: readonly [BookItem, ...BookItem[]] = [FIRST, ...REST];

/** The catalog's cover URL: the Sanity CDN source, 520 x 680, cropped. */
const SOURCE = FIRST.coverSrc;

describe('toReadingMapEntry', () => {
  it('keeps only what the map draws: no summary, cover, links, topics or spine', () => {
    const book = bookTitled('Topical');

    expect(toReadingMapEntry(book)).toEqual({
      slug: book.slug,
      title: book.title,
      authors: book.authors,
      stageLabel: book.stageLabel,
      status: book.status,
      topicCount: 3,
      firstTopic: 1,
    });
    expect(JSON.stringify(toReadingMapEntry(book)).length).toBeLessThan(
      JSON.stringify(book).length / 4,
    );
  });

  it('gives the topic range by its first number, and none for a book with no topics', () => {
    const later = toReadingMapEntry(bookTitled('Later'));
    const topicless = toReadingMapEntry(bookTitled('Topicless'));

    expect(later).toMatchObject({ topicCount: 2, firstTopic: 4 });
    expect(lastTopicOf(later)).toBe(bookTitled('Later').topics.at(-1)?.number);
    expect(topicless).not.toHaveProperty('firstTopic');
    expect(topicless.topicCount).toBe(0);
    expect(lastTopicOf(topicless)).toBeUndefined();
  });
});

describe('toBookNeighbor and neighborsOf', () => {
  it('names a neighbour by its link fields alone', () => {
    const book = bookTitled('Later');

    expect(toBookNeighbor(book)).toEqual({
      slug: book.slug,
      title: book.title,
      stageLabel: book.stageLabel,
      track: book.track,
    });
  });

  it('wraps round both ends: the first book follows the last', () => {
    const [topical, topicless, later] = BOOKS;

    expect(neighborsOf(BOOKS, 0)).toEqual({ prev: later, next: topicless });
    expect(neighborsOf(BOOKS, 1)).toEqual({ prev: topical, next: later });
    expect(neighborsOf(BOOKS, 2)).toEqual({ prev: topicless, next: topical });
  });

  it('answers the book itself on both sides when it is alone', () => {
    expect(neighborsOf([FIRST], 0)).toEqual({ prev: FIRST, next: FIRST });
  });
});

describe('coverAt', () => {
  const params = (url: string): URLSearchParams => new URL(url).searchParams;

  it('starts from a 520 x 680 cropped source', () => {
    expect(params(SOURCE).get('w')).toBe(String(COVER_WIDTH));
    expect(params(SOURCE).get('h')).toBe(String(COVER_HEIGHT));
    expect(params(SOURCE).get('fit')).toBe('crop');
  });

  it.each([96, 100, 200, 260, 300, 340])(
    'draws the cover %i px wide with the same crop window and shape',
    (width) => {
      const sized = params(coverAt(SOURCE, width));

      expect(sized.get('w')).toBe(String(width));
      expect(sized.get('fit')).toBe('crop');
      expect(sized.get('auto')).toBe('format');
      expect(sized.get('q')).toBe('75');
      const height = Number(sized.get('h'));
      expect(Math.abs(height - (width * COVER_HEIGHT) / COVER_WIDTH)).toBeLessThanOrEqual(1);
    },
  );

  it('answers the source itself at its own width or wider, so it stays the cached URL', () => {
    expect(coverAt(SOURCE, COVER_WIDTH)).toBe(SOURCE);
    expect(coverAt(SOURCE, 1040)).toBe(SOURCE);
  });

  it('never asks the CDN for more than a smaller source holds', () => {
    const small = SOURCE.replace('w=520', 'w=200').replace('h=680', 'h=262');

    expect(params(coverAt(small, 260)).get('w')).toBe('200');
  });

  it('leaves a URL the CDN cannot resize as it is', () => {
    const elsewhere = 'https://example.com/cover.jpg';

    expect(coverAt(elsewhere, 96)).toBe(elsewhere);
  });
});

describe('slotOffsetFactor', () => {
  it('puts the active book at the centre and the rest symmetrically either side', () => {
    for (const finite of [false, true]) {
      expect(slotOffsetFactor(0, finite)).toBe(0);
      for (const offset of [1, 2, 5, 9]) {
        expect(slotOffsetFactor(-offset, finite)).toBe(-slotOffsetFactor(offset, finite));
      }
    }
  });

  it.each([
    ['the circular stage', false, 0.515, 0.19],
    ["a shelf's finite stage", true, 0.53, 0.205],
  ] as const)('spaces %s from its first book by an even pitch', (_label, finite, first, pitch) => {
    expect(slotOffsetFactor(1, finite)).toBeCloseTo(first, 6);
    for (const offset of [2, 3, 8]) {
      expect(slotOffsetFactor(offset, finite) - slotOffsetFactor(offset - 1, finite)).toBeCloseTo(
        pitch,
        6,
      );
    }
  });
});
