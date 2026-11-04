// @vitest-environment node
/**
 * Copyright 2025 Mike Odnis
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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type Blog, HASHNODE_BLOG_URL } from '@/lib/api-integrations/blogs';
import {
  addHashnodeCovers,
  extractCoverImage,
  HEAD_CHAR_LIMIT,
  isAllowedCoverUrl,
} from '@/lib/api-integrations/hashnode-covers';
import { logger } from '@/utils';

const PAGE = `${HASHNODE_BLOG_URL}/a-post`;
const CDN_COVER =
  'https://cdn.hashnode.com/res/hashnode/image/upload/v1700000000000/0000-example.png';
const TITLE_CARD = `${HASHNODE_BLOG_URL}/api/og/post?og=eyJ0aXRsZSI6IkV4YW1wbGUifQ%3D%3D`;

/** The start of a Hashnode post page: a Next.js head with Open Graph and Twitter tags. */
const hashnodeHead = (image: string) =>
  [
    '<!DOCTYPE html><html lang="en"><head>',
    '<meta charSet="utf-8"/><meta name="viewport" content="width=device-width"/>',
    '<title>A post</title><link rel="canonical" href="https://blog.mikeodnis.dev/a-post"/>',
    '<meta property="og:title" content="A post"/>',
    '<meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/>',
    `<meta property="og:image" content="${image}"/>`,
    '<meta name="twitter:card" content="summary_large_image"/>',
    `<meta name="twitter:image" content="${image}"/>`,
    '</head>',
  ].join('');

const post = (slug: string, extra: Partial<Blog> = {}): Blog => ({
  title: slug,
  slug,
  publishedAt: '2025-01-01T00:00:00.000Z',
  excerpt: '',
  ...extra,
});

const encoder = new TextEncoder();

describe('extractCoverImage', () => {
  it('reads og:image from a Hashnode page head', () => {
    expect(extractCoverImage(`${hashnodeHead(CDN_COVER)}<body></body></html>`, PAGE)).toBe(
      CDN_COVER,
    );
    expect(extractCoverImage(hashnodeHead(TITLE_CARD), PAGE)).toBe(TITLE_CARD);
  });

  it('reads attributes in any order and quoting, and decodes entities', () => {
    expect(
      extractCoverImage(
        `<meta content="${CDN_COVER}?w=1600&amp;h=840&#38;fit=crop" property="og:image">`,
        PAGE,
      ),
    ).toBe(`${CDN_COVER}?w=1600&h=840&fit=crop`);
    expect(extractCoverImage(`<META PROPERTY='og:image' CONTENT='${CDN_COVER}'>`, PAGE)).toBe(
      CDN_COVER,
    );
    expect(extractCoverImage(`<meta property=og:image content=${CDN_COVER}>`, PAGE)).toBe(
      CDN_COVER,
    );
  });

  it('resolves a relative image against the page URL', () => {
    expect(
      extractCoverImage(`<meta property="og:image" content="/api/og/post?og=abc">`, PAGE),
    ).toBe(`${HASHNODE_BLOG_URL}/api/og/post?og=abc`);
  });

  it('falls back to twitter:image when og:image is not on an allowed host', () => {
    const html =
      '<meta property="og:image" content="https://images.example.com/x.png">' +
      `<meta name="twitter:image" content="${CDN_COVER}">`;
    expect(extractCoverImage(html, PAGE)).toBe(CDN_COVER);
  });

  it.each([
    ['http:// instead of https://', 'http://cdn.hashnode.com/res/hashnode/image/upload/x.png'],
    ['another host', 'https://images.example.com/x.png'],
    ['a look-alike host', 'https://cdn.hashnode.com.example.com/x.png'],
    ['a blog path outside /api/og/', `${HASHNODE_BLOG_URL}/favicon.png`],
    ['a data: URI', 'data:image/png;base64,AAAA'],
    ['an empty value', ''],
  ])('ignores %s', (_label, image) => {
    expect(
      extractCoverImage(`<head><meta property="og:image" content="${image}"></head>`, PAGE),
    ).toBeUndefined();
  });

  it('returns undefined when the head has no image tag', () => {
    expect(
      extractCoverImage('<html><head><title>x</title></head><body></body></html>', PAGE),
    ).toBeUndefined();
    expect(extractCoverImage('', PAGE)).toBeUndefined();
  });

  it('ignores image tags after </head> and keys that only look similar', () => {
    const html =
      '<head><meta property="og:image:width" content="1200"></head>' +
      `<body><meta property="og:image" content="${CDN_COVER}"></body>`;
    expect(extractCoverImage(html, PAGE)).toBeUndefined();
  });
});

describe('isAllowedCoverUrl', () => {
  it('accepts exactly the hosts and paths next/image is configured for', () => {
    expect(isAllowedCoverUrl(new URL(CDN_COVER))).toBe(true);
    expect(isAllowedCoverUrl(new URL(TITLE_CARD))).toBe(true);
    expect(isAllowedCoverUrl(new URL(`${HASHNODE_BLOG_URL}/api/ogx`))).toBe(false);
    expect(isAllowedCoverUrl(new URL('https://media2.dev.to/x.png'))).toBe(false);
  });
});

