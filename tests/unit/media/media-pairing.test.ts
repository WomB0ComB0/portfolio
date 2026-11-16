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
 * @file Pairing a written piece with the video of it on /media (media-pairing.ts): what makes a
 * pair (a rule in the map, a post and a video that link each other, one post and one video with
 * the same title) and, at more length, what must not. A reference to "the video version" that
 * points at the wrong piece is worse than none, so most cases here are look-alikes that stay
 * unpaired: above all a link one way, such as a post a video lists among its resources, which is
 * the written version of no video. Synthetic data only.
 */

import { makeTalk, makeVideo } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';
import {
  buildFeed,
  type FeedEntry,
  type FeedSources,
} from '@/app/(routes)/(dev)/media/_lib/media-feed';
import {
  applyPairRule,
  type PairRules,
  pairEntries,
  pairSignals,
} from '@/app/(routes)/(dev)/media/_lib/media-pairing';
import type { Blog } from '@/app/api/v1/[[...route]]/blog/handlers';

const BLOG = 'https://blog.example.dev';
const NO_RULES: PairRules = { pairs: [], notPairs: [] };
const noImages = (): string | null => null;

const post = (slug: string, overrides: Partial<Blog> = {}): Blog => ({
  title: `Post ${slug}`,
  slug,
  publishedAt: '2025-03-01T00:00:00.000Z',
  excerpt: '',
  source: 'hashnode',
  url: `${BLOG}/${slug}`,
  ...overrides,
});

/** A made video with an 11-character id built from `name`. */
const video = (name: string, overrides: Parameters<typeof makeVideo>[0] = {}) =>
  makeVideo({
    _id: name,
    videoId: videoId(name),
    title: `Video ${name}`,
    description: '',
    publishedDate: '2025-04-01T00:00:00Z',
    ...overrides,
  });

/** The 11-character id `video(name)` gets. */
const videoId = (name: string): string => name.padEnd(11, '0').slice(0, 11);

const watch = (name: string): string => `https://www.youtube.com/watch?v=${videoId(name)}`;

/** The feed for `sources`, paired by the page's own rules. */
function paired(sources: Partial<FeedSources>, rules: PairRules = NO_RULES): FeedEntry[] {
  return pairEntries(buildFeed(sources, noImages), pairSignals(sources), rules);
}

/** "kind:source id" to the id of what it points at, for the entries that point at something. */
const pairsOf = (entries: readonly FeedEntry[]): Record<string, string> =>
  Object.fromEntries(
    entries.filter((entry) => entry.pair !== null).map((entry) => [entry.id, entry.pair?.id ?? '']),
  );

const postId = (slug: string): string => `post:${BLOG}/${slug}`;

describe('a link one way', () => {
  it('pairs nothing for one video that lists one post: a resource is not a version', () => {
    const entries = paired({
      posts: [post('guide')],
      videos: [
        video('talk', { description: `Resources Mentioned in the Video:\n- ${BLOG}/guide` }),
      ],
    });

    expect(pairsOf(entries)).toEqual({});
  });

  it('pairs nothing for one post that embeds one video the video does not link back', () => {
    const entries = paired({
      posts: [post('revamp', { videoIds: [videoId('revamp')] })],
      videos: [video('revamp')],
    });

    expect(pairsOf(entries)).toEqual({});
  });

  it.each([2, 3, 5])('pairs nothing when %i videos link one post as a resource', (count) => {
    const videos = Array.from({ length: count }, (_, n) =>
      video(`res${n}`, {
        description: `Resources Mentioned in the Video:\n- ${BLOG}/guide`,
        publishedDate: `2025-0${n + 1}-01T00:00:00Z`,
      }),
    );
    const entries = paired({ posts: [post('guide')], videos });

    expect(pairsOf(entries)).toEqual({});
  });

  it('takes a link every upload repeats for a template line, not a pair', () => {
    const videos = Array.from({ length: 6 }, (_, n) =>
      video(`tpl${n}`, { description: `Latest post: ${BLOG}/latest` }),
    );
    const entries = paired({ posts: [post('latest')], videos });

    expect(pairsOf(entries)).toEqual({});
  });
});

