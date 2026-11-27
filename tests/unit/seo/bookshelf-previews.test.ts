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
 * @file What a book's and a shelf's link-preview card draws, and the image the page's metadata
 * names for it: a slug-keyed URL under /api/og (never a cover URL in the query), a version of
 * what is drawn so an edited book is a new URL, the 1200x630 PNG it is drawn as, and alt text
 * that describes the covers. The catalog is the real one, built from Sanity-shaped documents with
 * the real image URL builder.
 */

import { makeBook, makeBookshelf } from '@tests/fixtures/sanity-docs';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

// t3-env validates every variable on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return {
    sanityFetchWithToken: vi.fn(),
    urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source),
  };
});

import type { BookItem } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import { buildBookshelfCatalog } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/load-bookshelf';
import {
  BOOK_CARD_PATH,
  BOOK_CARD_TITLE_MAX,
  bookCardTitle,
  bookPreviewImage,
  bookPreviewOf,
} from '@/app/api/og/_lib/book-preview';
import { cardVersion } from '@/app/api/og/_lib/card-version';
import {
  SHELF_CARD_COVERS,
  SHELF_CARD_PATH,
  shelfPreviewImage,
  shelfPreviewOf,
} from '@/app/api/og/_lib/shelf-preview';

const shelf = makeBookshelf({
  title: 'Web & Languages',
  slug: { _type: 'slug', current: 'web-and-languages' },
  description: 'Python, JavaScript and the web.',
});
const docs = [
  makeBook({
    shelfId: shelf._id,
    title: 'Job Ready Python',
    slug: { _type: 'slug', current: 'job-ready-python' },
    authors: 'Hayden Van Der Post',
    status: 'completed',
  }),
  ...Array.from({ length: 5 }, (_, index) =>
    makeBook({ shelfId: shelf._id, title: `Web Book ${index + 2}` }),
  ),
];
const catalog = buildBookshelfCatalog(docs, [shelf]);
const [book] = catalog.books as [BookItem, ...BookItem[]];
const [shelfCollection] = catalog.shelves;
if (!shelfCollection) throw new Error('expected the fixture shelf');

const versionOf = (url: string): string | null =>
  new URL(url, 'https://mikeodnis.dev').searchParams.get('v');

describe("a book's preview card", () => {
  it('draws the title, stage, authors, shelf, status and the catalog’s own cover', () => {
    expect(bookPreviewOf(book)).toEqual({
      title: 'Job Ready Python',
      stageLabel: '01',
      authors: 'Hayden Van Der Post',
      shelf: 'Web & Languages',
      status: 'completed',
      coverSrc: book.coverSrc,
    });
    expect(new URL(book.coverSrc).hostname).toBe('cdn.sanity.io');
  });

  it('is named by the book’s slug and a version, with no cover URL in the query', () => {
    const image = bookPreviewImage(book);
    const url = new URL(image.url, 'https://mikeodnis.dev');

    expect(url.pathname).toBe(`${BOOK_CARD_PATH}/job-ready-python`);
    expect([...url.searchParams.keys()]).toEqual(['v']);
    expect(image.url).not.toContain('sanity');
    expect(versionOf(image.url)).toBe(cardVersion(bookPreviewOf(book)));
  });

  it('declares the 1200x630 PNG it is drawn as, with alt text describing the cover', () => {
    expect(bookPreviewImage(book)).toMatchObject({
      width: 1200,
      height: 630,
      type: 'image/png',
      alt: 'Cover of Job Ready Python by Hayden Van Der Post, read, on the Web & Languages shelf',
    });
  });

  it('encodes a slug that is not URL-safe', () => {
    const odd = { ...book, slug: 'c++ & you/2' };

    expect(new URL(bookPreviewImage(odd).url, 'https://x.test').pathname).toBe(
      `${BOOK_CARD_PATH}/c%2B%2B%20%26%20you%2F2`,
    );
  });

  it.each([
    ['status', { status: 'reading' }],
    ['cover', { coverSrc: `${book.coverSrc}&rect=0,0,10,10` }],
    ['title', { title: 'Job Ready Python, 2nd edition' }],
    ['shelf', { track: 'Languages' }],
    ['stage', { stageLabel: '02' }],
    ['authors', { authors: 'Someone Else' }],
  ] as const)('is a new URL when the %s changes', (_field, change) => {
    expect(versionOf(bookPreviewImage({ ...book, ...change }).url)).not.toBe(
      versionOf(bookPreviewImage(book).url),
    );
  });

  it('keeps its URL when only what it does not draw changes (the summary, the topics)', () => {
    const edited = { ...book, summary: 'A new summary.', topics: [] };

    expect(bookPreviewImage(edited).url).toBe(bookPreviewImage(book).url);
  });
});

