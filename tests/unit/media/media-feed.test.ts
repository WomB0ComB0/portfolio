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
 * @file The /media feed: blog posts, videos, stream uploads, talks, presentations and articles as
 * plain entries, newest first (undated last), grouped by kind (the sections) or by year (the one
 * feed); only kinds that have items get a chip; a stream upload is told from a made video by
 * Twitch's export line; a series part knows its place; YouTube boilerplate is stripped from
 * summaries; folded rows carry their parts; the header's figures and the row's date words.
 * Synthetic data only.
 */

import { makeArticle, makePresentation, makeTalk, makeVideo } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';
import {
  buildFeed,
  FEED_KINDS,
  type FeedEntry,
  KIND_WORDS,
  streamsAsVideos,
} from '@/app/(routes)/(dev)/media/_lib/media-feed';
import { mediaFilters } from '@/app/(routes)/(dev)/media/_lib/media-filters';
import {
  dateRange,
  fullDay,
  lengthText,
  monthDay,
  monthYear,
  totalLength,
} from '@/app/(routes)/(dev)/media/_lib/media-format';
import { MEDIA_NOT_SERIES } from '@/app/(routes)/(dev)/media/_lib/media-not-series';
import {
  feedRows,
  feedStats,
  groupByKind,
  groupByYear,
  kindsWithItems,
} from '@/app/(routes)/(dev)/media/_lib/media-rows';
import { cleanSummary } from '@/app/(routes)/(dev)/media/_lib/media-summary';
import type { Blog } from '@/app/api/v1/[[...route]]/blog/handlers';

const post = (overrides: Partial<Blog> = {}): Blog => ({
  title: 'Building a chat app',
  slug: 'building-a-chat-app',
  publishedAt: '2025-11-11T08:39:40.000Z',
  excerpt: 'Messages arrive instantly.',
  source: 'hashnode',
  url: 'https://blog.example.dev/building-a-chat-app',
  ...overrides,
});

const noImages = (): string | null => null;
const ids = (entries: readonly FeedEntry[]): string[] => entries.map((entry) => entry.id);

/** Twitch's own line on a broadcast it exported to YouTube. */
const TWITCH_LINE = 'Broadcasted live on Twitch -- Watch live at https://www.twitch.tv/someone';

describe('kinds', () => {
  it('are in section order: writing first, then video, streams, talks and slides', () => {
    expect(FEED_KINDS).toEqual(['post', 'article', 'video', 'stream', 'talk', 'presentation']);
  });

  it('name each section the way its chip does', () => {
    expect(FEED_KINDS.map((kind) => KIND_WORDS[kind].title)).toEqual([
      'Writing',
      'Articles',
      'Video',
      'Streams',
      'Talks',
      'Presentations',
    ]);
  });
});

