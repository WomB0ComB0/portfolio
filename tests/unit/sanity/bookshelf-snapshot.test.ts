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
 * @file The books and the shelves are ONE snapshot: one GROQ query (bookshelfQuery), one getter
 * (getBookshelf) and one entry in the shared stale-on-error cache, which /api/v1/sanity/books,
 * /api/v1/sanity/bookshelves and every bookshelf page (loadBookshelfCatalog) all read.
 * - A book moved to a newly published shelf is never missing from the catalog: within the TTL it
 *   stays on its old shelf, after the next load it is on the new one. Before, the two lists were
 *   cached under two keys, and one key warmed earlier (or one reload failing) dropped it.
 * - While a reload fails, both lists are the last good snapshot, with one warning; after the
 *   retry backoff a good load moves the book.
 * - Books, shelves and the catalog share one Sanity request per TTL per server process.
 * - Decoding and its reports are unchanged: invalid books and shelves are dropped and reported
 *   under `decode books` and `decode bookshelves`, while the routes serve the raw lists.
 * Only the Sanity client (with the real image URL builder), YouTube, the env and Sentry are
 * mocked: the getter, the cache, the loaders, the routes and the catalog builder are real.
 */

import { makeBook, makeBookshelf } from '@tests/fixtures/sanity-docs';
import { Elysia } from 'elysia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SanityBook, SanityBookshelf } from '@/hooks/sanity/schemas';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
const sanity = vi.hoisted(() => ({ sanityFetchWithToken: vi.fn() }));

vi.mock('@sentry/nextjs', () => sentry);
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return {
    sanityFetchWithToken: sanity.sanityFetchWithToken,
    urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source),
  };
});
vi.mock('@/lib/api-integrations/youtube', () => ({
  fetchChannelVideos: vi.fn(),
  fetchYouTubeVideoMetadataBatch: vi.fn(),
}));
// t3-env validates every production variable on import.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import { loadBookshelfCatalog } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/load-bookshelf';
import { sanityRoutes } from '@/app/api/v1/[[...route]]/sanity';
import { BaseError } from '@/classes/error';
import { STALE_RETRY_BACKOFF_MS } from '@/lib/cache/stale-cache';
import { resetApiReportCooldowns } from '@/lib/observability/report';
import { getBookshelf } from '@/lib/sanity/api';
import {
  loadBookshelf,
  readBooks,
  readBookshelves,
  resetSanityLoaderCaches,
  SANITY_CACHE_TTL_MS,
} from '@/lib/sanity/loaders';
import { bookshelfQuery } from '@/lib/sanity/queries';
import { logger } from '@/utils';

const T0 = new Date('2026-11-26T12:00:00Z').getTime();
const MINUTE_MS = 60_000;

const slugOf = (current: string) => ({ _type: 'slug' as const, current });

const SYSTEMS = makeBookshelf({ title: 'Systems', slug: slugOf('systems'), order: 10 });
const AI = makeBookshelf({ title: 'AI', slug: slugOf('ai'), order: 20 });
const BOOK_B = makeBook({ slug: slugOf('book-b'), shelfId: SYSTEMS._id, order: 10 });
const BOOK_C = makeBook({ slug: slugOf('book-c'), shelfId: SYSTEMS._id, order: 20 });
/** book-b after the owner publishes the AI shelf and moves the book onto it. */
const BOOK_B_MOVED: SanityBook = { ...BOOK_B, shelfId: AI._id };

/** What the dataset holds right now: the one snapshot query answers it whole. */
interface Dataset {
  readonly books: readonly SanityBook[];
  readonly shelves: readonly SanityBookshelf[];
}

const BEFORE_MOVE: Dataset = { books: [BOOK_B, BOOK_C], shelves: [SYSTEMS] };
const AFTER_MOVE: Dataset = { books: [BOOK_B_MOVED, BOOK_C], shelves: [SYSTEMS, AI] };

let dataset: Dataset = BEFORE_MOVE;
let sanityIsDown = false;

/** Sanity as the snapshot query sees it: one answer for one revision, or one failure. */
async function fakeSanity(query: string): Promise<unknown> {
  if (query !== bookshelfQuery) throw new Error(`unexpected query: ${query.slice(0, 60)}`);
  if (sanityIsDown) throw new Error('Sanity timed out');
  return { books: [...dataset.books], shelves: [...dataset.shelves] };
}

const app = new Elysia({ prefix: '/api/v1' }).use(sanityRoutes);
const get = (path: string): Promise<Response> =>
  app.handle(new Request(`http://localhost/api/v1/sanity${path}`));

/** Each catalog book's slug and shelf title, in stage order. */
async function shelving(): Promise<readonly (readonly [string, string])[]> {
  const catalog = await loadBookshelfCatalog();
  return catalog.books.map((book) => [book.slug, book.track] as const);
}