describe('a post and a video that link each other', () => {
  /** A post that embeds the video `chat`, so a description that links it back makes the pair. */
  const chatPost = (overrides: Partial<Blog> = {}): Blog =>
    post('chat-app', { videoIds: [videoId('chat')], ...overrides });

  it('pair both ways, each side carrying the other piece as it is', () => {
    const entries = paired({
      posts: [chatPost({ title: 'Building a chat app' })],
      videos: [video('chat', { description: `The written version: ${BLOG}/chat-app` })],
    });

    expect(pairsOf(entries)).toEqual({
      [postId('chat-app')]: 'video:chat',
      'video:chat': postId('chat-app'),
    });
    expect(entries.find((entry) => entry.id === 'video:chat')?.pair).toEqual({
      id: postId('chat-app'),
      kind: 'post',
      title: 'Building a chat app',
      href: `${BLOG}/chat-app`,
      videoId: null,
    });
    expect(entries.find((entry) => entry.id === postId('chat-app'))?.pair).toEqual({
      id: 'video:chat',
      kind: 'video',
      title: 'Video chat',
      href: watch('chat'),
      videoId: 'chat0000000',
    });
  });

  it.each([
    ['a full stop after it', `Read it at ${BLOG}/chat-app.`],
    ['brackets around it', `(post: ${BLOG}/chat-app)`],
    ['a query string and a fragment', `${BLOG}/chat-app?utm_source=youtube#intro`],
    ['www. and a trailing slash', 'https://www.blog.example.dev/chat-app/'],
    ['another case in the host, http', 'http://Blog.Example.dev/chat-app'],
    [
      'other links before it',
      `https://linktr.ee/someone and https://x.example/a\n${BLOG}/chat-app`,
    ],
  ])('reads the link back with %s', (_what, description) => {
    const entries = paired({ posts: [chatPost()], videos: [video('chat', { description })] });

    expect(pairsOf(entries)['video:chat']).toBe(postId('chat-app'));
  });

  it.each([
    ['the blog itself, not a post', `More on ${BLOG}`],
    ['a post that is not in the feed', `${BLOG}/an-older-post`],
    ['a longer address that starts the same', `${BLOG}/chat-app-part-2`],
    ['a page under the post', `${BLOG}/chat-app/comments`],
    ['the same path on another site', 'https://other.example.dev/chat-app'],
    ['a share link that only carries the address', `https://share.example/?u=${BLOG}/chat-app`],
    ['the address without a scheme, as plain words', 'blog.example.dev/chat-app'],
    ['no link at all', 'Building a chat app, the video.'],
  ])('takes %s for no link back, so nothing pairs', (_what, description) => {
    const entries = paired({ posts: [chatPost()], videos: [video('chat', { description })] });

    expect(pairsOf(entries)).toEqual({});
  });

  it('pairs nothing for a video that links two posts back: a list of resources names no version', () => {
    const entries = paired({
      posts: [
        post('first', { videoIds: [videoId('both')] }),
        post('second', { videoIds: [videoId('both')] }),
      ],
      videos: [video('both', { description: `${BLOG}/second then ${BLOG}/first` })],
    });

    expect(pairsOf(entries)).toEqual({});
  });

  it('pairs nothing for a post that embeds two videos which link it back (a round-up)', () => {
    const entries = paired({
      posts: [post('two', { videoIds: [videoId('second'), videoId('first')] })],
      videos: [
        video('first', { description: `${BLOG}/two` }),
        video('second', { description: `${BLOG}/two` }),
      ],
    });

    expect(pairsOf(entries)).toEqual({});
  });

  it('pairs a post several videos link with the one of them it embeds itself', () => {
    const entries = paired({
      posts: [post('guide', { videoIds: ['made0000000'] })],
      videos: [
        video('made', { description: `${BLOG}/guide` }),
        video('later', { description: `See also ${BLOG}/guide` }),
      ],
    });

    expect(pairsOf(entries)).toEqual({
      'video:made': postId('guide'),
      [postId('guide')]: 'video:made',
    });
  });

  it('pairs a post with the one video it embeds that is in the feed', () => {
    const entries = paired({
      posts: [post('one', { videoIds: ['missing0000', videoId('second')] })],
      videos: [video('first'), video('second', { description: `${BLOG}/one` })],
    });

    expect(pairsOf(entries)).toEqual({
      [postId('one')]: 'video:second',
      'video:second': postId('one'),
    });
  });

  it('pairs nothing through a video that is not in the feed', () => {
    const entries = paired({
      posts: [post('revamp', { videoIds: ['someoneElse'] })],
      videos: [video('revamp', { description: `${BLOG}/revamp` })],
    });

    expect(pairsOf(entries)).toEqual({});
  });

  it('a stream upload can be the video of a post too', () => {
    const entries = paired({
      posts: [post('live-build', { videoIds: [videoId('live')] })],
      videos: [
        video('live', {
          description: `Broadcasted live on Twitch -- Watch live at https://www.twitch.tv/x\n${BLOG}/live-build`,
        }),
      ],
    });

    expect(pairsOf(entries)).toEqual({
      'stream:live': postId('live-build'),
      [postId('live-build')]: 'stream:live',
    });
  });
});

