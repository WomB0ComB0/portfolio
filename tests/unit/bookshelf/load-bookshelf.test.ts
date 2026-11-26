// @vitest-environment node
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
 * @file The bookshelf's one loader (bookshelf/_lib/load-bookshelf.ts) builds what every bookshelf
 * page, the sitemap and the link-health catalog render from Sanity's `book` and `bookshelf`
 * documents, with no built-in catalog to fall back to:
 * - books are joined to their shelf by `shelfId` and ordered by shelf, then by book order;
 * - stages and topics are numbered continuously across shelves, and a book's track is its
 *   shelf's title;
 * - each cover is drawn from its Sanity asset; the alt is Studio's, else the title and authors;
 * - optional facts Studio leaves empty stay undefined;
 * - a book on no published shelf is dropped and reported once; a shelf with no books is left out;
 * - an empty dataset is an empty catalog, and a Sanity outage (a loader rejects) rejects.
 * The cached Sanity loaders and Sentry are mocked; the image URL builder is the real one.
 */

import { makeBook, makeBookshelf } from '@tests/fixtures/sanity-docs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loaders = vi.hoisted(() => ({ loadBooks: vi.fn(), loadBookshelves: vi.fn() }));
const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock('@/lib/sanity/loaders', () => loaders);
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return {
    sanityFetchWithToken: vi.fn(),
    urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source),
  };
});
vi.mock('@sentry/nextjs', () => sentry);

