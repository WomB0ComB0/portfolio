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
 * @file What a /media row points at, in the server HTML (renderToString, no client JavaScript
 * run): one "See also" line on a row that points at something and none on any other; a project
 * named only on the evidence of a link; the references in one order; a long series cut to its
 * newest uploads, whose one link to the whole series is the line that closes them; and a post and
 * the video of it pointing at each other only when they link each other. Only the loaders are
 * mocked.
 */

import { makeProject, makeVideo } from '@tests/fixtures/sanity-docs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  POST,
  POST_URL,
  parse,
  rowOf,
  SERIES,
  sections,
  serverHtml,
  TWITCH_LINE,
  textOf,
  VIDEOS,
  watch,
} from './media-page-fixtures';

const { loaders, fetchBlogs, permanentRedirect } = vi.hoisted(() => ({
  loaders: {
    loadVideos: vi.fn(),
    loadVideoList: vi.fn(),
    loadTalks: vi.fn(),
    loadPresentations: vi.fn(),
    loadArticles: vi.fn(),
    loadProjects: vi.fn(),
  },
  fetchBlogs: vi.fn(),
  permanentRedirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT ${href}`);
  }),
}));

// t3-env validates every variable on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/loaders', () => loaders);
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});
vi.mock('@/app/api/v1/[[...route]]/blog/handlers', () => ({ fetchBlogs }));
vi.mock('@/lib/observability/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/observability/report')>()),
  reportApiFailure: vi.fn(() => true),
  reportError: vi.fn(() => true),
}));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  permanentRedirect,
}));

/** Every loader answering at once: six uploads (three of them one stream), one post, nothing else. */
function answerAll(): void {
  loaders.loadVideos.mockResolvedValue(VIDEOS);
  loaders.loadVideoList.mockImplementation(async () => ({
    videos: await loaders.loadVideos(),
    complete: true,
  }));
  loaders.loadTalks.mockResolvedValue([]);
  loaders.loadPresentations.mockResolvedValue([]);
  loaders.loadArticles.mockResolvedValue([]);
  loaders.loadProjects.mockResolvedValue([]);
  fetchBlogs.mockResolvedValue([POST]);
}

beforeEach(() => {
  vi.resetModules();
  answerAll();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('/media: the "See also" line', () => {
  it('is one labelled list on a row that points at something, and absent on every other row', async () => {
    // Two of the series' three uploads, each linking the series (the full list holds all three
    // and says each place as text, round 10).
    const root = parse(await serverHtml({ q: 'coding marathon. (part' }));
    const full = parse(await serverHtml());
    const lines = root.querySelectorAll('[data-feed-see-also]');

    expect(lines).toHaveLength(2);
    for (const line of lines) {
      // A list named "See also"; the same words stand before it on screen and are not spoken twice.
      expect(line.tagName).toBe('UL');
      expect(line.getAttribute('aria-label')).toBe('See also');
      const lead = line.previousElementSibling;
      expect(textOf(lead)).toBe('See also');
      expect(lead?.hasAttribute('data-feed-see-lead')).toBe(true);
      expect(lead?.getAttribute('aria-hidden')).toBe('true');
      // The list holds references only: every item of it is a link.
      expect(line.querySelector('[data-feed-see-lead]')).toBeNull();
      expect(line.children.length).toBeGreaterThan(0);
      for (const item of line.children) {
        expect(item.tagName).toBe('LI');
        expect(item.querySelector('a')).not.toBeNull();
      }
    }
    // On the full list nothing points anywhere: the series' places are text, in no list.
    expect(full.querySelectorAll('[data-feed-see-also]')).toHaveLength(0);
    for (const href of [watch('lone0000001'), watch('resq0000001'), POST_URL]) {
      expect(rowOf(full, href)).not.toBeNull();
      expect(rowOf(full, href)?.querySelector('[data-feed-see-also]')).toBeNull();
    }
  });

  it('names the project a description links, as a link to its page on this site', async () => {
    const project = makeProject({
      _id: 'decoder',
      title: 'Product Decoder',
      githubUrl: 'https://github.com/example/product-decoder',
    });
    loaders.loadProjects.mockResolvedValue([project, makeProject({ title: 'Networking' })]);
    loaders.loadVideos.mockResolvedValue(
      VIDEOS.map((video) =>
        video._id === 'resq'
          ? { ...video, description: 'Code: https://github.com/example/product-decoder' }
          : video,
      ),
    );
    const root = parse(await serverHtml());
    const links = root.querySelectorAll('a[data-feed-project]');
    const link = rowOf(root, watch('resq0000001'))?.querySelector('a[data-feed-project]');

    // "Networking in tech" shares a word with a project's title and links nothing: no relation.
    expect(links).toHaveLength(1);
    expect(textOf(link)).toBe('Project: Product Decoder');
    expect(link?.getAttribute('href')).toBe('/projects/decoder');
    expect(link?.hasAttribute('target')).toBe(false);
    expect(link?.querySelector('[data-feed-proposed]')).toBeNull();
  });

  it('names no project when the projects cannot load, and loses nothing else', async () => {
    loaders.loadProjects.mockRejectedValue(new Error('Sanity down'));
    const root = parse(await serverHtml());

    expect(root.querySelectorAll('[data-feed-row]')).toHaveLength(7);
    expect(root.querySelector('a[data-feed-project]')).toBeNull();
    expect(root.querySelector('[data-feed-missing]')).toBeNull();
  });

  it('puts the references in one order: version, series, project', async () => {
    loaders.loadProjects.mockResolvedValue([
      makeProject({ _id: 'show', title: 'The Show', liveUrl: 'https://show.example.dev' }),
    ]);
    fetchBlogs.mockResolvedValue([{ ...POST, videoIds: ['mara0000003'] }]);
    loaders.loadVideos.mockResolvedValue(
      VIDEOS.map((video) =>
        video._id === 'm3'
          ? { ...video, description: `${TWITCH_LINE}\n${POST_URL}\nhttps://show.example.dev` }
          : video,
      ),
    );
    // A search for the project finds this one upload of the series, so its row links the series.
    const root = parse(await serverHtml({ q: 'the show' }));
    const kinds = Array.from(
      rowOf(root, watch('mara0000003'))?.querySelectorAll('[data-feed-see-also] li a') ?? [],
      (link) =>
        ['data-feed-pair', 'data-feed-series', 'data-feed-project'].find((name) =>
          link.hasAttribute(name),
        ),
    );

    expect(kinds).toEqual(['data-feed-pair', 'data-feed-series', 'data-feed-project']);
  });

  it('keeps the other references under the place inside the series', async () => {
    loaders.loadProjects.mockResolvedValue([
      makeProject({ _id: 'show', title: 'The Show', liveUrl: 'https://show.example.dev' }),
    ]);
    fetchBlogs.mockResolvedValue([{ ...POST, videoIds: ['mara0000003'] }]);
    loaders.loadVideos.mockResolvedValue(
      VIDEOS.map((video) =>
        video._id === 'm3'
          ? { ...video, description: `${TWITCH_LINE}\n${POST_URL}\nhttps://show.example.dev` }
          : video,
      ),
    );
    const root = parse(await serverHtml({ series: SERIES }));
    const row = rowOf(root, watch('mara0000003'));
    const place = row?.querySelector('[data-feed-series-place]');
    const line = row?.querySelector('ul[data-feed-see-also]');

    expect(textOf(place)).toBe('Upload 3 of 3');
    expect(
      Array.from(line?.querySelectorAll('li a') ?? [], (link) =>
        ['data-feed-pair', 'data-feed-series', 'data-feed-project'].find((name) =>
          link.hasAttribute(name),
        ),
      ),
    ).toEqual(['data-feed-pair', 'data-feed-project']);
    expect(
      place && line ? place.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING : 0,
    ).toBeTruthy();
  });
});