describe('the same title', () => {
  it('pairs the one post and the one video that carry it', () => {
    const entries = paired({
      posts: [post('revamp', { title: 'Portfolio Revamp: Round 3!' })],
      videos: [video('revamp', { title: 'portfolio revamp – round 3' })],
    });

    expect(pairsOf(entries)).toEqual({
      [postId('revamp')]: 'video:revamp',
      'video:revamp': postId('revamp'),
    });
  });

  it.each([
    ['a title one word apart', 'Portfolio revamp round 3', 'Portfolio revamp round 4'],
    ['a title that only starts the same', 'Building a chat app', 'Building a chat app with Go'],
    ['a part of the same show', 'Building a chat app', 'Building a chat app (Part 1)'],
    ['a short title anyone could reuse', 'Weekly update', 'Weekly update'],
    ['a one-word title', 'Introduction', 'Introduction'],
    ['titles with nothing to compare', '!!!', '???'],
  ])('pairs nothing for %s', (_what, written, filmed) => {
    const entries = paired({
      posts: [post('a', { title: written })],
      videos: [video('a', { title: filmed })],
    });

    expect(pairsOf(entries)).toEqual({});
  });

  it('pairs nothing when several uploads carry the title (a recurring stream)', () => {
    const entries = paired({
      posts: [post('marathon', { title: 'Coding, building and learning marathon' })],
      videos: [
        video('m1', { title: 'Coding, building and learning marathon.' }),
        video('m2', { title: 'Coding, building and learning marathon.' }),
      ],
    });

    expect(pairsOf(entries)).toEqual({});
  });

  it('pairs nothing when two posts carry the title', () => {
    const entries = paired({
      posts: [
        post('a', { title: 'Notes on edge caching' }),
        post('b', { title: 'Notes on Edge Caching' }),
      ],
      videos: [video('edge', { title: 'Notes on edge caching' })],
    });

    expect(pairsOf(entries)).toEqual({});
  });

  it('never pairs two videos, two posts, or a piece with itself', () => {
    const entries = paired({
      posts: [
        post('a', { title: 'Notes on edge caching', videoIds: [] }),
        post('b', { title: 'Another post entirely here' }),
      ],
      videos: [
        video('one', { title: 'A demo of the thing', description: watch('two') }),
        video('two', { title: 'A demo of the thing', description: watch('two') }),
        video('self', { title: 'Self reference video here', description: watch('self') }),
      ],
    });

    expect(pairsOf(entries)).toEqual({});
  });

  it('leaves talks and presentations out, whatever they link or are called', () => {
    const sources: Partial<FeedSources> = {
      posts: [post('edge', { title: 'Notes on edge caching', videoIds: ['talkvideo00'] })],
      talks: [
        makeTalk({
          title: 'Notes on edge caching',
          description: `${BLOG}/edge`,
          videoUrl: 'https://www.youtube.com/watch?v=talkvideo00',
        }),
      ],
    };

    expect(pairsOf(paired(sources))).toEqual({});
  });
});

