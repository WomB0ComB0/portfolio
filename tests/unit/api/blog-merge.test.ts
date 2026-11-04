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

import { describe, expect, it } from 'vitest';

import { mergeBlogSources, normalizeTitle } from '@/lib/api-integrations/blog-merge';
import { type Blog, HASHNODE_BLOG_URL } from '@/lib/api-integrations/blogs';
import type { DevToBlog } from '@/lib/api-integrations/devto';

const hashnode = (
  title: string,
  slug: string,
  publishedAt: string,
  extra: Partial<Blog> = {},
): Blog => ({ title, slug, publishedAt, excerpt: `About ${title}`, ...extra });

const devto = (
  title: string,
  slug: string,
  publishedAt: string,
  extra: Partial<DevToBlog> = {},
): DevToBlog => ({
  title,
  slug,
  publishedAt,
  excerpt: 'dev.to excerpt',
  source: 'devto',
  url: `https://dev.to/mikeodnis/${slug}`,
  imageUrl: `https://media2.dev.to/${slug}.png`,
  ...extra,
});

// Shaped like the live cross-post: the dev.to copy is a second later, has Forem's slug suffix,
// and its canonical_url points at itself rather than at Hashnode.
const CHAT_HN = hashnode(
  'Building a Real-Time Chat App with WebSockets',
  'building-a-real-time-chat-app-with-websockets',
  '2025-11-11T08:39:40.000Z',
);
const CHAT_DT = devto(
  'Building a Real-Time Chat App with WebSockets',
  'building-a-real-time-chat-app-with-websockets-3k6f',
  '2025-11-11T08:39:41Z',
  { canonicalUrl: 'https://dev.to/mikeodnis/building-a-real-time-chat-app-with-websockets-3k6f' },
);
const STATIC_HN = hashnode(
  'Beyond Static: Creating a Dynamic Developer Portfolio with Next.js and Modern Web Tech',
  'beyond-static-creating-a-dynamic-developer-portfolio-with-nextjs-and-modern-web-tech',
  '2024-09-26T15:27:57.000Z',
);

describe('normalizeTitle', () => {
  it('drops case, punctuation and accents and reads & as "and"', () => {
    expect(normalizeTitle('Beyond Static: Next.js & Café!')).toBe('beyond static next js and cafe');
    expect(normalizeTitle('  Real-time — chat  ')).toBe('real time chat');
  });

  it('keeps letters outside the Latin alphabet', () => {
    expect(normalizeTitle('日本語の記事！')).toBe('日本語の記事');
  });
});