describe('/media: a long series', () => {
  /** Twelve uploads of one stream, newest first, after the made videos. */
  const LONG = Array.from({ length: 12 }, (_, n) =>
    makeVideo({
      _id: `long${n}`,
      title: 'Long marathon.',
      description: TWITCH_LINE,
      videoId: `long00000${String(n).padStart(2, '0')}`,
      publishedDate: `2025-06-${String(n + 1).padStart(2, '0')}T08:00:00Z`,
      duration: '1:00:00',
    }),
  );
  const LONG_SERIES = 'long-marathon';
  const longRows = (root: HTMLElement): Element[] =>
    Array.from(root.querySelectorAll(`[data-feed-row][data-series="${LONG_SERIES}"]`));

  beforeEach(() => {
    loaders.loadVideos.mockResolvedValue([...VIDEOS, ...LONG]);
  });

  it('lists its newest five uploads, then says how many more there are and links to all', async () => {
    const root = parse(await serverHtml());
    const more = root.querySelector(`[data-feed-more="${LONG_SERIES}"]`);
    const link = more?.querySelector('a[data-feed-more-link]');

    expect(longRows(root)).toHaveLength(5);
    expect(textOf(more)).toBe('7 earlier uploads. Show all 12 uploads of Long marathon');
    // Read alone, the link says what it opens.
    expect(textOf(link)).toBe('Show all 12 uploads of Long marathon');
    expect(link?.getAttribute('href')).toBe(`/media?series=${LONG_SERIES}`);
    expect(link?.hasAttribute('target')).toBe(false);
    // It closes the series where its next upload would have been, inside the Streams table.
    expect(more?.previousElementSibling).toBe(longRows(root).at(-1));
    expect(more?.hasAttribute('data-feed-row')).toBe(false);
    // Its words sit in the title column and no cell spans the columns a phone hides: a spanning
    // cell would bring them back and squeeze every title of the table.
    expect(more?.querySelectorAll('td')).toHaveLength(3);
    expect(more?.querySelector('td[colspan]')).toBeNull();
    expect(more?.querySelector('td')?.contains(link ?? null)).toBe(true);
  });

  it('links the series once where it is cut: the closing line, not each of the five rows', async () => {
    const root = parse(await serverHtml());
    const toSeries = Array.from(root.querySelectorAll(`a[href="/media?series=${LONG_SERIES}"]`));

    expect(toSeries).toHaveLength(1);
    expect(toSeries[0]?.hasAttribute('data-feed-more-link')).toBe(true);
    // Each listed row says where it is in the series as text, with no "See also" line of its own.
    expect(
      longRows(root).map((row) => textOf(row.querySelector('[data-feed-series-place]'))),
    ).toEqual([12, 11, 10, 9, 8].map((part) => `Upload ${part} of 12`));
    for (const row of longRows(root)) {
      expect(row.querySelector('a[data-feed-series]')).toBeNull();
      expect(row.querySelector('[data-feed-see-also]')).toBeNull();
    }
  });

  it('says a short series beside a long one that is cut as text: the full list holds all of it', async () => {
    const root = parse(await serverHtml());
    const short = Array.from(root.querySelectorAll(`[data-feed-row][data-series="${SERIES}"]`));

    expect(short.map((row) => row.querySelectorAll('a[data-feed-series]').length)).toEqual([
      0, 0, 0,
    ]);
    expect(short.map((row) => textOf(row.querySelector('[data-feed-series-place]')))).toEqual([
      'Upload 3 of 3',
      'Upload 2 of 3',
      'Upload 1 of 3',
    ]);
  });

  it('still counts every upload in the section, the chip and the header', async () => {
    const root = parse(await serverHtml());

    expect(sections(root).map(([heading]) => heading)).toContain(
      'Streams, 15 streams · 34 h 32 min',
    );
    expect(textOf(root.querySelector('[data-chip="stream"]'))).toContain('15');
    expect(textOf(root.querySelector('[data-filter-part="count"]'))).toBe('19 items');
  });

  it('leaves a short series whole', async () => {
    const root = parse(await serverHtml());

    expect(root.querySelectorAll(`[data-feed-row][data-series="${SERIES}"]`)).toHaveLength(3);
    expect(root.querySelector(`[data-feed-more="${SERIES}"]`)).toBeNull();
  });

  it.each([
    ['the series itself', { series: LONG_SERIES }],
    ['its kind', { kind: 'stream' }],
    ['a search', { q: 'long marathon' }],
  ])('lists every upload once the visitor asks for %s', async (_what, params) => {
    const root = parse(await serverHtml(params));

    expect(longRows(root)).toHaveLength(12);
    expect(root.querySelector('[data-feed-more]')).toBeNull();
  });

  // /media?kind=stream linked "Series: Upload 27 of 27" on its first row, to the same 27 rows.
  it.each([
    ['its kind', { kind: 'stream' }, [VIDEOS[0], ...LONG]],
    ['a search', { q: 'long marathon' }, [...VIDEOS, ...LONG]],
  ])(
    'says the place as text on every row when %s lists that one series whole',
    async (_what, params, videos) => {
      loaders.loadVideos.mockResolvedValue(videos);
      const root = parse(await serverHtml(params));
      const rows = longRows(root);

      expect(root.querySelectorAll('[data-feed-row]')).toHaveLength(12);
      expect(root.querySelector('a[data-feed-series]')).toBeNull();
      expect(rows.map((row) => textOf(row.querySelector('[data-feed-series-place]')))).toEqual(
        [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((part) => `Upload ${part} of 12`),
      );
    },
  );

  it('keeps the link when the list holds only some uploads of the series', async () => {
    const root = parse(await serverHtml({ q: 'coding marathon. (part' }));
    const rows = Array.from(root.querySelectorAll('[data-feed-row]'));

    // Two of the series' three uploads: the link opens the third one too.
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.querySelectorAll('a[data-feed-series]').length)).toEqual([1, 1]);
  });

  it('says the place as text on every row of a series listed whole beside other rows', async () => {
    // Its kind lists the long series and the short one, each whole: a link to either would only
    // show the same rows again (round 10; the first row of the long one used to link it).
    const root = parse(await serverHtml({ kind: 'stream' }));
    const rows = longRows(root);

    expect(rows).toHaveLength(12);
    expect(root.querySelector('a[data-feed-series]')).toBeNull();
    expect(rows.map((row) => textOf(row.querySelector('[data-feed-series-place]')))).toEqual(
      [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((part) => `Upload ${part} of 12`),
    );
    expect(
      Array.from(root.querySelectorAll(`[data-feed-row][data-series="${SERIES}"]`), (row) =>
        textOf(row.querySelector('[data-feed-series-place]')),
      ),
    ).toEqual(['Upload 3 of 3', 'Upload 2 of 3', 'Upload 1 of 3']);
  });

  it('links nothing to the series from inside it', async () => {
    const rows = longRows(parse(await serverHtml({ series: LONG_SERIES })));

    expect(rows).toHaveLength(12);
    expect(rows.flatMap((row) => Array.from(row.querySelectorAll('a[data-feed-series]')))).toEqual(
      [],
    );
    expect(rows.map((row) => textOf(row.querySelector('[data-feed-series-place]')))).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((part) => `Upload ${part} of 12`),
    );
  });
});