describe('the map', () => {
  it('a rule pairs two pieces nothing else connects', () => {
    const entries = paired(
      { posts: [post('static')], videos: [video('revamp')] },
      { pairs: [{ written: `${BLOG}/static`, video: watch('revamp') }], notPairs: [] },
    );

    expect(pairsOf(entries)).toEqual({
      [postId('static')]: 'video:revamp',
      'video:revamp': postId('static'),
    });
  });

  it('reads the video as a bare id, and the post with www. or a trailing slash', () => {
    const entries = paired(
      { posts: [post('static')], videos: [video('revamp')] },
      {
        pairs: [{ written: 'https://www.blog.example.dev/static/', video: 'revamp00000' }],
        notPairs: [],
      },
    );

    expect(pairsOf(entries)[postId('static')]).toBe('video:revamp');
  });

  it('a rule wins over a link', () => {
    const entries = paired(
      {
        posts: [post('linked', { videoIds: [videoId('v')] }), post('ruled')],
        videos: [video('v', { description: `${BLOG}/linked` })],
      },
      { pairs: [{ written: `${BLOG}/ruled`, video: watch('v') }], notPairs: [] },
    );

    expect(pairsOf(entries)).toEqual({
      'video:v': postId('ruled'),
      [postId('ruled')]: 'video:v',
    });
  });

  it('every pair points both ways: no piece is the other version of two', () => {
    const entries = paired(
      {
        posts: [post('a', { title: 'One long shared title' }), post('b')],
        videos: [
          video('x', { title: 'One long shared title', description: `${BLOG}/b` }),
          video('y', { description: `${BLOG}/b` }),
        ],
      },
      NO_RULES,
    );
    const pairs = pairsOf(entries);

    for (const [from, to] of Object.entries(pairs)) expect(pairs[to]).toBe(from);
    expect(pairs).toEqual({ [postId('a')]: 'video:x', 'video:x': postId('a') });
  });

  it('a rule that names a piece missing from the feed pairs nothing', () => {
    const entries = paired(
      { posts: [post('static')], videos: [video('revamp')] },
      {
        pairs: [
          { written: `${BLOG}/gone`, video: watch('revamp') },
          { written: `${BLOG}/static`, video: 'notInFeed00' },
          { written: 'not a url', video: 'nor an id' },
        ],
        notPairs: [],
      },
    );

    expect(pairsOf(entries)).toEqual({});
  });

  it('a "not a pair" rule blocks two pieces that link each other and a same-title match', () => {
    const block: PairRules = {
      pairs: [],
      notPairs: [{ written: `${BLOG}/chat-app`, video: watch('chat') }],
    };
    const linked: Partial<FeedSources> = {
      posts: [post('chat-app', { videoIds: [videoId('chat')] })],
      videos: [video('chat', { description: `${BLOG}/chat-app` })],
    };

    expect(pairsOf(paired(linked))).not.toEqual({});
    expect(pairsOf(paired(linked, block))).toEqual({});
    expect(
      pairsOf(
        paired(
          {
            posts: [post('chat-app', { title: 'Building a chat app' })],
            videos: [video('chat', { title: 'Building a chat app' })],
          },
          block,
        ),
      ),
    ).toEqual({});
  });

  it('a "not a pair" rule blocks only that pairing: the next candidate takes its place', () => {
    const entries = paired(
      {
        posts: [post('series', { videoIds: [videoId('late'), videoId('early')] })],
        videos: [
          video('late', { description: `${BLOG}/series`, publishedDate: '2025-06-01T00:00:00Z' }),
          video('early', { description: `${BLOG}/series`, publishedDate: '2025-05-01T00:00:00Z' }),
        ],
      },
      { pairs: [], notPairs: [{ written: `${BLOG}/series`, video: watch('early') }] },
    );

    expect(pairsOf(entries)).toEqual({
      'video:late': postId('series'),
      [postId('series')]: 'video:late',
    });
  });
});

