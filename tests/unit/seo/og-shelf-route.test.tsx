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
 * @file /api/og/shelf/<shelfSlug>, a shelf's link-preview card, rendered for real with next/og:
 * the slug is looked up in the catalog (Sanity getters mocked, loaders real) and only the covers
 * of the shelf's first books are fetched (network fetches stubbed, answering with a real PNG;
 * next/og's own wasm still loads from disk). It answers:
 * - the shelf card with every cover, a 1200x630 PNG, kept a year at its own version;
 * - the shelf card with the covers that loaded, uncached, when some fail;
 * - the shelf's text card, uncached, when none load;
 * - 404, uncached and with nothing fetched, for a shelf the catalog does not have;
 * - the generic shelf card, uncached, when Sanity is down.
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
import { RECHECKED_CARD_CACHE_CONTROL } from '@/app/api/og/_lib/draw-card';
import { ShelfCard } from '@/app/api/og/_lib/shelf-card';
import { SHELF_CARD_COVERS, shelfPreviewImage } from '@/app/api/og/_lib/shelf-preview';
import { GET } from '@/app/api/og/shelf/[shelfSlug]/route';
import { resetApiReportCooldowns } from '@/lib/observability/report';
import { PageCard } from '@/lib/og/cards';
import { PAGE_CARD_CACHE_CONTROL } from '@/lib/og/constants';
import { resetSanityLoaderCaches } from '@/lib/sanity/loaders';
import { logger } from '@/utils';

/** Rendering a card takes a few hundred milliseconds; the first also loads the fonts and wasm. */
const RENDER_TIMEOUT = 30_000;

/** A real PNG for every cover, so Satori decodes and draws actual images. */
const COVER_PNG = readFileSync(join(process.cwd(), 'public/pwa/apple-touch-icon.png'));

const shelf = makeBookshelf({
  title: 'Web & Languages',
  slug: { _type: 'slug', current: 'web-and-languages' },
  description: 'Python, JavaScript and the web.',
});
/** Six books, each with its own cover asset, so each cover is a distinct URL. */
const books = Array.from({ length: 6 }, (_, index) =>
  makeBook({
    shelfId: shelf._id,
    coverImage: {
      _type: 'image',
      asset: { _type: 'reference', _ref: `image-cover${index}-520x680-webp` },
    },
  }),
);
const docs = { books, shelves: [shelf] };
const catalog = buildBookshelfCatalog(docs.books, docs.shelves);
const [catalogShelf] = catalog.shelves;
if (!catalogShelf) throw new Error('expected the fixture shelf');

/** The card URL the shelf page's metadata names (with its current version). */
const CARD_URL = `https://mikeodnis.dev${shelfPreviewImage(catalogShelf, catalog.books).url}`;

/** The network fetches the route makes: the test answers them and checks every one. */
const fetchMock = vi.fn<typeof fetch>();
/** The real fetch, for next/og's own wasm, which it loads from a data: or file: URL. */
const realFetch = globalThis.fetch;
const routeFetch = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
  /^https?:/.test(String(input instanceof Request ? input.url : input))
    ? fetchMock(input, init)
    : realFetch(input, init);

const coverReply = async () =>
  new Response(COVER_PNG, { headers: { 'content-type': 'image/png' } });

const get = (url: string, shelfSlug = 'web-and-languages') =>
  GET(new Request(url, { headers: { 'x-forwarded-for': '203.0.113.7' } }), {
    params: Promise.resolve({ shelfSlug }),
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

const lastCard = (): ReactElement | undefined => drawn.cards.at(-1);
/** The covers the last card drawn was given (a ShelfCard's). */
const lastCovers = () => (lastCard()?.props as { readonly covers?: readonly string[] })?.covers;

beforeEach(() => {
  resetSanityLoaderCaches();
  resetApiReportCooldowns();
  drawn.cards.length = 0;
  sanityApi.getBookshelf.mockResolvedValue(docs);
  guard.check.mockResolvedValue({ kind: 'allow' });
  fetchMock.mockImplementation(coverReply);
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

describe('a shelf card (/api/og/shelf/<shelfSlug>)', () => {
  it(
    'draws its first covers as a 1200x630 PNG, kept a year at its own version',
    async () => {
      const png = await pngOf(await get(CARD_URL));

      expect(png).toMatchObject({ status: 200, type: 'image/png', format: 'png' });
      expect([png.width, png.height]).toEqual([1200, 630]);
      expect(png.cacheControl).toBe(PAGE_CARD_CACHE_CONTROL);
      expect(lastCard()?.type).toBe(ShelfCard);
      expect(lastCovers()).toHaveLength(SHELF_CARD_COVERS);
    },
    RENDER_TIMEOUT,
  );

  it(
    'fetches only its first books’ own covers, from Sanity’s CDN',
    async () => {
      await get(`${CARD_URL}&cover=${encodeURIComponent('https://evil.example/a.png')}`);

      const fetched = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
      expect(fetched).toHaveLength(SHELF_CARD_COVERS);
      expect(new Set(fetched.map((url) => url.origin))).toEqual(new Set(['https://cdn.sanity.io']));
      expect(fetched.map((url) => url.pathname)).toEqual(
        catalog.books.slice(0, SHELF_CARD_COVERS).map((book) => new URL(book.coverSrc).pathname),
      );
    },
    RENDER_TIMEOUT,
  );

  it(
    'keeps the card only an hour at a URL with an old version',
    async () => {
      const response = await get(CARD_URL.replace(/v=[^&]+/, 'v=old'));

      expect(response.headers.get('cache-control')).toBe(RECHECKED_CARD_CACHE_CONTROL);
    },
    RENDER_TIMEOUT,
  );

  it(
    'draws the covers that loaded, uncached, when some fail',
    async () => {
      fetchMock.mockImplementation(async (input) =>
        String(input).includes('cover1-') ? new Response('gone', { status: 404 }) : coverReply(),
      );

      const response = await get(CARD_URL);

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(lastCard()?.type).toBe(ShelfCard);
      expect(lastCovers()).toHaveLength(SHELF_CARD_COVERS - 1);
    },
    RENDER_TIMEOUT,
  );

  it(
    'falls back to the shelf’s text card, uncached, when no cover loads',
    async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      const png = await pngOf(await get(CARD_URL));

      expect(png).toMatchObject({ status: 200, type: 'image/png', cacheControl: 'no-store' });
      expect([png.width, png.height]).toEqual([1200, 630]);
      expect(lastCard()?.type).toBe(PageCard);
      expect(lastCard()?.props).toMatchObject({
        title: 'Web & Languages Shelf',
        description: 'Python, JavaScript and the web.',
      });
    },
    RENDER_TIMEOUT,
  );

  it('answers 404, uncached, for a shelf the catalog does not have, and fetches nothing', async () => {
    const response = await get('https://mikeodnis.dev/api/og/shelf/nope', 'nope');

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(drawn.cards).toEqual([]);
  });

  it(
    'draws the generic shelf card, uncached, and reports a warning when Sanity is down',
    async () => {
      sanityApi.getBookshelf.mockRejectedValue(new Error('Sanity answered 503'));

      const response = await get(CARD_URL);

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(lastCard()?.props).toMatchObject({ title: 'Shelf' });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(sentry.captureException).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ level: 'warning' }),
      );
    },
    RENDER_TIMEOUT,
  );
});
