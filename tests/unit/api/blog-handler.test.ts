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

/**
 * @file GET /api/v1/blog end to end below the network: the real RSS parser, cover reader,
 * dev.to client and merge, with only `fetch` stubbed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The dev.to client imports the env schema, which would demand every production variable.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: vi.fn() }));
// The full '@/lib' barrel pulls in Sanity and decorator-based clients; the route needs only these.
vi.mock('@/lib', async () => ({
  ...(await import('@/lib/api-integrations/blogs')),
  ...(await import('@/lib/api-integrations/devto')),
  ...(await import('@/lib/api-integrations/blog-merge')),
  ...(await import('@/lib/api-integrations/hashnode-covers')),
}));

import { fetchBlogs } from '@/app/api/v1/[[...route]]/blog/handlers';
import { blogRoute } from '@/app/api/v1/[[...route]]/blog/index';
import { BaseError } from '@/classes/error';
import { HASHNODE_BLOG_URL } from '@/lib/api-integrations/blogs';
import { logger } from '@/utils';

const CHAT_SLUG = 'building-a-real-time-chat-app-with-websockets';
const STATIC_SLUG = 'beyond-static-a-dynamic-portfolio';
const TITLE_CARD = `${HASHNODE_BLOG_URL}/api/og/post?og=eyJ0aXRsZSI6IkNoYXQifQ%3D%3D`;
const CDN_COVER = 'https://cdn.hashnode.com/res/hashnode/image/upload/v1/static-cover.png';
const DEVTO_SOCIAL = 'https://media2.dev.to/dynamic/image/width=1000/chat-social.png';
const DEVTO_FEED = 'https://dev.to/api/articles?username=mikeodnis&per_page=30';

const rssItem = (title: string, slug: string, pubDate: string) => `
    <item>
      <title><![CDATA[${title}]]></title>
      <description><![CDATA[Hashnode excerpt for ${title}]]></description>
      <link>${HASHNODE_BLOG_URL}/${slug}</link>
      <guid isPermaLink="true">${HASHNODE_BLOG_URL}/${slug}</guid>
      <pubDate>${pubDate}</pubDate>
    </item>`;

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Blog</title><link>${HASHNODE_BLOG_URL}</link>
${rssItem('Building a Real-Time Chat App with WebSockets', CHAT_SLUG, 'Tue, 11 Nov 2025 08:39:40 GMT')}
${rssItem('Beyond Static: A Dynamic Portfolio', STATIC_SLUG, 'Thu, 26 Sep 2024 15:27:57 GMT')}
</channel></rss>`;

const ANNOUNCEMENT_HTML =
  '<!DOCTYPE html><html><head><title>GraphQL API is moving to a paid offering</title></head><body></body></html>';

const postHead = (image: string) =>
  `<!DOCTYPE html><html><head><title>Post</title><meta property="og:image" content="${image}"/></head><body>`;

const devtoArticle = (title: string, slug: string, publishedAt: string, extra = {}) => ({
  title,
  slug,
  published_at: publishedAt,
  description: `dev.to description for ${title}`,
  cover_image: null,
  social_image: `https://media2.dev.to/${slug}.png`,
  url: `https://dev.to/mikeodnis/${slug}`,
  canonical_url: `https://dev.to/mikeodnis/${slug}`,
  ...extra,
});

const DEVTO_ARTICLES = [
  devtoArticle(
    'Building a Real-Time Chat App with WebSockets',
    `${CHAT_SLUG}-3k6f`,
    '2025-11-11T08:39:41Z',
    { social_image: DEVTO_SOCIAL },
  ),
  devtoArticle('Only on dev.to', 'only-on-dev-to-1abc', '2026-01-05T10:00:00Z'),
];

type Route = (url: string) => Response | Promise<Response>;

const text = (body: string, status = 200, type = 'text/html; charset=utf-8') =>
  new Response(body, { status, headers: { 'content-type': type } });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Serves the live shape of every upstream the route reads; `overrides` replace single URLs. */
