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
 * @file /api/og/book/<slug>, a book's link-preview card, rendered for real with next/og: the
 * slug is looked up in the catalog (Sanity getters mocked, loaders real) and only that book's own
 * cover is fetched (network fetches stubbed, answering with a real PNG; next/og's own wasm still
 * loads from disk). It answers:
 * - the book card, a 1200x630 PNG, kept a year at the URL naming its current version and an hour
 *   at any other;
 * - 404, uncached and with nothing fetched, for a slug the catalog does not have;
 * - the text card it had before, uncached, when the cover cannot be fetched or drawn;
 * - the generic book text card, uncached, when Sanity is down;
 * - the API guard's 429, before anything is looked up.
 * Nothing in the query can make it fetch another address.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { imageInfo } from '@tests/fixtures/image-size';
import { makeBook, makeBookshelf } from '@tests/fixtures/sanity-docs';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

const sanityApi = vi.hoisted(() => ({ getBookshelf: vi.fn() }));
const guard = vi.hoisted(() => ({ check: vi.fn() }));
const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
/** Every card the route asked to draw, in order. */
const drawn = vi.hoisted(() => ({ cards: [] as ReactElement[] }));

// t3-env validates every variable on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sanity/api')>()),
  ...sanityApi,
}));
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return {
    sanityFetchWithToken: vi.fn(),
    urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source),
  };
});
vi.mock('@/lib/security/api-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/security/api-guard')>()),
  apiGuard: guard,
}));
vi.mock('@sentry/nextjs', () => sentry);
vi.mock('@/lib/og/render', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/og/render')>();
  return {
    ...actual,
    renderOgCard: (card: ReactElement, init?: Parameters<typeof actual.renderOgCard>[1]) => {
      drawn.cards.push(card);
      return actual.renderOgCard(card, init);
    },
  };
});

import { buildBookshelfCatalog } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/load-bookshelf';
import { BookCard } from '@/app/api/og/_lib/book-card';
import { bookPreviewImage } from '@/app/api/og/_lib/book-preview';
import { RECHECKED_CARD_CACHE_CONTROL } from '@/app/api/og/_lib/draw-card';
import { GET } from '@/app/api/og/book/[slug]/route';
import { resetApiReportCooldowns } from '@/lib/observability/report';
import { PageCard } from '@/lib/og/cards';
import { PAGE_CARD_CACHE_CONTROL } from '@/lib/og/constants';
import { resetSanityLoaderCaches } from '@/lib/sanity/loaders';
import { logger } from '@/utils';

/** Rendering a card takes a few hundred milliseconds; the first also loads the fonts and wasm. */
const RENDER_TIMEOUT = 30_000;

/** A real PNG for the cover, so Satori decodes and draws an actual image. */
const COVER_PNG = readFileSync(join(process.cwd(), 'public/pwa/apple-touch-icon.png'));

const shelf = makeBookshelf({ title: 'Web & Languages' });
const book = makeBook({
  shelfId: shelf._id,
  title: 'Job Ready Python',
  slug: { _type: 'slug', current: 'job-ready-python' },
  authors: 'Hayden Van Der Post',
  summary: 'Python from zero to a first job.',
});
const docs = { books: [book], shelves: [shelf] };
const [catalogBook] = buildBookshelfCatalog(docs.books, docs.shelves).books;
if (!catalogBook) throw new Error('expected the fixture book');

/** The card URL the book page's metadata names (with its current version). */
const CARD_URL = `https://mikeodnis.dev${bookPreviewImage(catalogBook).url}`;

/** The network fetches the route makes: the test answers them and checks every one. */
const fetchMock = vi.fn<typeof fetch>();
/** The real fetch, for next/og's own wasm, which it loads from a data: or file: URL. */
const realFetch = globalThis.fetch;
const routeFetch = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
  /^https?:/.test(String(input instanceof Request ? input.url : input))
    ? fetchMock(input, init)
    : realFetch(input, init);

const get = (url: string, slug = 'job-ready-python') =>
  GET(new Request(url, { headers: { 'x-forwarded-for': '203.0.113.7' } }), {
    params: Promise.resolve({ slug }),
  });

/** The response's status, cache rule and content type, and the PNG's real size. */
async function pngOf(response: Response) {
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    type: response.headers.get('content-type'),
    cacheControl: response.headers.get('cache-control'),
    ...imageInfo(bytes),
  };
}