/** The Sentry contexts reported so far. */
const reportedContexts = (): unknown[] =>
  sentry.captureException.mock.calls.map(
    ([, context]) =>
      (context as { tags?: Record<string, unknown> } | undefined)?.tags?.['api.context'],
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  resetSanityLoaderCaches();
  resetApiReportCooldowns();
  dataset = BEFORE_MOVE;
  sanityIsDown = false;
  sentry.captureException.mockReset();
  sanity.sanityFetchWithToken.mockReset().mockImplementation(fakeSanity);
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('getBookshelf', () => {
  it('answers both lists from ONE query that reads both document types', async () => {
    await expect(getBookshelf()).resolves.toEqual(BEFORE_MOVE);

    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(1);
    expect(bookshelfQuery).toMatch(/"books":\s*\*\[_type == "book"\]/);
    expect(bookshelfQuery).toMatch(/"shelves":\s*\*\[_type == "bookshelf"\]/);
  });

  it('throws a BaseError carrying the cause when Sanity fails', async () => {
    const outage = new Error('getaddrinfo ENOTFOUND abc123.api.sanity.io');
    sanity.sanityFetchWithToken.mockRejectedValue(outage);

    const failure = await getBookshelf().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(BaseError);
    expect(failure).toMatchObject({ command: 'sanity:bookshelf', cause: outage });
  });

  it.each([
    ['null', null],
    ['a list', []],
    ['books alone', { books: [] }],
    ['shelves that are not a list', { books: [], shelves: {} }],
  ])('throws instead of answering empty lists when Sanity answers %s', async (_label, answer) => {
    sanity.sanityFetchWithToken.mockResolvedValue(answer);

    const failure = await getBookshelf().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(BaseError);
    expect(failure).toMatchObject({ command: 'sanity:bookshelf' });
  });
});

describe('one snapshot for the routes and the pages', () => {
  it('A: a book moved after /bookshelves warmed the cache stays on its old shelf, then moves', async () => {
    // T0: GET /api/v1/sanity/bookshelves loads the snapshot (and with it the books).
    expect((await get('/bookshelves')).status).toBe(200);
    vi.setSystemTime(T0 + 2 * MINUTE_MS);
    dataset = AFTER_MOVE;

    vi.setSystemTime(T0 + 3 * MINUTE_MS);
    expect(await shelving()).toEqual([
      ['book-b', 'Systems'],
      ['book-c', 'Systems'],
    ]);
    // No book was left without its shelf, so nothing was reported as an orphan.
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(1);

    vi.setSystemTime(T0 + SANITY_CACHE_TTL_MS + 1);
    expect(await shelving()).toEqual([
      ['book-c', 'Systems'],
      ['book-b', 'AI'],
    ]);
    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(2);
  });

  it('B: while the reload fails both lists stay the last snapshot, with one warning', async () => {
    expect(await shelving()).toEqual([
      ['book-b', 'Systems'],
      ['book-c', 'Systems'],
    ]);
    dataset = AFTER_MOVE;
    sanityIsDown = true;
    vi.setSystemTime(T0 + SANITY_CACHE_TTL_MS + 1);

    expect(await shelving()).toEqual([
      ['book-b', 'Systems'],
      ['book-c', 'Systems'],
    ]);
    const books = await readBooks();
    const shelves = await readBookshelves();
    expect(books).toMatchObject({ stale: true, data: BEFORE_MOVE.books });
    expect(shelves).toMatchObject({ stale: true, data: BEFORE_MOVE.shelves });
    expect(reportedContexts()).toEqual(['load bookshelf for pages']);
    expect(sentry.captureException.mock.calls[0]?.[0]).toMatchObject({
      command: 'sanity:bookshelf',
    });
    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ level: 'warning' }),
    );

    // After the backoff the next request asks again, and a good load moves the book.
    sanityIsDown = false;
    vi.setSystemTime(T0 + SANITY_CACHE_TTL_MS + 1 + STALE_RETRY_BACKOFF_MS + 1);
    expect(await shelving()).toEqual([
      ['book-c', 'Systems'],
      ['book-b', 'AI'],
    ]);
    await expect(readBooks()).resolves.toMatchObject({ stale: false });
  });

  it('shares ONE Sanity request per TTL between both routes and the catalog', async () => {
    const booksRes = await get('/books');
    const shelvesRes = await get('/bookshelves');
    await loadBookshelfCatalog();
    await loadBookshelf();

    expect(await booksRes.json()).toEqual(BEFORE_MOVE.books);
    expect(await shelvesRes.json()).toEqual(BEFORE_MOVE.shelves);
    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(1);

    vi.setSystemTime(T0 + SANITY_CACHE_TTL_MS + 1);
    await loadBookshelfCatalog();
    await get('/books');
    await get('/bookshelves');
    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight load between concurrent readers', async () => {
    await Promise.all([get('/books'), get('/bookshelves'), loadBookshelfCatalog()]);

    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(1);
  });

  it('rejects the catalog with the getter error when Sanity fails with nothing cached', async () => {
    sanityIsDown = true;

    await expect(loadBookshelfCatalog()).rejects.toMatchObject({ command: 'sanity:bookshelf' });
    // The page reports nothing itself: Next reports page errors.
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('decodes and reports invalid documents as before, while the routes serve them raw', async () => {
    const badBook = { ...makeBook({ shelfId: SYSTEMS._id }), status: 'in-progress' };
    const { slug: _slug, ...badShelf } = makeBookshelf();
    dataset = {
      books: [BOOK_B, badBook as unknown as SanityBook, BOOK_C],
      shelves: [SYSTEMS, badShelf as unknown as SanityBookshelf],
    };

    const { books, shelves } = await loadBookshelf();
    // A second request decodes the same cached answer again: nothing is reported twice.
    await loadBookshelfCatalog();

    expect(books.map((book) => book._id)).toEqual([BOOK_B._id, BOOK_C._id]);
    expect(shelves.map((shelf) => shelf._id)).toEqual([SYSTEMS._id]);
    expect(reportedContexts().sort()).toEqual(['decode books', 'decode bookshelves']);
    expect(await (await get('/books')).json()).toHaveLength(3);
    expect(await (await get('/bookshelves')).json()).toHaveLength(2);
  });
});