describe('stream uploads', () => {
  it("tells a stream upload by Twitch's export line", () => {
    const feed = buildFeed(
      {
        videos: [
          makeVideo({ _id: 's', title: 'Coding marathon.', description: TWITCH_LINE }),
          makeVideo({ _id: 'v', title: 'Cloud demo', description: 'We build a demo.' }),
        ],
      },
      noImages,
    );
    const byId = Object.fromEntries(feed.map((entry) => [entry.id, entry]));

    expect(byId['stream:s']?.kind).toBe('stream');
    expect(byId['video:v']?.kind).toBe('video');
    // A stream is still a YouTube upload: the same link, still and player id as any video.
    expect(byId['stream:s']).toMatchObject({ where: 'YouTube', external: true });
    expect(byId['stream:s']?.videoId).not.toBeNull();
    expect(byId['stream:s']?.haystack).toContain('Stream');
  });

  it('counts an upload with an empty description and the same base title as a stream too', () => {
    const feed = buildFeed(
      {
        videos: [
          makeVideo({ _id: 'a', title: 'Coding marathon. (Part 2/2)', description: TWITCH_LINE }),
          makeVideo({ _id: 'b', title: 'coding marathon', description: '' }),
          makeVideo({ _id: 'c', title: 'Coding marathon, the recap', description: '' }),
        ],
      },
      noImages,
    );

    expect(Object.fromEntries(feed.map((entry) => [entry.id.split(':')[1], entry.kind]))).toEqual({
      a: 'stream',
      b: 'stream',
      c: 'video',
    });
  });

  it('leaves a video that only mentions Twitch mid-line a video', () => {
    const feed = buildFeed(
      {
        videos: [
          makeVideo({ description: 'This was broadcasted live on Twitch last week.' }),
          makeVideo({ description: 'Notes.\nI also stream: broadcasted live on Twitch, Fridays.' }),
          makeVideo({ description: 'Watch live at https://www.twitch.tv/someone' }),
        ],
      },
      noImages,
    );

    expect(feed.map((entry) => entry.kind)).toEqual(['video', 'video', 'video']);
  });

  it("reads Twitch's line on any line of the description, in any case", () => {
    const [entry] = buildFeed(
      {
        videos: [makeVideo({ description: `Late night session.\n  ${TWITCH_LINE.toUpperCase()}` })],
      },
      noImages,
    );

    expect(entry?.kind).toBe('stream');
  });

  it('keeps a stream upload findable by its project and topics when it is listed as a video', () => {
    const [entry] = buildFeed(
      { videos: [makeVideo({ _id: 's', title: 'Night build', description: TWITCH_LINE })] },
      noImages,
    );
    if (!entry) throw new Error('no entry');
    const related: FeedEntry = {
      ...entry,
      project: { id: 'tool', title: 'The Tool', proposed: false },
      topics: [{ slug: 'web', label: 'Web' }],
    };

    const [asVideo] = streamsAsVideos([related]);

    expect(asVideo?.kind).toBe('video');
    expect(asVideo?.haystack).toContain('The Tool');
    expect(asVideo?.haystack).toContain('Web');
    expect(asVideo?.project).toEqual(related.project);
  });

  it('puts every stream back with the videos when asked, ids still unique', () => {
    const feed = buildFeed(
      {
        videos: [
          makeVideo({
            _id: 's2',
            title: 'Marathon',
            description: TWITCH_LINE,
            publishedDate: '2025-10-02T00:00:00Z',
          }),
          makeVideo({
            _id: 's1',
            title: 'Marathon',
            description: TWITCH_LINE,
            publishedDate: '2025-10-01T00:00:00Z',
          }),
          makeVideo({ _id: 'v', title: 'Cloud demo' }),
        ],
        posts: [post()],
      },
      noImages,
    );
    const merged = streamsAsVideos(feed);

    expect(merged.map((entry) => entry.kind).sort()).toEqual(['post', 'video', 'video', 'video']);
    expect(new Set(ids(merged)).size).toBe(merged.length);
    expect(ids(merged)).toContain('video:s1');
    expect(merged.find((entry) => entry.id === 'video:s1')?.haystack).not.toContain('Stream');
    // Its place in the series is kept, so the row still says "Upload 1 of 2".
    expect(merged.find((entry) => entry.id === 'video:s1')?.series).toMatchObject({
      part: 1,
      count: 2,
    });
    // The input is left as it was.
    expect(feed.filter((entry) => entry.kind === 'stream')).toHaveLength(2);
  });
});