/** The component of the last card drawn. */
const lastCard = () => drawn.cards.at(-1)?.type;

beforeEach(() => {
  resetSanityLoaderCaches();
  resetApiReportCooldowns();
  drawn.cards.length = 0;
  sanityApi.getBookshelf.mockResolvedValue(docs);
  guard.check.mockResolvedValue({ kind: 'allow' });
  fetchMock.mockImplementation(
    async () => new Response(COVER_PNG, { headers: { 'content-type': 'image/png' } }),
  );
  vi.stubGlobal('fetch', routeFetch);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  fetchMock.mockReset();
  sanityApi.getBookshelf.mockReset();
  guard.check.mockReset();
  sentry.captureException.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a book card (/api/og/book/<slug>)', () => {
  it(
    'draws the book card as a 1200x630 PNG, kept a year at its own version',
    async () => {
      const png = await pngOf(await get(CARD_URL));

      expect(png).toMatchObject({ status: 200, type: 'image/png', format: 'png' });
      expect([png.width, png.height]).toEqual([1200, 630]);
      expect(png.cacheControl).toBe(PAGE_CARD_CACHE_CONTROL);
      expect(lastCard()).toBe(BookCard);
    },
    RENDER_TIMEOUT,
  );

  it(
    'fetches only the book’s own cover, from Sanity’s CDN, whatever the query names',
    async () => {
      const hostile = `${CARD_URL}&cover=${encodeURIComponent('https://169.254.169.254/x.png')}&url=${encodeURIComponent('https://evil.example/a.png')}`;

      await get(hostile);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [requested] = fetchMock.mock.calls[0] ?? [];
      const url = new URL(String(requested));
      expect(url.origin).toBe('https://cdn.sanity.io');
      expect(url.pathname).toBe(new URL(catalogBook.coverSrc).pathname);
      expect(url.searchParams.get('fm')).toBe('jpg');
    },
    RENDER_TIMEOUT,
  );

  it.each([
    ['an old version', CARD_URL.replace(/v=[^&]+/, 'v=old')],
    ['no version', CARD_URL.replace(/\?.*$/, '')],
  ])(
    'keeps the card only an hour at a URL with %s',
    async (_case, url) => {
      const response = await get(url);

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe(RECHECKED_CARD_CACHE_CONTROL);
    },
    RENDER_TIMEOUT,
  );

  it('answers 404, uncached, for a slug the catalog does not have, and fetches nothing', async () => {
    const response = await get('https://mikeodnis.dev/api/og/book/no-such-book', 'no-such-book');

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).not.toBe('image/png');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(drawn.cards).toEqual([]);
  });

  it.each([
    ['the fetch fails', () => Promise.reject(new TypeError('fetch failed'))],
    ['the CDN answers 404', async () => new Response('gone', { status: 404 })],
    [
      'the CDN answers a page',
      async () => new Response('<html>', { headers: { 'content-type': 'text/html' } }),
    ],
  ])(
    'falls back to the text card, uncached, when %s',
    async (_case, reply) => {
      fetchMock.mockImplementation(reply);

      const png = await pngOf(await get(CARD_URL));

      expect(png).toMatchObject({ status: 200, type: 'image/png', cacheControl: 'no-store' });
      expect([png.width, png.height]).toEqual([1200, 630]);
      expect(lastCard()).toBe(PageCard);
      expect(drawn.cards.at(-1)?.props).toMatchObject({
        title: 'Job Ready Python (Stage 01)',
        description: 'Python from zero to a first job.',
      });
    },
    RENDER_TIMEOUT,
  );

  it(
    'draws the generic book card, uncached, and reports a warning when Sanity is down',
    async () => {
      sanityApi.getBookshelf.mockRejectedValue(new Error('Sanity answered 503'));

      const response = await get(CARD_URL);

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(drawn.cards.at(-1)?.props).toMatchObject({ title: 'Book' });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(sentry.captureException).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ level: 'warning' }),
      );
    },
    RENDER_TIMEOUT,
  );

  it('answers the guard’s 429, uncached, before looking anything up', async () => {
    guard.check.mockResolvedValue({ kind: 'limit', limit: 30, reset: Date.now() + 5_000 });

    const response = await get(CARD_URL);

    expect(response.status).toBe(429);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(sanityApi.getBookshelf).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