import { getLiveConsoleSpineTheme } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import {
  buildBookshelfCatalog,
  hasBooks,
  loadBookshelfCatalog,
  loadCatalogBookBySlug,
  loadCatalogShelfBySlug,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/load-bookshelf';
import { resetApiReportCooldowns } from '@/lib/observability/report';

const slugOf = (current: string) => ({ _type: 'slug' as const, current });

/** A cover image on the asset `ref`, optionally with Studio alt text. */
const coverOf = (ref: string, alt?: string) => ({
  _type: 'image' as const,
  asset: { _type: 'reference' as const, _ref: ref },
  ...(alt === undefined ? {} : { alt }),
});

/** The one Sentry event's error and capture context. */
const reported = () => {
  const [error, context] = sentry.captureException.mock.calls[0] ?? [];
  return {
    error: error as { message: string; command: string; metadata: { books: string[] } },
    context,
  };
};

beforeEach(() => {
  sentry.captureException.mockReset();
  resetApiReportCooldowns();
  loaders.loadBooks.mockReset().mockResolvedValue([]);
  loaders.loadBookshelves.mockReset().mockResolvedValue([]);
});

describe('buildBookshelfCatalog order and numbering', () => {
  const systems = makeBookshelf({ title: 'Systems', slug: slugOf('systems'), order: 10 });
  const humanities = makeBookshelf({ title: 'Humanities', slug: slugOf('humanities'), order: 20 });

  it('orders books by shelf, then by book order within each shelf', () => {
    // As booksQuery answers them: by book order alone, so the two shelves interleave.
    const h1 = makeBook({ shelfId: humanities._id, order: 10 });
    const s1 = makeBook({ shelfId: systems._id, order: 20 });
    const h2 = makeBook({ shelfId: humanities._id, order: 30 });
    const s2 = makeBook({ shelfId: systems._id, order: 40 });

    const { books } = buildBookshelfCatalog([h1, s1, h2, s2], [systems, humanities]);

    expect(books.map((book) => book.slug)).toEqual([s1, s2, h1, h2].map((doc) => doc.slug.current));
    expect(books.map((book) => book.stage)).toEqual([1, 2, 3, 4]);
    expect(books.map((book) => book.stageLabel)).toEqual(['01', '02', '03', '04']);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("keeps each shelf's books together when two shelves share an order value", () => {
    const first = makeBookshelf({ order: 10 });
    const second = makeBookshelf({ order: 10 });
    const b1 = makeBook({ shelfId: second._id });
    const a1 = makeBook({ shelfId: first._id });
    const b2 = makeBook({ shelfId: second._id });
    const a2 = makeBook({ shelfId: first._id });

    const { books } = buildBookshelfCatalog([b1, a1, b2, a2], [first, second]);

    expect(books.map((book) => book.slug)).toEqual([a1, a2, b1, b2].map((doc) => doc.slug.current));
  });

  it("labels each book's track with its shelf's title and links its shelf by slug", () => {
    const { books } = buildBookshelfCatalog(
      [makeBook({ shelfId: humanities._id }), makeBook({ shelfId: systems._id })],
      [systems, humanities],
    );

    expect(books.map((book) => [book.track, book.shelfSlug])).toEqual([
      ['Systems', 'systems'],
      ['Humanities', 'humanities'],
    ]);
  });

  it('numbers topics continuously across shelves, skipping blank ones, and counts them', () => {
    const docs = [
      makeBook({ shelfId: humanities._id, topics: ['Ethics', '  ', ' Rhetoric '] }),
      makeBook({ shelfId: systems._id, topics: ['Queues', 'Caches'] }),
      makeBook({ shelfId: systems._id, topics: null }),
    ];

    const { books, totalTopics } = buildBookshelfCatalog(docs, [systems, humanities]);

    expect(books.map((book) => book.topics)).toEqual([
      [
        { number: 1, title: 'Queues' },
        { number: 2, title: 'Caches' },
      ],
      [],
      [
        { number: 3, title: 'Ethics' },
        { number: 4, title: 'Rhetoric' },
      ],
    ]);
    expect(totalTopics).toBe(4);
  });

  it('gives each book a Live Console spine by its position and keeps its last change', () => {
    const docs = Array.from({ length: 4 }, () => makeBook({ shelfId: systems._id }));

    const { books } = buildBookshelfCatalog(docs, [systems]);

    books.forEach((book, index) => {
      expect(book.spine).toEqual(getLiveConsoleSpineTheme(index));
      expect(book.updatedAt).toBe(docs[index]?._updatedAt);
    });
  });
});

describe('buildBookshelfCatalog book facts', () => {
  const shelf = makeBookshelf();

  it('draws each cover from its own Sanity asset, cropped to 520x680 in the best format', () => {
    const docs = [
      makeBook({ shelfId: shelf._id }),
      makeBook({ shelfId: shelf._id, coverImage: coverOf('image-def456-800x1000-png') }),
    ];

    const [first, second] = buildBookshelfCatalog(docs, [shelf]).books;

    expect(first?.coverSrc).toMatch(
      /^https:\/\/cdn\.sanity\.io\/images\/test\/test\/abc123-520x680\.webp\?/,
    );
    expect(second?.coverSrc).toMatch(
      /^https:\/\/cdn\.sanity\.io\/images\/test\/test\/def456-800x1000\.png\?/,
    );
    for (const book of [first, second]) {
      const params = new URL(book?.coverSrc ?? '').searchParams;
      expect(params.get('w')).toBe('520');
      expect(params.get('h')).toBe('680');
      expect(params.get('fit')).toBe('crop');
      expect(params.get('auto')).toBe('format');
    }
  });

  it("uses Studio's alt text for the cover, else the title and authors", () => {
    const docs = [
      makeBook({
        shelfId: shelf._id,
        coverImage: coverOf('image-abc123-520x680-webp', '  A red cover  '),
      }),
      makeBook({ shelfId: shelf._id, title: 'Queues', authors: 'Ada Lovelace' }),
      makeBook({
        shelfId: shelf._id,
        title: 'Caches',
        authors: 'Grace Hopper',
        coverImage: coverOf('image-abc123-520x680-webp', '   '),
      }),
    ];

    const { books } = buildBookshelfCatalog(docs, [shelf]);

    expect(books.map((book) => book.coverAlt)).toEqual([
      'A red cover',
      'Queues by Ada Lovelace',
      'Caches by Grace Hopper',
    ]);
  });

  it('leaves the optional facts Studio has no value for undefined, and trims the rest', () => {
    const bare = makeBook({
      shelfId: shelf._id,
      publisher: null,
      edition: '   ',
      year: null,
      url: '',
    });
    const full = makeBook({
      shelfId: shelf._id,
      publisher: " O'Reilly ",
      edition: '2nd edition',
      year: 2020,
      isbn: ' 9780306406157 ',
      url: ' https://example.com/book ',
    });

    const [bareBook, fullBook] = buildBookshelfCatalog([bare, full], [shelf]).books;

    expect(bareBook).toMatchObject({ title: bare.title, authors: bare.authors });
    for (const fact of ['publisher', 'edition', 'year', 'isbn', 'url'] as const) {
      expect(bareBook?.[fact], fact).toBeUndefined();
    }
    expect(fullBook).toMatchObject({
      publisher: "O'Reilly",
      edition: '2nd edition',
      year: 2020,
      isbn: '9780306406157',
      url: 'https://example.com/book',
    });
  });

  it("falls back to the title for the spine and to the first author's surname", () => {
    const plain = makeBook({
      shelfId: shelf._id,
      title: 'Notes on Engines',
      authors: 'Ada Lovelace, Charles Babbage',
    });
    const styled = makeBook({ shelfId: shelf._id, spineTitle: 'ENGINES', spineAuthor: 'ADA' });

    const [plainBook, styledBook] = buildBookshelfCatalog([plain, styled], [shelf]).books;

    expect(plainBook).toMatchObject({ spineTitle: 'Notes on Engines', spineAuthor: 'LOVELACE' });
    expect(styledBook).toMatchObject({ spineTitle: 'ENGINES', spineAuthor: 'ADA' });
  });
});

describe('buildBookshelfCatalog shelves', () => {
  it('lists the shelves with books in shelf order, each with its books in stage order', () => {
    const first = makeBookshelf({ description: '  Where it starts.  ' });
    const empty = makeBookshelf();
    const last = makeBookshelf({ description: null });
    const docs = [
      makeBook({ shelfId: last._id }),
      makeBook({ shelfId: first._id }),
      makeBook({ shelfId: last._id }),
    ];

    const { books, shelves } = buildBookshelfCatalog(docs, [first, empty, last]);

    expect(shelves).toEqual([
      {
        slug: first.slug.current,
        title: first.title,
        description: 'Where it starts.',
        bookSlugs: [books[0]?.slug],
        updatedAt: first._updatedAt,
      },
      {
        slug: last.slug.current,
        title: last.title,
        description: '2 curated books.',
        bookSlugs: [books[1]?.slug, books[2]?.slug],
        updatedAt: last._updatedAt,
      },
    ]);
  });

  it('describes a one-book shelf with no Studio description in the singular', () => {
    const shelf = makeBookshelf();

    const { shelves } = buildBookshelfCatalog([makeBook({ shelfId: shelf._id })], [shelf]);

    expect(shelves[0]?.description).toBe('1 curated book.');
  });

  it('drops the books on no published shelf and reports them in one warning', () => {
    const shelf = makeBookshelf();
    const placed = makeBook({ shelfId: shelf._id, topics: ['One', 'Two'] });
    const deleted = makeBook({ shelfId: 'bookshelf-deleted', topics: ['Lost'] });
    const draftOnly = makeBook({ shelfId: 'bookshelf-draft' });

    const catalog = buildBookshelfCatalog([deleted, placed, draftOnly], [shelf]);

    expect(catalog.books.map((book) => [book.slug, book.stage])).toEqual([
      [placed.slug.current, 1],
    ]);
    expect(catalog.totalTopics).toBe(2);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    const { error, context } = reported();
    expect(error.message).toContain('2 books reference no published shelf');
    expect(error.command).toBe('bookshelf:catalog');
    expect(error.metadata.books).toEqual([deleted.slug.current, draftOnly.slug.current]);
    expect(context).toMatchObject({
      level: 'warning',
      tags: { 'api.context': 'bookshelf catalog' },
    });
  });

  it('answers an empty catalog for an empty dataset or shelves with no books', () => {
    const empty = { books: [], shelves: [], totalTopics: 0 };

    expect(buildBookshelfCatalog([], [])).toEqual(empty);
    expect(buildBookshelfCatalog([], [makeBookshelf(), makeBookshelf()])).toEqual(empty);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('loadBookshelfCatalog', () => {
  const shelf = makeBookshelf({ slug: slugOf('systems') });
  const empty = makeBookshelf({ slug: slugOf('empty') });
  const first = makeBook({ shelfId: shelf._id });
  const second = makeBook({ shelfId: shelf._id });

  beforeEach(() => {
    loaders.loadBooks.mockResolvedValue([first, second]);
    loaders.loadBookshelves.mockResolvedValue([shelf, empty]);
  });

  it('builds the catalog from what the cached Sanity loaders answer', async () => {
    const catalog = await loadBookshelfCatalog();

    expect(catalog).toEqual(buildBookshelfCatalog([first, second], [shelf, empty]));
    expect(hasBooks(catalog.books)).toBe(true);
  });

  it('answers an empty catalog, with no books for the islands, for an empty dataset', async () => {
    loaders.loadBooks.mockResolvedValue([]);
    loaders.loadBookshelves.mockResolvedValue([]);

    const catalog = await loadBookshelfCatalog();

    expect(catalog).toEqual({ books: [], shelves: [], totalTopics: 0 });
    expect(hasBooks(catalog.books)).toBe(false);
  });

  it.each(['loadBooks', 'loadBookshelves'] as const)(
    'rejects, with no built-in catalog in its place, when %s rejects',
    async (loader) => {
      const outage = new Error('Sanity answered 503');
      loaders[loader].mockRejectedValue(outage);

      await expect(loadBookshelfCatalog()).rejects.toBe(outage);
      await expect(loadCatalogBookBySlug(first.slug.current)).rejects.toBe(outage);
      await expect(loadCatalogShelfBySlug('systems')).rejects.toBe(outage);
    },
  );

  it('finds a book by slug with its catalog, and answers null for an unknown slug', async () => {
    const hit = await loadCatalogBookBySlug(second.slug.current);

    expect(hit?.book).toMatchObject({ slug: second.slug.current, stage: 2 });
    expect(hit?.catalog.books).toHaveLength(2);
    await expect(loadCatalogBookBySlug('no-such-book')).resolves.toBeNull();
  });

  it('finds a shelf with its books in stage order, and answers null for an unknown or empty one', async () => {
    const hit = await loadCatalogShelfBySlug('systems');

    expect(hit?.shelf.slug).toBe('systems');
    expect(hit?.books.map((book) => book.slug)).toEqual([first.slug.current, second.slug.current]);
    await expect(loadCatalogShelfBySlug('no-such-shelf')).resolves.toBeNull();
    await expect(loadCatalogShelfBySlug('empty')).resolves.toBeNull();
  });
});
