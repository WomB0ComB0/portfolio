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

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getBlogs, HASHNODE_BLOG_URL, parseHashnodeRss } from '@/lib/api-integrations/blogs';
import { logger } from '@/utils';

const item = (title: string, slug: string, pubDate: string, description = `About ${title}`) => `
    <item>
      <title><![CDATA[${title}]]></title>
      <description><![CDATA[${description}]]></description>
      <link>${HASHNODE_BLOG_URL}/${slug}</link>
      <guid isPermaLink="true">${HASHNODE_BLOG_URL}/${slug}</guid>
      <category><![CDATA[React]]></category>
      <dc:creator><![CDATA[Mike Odnis]]></dc:creator>
      <pubDate>${pubDate}</pubDate>
      <content:encoded><![CDATA[<h1>${title}</h1><p>Body</p>]]></content:encoded>
    </item>`;

const feed = (...items: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0">
  <channel>
    <title><![CDATA[Blog]]></title>
    <link>${HASHNODE_BLOG_URL}</link>
    <atom:link href="${HASHNODE_BLOG_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items.join('')}
  </channel>
</rss>`;

const OLDER = item('Older post', 'older-post', 'Thu, 26 Sep 2024 15:27:57 GMT');
const NEWER = item('Newer post', 'newer-post', 'Tue, 11 Nov 2025 08:39:40 GMT');

/** What gql.hashnode.com now redirects non-Pro callers to: an HTML page served with 200. */
const ANNOUNCEMENT_HTML =
  '<!DOCTYPE html><html lang="en"><head><title>GraphQL API is moving to a paid offering | Hashnode</title></head><body><h1>GraphQL API is moving to a paid offering</h1></body></html>';

describe('parseHashnodeRss', () => {
  it('maps feed items to blog entries, newest first, with ISO dates and slugs', () => {
    expect(parseHashnodeRss(feed(OLDER, NEWER))).toEqual([
      {
        title: 'Newer post',
        slug: 'newer-post',
        publishedAt: '2025-11-11T08:39:40.000Z',
        excerpt: 'About Newer post',
      },
      {
        title: 'Older post',
        slug: 'older-post',
        publishedAt: '2024-09-26T15:27:57.000Z',
        excerpt: 'About Older post',
      },
    ]);
  });

  it('returns an array for a feed with a single post', () => {
    expect(parseHashnodeRss(feed(NEWER)).map((b) => b.slug)).toEqual(['newer-post']);
  });

  it('returns no posts for a feed without items', () => {
    expect(parseHashnodeRss(feed())).toEqual([]);
  });

  it('keeps numeric-looking titles as strings and decodes XML entities outside CDATA', () => {
    const xml = feed(
      item('2024', 'year-in-review', 'Tue, 31 Dec 2024 12:00:00 GMT'),
      `<item><title>Tom &amp; Jerry &lt;3</title><link>${HASHNODE_BLOG_URL}/tom-and-jerry/</link><pubDate>Mon, 06 Jan 2025 09:00:00 GMT</pubDate></item>`,
    );
    const [first, second] = parseHashnodeRss(xml);
    expect(first).toMatchObject({ title: 'Tom & Jerry <3', slug: 'tom-and-jerry', excerpt: '' });
    expect(second).toMatchObject({ title: '2024', slug: 'year-in-review' });
    expect(typeof second?.title).toBe('string');
  });

  it('never sets imageUrl, because the feed carries no cover images', () => {
    for (const blog of parseHashnodeRss(feed(OLDER, NEWER))) {
      expect(blog).not.toHaveProperty('imageUrl');
    }
  });

  it('respects the limit after sorting', () => {
    expect(parseHashnodeRss(feed(OLDER, NEWER), 1).map((b) => b.slug)).toEqual(['newer-post']);
  });

  it('skips malformed items and warns how many were dropped', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const xml = feed(
      NEWER,
      item('Bad date', 'bad-date', 'not a date'),
      item('', 'no-title', 'Tue, 11 Nov 2025 08:39:40 GMT'),
      `<item><title>Bad link</title><link>not a url</link><pubDate>Tue, 11 Nov 2025 08:39:40 GMT</pubDate></item>`,
      `<item><title>Root link</title><link>${HASHNODE_BLOG_URL}/</link><pubDate>Tue, 11 Nov 2025 08:39:40 GMT</pubDate></item>`,
      `<item><title>No link</title><pubDate>Tue, 11 Nov 2025 08:39:40 GMT</pubDate></item>`,
    );
    expect(parseHashnodeRss(xml).map((b) => b.slug)).toEqual(['newer-post']);
    expect(warn).toHaveBeenCalledWith('Skipped 5 malformed Hashnode feed item(s)');
  });

  it('throws a descriptive error for documents that are not RSS, such as an HTML page', () => {
    expect(() => parseHashnodeRss(ANNOUNCEMENT_HTML)).toThrow(/not RSS.*<!DOCTYPE html>/);
    expect(() => parseHashnodeRss('{"data":null}')).toThrow(/not RSS/);
  });
});

describe('getBlogs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubFetch = (...responses: Array<() => Response>) => {
    const fetchMock = vi.fn(async () => {
      const next = responses.shift();
      if (!next) throw new Error('unexpected extra fetch');
      return next();
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  const rss =
    (body: string, status = 200) =>
    () =>
      new Response(body, { status, headers: { 'content-type': 'application/xml; charset=utf-8' } });

  it('reads the public RSS feed and needs no API token', async () => {
    const fetchMock = stubFetch(rss(feed(OLDER, NEWER)));

    const blogs = await getBlogs();

    expect(blogs.map((b) => b.slug)).toEqual(['newer-post', 'older-post']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string | URL, RequestInit];
    expect(String(url)).toBe(`${HASHNODE_BLOG_URL}/rss.xml`);
    expect(new Headers(init?.headers).has('authorization')).toBe(false);
  });

  it('passes the limit through', async () => {
    stubFetch(rss(feed(OLDER, NEWER)));
    expect((await getBlogs(1)).map((b) => b.slug)).toEqual(['newer-post']);
  });

  it('rejects with a clear error when the feed is replaced by an HTML page', async () => {
    stubFetch(
      () =>
        new Response(ANNOUNCEMENT_HTML, { status: 200, headers: { 'content-type': 'text/html' } }),
    );
    await expect(getBlogs()).rejects.toThrow(/not RSS/);
  });

  it('does not retry a 404', async () => {
    const fetchMock = stubFetch(rss('Not found', 404));
    await expect(getBlogs()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a transient 503 and then succeeds', async () => {
    const fetchMock = stubFetch(rss('Unavailable', 503), rss(feed(NEWER)));
    expect((await getBlogs()).map((b) => b.slug)).toEqual(['newer-post']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