describe('pairEntries', () => {
  it('returns new entries and leaves its input as it was', () => {
    const sources = {
      posts: [post('chat-app', { videoIds: [videoId('chat')] })],
      videos: [video('chat', { description: `${BLOG}/chat-app` })],
    };
    const entries = buildFeed(sources, noImages);
    const before = JSON.stringify(entries);

    const result = pairEntries(entries, pairSignals(sources), NO_RULES);

    expect(pairsOf(result)).not.toEqual({});
    expect(JSON.stringify(entries)).toBe(before);
    expect(result).not.toBe(entries);
    expect(result.map((entry) => entry.id)).toEqual(entries.map((entry) => entry.id));
  });

  it('pairs nothing in a feed with only one medium', () => {
    expect(pairsOf(paired({ videos: [video('a'), video('b')] }))).toEqual({});
    expect(pairsOf(paired({ posts: [post('a'), post('b')] }))).toEqual({});
  });
});

describe('pairSignals', () => {
  it('reads at most the first 50 links of a description', () => {
    const links = (count: number): string =>
      Array.from({ length: count }, (_, n) => `https://x.example/${n}`).join(' ');
    const withNoise = (count: number): FeedEntry[] =>
      paired({
        posts: [post('late', { videoIds: [videoId('v')] })],
        videos: [video('v', { description: `${links(count)} ${BLOG}/late` })],
      });

    expect(pairsOf(withNoise(49))).not.toEqual({});
    expect(pairsOf(withNoise(50))).toEqual({});
  });

  it('writes a link to a video as its id, whatever the link form', () => {
    const edges = pairSignals({
      videos: [
        video('a', { description: 'https://youtu.be/bbbbbbbbbbb and https://x.example/Path/' }),
      ],
    });

    expect(edges).toEqual([
      { from: 'yt:a0000000000', to: 'yt:bbbbbbbbbbb' },
      { from: 'yt:a0000000000', to: 'url:x.example/Path' },
    ]);
  });
});

describe('applyPairRule', () => {
  const sources = {
    posts: [post('static'), post('chat-app', { videoIds: [videoId('chat')] })],
    videos: [video('revamp'), video('chat', { description: `${BLOG}/chat-app` })],
  };
  const entries = pairEntries(buildFeed(sources, noImages), pairSignals(sources), NO_RULES);

  it('sets both sides and leaves the other pairs alone', () => {
    const result = applyPairRule(entries, { written: `${BLOG}/static`, video: watch('revamp') });

    expect(pairsOf(result)).toEqual({
      [postId('static')]: 'video:revamp',
      'video:revamp': postId('static'),
      [postId('chat-app')]: 'video:chat',
      'video:chat': postId('chat-app'),
    });
    expect(pairsOf(entries)).toEqual({
      [postId('chat-app')]: 'video:chat',
      'video:chat': postId('chat-app'),
    });
  });

  it('changes nothing when the rule names a piece that is not there', () => {
    expect(applyPairRule(entries, { written: `${BLOG}/gone`, video: watch('revamp') })).toEqual(
      entries,
    );
    expect(applyPairRule(entries, { written: `${BLOG}/static`, video: 'nope' })).toEqual(entries);
  });
});