describe("a book card's title", () => {
  it('keeps a title that fits whole', () => {
    expect(bookCardTitle('Job Ready Python')).toBe('Job Ready Python');
  });

  it('drops the subtitle of a title too long for the card, when the main title fits', () => {
    const long =
      'Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow: Concepts, Tools, and Techniques to Build Intelligent Systems';

    expect(bookCardTitle(long)).toBe(
      'Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow',
    );
  });

  it('clips a long title with no subtitle at a word, within the card', () => {
    const long =
      'A very long title that never pauses for a colon and goes on and on and on and on forever';
    const fitted = bookCardTitle(long);

    expect(long.length).toBeGreaterThan(BOOK_CARD_TITLE_MAX);
    expect(fitted.length).toBeLessThanOrEqual(BOOK_CARD_TITLE_MAX);
    expect(fitted.endsWith('…')).toBe(true);
  });
});

describe("a shelf's preview card", () => {
  const books = catalog.books;

  it('draws the shelf’s title, description, counts and its first few covers', () => {
    const preview = shelfPreviewOf(shelfCollection, books);

    expect(preview).toMatchObject({
      title: 'Web & Languages',
      description: 'Python, JavaScript and the web.',
      bookCount: 6,
      readCount: 1,
    });
    expect(preview.covers).toHaveLength(SHELF_CARD_COVERS);
    expect(preview.covers.map((cover) => cover.title)).toEqual(
      books.slice(0, SHELF_CARD_COVERS).map((item) => item.title),
    );
    expect(preview.covers.map((cover) => cover.coverSrc)).toEqual(
      books.slice(0, SHELF_CARD_COVERS).map((item) => item.coverSrc),
    );
  });

  it('is named by the shelf’s slug and a version, as a 1200x630 PNG with alt text', () => {
    const image = shelfPreviewImage(shelfCollection, books);
    const url = new URL(image.url, 'https://mikeodnis.dev');

    expect(url.pathname).toBe(`${SHELF_CARD_PATH}/web-and-languages`);
    expect([...url.searchParams.keys()]).toEqual(['v']);
    expect(versionOf(image.url)).toBe(cardVersion(shelfPreviewOf(shelfCollection, books)));
    expect(image).toMatchObject({ width: 1200, height: 630, type: 'image/png' });
    expect(image.alt).toBe(
      'Covers of Job Ready Python, Web Book 2, Web Book 3, and Web Book 4 on the Web & Languages shelf (6 books)',
    );
  });

  it('describes a one-book shelf in the singular', () => {
    const image = shelfPreviewImage({ ...shelfCollection, bookSlugs: [book.slug] }, [book]);

    expect(image.alt).toBe('Cover of Job Ready Python on the Web & Languages shelf (1 book)');
  });

  it('keeps its URL when a book past the covers changes, and changes when a cover does', () => {
    const base = shelfPreviewImage(shelfCollection, books).url;
    const lastChanged = books.map((item, index) =>
      index === books.length - 1 ? { ...item, title: 'Renamed' } : item,
    );
    const firstChanged = books.map((item, index) =>
      index === 0 ? { ...item, coverSrc: `${item.coverSrc}&q=1` } : item,
    );

    expect(shelfPreviewImage(shelfCollection, lastChanged).url).toBe(base);
    expect(shelfPreviewImage(shelfCollection, firstChanged).url).not.toBe(base);
  });
});

describe('a card version', () => {
  it('is short, URL-safe and the same for the same drawing', () => {
    const version = cardVersion({ a: 1, b: 'two' });

    expect(version).toMatch(/^[0-9a-z]{1,8}$/);
    expect(cardVersion({ a: 1, b: 'two' })).toBe(version);
    expect(cardVersion({ a: 1, b: 'three' })).not.toBe(version);
  });
});