describe('/media: a post and the video of it', () => {
  it('shows no reference when the feed holds no pair', async () => {
    const html = await serverHtml();

    expect(html).not.toContain('Video version');
    expect(html).not.toContain('Written version');
    expect(parse(html).querySelector('[data-feed-pair]')).toBeNull();
  });

  it('points a video and a post that link each other at each other', async () => {
    fetchBlogs.mockResolvedValue([{ ...POST, videoIds: ['oldv0000001'] }]);
    loaders.loadVideos.mockResolvedValue(
      VIDEOS.map((video) =>
        video._id === 'old'
          ? { ...video, description: `The written version: ${POST_URL}.` }
          : video,
      ),
    );
    const root = parse(await serverHtml());
    const onVideo = rowOf(root, watch('oldv0000001'))?.querySelector('a[data-feed-pair]');
    const onPost = rowOf(root, POST_URL)?.querySelector('a[data-feed-pair]');

    expect(root.querySelectorAll('a[data-feed-pair]')).toHaveLength(2);
    expect(textOf(onVideo)).toBe(
      'Written version: Building a real-time chat app (opens in a new tab)',
    );
    expect(onVideo?.getAttribute('href')).toBe(POST_URL);
    expect(onVideo?.getAttribute('data-feed-pair')).toBe('post');
    expect(textOf(onPost)).toBe('Video version: Networking in tech (opens in a new tab)');
    expect(onPost?.getAttribute('href')).toBe(watch('oldv0000001'));
    expect(onPost?.getAttribute('data-feed-pair')).toBe('video');
    for (const link of [onVideo, onPost]) {
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link?.hasAttribute('data-play')).toBe(false);
      expect(link?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
    expect(onVideo?.getAttribute('title')).toBe('Building a real-time chat app');
    expect(onPost?.getAttribute('title')).toBe('Networking in tech');
  });

  it.each([
    ['one video lists', ['old']],
    ['two videos list', ['old', 'resq']],
  ])('shows no version for a post %s as a resource', async (_what, ids) => {
    loaders.loadVideos.mockResolvedValue(
      VIDEOS.map((video) =>
        ids.includes(video._id)
          ? { ...video, description: `Resources Mentioned in the Video:\n- ${POST_URL}` }
          : video,
      ),
    );
    const html = await serverHtml();

    expect(html).not.toContain('Video version');
    expect(html).not.toContain('Written version');
  });

  it('shows no version for a post that embeds a video which does not link it back', async () => {
    fetchBlogs.mockResolvedValue([{ ...POST, videoIds: ['resq0000001'] }]);
    const html = await serverHtml();

    expect(html).not.toContain('Video version');
    expect(html).not.toContain('Written version');
  });

  it('pairs nothing for a video that links the blog, or a post that is not listed', async () => {
    loaders.loadVideos.mockResolvedValue(
      VIDEOS.map((video) => ({
        ...video,
        description: `${video.description}\nBlog: https://blog.example.dev and https://blog.example.dev/another-post`,
      })),
    );
    const html = await serverHtml();

    expect(html).not.toContain('Video version');
    expect(html).not.toContain('Written version');
  });
});
