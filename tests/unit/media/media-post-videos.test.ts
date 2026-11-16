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
 * @file The one field /media's pairing needs that the blog loader did not return: the YouTube
 * videos a Hashnode post embeds or links, read from the body the RSS feed already carries
 * (`content:encoded`). The body itself is not kept. A post without such a link, and a feed
 * without the element, answer exactly as before, so every other caller sees no change; the merge
 * with dev.to passes the field through.
 */

import { describe, expect, it } from 'vitest';
import { mergeBlogSources } from '@/lib/api-integrations/blog-merge';
import { HASHNODE_BLOG_URL, parseHashnodeRss } from '@/lib/api-integrations/blogs';

const item = (slug: string, body: string | null): string => `
    <item>
      <title><![CDATA[Post ${slug}]]></title>
      <description><![CDATA[About ${slug}]]></description>
      <link>${HASHNODE_BLOG_URL}/${slug}</link>
      <pubDate>Tue, 11 Nov 2025 08:39:40 GMT</pubDate>
      ${body === null ? '' : `<content:encoded><![CDATA[${body}]]></content:encoded>`}
    </item>`;

const feed = (...items: string[]): string => `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
  <channel>
    <title><![CDATA[Blog]]></title>
    <link>${HASHNODE_BLOG_URL}</link>
    ${items.join('')}
  </channel>
</rss>`;

describe('parseHashnodeRss: the videos a post embeds', () => {
  it('reads each YouTube id in the body once, in order, whatever the link form', () => {
    const body = `<p>Watch it:</p>
      <div class="embed-wrapper"><a class="embed-card" href="https://www.youtube.com/watch?v=aaaaaaaaaa1">https://www.youtube.com/watch?v=aaaaaaaaaa1</a></div>
      <p><a href="https://youtu.be/bbbbbbbbbb2?si=x">short link</a></p>
      <iframe src="https://www.youtube-nocookie.com/embed/cccccccccc3"></iframe>
      <a href="https://www.youtube.com/watch?list=PL1&amp;v=dddddddddd4">in a playlist</a>
      <a href="https://www.youtube.com/embed/aaaaaaaaaa1">again</a>`;

    const [post] = parseHashnodeRss(feed(item('with-video', body)));

    expect(post?.videoIds).toEqual(['aaaaaaaaaa1', 'bbbbbbbbbb2', 'cccccccccc3', 'dddddddddd4']);
  });

  it('adds no field when the body links no video, or the feed carries no body', () => {
    const posts = parseHashnodeRss(
      feed(
        item(
          'plain',
          '<h1>Plain</h1><p>See https://www.youtube.com/@someone and https://example.com/a</p>',
        ),
        item('no-body', null),
      ),
    );

    expect(posts).toHaveLength(2);
    for (const post of posts) {
      expect(Object.keys(post).sort()).toEqual(['excerpt', 'publishedAt', 'slug', 'title']);
    }
  });

  it('never keeps the body itself', () => {
    const [post] = parseHashnodeRss(
      feed(item('with-video', '<p>SECRET-BODY https://youtu.be/aaaaaaaaaa1</p>')),
    );

    expect(JSON.stringify(post)).not.toContain('SECRET-BODY');
  });
});

describe('mergeBlogSources: videoIds', () => {
  it("passes a Hashnode post's videos through, and adds none where there are none", () => {
    const merged = mergeBlogSources(
      [
        {
          title: 'With video',
          slug: 'with-video',
          publishedAt: '2025-11-11T08:39:40.000Z',
          excerpt: '',
          videoIds: ['aaaaaaaaaa1'],
        },
        { title: 'Plain', slug: 'plain', publishedAt: '2025-11-10T08:39:40.000Z', excerpt: '' },
      ],
      [],
    );

    expect(merged[0]?.videoIds).toEqual(['aaaaaaaaaa1']);
    expect(merged[1] && 'videoIds' in merged[1]).toBe(false);
  });
});
