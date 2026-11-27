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
 * @file How a preview card gets a cover: only from Sanity's image CDN (the URL the catalog built,
 * never anything else), resized there to the size the card draws it as a JPEG, within a time limit
 * and a byte limit, and only when the bytes really are a JPEG or PNG. Anything else gives null, so
 * the card route draws its text card instead. fetch is stubbed; nothing leaves the machine.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// t3-env validates every variable on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import { COVER_MAX_BYTES, coverFetchUrl, loadCoverDataUri } from '@/app/api/og/_lib/cover-image';
import { logger } from '@/utils';

/** A cover URL as the catalog builds it (load-bookshelf.ts): 520x680, cropped, auto format. */
const COVER =
  'https://cdn.sanity.io/images/test/test/abc123-520x680.webp?rect=0,10,520,670&w=520&h=680&fit=crop&auto=format';

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

const fetchMock = vi.fn<typeof fetch>();

const imageResponse = (
  bytes: Uint8Array<ArrayBuffer>,
  type = 'image/jpeg',
  init: ResponseInit = {},
) =>
  new Response(bytes, {
    status: 200,
    ...init,
    headers: { 'content-type': type, 'content-length': String(bytes.byteLength), ...init.headers },
  });

/** A response whose body streams `chunks` with no content-length, as a chunked reply would. */
const streamed = (chunks: readonly Uint8Array[]) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    { headers: { 'content-type': 'image/jpeg' } },
  );

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the cover URL a card fetches', () => {
  it('asks Sanity’s CDN for the drawn size as a JPEG, keeping the crop', () => {
    const url = new URL(coverFetchUrl(COVER, 340) ?? '');

    expect(url.origin).toBe('https://cdn.sanity.io');
    expect(url.pathname).toBe('/images/test/test/abc123-520x680.webp');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      rect: '0,10,520,670',
      w: '340',
      h: '445',
      fit: 'crop',
      fm: 'jpg',
    });
    expect(url.searchParams.has('auto')).toBe(false);
  });

  it.each([
    ['another host', 'https://evil.example/images/a.jpg'],
    ['a look-alike host', 'https://cdn.sanity.io.evil.example/images/a.jpg'],
    ['plain http', 'http://cdn.sanity.io/images/test/test/a-1x1.jpg'],
    ['a Sanity file, not an image', 'https://cdn.sanity.io/files/test/test/a.pdf'],
    ['credentials in the URL', 'https://user:pw@cdn.sanity.io/images/test/test/a-1x1.jpg'],
    ['a data URI', 'data:image/png;base64,AAAA'],
    ['no URL at all', 'not a url'],
  ])('refuses %s', (_case, src) => {
    expect(coverFetchUrl(src, 340)).toBeNull();
  });
});

describe('loading a cover for a card', () => {
  it('gives the JPEG as a data URI, fetched once with a time limit and no redirects', async () => {
    fetchMock.mockResolvedValue(imageResponse(JPEG));

    const uri = await loadCoverDataUri(COVER, 340);

    expect(uri).toBe(`data:image/jpeg;base64,${Buffer.from(JPEG).toString('base64')}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(coverFetchUrl(COVER, 340));
    expect(init).toMatchObject({ redirect: 'error' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('accepts a PNG', async () => {
    fetchMock.mockResolvedValue(imageResponse(PNG, 'image/png'));

    expect(await loadCoverDataUri(COVER, 340)).toMatch(/^data:image\/png;base64,/);
  });

  it('never fetches a URL that is not a Sanity image', async () => {
    expect(await loadCoverDataUri('https://169.254.169.254/latest/meta-data', 340)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an HTTP error', () => imageResponse(JPEG, 'image/jpeg', { status: 404 })],
    ['a page instead of an image', () => imageResponse(JPEG, 'text/html')],
    ['an SVG (Satori would draw its markup)', () => imageResponse(JPEG, 'image/svg+xml')],
    ['bytes that are not a JPEG or PNG', () => imageResponse(Uint8Array.from([1, 2, 3, 4]))],
    [
      'a declared size over the limit',
      () =>
        imageResponse(JPEG, 'image/jpeg', {
          headers: { 'content-length': String(COVER_MAX_BYTES + 1) },
        }),
    ],
    [
      'a streamed body that runs over the limit',
      () => streamed([JPEG, new Uint8Array(COVER_MAX_BYTES)]),
    ],
  ])('gives null for %s', async (_case, reply) => {
    fetchMock.mockResolvedValue(reply());

    expect(await loadCoverDataUri(COVER, 340)).toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('gives null when the fetch fails or runs out of time', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('The operation timed out.', 'TimeoutError'));
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

    expect(await loadCoverDataUri(COVER, 340)).toBeNull();
    expect(await loadCoverDataUri(COVER, 340)).toBeNull();
  });

  it('reads a streamed cover within the limit whole', async () => {
    fetchMock.mockResolvedValue(streamed([JPEG.slice(0, 4), JPEG.slice(4)]));

    expect(await loadCoverDataUri(COVER, 340)).toBe(
      `data:image/jpeg;base64,${Buffer.from(JPEG).toString('base64')}`,
    );
  });
});