function stubUpstreams(overrides: Record<string, Route> = {}) {
  const routes: Record<string, Route> = {
    [`${HASHNODE_BLOG_URL}/rss.xml`]: () => text(RSS, 200, 'application/xml'),
    [`${HASHNODE_BLOG_URL}/${CHAT_SLUG}`]: () => text(postHead(TITLE_CARD)),
    [`${HASHNODE_BLOG_URL}/${STATIC_SLUG}`]: () => text(postHead(CDN_COVER)),
    [DEVTO_FEED]: () => json(DEVTO_ARTICLES),
    ...overrides,
  };
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    const route = routes[url];
    if (!route) throw new Error(`unexpected fetch: ${url}`);
    return route(url);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const requestedUrls = (fetchMock: ReturnType<typeof stubUpstreams>) =>
  fetchMock.mock.calls.map(([input]) => (input instanceof Request ? input.url : String(input)));

beforeEach(() => {
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchBlogs', () => {
  it('returns one card per article, Hashnode covers included, newest first', async () => {
    const fetchMock = stubUpstreams();

    const blogs = await fetchBlogs();

    expect(blogs).toEqual([
      {
        title: 'Only on dev.to',
        slug: 'only-on-dev-to-1abc',
        publishedAt: '2026-01-05T10:00:00Z',
        excerpt: 'dev.to description for Only on dev.to',
        imageUrl: 'https://media2.dev.to/only-on-dev-to-1abc.png',
        source: 'devto',
        url: 'https://dev.to/mikeodnis/only-on-dev-to-1abc',
      },
      {
        title: 'Building a Real-Time Chat App with WebSockets',
        slug: CHAT_SLUG,
        publishedAt: '2025-11-11T08:39:40.000Z',
        excerpt: 'Hashnode excerpt for Building a Real-Time Chat App with WebSockets',
        imageUrl: TITLE_CARD,
        source: 'hashnode',
        url: `${HASHNODE_BLOG_URL}/${CHAT_SLUG}`,
      },
      {
        title: 'Beyond Static: A Dynamic Portfolio',
        slug: STATIC_SLUG,
        publishedAt: '2024-09-26T15:27:57.000Z',
        excerpt: 'Hashnode excerpt for Beyond Static: A Dynamic Portfolio',
        imageUrl: CDN_COVER,
        source: 'hashnode',
        url: `${HASHNODE_BLOG_URL}/${STATIC_SLUG}`,
      },
    ]);
    expect(requestedUrls(fetchMock).sort()).toEqual(
      [
        DEVTO_FEED,
        `${HASHNODE_BLOG_URL}/${CHAT_SLUG}`,
        `${HASHNODE_BLOG_URL}/${STATIC_SLUG}`,
        `${HASHNODE_BLOG_URL}/rss.xml`,
      ].sort(),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('collapses a retitled dev.to copy whose canonical_url points at the Hashnode post', async () => {
    // Neither the title nor the slug matches, so only the dev.to canonical_url links the two.
    const retitled = devtoArticle(
      'Static sites are not enough',
      'static-sites-are-not-enough-9z',
      '2024-09-27T10:00:00Z',
      {
        canonical_url: `${HASHNODE_BLOG_URL}/${STATIC_SLUG}`,
      },
    );
    stubUpstreams({ [DEVTO_FEED]: () => json([...DEVTO_ARTICLES, retitled]) });

    const blogs = await fetchBlogs();

    expect(blogs.map((b) => [b.source, b.slug])).toEqual([
      ['devto', 'only-on-dev-to-1abc'],
      ['hashnode', CHAT_SLUG],
      ['hashnode', STATIC_SLUG],
    ]);
  });

  it("uses the dev.to copy's image when the Hashnode post page can't be read", async () => {
    stubUpstreams({ [`${HASHNODE_BLOG_URL}/${CHAT_SLUG}`]: () => text('Not found', 404) });

    const blogs = await fetchBlogs();

    expect(blogs.map((b) => [b.source, b.slug, b.imageUrl])).toEqual([
      ['devto', 'only-on-dev-to-1abc', 'https://media2.dev.to/only-on-dev-to-1abc.png'],
      ['hashnode', CHAT_SLUG, DEVTO_SOCIAL],
      ['hashnode', STATIC_SLUG, CDN_COVER],
    ]);
  });

  it('serves the dev.to posts alone when the Hashnode feed is replaced by an HTML page', async () => {
    stubUpstreams({ [`${HASHNODE_BLOG_URL}/rss.xml`]: () => text(ANNOUNCEMENT_HTML) });

    const blogs = await fetchBlogs();

    expect(blogs.map((b) => [b.source, b.slug])).toEqual([
      ['devto', 'only-on-dev-to-1abc'],
      ['devto', `${CHAT_SLUG}-3k6f`],
    ]);
    expect(blogs.every((b) => !('canonicalUrl' in b))).toBe(true);
    expect(logger.error).toHaveBeenCalledWith('Failed to fetch Hashnode blogs:', expect.anything());
  });

  it('serves the Hashnode posts alone when dev.to fails', async () => {
    stubUpstreams({ [DEVTO_FEED]: () => json({ error: 'not found' }, 404) });

    const blogs = await fetchBlogs();

    expect(blogs.map((b) => [b.source, b.slug, b.imageUrl])).toEqual([
      ['hashnode', CHAT_SLUG, TITLE_CARD],
      ['hashnode', STATIC_SLUG, CDN_COVER],
    ]);
  });

  it('rejects with a BaseError when neither source returns posts', async () => {
    stubUpstreams({
      [`${HASHNODE_BLOG_URL}/rss.xml`]: () => text('Not found', 404),
      [DEVTO_FEED]: () => json({ error: 'not found' }, 404),
    });

    await expect(fetchBlogs()).rejects.toBeInstanceOf(BaseError);
  });
});

describe('GET /blog route', () => {
  it('returns the merged posts through the response schema with the long cache headers', async () => {
    stubUpstreams();

    const response = await blogRoute.handle(new Request('http://localhost/blog'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=86400');
    const body = (await response.json()) as Array<{
      source: string;
      slug: string;
      imageUrl?: string;
    }>;
    expect(body.map((b) => [b.source, b.slug, b.imageUrl])).toEqual([
      ['devto', 'only-on-dev-to-1abc', 'https://media2.dev.to/only-on-dev-to-1abc.png'],
      ['hashnode', CHAT_SLUG, TITLE_CARD],
      ['hashnode', STATIC_SLUG, CDN_COVER],
    ]);
  });

  it('answers 500 with an error body when no source returns posts', async () => {
    stubUpstreams({
      [`${HASHNODE_BLOG_URL}/rss.xml`]: () => text('Not found', 404),
      [DEVTO_FEED]: () => json({ error: 'not found' }, 404),
    });

    const response = await blogRoute.handle(new Request('http://localhost/blog'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });
});