describe('addHashnodeCovers', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const html = (body: string, status = 200) =>
    new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

  /** A body that never ends: `first`, then `filler` for as long as it is read. */
  const endlessBody = (first: string, filler: string) => {
    const state = { pulls: 0, cancelled: false, enqueuedChars: 0 };
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = state.pulls === 0 ? first : filler;
        state.pulls += 1;
        state.enqueuedChars += chunk.length;
        controller.enqueue(encoder.encode(chunk));
      },
      cancel() {
        state.cancelled = true;
      },
    });
    return { body, state };
  };

  it('sets imageUrl from each post page, one request per post', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith('/with-card')
        ? html(hashnodeHead(TITLE_CARD))
        : html(hashnodeHead(CDN_COVER)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const posts = [post('with-cover'), post('with-card')];
    const result = await addHashnodeCovers(posts);

    expect(result.map((p) => p.imageUrl)).toEqual([CDN_COVER, TITLE_CARD]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const calls = fetchMock.mock.calls as unknown as Array<[string | URL, RequestInit]>;
    expect(calls.map(([url]) => String(url))).toEqual([
      `${HASHNODE_BLOG_URL}/with-cover`,
      `${HASHNODE_BLOG_URL}/with-card`,
    ]);
    expect(new Headers(calls[0]?.[1]?.headers).get('accept')).toBe('text/html');
    // New objects; the input is untouched.
    expect(posts.every((p) => !('imageUrl' in p))).toBe(true);
  });

  it('does not fetch a page for a post that already has an image', async () => {
    const fetchMock = vi.fn(async () => html(hashnodeHead(CDN_COVER)));
    vi.stubGlobal('fetch', fetchMock);

    const existing = post('has-image', { imageUrl: 'https://cdn.hashnode.com/existing.png' });
    expect(await addHashnodeCovers([existing])).toEqual([existing]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves posts whose page fails or has no image without one, and still resolves', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/server-error')) return html('Unavailable', 500);
        if (url.endsWith('/not-found')) return html('Not found', 404);
        if (url.endsWith('/network-error')) throw new TypeError('fetch failed');
        if (url.endsWith('/no-image')) return html('<html><head><title>x</title></head></html>');
        return html(hashnodeHead(CDN_COVER));
      }),
    );

    const result = await addHashnodeCovers([
      post('server-error'),
      post('ok'),
      post('not-found'),
      post('network-error'),
      post('no-image'),
    ]);

    expect(result.map((p) => [p.slug, p.imageUrl])).toEqual([
      ['server-error', undefined],
      ['ok', CDN_COVER],
      ['not-found', undefined],
      ['network-error', undefined],
      ['no-image', undefined],
    ]);
    expect(result.filter((p) => 'imageUrl' in p)).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not read the cover of a Hashnode post',
      expect.objectContaining({ slug: 'server-error' }),
    );
  });

  it('stops reading and cancels the body once </head> has arrived', async () => {
    const { body, state } = endlessBody(
      `${hashnodeHead(CDN_COVER)}<body>`,
      `<p>${'x'.repeat(16 * 1024)}</p>`,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status: 200 })),
    );

    const [result] = await addHashnodeCovers([post('streamed')]);

    expect(result?.imageUrl).toBe(CDN_COVER);
    expect(state.cancelled).toBe(true);
    // The head plus at most the chunk the stream had already queued.
    expect(state.pulls).toBeLessThanOrEqual(2);
  });

  it('gives up on a head that never closes after a bounded amount of text', async () => {
    const { body, state } = endlessBody(
      '<!DOCTYPE html><html><head><title>x</title>',
      `<meta name="filler" content="${'y'.repeat(4 * 1024)}">`,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status: 200 })),
    );

    const [result] = await addHashnodeCovers([post('endless-head')]);

    expect(result).not.toHaveProperty('imageUrl');
    expect(state.cancelled).toBe(true);
    expect(state.enqueuedChars).toBeLessThan(HEAD_CHAR_LIMIT + 3 * 4 * 1024);
  });

  it('still uses an image found before the size limit when the head never closes', async () => {
    const { body, state } = endlessBody(
      `<html><head><meta property="og:image" content="${CDN_COVER}">`,
      `<style>${'z'.repeat(8 * 1024)}</style>`,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status: 200 })),
    );

    const [result] = await addHashnodeCovers([post('big-head')]);

    expect(result?.imageUrl).toBe(CDN_COVER);
    expect(state.cancelled).toBe(true);
  });

  it('times out a page that never answers, aborts the request and keeps the post', async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            if (init?.signal) {
              signals.push(init.signal);
              init.signal.addEventListener('abort', () => reject(init.signal?.reason));
            }
          }),
      ),
    );

    const started = Date.now();
    const result = await addHashnodeCovers([post('hangs')], { timeout: '50 millis' });

    expect(result).toEqual([post('hangs')]);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not read the cover of a Hashnode post',
      expect.objectContaining({ slug: 'hangs', error: expect.stringMatching(/timed out/i) }),
    );
  });

  it('times out a page whose head arrives too slowly and cancels the body', async () => {
    const state = { cancelled: false };
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('<html><head><title>slow</title>'));
      },
      // Never enqueues again: the rest of the head never arrives.
      pull: () => new Promise<void>(() => undefined),
      cancel() {
        state.cancelled = true;
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status: 200 })),
    );

    const result = await addHashnodeCovers([post('slow')], { timeout: '50 millis' });

    expect(result).toEqual([post('slow')]);
    expect(state.cancelled).toBe(true);
  });
});