describe('series', () => {
  it('gives each upload of a series its place and the series one URL value', () => {
    const feed = buildFeed(
      {
        videos: [
          makeVideo({
            _id: 'b',
            title: 'Project 2 (part 2) - Discord Clone',
            publishedDate: '2024-11-07',
          }),
          makeVideo({
            _id: 'x',
            title: 'Project 4 (part 1) - AI Coding Agent',
            publishedDate: '2024-11-01',
          }),
          makeVideo({
            _id: 'a',
            title: 'Project 2 (part 1) - Discord Clone',
            publishedDate: '2024-10-24',
          }),
        ],
      },
      noImages,
    );
    const byId = Object.fromEntries(feed.map((entry) => [entry.id, entry]));

    expect(byId['video:a']?.series).toEqual({
      slug: 'project-2-discord-clone',
      name: 'Project 2 - Discord Clone',
      part: 1,
      count: 2,
      numbered: 'title',
    });
    expect(byId['video:b']?.series).toMatchObject({ part: 2, count: 2 });
    expect(byId['video:x']?.series).toBeNull();
    expect(feed.every((entry) => entry.pair === null)).toBe(true);
  });

  it('lists a series newest first by its numbering, when parts went up out of order', () => {
    // "(Part 2/2)" reached YouTube hours before "(Part 1/2)": upload 3 is listed above upload 2.
    const feed = buildFeed(
      {
        videos: [
          makeVideo({ _id: 'after', title: 'Marathon.', publishedDate: '2025-12-30T03:17:20Z' }),
          makeVideo({
            _id: 'one',
            title: 'Marathon. (Part 1/2)',
            publishedDate: '2025-12-29T09:02:28Z',
          }),
          makeVideo({ _id: 'other', title: 'A demo', publishedDate: '2025-12-29T05:00:00Z' }),
          makeVideo({
            _id: 'two',
            title: 'Marathon. (Part 2/2)',
            publishedDate: '2025-12-29T00:42:07Z',
          }),
          makeVideo({ _id: 'before', title: 'Marathon.', publishedDate: '2025-10-20T23:16:26Z' }),
        ],
      },
      noImages,
    );

    // The series keeps the rows it held; the video between two of its uploads stays where it was.
    expect(ids(feed)).toEqual([
      'video:after',
      'video:two',
      'video:other',
      'video:one',
      'video:before',
    ]);
    expect(feed.map((entry) => entry.series?.part ?? null)).toEqual([4, 3, null, 2, 1]);
  });

  it('starts every entry with nothing to see also: no pair, no project, no topics', () => {
    const feed = buildFeed({ posts: [post()], videos: [makeVideo()] }, noImages);

    for (const entry of feed) {
      expect(entry.pair).toBeNull();
      expect(entry.project).toBeNull();
      expect(entry.topics).toEqual([]);
    }
  });

  it('never gives a post, talk or article a series, even with numbered titles', () => {
    const feed = buildFeed(
      {
        posts: [
          post({ title: 'Rust notes, Part 1', url: 'https://blog.example.dev/rust-1' }),
          post({ title: 'Rust notes, Part 2', url: 'https://blog.example.dev/rust-2' }),
        ],
        talks: [makeTalk({ title: 'Edge, Part 1' }), makeTalk({ title: 'Edge, Part 2' })],
      },
      noImages,
    );

    expect(feed.every((entry) => entry.series === null)).toBe(true);
  });

  it('keeps two series apart when their titles would write the same URL value', () => {
    const feed = buildFeed(
      {
        videos: [
          makeVideo({ _id: 'a2', title: 'C++ stream' }),
          makeVideo({ _id: 'a1', title: 'C++ stream' }),
          makeVideo({ _id: 'b2', title: 'C# stream' }),
          makeVideo({ _id: 'b1', title: 'C# stream' }),
        ],
      },
      noImages,
    );
    const slugs = Object.fromEntries(feed.map((entry) => [entry.id, entry.series?.slug]));

    expect(slugs['video:a1']).toBe(slugs['video:a2']);
    expect(slugs['video:b1']).toBe(slugs['video:b2']);
    expect(slugs['video:a1']).not.toBe(slugs['video:b1']);
    for (const slug of Object.values(slugs)) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  // Same title, two years apart, nothing to do with each other: the rule cannot tell, so the
  // hand-written list stops it (by either upload's YouTube link or id).
  it('makes two unrelated same-titled uploads a series unless the not-a-series list names one', () => {
    const videos = [
      makeVideo({ _id: 'new', title: 'Demo', videoId: 'demo2026abc', publishedDate: '2026-02-01' }),
      makeVideo({ _id: 'old', title: 'Demo', videoId: 'demo2024abc', publishedDate: '2024-02-01' }),
    ];

    const together = buildFeed({ videos }, noImages);
    const apart = buildFeed({ videos }, noImages, {
      notSeries: [{ video: 'https://www.youtube.com/watch?v=demo2026abc' }],
    });

    expect(together.map((entry) => entry.series?.count)).toEqual([2, 2]);
    expect(apart.every((entry) => entry.series === null)).toBe(true);
  });

  it('ships the not-a-series list empty', () => {
    expect(MEDIA_NOT_SERIES).toEqual([]);
  });
});

describe('lengths', () => {
  // A live stream in progress or a scheduled premiere has no length yet: YouTube says P0D, which
  // reaches the page as "0:00". It shows no length and adds nothing to a section's total.
  it.each(['0:00', '00:00', '0:00:00', ' 0:00 '])('reads %j as no length', (duration) => {
    const [entry] = buildFeed({ videos: [makeVideo({ duration })] }, noImages);

    expect(entry?.duration).toBeNull();
  });

  it('keeps every real length as it was, and totals only those', () => {
    const feed = buildFeed(
      {
        videos: [
          makeVideo({ _id: 'live', duration: '0:00', publishedDate: '2025-03-03' }),
          makeVideo({ _id: 'short', duration: '1:02', publishedDate: '2025-03-02' }),
          makeVideo({ _id: 'long', duration: '1:00:00', publishedDate: '2025-03-01' }),
        ],
      },
      noImages,
    );

    expect(feed.map((entry) => entry.duration)).toEqual([null, '1:02', '1:00:00']);
    expect(totalLength(feed.map((entry) => entry.duration))).toBe('1 h 1 min');
    expect(totalLength([feed[0]?.duration])).toBeNull();
  });
});

describe('groupByKind', () => {
  it('groups rows by kind in section order, leaving empty kinds out and keeping row order', () => {
    const rows = [
      { id: 'v1', kind: 'video' },
      { id: 'p1', kind: 'post' },
      { id: 's1', kind: 'stream' },
      { id: 'v2', kind: 'video' },
    ] as const;

    expect(groupByKind(rows).map((group) => [group.kind, group.rows.map((row) => row.id)])).toEqual(
      [
        ['post', ['p1']],
        ['video', ['v1', 'v2']],
        ['stream', ['s1']],
      ],
    );
    expect(groupByKind([])).toEqual([]);
  });
});

describe('buildFeed', () => {
  it('merges every source into one list, newest first, undated last', () => {
    const feed = buildFeed(
      {
        posts: [post({ publishedAt: '2025-11-11T08:00:00Z' })],
        videos: [makeVideo({ _id: 'v1', publishedDate: '2026-05-05T01:33:15Z' })],
        talks: [makeTalk({ _id: 't1', date: '2025-04-01' })],
        presentations: [makePresentation({ _id: 'p1', date: 'not a date' })],
        articles: [makeArticle({ _id: 'a1', publishedDate: '2025-06-01' })],
      },
      noImages,
    );

    expect(feed.map((entry) => entry.kind)).toEqual([
      'video',
      'post',
      'article',
      'talk',
      'presentation',
    ]);
    expect(feed.map((entry) => entry.year)).toEqual(['2026', '2025', '2025', '2025', 'Undated']);
  });

  it('links each kind onward: YouTube, the post, the article, the talk video, the slides', () => {
    const feed = buildFeed(
      {
        posts: [post({ url: undefined, slug: 'a-post', source: 'devto' })],
        videos: [makeVideo({ videoId: 'abc123DEF45' })],
        talks: [
          makeTalk({ videoUrl: 'https://youtu.be/x', slidesUrl: 'https://slides.example/t' }),
        ],
        presentations: [
          makePresentation({ slidesUrl: 'https://slides.example/p', eventUrl: null }),
        ],
        articles: [makeArticle({ publicationUrl: 'https://mag.example/a' })],
      },
      noImages,
    );
    const byKind = Object.fromEntries(feed.map((entry) => [entry.kind, entry]));

    expect(byKind.video?.href).toBe('https://www.youtube.com/watch?v=abc123DEF45');
    expect(byKind.video?.videoId).toBe('abc123DEF45');
    expect(byKind.video?.where).toBe('YouTube');
    expect(byKind.post?.href).toBe('https://dev.to/mikeodnis/a-post');
    expect(byKind.post?.where).toBe('dev.to');
    expect(byKind.talk?.href).toBe('https://youtu.be/x');
    expect(byKind.presentation?.href).toBe('https://slides.example/p');
    expect(byKind.article?.href).toBe('https://mag.example/a');
    expect(feed.every((entry) => entry.external)).toBe(true);
  });

  it('gives an item with nowhere to go no link, rather than a dead one', () => {
    const [talk] = buildFeed({ talks: [makeTalk({ videoUrl: null, slidesUrl: '  ' })] }, noImages);

    expect(talk?.href).toBeNull();
  });

  it('uses the YouTube still for a video and the image builder for Sanity art', () => {
    const image = {
      _type: 'image',
      asset: { _ref: 'image-a-1600x900-png', _type: 'reference' },
    } as const;
    const feed = buildFeed(
      {
        videos: [makeVideo({ videoId: 'vid00000001' })],
        talks: [makeTalk({ thumbnailImage: image })],
        posts: [post({ imageUrl: 'https://cdn.hashnode.com/res/cover.png' })],
      },
      () => 'https://cdn.sanity.io/thumb.png',
    );
    const byKind = Object.fromEntries(feed.map((entry) => [entry.kind, entry]));

    expect(byKind.video?.thumb).toBe('https://img.youtube.com/vi/vid00000001/mqdefault.jpg');
    expect(byKind.talk?.thumb).toBe('https://cdn.sanity.io/thumb.png');
    expect(byKind.post?.thumb).toBe('https://cdn.hashnode.com/res/cover.png');
  });

  it('searches the title, the kind, where it lives and the summary', () => {
    const [entry] = buildFeed(
      { articles: [makeArticle({ title: 'On Rust', publication: 'Lobsters' })] },
      noImages,
    );

    expect(entry?.haystack).toContain('On Rust');
    expect(entry?.haystack).toContain('Article');
    expect(entry?.haystack).toContain('Lobsters');
  });
});

describe('cleanSummary', () => {
  it('drops the YouTube link template and Twitch boilerplate', () => {
    const template =
      '🔗 Connect with Me:  \n👉 LinkTree: https://linktr.ee/someone – Find all my links!\n\n💬 Got Questions?\nDrop a comment below!';

    expect(cleanSummary(template)).toBe('');
    expect(
      cleanSummary('Broadcasted live on Twitch -- Watch live at https://www.twitch.tv/x'),
    ).toBe('');
  });

  it('keeps the first real sentence, before any template', () => {
    const text =
      'We build a cloud demo end to end. Then we deploy it.\n\n🔗 Connect with Me:\n👉 https://x.example';

    expect(cleanSummary(text)).toBe('We build a cloud demo end to end.');
  });

  it('caps a long sentence at a word, with an ellipsis', () => {
    const summary = cleanSummary(`${'word '.repeat(80)}end.`);

    expect(summary.length).toBeLessThanOrEqual(161);
    expect(summary.endsWith('…')).toBe(true);
  });

  it('reads nothing as nothing', () => {
    expect(cleanSummary(undefined)).toBe('');
    expect(cleanSummary('   ')).toBe('');
  });
});

describe('groupByYear', () => {
  it('groups rows by year, newest year first, Undated last, keeping row order', () => {
    const rows = [
      { id: 'u', year: 'Undated' },
      { id: 'a', year: '2024' },
      { id: 'b', year: '2026' },
      { id: 'c', year: '2024' },
    ];

    expect(groupByYear(rows).map((group) => [group.year, group.rows.map((row) => row.id)])).toEqual(
      [
        ['2026', ['b']],
        ['2024', ['a', 'c']],
        ['Undated', ['u']],
      ],
    );
  });
});

describe('kindsWithItems', () => {
  it('lists only the kinds that have items, in section order', () => {
    const feed = buildFeed(
      { articles: [makeArticle()], videos: [makeVideo()], posts: [post()] },
      noImages,
    );

    expect(kindsWithItems(feed)).toEqual(['post', 'article', 'video']);
  });

  it('is empty for an empty feed', () => {
    expect(kindsWithItems([])).toEqual([]);
  });
});

describe('feedRows', () => {
  const marathon = [
    makeVideo({
      _id: 'm3',
      title: 'Marathon',
      publishedDate: '2025-12-30T05:00:00Z',
      duration: '1:00:00',
    }),
    makeVideo({
      _id: 'm2',
      title: 'Marathon (Part 2/2)',
      publishedDate: '2025-12-29T09:00:00Z',
      duration: '2:04:43',
    }),
    makeVideo({
      _id: 'm1',
      title: 'Marathon (Part 1/2)',
      publishedDate: '2025-12-29T08:00:00Z',
      duration: '30:00',
    }),
  ];

  it('folds livestream parts into one row that carries every part', () => {
    const rows = feedRows(buildFeed({ videos: marathon }, noImages), 'fold');

    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe('Marathon');
    expect(rows[0]?.id).toBe('parts:video:m3');
    expect(ids(rows[0]?.parts ?? [])).toEqual(['video:m1', 'video:m2', 'video:m3']);
  });

  it('lists every part as its own row when told to, each knowing its place', () => {
    const rows = feedRows(buildFeed({ videos: marathon }, noImages), 'each');

    expect(rows.map((row) => [row.title, row.parts.length])).toEqual([
      ['Marathon', 0],
      ['Marathon (Part 2/2)', 0],
      ['Marathon (Part 1/2)', 0],
    ]);
    expect(rows.map((row) => row.series && [row.series.part, row.series.count])).toEqual([
      [3, 3],
      [2, 3],
      [1, 3],
    ]);
    expect(new Set(rows.map((row) => row.series?.slug))).toEqual(new Set(['marathon']));
  });

  it('folds stream uploads too, and a folded list carries no series place', () => {
    const streamed = marathon.map((video) => ({ ...video, description: TWITCH_LINE }));
    const rows = feedRows(buildFeed({ videos: streamed }, noImages), 'fold');

    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('stream');
    expect(rows[0]?.parts).toHaveLength(3);
    expect(rows.every((row) => row.series === null)).toBe(true);
  });

  it('keeps every part searchable after the uploads are folded into a row', () => {
    const entries = buildFeed(
      {
        videos: marathon.map((video, index) => ({
          ...video,
          description: index === 2 ? 'Debugging WebSockets.' : 'Building the interface.',
        })),
      },
      noImages,
    );
    const schema = mediaFilters(['video']);
    const rows = feedRows(entries, 'fold');

    expect(schema.filter(rows, schema.parse('?q=websockets'))).toEqual(rows);
    expect(schema.filter(rows, schema.parse('?q=Part%201'))).toEqual(rows);
    expect(schema.filter(rows, schema.parse('?q=interface'))).toEqual(rows);
  });
});

describe('feedStats', () => {
  it('counts each kind and names the newest date', () => {
    const feed = buildFeed(
      {
        videos: [
          makeVideo({ publishedDate: '2026-05-05T01:33:15Z' }),
          makeVideo({ publishedDate: '2024-01-01' }),
        ],
        posts: [post()],
      },
      noImages,
    );

    expect(feedStats(feed)).toEqual({
      counts: { post: 1, article: 0, video: 2, stream: 0, talk: 0, presentation: 0 },
      newest: '2026-05-05T01:33:15Z',
    });
  });

  it('counts every upload of a row that folds several', () => {
    const entries = buildFeed(
      {
        videos: ['2025-12-30T05:00:00Z', '2025-12-29T09:00:00Z', '2025-12-29T08:00:00Z'].map(
          (publishedDate, index) =>
            makeVideo({ _id: `night-${index}`, title: 'Marathon', publishedDate }),
        ),
      },
      noImages,
    );
    const folded = feedRows(entries, 'fold');

    expect(folded).toHaveLength(1);
    expect(feedStats(folded)).toEqual(feedStats(feedRows(entries, 'each')));
    expect(feedStats(folded).counts.video).toBe(3);
  });
});

describe('media-format', () => {
  it('writes dates the way the rows and header read them, in UTC', () => {
    expect(monthDay('2025-12-30T05:03:52Z')).toBe('Dec 30');
    expect(monthDay('2025-03-01')).toBe('Mar 1');
    expect(monthYear('2026-05-05T01:33:15Z')).toBe('May 2026');
  });

  it('writes a range of parts once per month', () => {
    expect(dateRange('2025-08-24T00:00:00Z', '2025-12-30T00:00:00Z')).toBe('Aug 24 – Dec 30');
    expect(dateRange('2025-12-29T00:00:00Z', '2025-12-30T00:00:00Z')).toBe('Dec 29 – 30');
    expect(dateRange('2025-12-29T00:00:00Z', '2025-12-29T09:00:00Z')).toBe('Dec 29');
  });

  it("writes a section row's date with its year, in UTC", () => {
    expect(fullDay('2025-12-30T05:03:52Z')).toBe('Dec 30, 2025');
    expect(fullDay('2024-01-01T00:30:00+05:00')).toBe('Dec 31, 2023');
  });

  it('writes a number of seconds as hours and minutes, rounded to the minute', () => {
    expect(lengthText(449_400)).toBe('124 h 50 min');
    expect(lengthText(20_580)).toBe('5 h 43 min');
    expect(lengthText(7_200)).toBe('2 h');
    expect(lengthText(694)).toBe('12 min');
    expect(lengthText(0)).toBe('0 min');
  });

  it('adds lengths up into hours or minutes, ignoring ones it cannot read', () => {
    expect(totalLength(['8:32:20', '1:37:54'])).toBe('10 h 10 min');
    expect(totalLength(['11:34', '9:07'])).toBe('21 min');
    expect(totalLength(['40:00:00', '2:00:00'])).toBe('42 h');
    expect(totalLength([null, 'soon'])).toBeNull();
  });
});