describe('mergeBlogSources', () => {
  it('collapses a cross-post into the Hashnode entry and borrows the dev.to image', () => {
    const merged = mergeBlogSources([CHAT_HN, STATIC_HN], [CHAT_DT]);

    expect(merged).toEqual([
      {
        title: CHAT_HN.title,
        slug: CHAT_HN.slug,
        publishedAt: CHAT_HN.publishedAt,
        excerpt: CHAT_HN.excerpt,
        imageUrl: CHAT_DT.imageUrl,
        source: 'hashnode',
        url: `${HASHNODE_BLOG_URL}/${CHAT_HN.slug}`,
      },
      {
        title: STATIC_HN.title,
        slug: STATIC_HN.slug,
        publishedAt: STATIC_HN.publishedAt,
        excerpt: STATIC_HN.excerpt,
        source: 'hashnode',
        url: `${HASHNODE_BLOG_URL}/${STATIC_HN.slug}`,
      },
    ]);
    expect(merged[0]).not.toHaveProperty('canonicalUrl');
    expect(merged[1]).not.toHaveProperty('imageUrl');
  });

  it('keeps the Hashnode cover when the Hashnode post has one', () => {
    const cover = 'https://cdn.hashnode.com/res/hashnode/image/upload/v1/cover.png';
    const [post] = mergeBlogSources([{ ...CHAT_HN, imageUrl: cover }], [CHAT_DT]);
    expect(post).toMatchObject({ source: 'hashnode', imageUrl: cover });
  });

  it('leaves the merged post without an image when neither copy has one', () => {
    const merged = mergeBlogSources([CHAT_HN], [{ ...CHAT_DT, imageUrl: undefined }]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).not.toHaveProperty('imageUrl');
  });

  describe('dedup keys', () => {
    it('(1) matches on a canonical_url that points at the Hashnode post, whatever the title', () => {
      const copy = devto('Totally different title', 'unrelated-slug-1', CHAT_HN.publishedAt, {
        canonicalUrl: `${HASHNODE_BLOG_URL}/${CHAT_HN.slug}/?utm_source=devto`,
      });
      const merged = mergeBlogSources([CHAT_HN], [copy]);
      expect(merged).toHaveLength(1);
      expect(merged[0]).toMatchObject({ source: 'hashnode', imageUrl: copy.imageUrl });
    });

    it('(1) a canonical_url naming another Hashnode post wins over a title match', () => {
      const other = hashnode('Another post', 'another-post', '2025-01-01T00:00:00.000Z');
      const copy = devto(CHAT_HN.title, 'x-1', CHAT_HN.publishedAt, {
        canonicalUrl: `${HASHNODE_BLOG_URL}/another-post`,
      });
      const merged = mergeBlogSources([CHAT_HN, other], [copy]);
      expect(merged.map((b) => [b.slug, b.imageUrl])).toEqual([
        [CHAT_HN.slug, undefined],
        ['another-post', copy.imageUrl],
      ]);
    });

    it('(1) keeps a dev.to post whose canonical Hashnode post is not in the feed', () => {
      const copy = devto('An older post', 'an-older-post-3k6f', '2025-11-11T08:39:41Z', {
        canonicalUrl: `${HASHNODE_BLOG_URL}/an-older-post`,
      });
      expect(mergeBlogSources([CHAT_HN], [copy]).map((b) => b.source)).toEqual([
        'devto',
        'hashnode',
      ]);
    });

    it('(1) falls back to the title and slug keys when the canonical post is not in the feed', () => {
      // For example, the Hashnode slug was changed after the dev.to copy named the old one.
      const byTitle = devto(CHAT_HN.title, 'renamed-1a', '2025-11-11T08:39:41Z', {
        canonicalUrl: `${HASHNODE_BLOG_URL}/an-old-slug`,
      });
      const bySlug = devto('Retitled on dev.to', `${CHAT_HN.slug}-3k6f`, '2025-11-11T08:39:41Z', {
        canonicalUrl: `${HASHNODE_BLOG_URL}/an-old-slug`,
      });
      expect(mergeBlogSources([CHAT_HN], [byTitle])).toEqual([
        expect.objectContaining({ source: 'hashnode', imageUrl: byTitle.imageUrl }),
      ]);
      expect(mergeBlogSources([CHAT_HN], [bySlug])).toEqual([
        expect.objectContaining({ source: 'hashnode', imageUrl: bySlug.imageUrl }),
      ]);
    });

    it('(2) matches titles that differ only in case, punctuation and accents', () => {
      const copy = devto(
        'beyond static — creating a dynamic developer portfolio with next.js & modern web tech',
        'a-different-slug-1a2b',
        STATIC_HN.publishedAt,
      );
      const loose = hashnode('Café Notes', 'cafe-notes', '2025-02-01T00:00:00.000Z');
      const looseCopy = devto('CAFE NOTES!', 'something-else-9', '2025-02-01T00:00:00Z');
      const merged = mergeBlogSources([STATIC_HN, loose], [copy, looseCopy]);
      expect(merged.map((b) => b.source)).toEqual(['hashnode', 'hashnode']);
    });

    it('(3) matches a retitled cross-post by its slug plus a Forem suffix', () => {
      const copy = devto('Real-time chat, revisited', `${CHAT_HN.slug}-o7j`, CHAT_HN.publishedAt);
      const exact = devto('Also retitled', CHAT_HN.slug, CHAT_HN.publishedAt);
      expect(mergeBlogSources([CHAT_HN], [copy])).toHaveLength(1);
      expect(mergeBlogSources([CHAT_HN], [exact])).toHaveLength(1);
    });

    it('prefers a title match over a slug match on another Hashnode post', () => {
      const titled = hashnode('Intro to React', 'react-basics', '2025-01-01T00:00:00.000Z');
      const slugged = hashnode('Something else', 'intro-to-react', '2025-01-02T00:00:00.000Z');
      const copy = devto('Intro to React', 'intro-to-react-2b', '2025-01-03T00:00:00Z');
      const merged = mergeBlogSources([titled, slugged], [copy]);
      expect(merged.map((b) => [b.slug, b.imageUrl])).toEqual([
        ['intro-to-react', undefined],
        ['react-basics', copy.imageUrl],
      ]);
    });
  });

  it('keeps unrelated posts: longer slugs, non-Forem suffixes and different titles', () => {
    const original = hashnode('Intro', 'intro-to-react', '2025-01-01T00:00:00.000Z');
    const merged = mergeBlogSources(
      [original],
      [
        devto('Intro to React hooks', 'intro-to-react-hooks-12ab', '2025-01-02T00:00:00Z'),
        devto('Intro to React 2025', 'intro-to-react-zzzz', '2025-01-03T00:00:00Z'),
        devto('Intro to React, part two', 'intro-to-react-12345', '2025-01-04T00:00:00Z'),
      ],
    );
    expect(merged.map((b) => [b.source, b.slug])).toEqual([
      ['devto', 'intro-to-react-12345'],
      ['devto', 'intro-to-react-zzzz'],
      ['devto', 'intro-to-react-hooks-12ab'],
      ['hashnode', 'intro-to-react'],
    ]);
  });

  it('never matches titles that normalize to nothing', () => {
    const merged = mergeBlogSources(
      [hashnode('!!!', 'bang', '2025-01-01T00:00:00.000Z')],
      [devto('???', 'question-1', '2025-01-02T00:00:00Z')],
    );
    expect(merged).toHaveLength(2);
  });

  it('keeps dev.to-only posts as they are and sorts everything newest first', () => {
    const only = devto('Only on dev', 'only-on-dev-1abc', '2026-01-01T00:00:00Z', {
      canonicalUrl: 'https://dev.to/mikeodnis/only-on-dev-1abc',
    });
    const merged = mergeBlogSources([STATIC_HN, CHAT_HN], [CHAT_DT, only]);

    expect(merged.map((b) => b.slug)).toEqual([only.slug, CHAT_HN.slug, STATIC_HN.slug]);
    expect(merged[0]).toEqual({
      title: only.title,
      slug: only.slug,
      publishedAt: only.publishedAt,
      excerpt: only.excerpt,
      imageUrl: only.imageUrl,
      source: 'devto',
      url: only.url,
    });
  });

  it('sorts posts with an unparseable date last', () => {
    const undated = devto('Undated', 'undated-1', 'not a date');
    const merged = mergeBlogSources([STATIC_HN], [undated]);
    expect(merged.map((b) => b.slug)).toEqual([STATIC_HN.slug, undated.slug]);
  });

  it('drops every dev.to copy of a post cross-posted twice, taking the first image found', () => {
    const first = { ...CHAT_DT, imageUrl: '' };
    const second = devto(CHAT_HN.title, `${CHAT_HN.slug}-9p`, CHAT_HN.publishedAt);
    const merged = mergeBlogSources([CHAT_HN], [first, second]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.imageUrl).toBe(second.imageUrl);
  });

  it('works with only one source', () => {
    expect(mergeBlogSources([], [CHAT_DT]).map((b) => b.source)).toEqual(['devto']);
    expect(mergeBlogSources([CHAT_HN], []).map((b) => b.source)).toEqual(['hashnode']);
    expect(mergeBlogSources([], [])).toEqual([]);
  });

  it('does not modify its inputs', () => {
    const hashnodePosts = Object.freeze([Object.freeze({ ...CHAT_HN })]);
    const devtoPosts = Object.freeze([Object.freeze({ ...CHAT_DT })]);
    const merged = mergeBlogSources(hashnodePosts, devtoPosts);
    expect(merged[0]).not.toBe(hashnodePosts[0]);
    expect(hashnodePosts[0]).toEqual(CHAT_HN);
    expect(devtoPosts[0]).toEqual(CHAT_DT);
  });
});
