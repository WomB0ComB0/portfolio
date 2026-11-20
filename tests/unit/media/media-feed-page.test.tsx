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
 * @file /media in sections, rendered on the server: every item is a row link in the server HTML
 * (prerender, no client JavaScript run), in the section of its own kind (Writing, Video,
 * Streams), each section newest first with its own heading, count and columns. Every upload is
 * its own row, and a series part says which part it is. Kind chips exist only for kinds that have
 * items. Shared ?kind=, ?series= and ?topic= links are filtered in the server HTML. A source that
 * fails or misses its deadline costs only its own items (and says so); every source failing
 * reaches the error view; nothing published shows the EmptyState. Old ?tab= links redirect to
 * ?kind=. No loading.tsx: the page waits for its feed a moment at most (FIRST_FLUSH_WAIT_MS). In by
 * then, every row is in place in the first HTML; still loading, the header goes out and the strip
 * and the list stream in behind skeletons of their own size. Only the loaders are mocked;
 * image URLs come from the real Sanity URL builder. What a row points at (its "See also" line, a long series, a post and the video of it)
 * is in media-feed-page-see-also.test.tsx.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { makeTalk, makeVideo } from '@tests/fixtures/sanity-docs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIRST_FLUSH_WAIT_MS } from '@/lib/async/settled-within';
import {
  chipSlugs,
  firstFlushHtml,
  POST,
  POST_URL,
  pageElement,
  parse,
  prerenderHtml,
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

const ROUTE_DIR = path.join(process.cwd(), 'src/app/(routes)/(dev)/media');

/** Past the page's short wait (FIRST_FLUSH_WAIT_MS), so a source answering then is streamed. */
const LATE_MS = FIRST_FLUSH_WAIT_MS + 100;

/** One turn of the event loop, on the real setImmediate (the fake clock leaves it alone). */
const nextTurn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

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

describe('/media: sections in the server HTML', () => {
  it('puts every item in the first HTML as a link onward, marked as a new tab', async () => {
    const root = parse(await serverHtml());

    expect(root.querySelector('h1')?.textContent).toBe('Media');
    for (const video of VIDEOS) {
      const link = root.querySelector(`a[data-feed-title][href="${watch(video.videoId)}"]`);
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link?.textContent).toContain('(opens in a new tab)');
    }
    expect(root.querySelector(`a[data-feed-title][href="${POST_URL}"]`)).not.toBeNull();
  });

  it('lists Writing, then Video, then Streams, each with its count and only its own rows', async () => {
    const root = parse(await serverHtml());

    expect(sections(root)).toEqual([
      ['Writing, 1 post', [POST_URL]],
      [
        'Video, 3 videos · 1 h 6 min',
        [watch('resq0000001'), watch('lone0000001'), watch('oldv0000001')],
      ],
      [
        'Streams, 3 streams · 22 h 32 min',
        [watch('mara0000003'), watch('mara0000002'), watch('mara0000001')],
      ],
    ]);
    expect(
      Array.from(root.querySelectorAll('[data-index-part="group"] h2'), (h2) => h2.id),
    ).toEqual(['media-post', 'media-video', 'media-stream']);
    for (const kind of ['post', 'video', 'stream']) {
      const section = root.querySelector(`#media-${kind}`)?.closest('section');
      expect(section?.querySelectorAll('tr[data-feed-row]').length).toBeGreaterThan(0);
      expect(
        section?.querySelectorAll(`tr[data-feed-row]:not([data-kind="${kind}"])`),
      ).toHaveLength(0);
    }
  });

  it('shows each section only the columns that vary in it, never Kind', async () => {
    const root = parse(await serverHtml());
    const labels = (id: string): string[] =>
      Array.from(
        root.querySelector(`#${id}`)?.closest('section')?.querySelectorAll('th') ?? [],
        (th) => th.textContent ?? '',
      );

    expect(labels('media-post')).toEqual(['Title', 'Where', 'Date']);
    expect(labels('media-video')).toEqual(['Title', 'Length', 'Date']);
    expect(labels('media-stream')).toEqual(['Title', 'Length', 'Date']);
    expect(rowOf(root, POST_URL)?.querySelectorAll('td')).toHaveLength(3);
    expect(rowOf(root, watch('resq0000001'))?.querySelectorAll('td')).toHaveLength(3);
  });

  it('writes each date with its year, and a phone line without the kind', async () => {
    const root = parse(await serverHtml());
    const dates = Array.from(root.querySelectorAll('tr[data-feed-row] time'), (time) => [
      time.getAttribute('datetime'),
      time.textContent,
    ]);

    expect(dates).toEqual([
      ['2025-11-11', 'Nov 11, 2025'],
      ['2026-05-05', 'May 5, 2026'],
      ['2024-11-22', 'Nov 22, 2024'],
      ['2024-09-24', 'Sep 24, 2024'],
      ['2025-12-30', 'Dec 30, 2025'],
      ['2025-12-29', 'Dec 29, 2025'],
      ['2025-12-29', 'Dec 29, 2025'],
    ]);
    const meta = (href: string): string =>
      textOf(rowOf(root, href)?.querySelector('[data-feed-meta]'));
    expect(meta(POST_URL)).toBe('Hashnode · Nov 11, 2025');
    expect(meta(watch('resq0000001'))).toBe('11:34 · May 5, 2026');
    expect(meta(watch('mara0000003'))).toBe('8:32:20 · Dec 30, 2025');
  });

  it('gives every upload its own row: nothing is folded', async () => {
    const root = parse(await serverHtml());

    expect(root.querySelectorAll('tr[data-feed-row]')).toHaveLength(7);
    expect(root.querySelector('[data-feed-parts]')).toBeNull();
    expect(root.querySelector('a[data-feed-part]')).toBeNull();
  });

  it('says which upload of its series a row is, as a link to the whole series', async () => {
    // Two of the series' three uploads: a list that holds part of it links it (round 10).
    const root = parse(await serverHtml({ q: 'coding marathon. (part' }));
    const note = (id: string) => rowOf(root, watch(id))?.querySelector('a[data-feed-series]');

    expect(textOf(note('mara0000001'))).toBe('Series: Upload 1 of 3 in Coding marathon.');
    expect(textOf(note('mara0000002'))).toBe('Series: Upload 2 of 3 in Coding marathon.');
    // A screen reader also hears the series' name, joined by a word ("... of 3 in Coding
    // marathon."). Hidden words are read as a box of their own, with a pause before them: joined
    // by a comma they were announced "Upload 2 of 3 , Coding marathon.", a space before the comma.
    const spoken = note('mara0000002')?.querySelector('.sr-only');
    expect(spoken?.textContent).toBe(' in Coding marathon.');
    expect(spoken?.textContent).not.toMatch(/^\s*[,.;:]/);
    for (const id of ['mara0000001', 'mara0000002']) {
      expect(note(id)?.getAttribute('href')).toBe(`/media?series=${SERIES}`);
      expect(note(id)?.getAttribute('title')).toBe('Show all 3, first to last');
      expect(note(id)?.hasAttribute('target')).toBe(false);
      expect(rowOf(root, watch(id))?.getAttribute('data-series')).toBe(SERIES);
    }
  });

  it('says the place as plain text inside the series itself, where a link would lead nowhere', async () => {
    const root = parse(await serverHtml({ series: SERIES }));
    const rows = Array.from(root.querySelectorAll('tr[data-feed-row]'));

    expect(rows).toHaveLength(3);
    expect(root.querySelector('a[data-feed-series]')).toBeNull();
    expect(rows.map((row) => textOf(row.querySelector('[data-feed-series-place]')))).toEqual([
      'Upload 1 of 3',
      'Upload 2 of 3',
      'Upload 3 of 3',
    ]);
    // The rows point at nothing else, so no "See also" list is left to name.
    expect(root.querySelector('[data-feed-see-also]')).toBeNull();
    expect(root.innerHTML).not.toContain('See also');
  });

  it('says the place as text on the full list, which holds every upload of the series', async () => {
    // A link would only show the same three rows again (round 10).
    const root = parse(await serverHtml());
    const place = (id: string): string =>
      textOf(rowOf(root, watch(id))?.querySelector('[data-feed-series-place]'));

    expect(root.querySelector('a[data-feed-series]')).toBeNull();
    expect(['mara0000001', 'mara0000002', 'mara0000003'].map(place)).toEqual([
      'Upload 1 of 3',
      'Upload 2 of 3',
      'Upload 3 of 3',
    ]);
    for (const id of ['mara0000001', 'mara0000002', 'mara0000003']) {
      expect(rowOf(root, watch(id))?.getAttribute('data-series')).toBe(SERIES);
    }
  });

  it('gives a lone part, and anything outside a series, no series link', async () => {
    const root = parse(await serverHtml());

    for (const href of [watch('lone0000001'), watch('resq0000001'), POST_URL]) {
      expect(rowOf(root, href)).not.toBeNull();
      expect(rowOf(root, href)?.querySelector('a[data-feed-series]')).toBeNull();
      expect(rowOf(root, href)?.hasAttribute('data-series')).toBe(false);
    }
  });

  it('offers chips only for kinds that have items, named as the sections are', async () => {
    const html = await serverHtml();
    const root = parse(html);

    expect(chipSlugs(root)).toEqual(['all', 'post', 'video', 'stream']);
    expect(textOf(root.querySelector('[data-chip="post"]'))).toContain('Writing');
    expect(textOf(root.querySelector('[data-chip="video"]'))).toContain('Video');
    expect(textOf(root.querySelector('[data-chip="stream"]'))).toContain('Streams');
    expect(html).not.toMatch(/opacity:\s*0(?![.\d])/);
    // No loading copy, skeleton pulse or busy region (an <img loading="eager"> is fine).
    expect(html).not.toMatch(/>\s*Loading|animate-pulse|aria-busy="true"/);
  });

  it('states the page in its header: the section counts, in section order', async () => {
    const root = parse(await serverHtml());
    const strip = textOf(root.querySelector('[aria-label="Totals"]'));

    expect(strip).toMatch(/post.*videos.*streams/);
    expect(strip).not.toContain('latest');
  });

  // A search result shows this sentence. It named talks, presentations and articles, of which
  // the feed holds none; the page's sections are Writing, Video and Streams.
  it('describes itself to a search engine by what it holds', async () => {
    const { metadata } = await import('@/app/(routes)/(dev)/media/page');

    expect(metadata.description).toBe(
      'Writing, videos and streams on technology and software, newest first.',
    );
    expect(metadata.openGraph?.description).toBe(metadata.description);
    expect(metadata.description).not.toMatch(/talks|presentations|articles/i);
  });

  it('keeps no loading.tsx: the header and the parts’ own skeletons are the loading state', () => {
    const present = ['loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js'].filter((file) =>
      existsSync(path.join(ROUTE_DIR, file)),
    );

    expect(present).toEqual([]);
  });
});

describe('/media: shared links, filtered in the server HTML', () => {
  it('renders only the Streams section for ?kind=stream', async () => {
    const root = parse(await serverHtml({ kind: 'stream' }));

    expect(sections(root).map(([heading]) => heading)).toEqual([
      'Streams, 3 streams · 22 h 32 min',
    ]);
    expect(root.querySelector(`a[data-feed-title][href="${POST_URL}"]`)).toBeNull();
  });

  it('renders only Writing for ?kind=post, and leaves stream uploads out of ?kind=video', async () => {
    const posts = parse(await serverHtml({ kind: 'post' }));
    expect(posts.querySelector(`a[data-feed-title][href="${POST_URL}"]`)).not.toBeNull();
    expect(posts.querySelector('a[data-feed-title][href*="youtube.com"]')).toBeNull();

    const videos = parse(await serverHtml({ kind: 'video' }));
    expect(sections(videos).map(([heading]) => heading)).toEqual(['Video, 3 videos · 1 h 6 min']);
    expect(videos.querySelector('a[data-feed-title][href*="mara"]')).toBeNull();
  });

  it('renders only the series for ?series=, first upload first, with its token', async () => {
    const root = parse(await serverHtml({ series: SERIES }));

    expect(sections(root)).toEqual([
      [
        'Streams, 3 streams · 22 h 32 min',
        [watch('mara0000001'), watch('mara0000002'), watch('mara0000003')],
      ],
    ]);
    const token = root.querySelector('a[data-filter-part="token"]');
    expect(textOf(token)).toBe('Series: Coding marathon.');
    expect(token?.getAttribute('aria-label')).toBe('Remove Series: Coding marathon.');
    expect(token?.getAttribute('href')).toBe('/media');
    // The live number writes its figure for the eye and again for a screen reader.
    expect(textOf(root.querySelector('[data-filter-part="count"]'))).toMatch(/3 of 7 items$/);
    // The series rides along with a search typed without JavaScript.
    expect(
      root.querySelector('form input[type="hidden"][name="series"]')?.getAttribute('value'),
    ).toBe(SERIES);
  });

  it('reads a series that does not exist as no filter', async () => {
    const root = parse(await serverHtml({ series: 'another-show' }));

    expect(root.querySelectorAll('tr[data-feed-row]')).toHaveLength(7);
    expect(root.querySelector('a[data-filter-part="token"]')).toBeNull();
  });

  it('names the series when a search inside it matches nothing', async () => {
    const root = parse(await serverHtml({ series: SERIES, q: 'zzz' }));

    expect(textOf(root.querySelector('[data-state="empty"] p'))).toContain(
      'Nothing matches “zzz” in the series Coding marathon. Clear the filters to see all 7.',
    );
  });

  it('reads ?topic= as no filter while no topic is written, and keeps every row', async () => {
    const root = parse(await serverHtml({ topic: 'web' }));

    expect(root.querySelectorAll('[data-feed-row]')).toHaveLength(7);
    expect(root.querySelector('[data-filter-part="token"]')).toBeNull();
    expect(root.querySelector('a[data-feed-topic]')).toBeNull();
  });
});

describe('/media: when sources fail or run long', () => {
  it('a failed source costs only its items, and the page says which', async () => {
    loaders.loadVideos.mockRejectedValue(new Error('YouTube down'));
    const root = parse(await serverHtml());

    expect(root.querySelector(`a[data-feed-title][href="${POST_URL}"]`)).not.toBeNull();
    expect(root.querySelector('[data-feed-missing]')?.textContent).toBe(
      "Videos couldn't load just now, so they're missing below.",
    );
    expect(chipSlugs(root).sort()).toEqual(['all', 'post']);
    expect(sections(root).map(([heading]) => heading)).toEqual(['Writing, 1 post']);
  });

  it('drops a source that misses its deadline instead of holding the list', async () => {
    loaders.loadVideos.mockReturnValue(new Promise(() => {}));
    // Modules load on real timers, and React schedules its work on the real setImmediate; only
    // the feed's deadline runs on the fake clock.
    await import('@/app/(routes)/(dev)/media/page');
    const { FEED_SOURCE_DEADLINE_MS } = await import('@/app/(routes)/(dev)/media/_lib/load-feed');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const pending = pageElement().then((element) => prerenderHtml(element));
    // Let the page start its feed (each source's deadline) and its own short wait, all on the
    // fake clock and all at once, before the clock moves past both.
    for (let turn = 0; turn < 100 && vi.getTimerCount() < 2; turn += 1) await nextTurn();
    await vi.advanceTimersByTimeAsync(FEED_SOURCE_DEADLINE_MS + 1);
    const root = parse(await pending);
    vi.useRealTimers();

    expect(root.querySelector(`a[data-feed-title][href="${POST_URL}"]`)).not.toBeNull();
    expect(root.querySelector('[data-feed-missing]')?.textContent).toContain('Videos');
  });

  it('reaches the error view when every source fails within the wait: the page throws', async () => {
    for (const load of Object.values(loaders)) load.mockRejectedValue(new Error('down'));
    fetchBlogs.mockRejectedValue(new Error('down'));
    const { default: MediaPage } = await import('@/app/(routes)/(dev)/media/page');

    await expect(MediaPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('down');
  });

  it('reaches the error view when every source fails later: both streamed parts throw it', async () => {
    const downLater = () =>
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error('down')), LATE_MS);
      });
    for (const load of Object.values(loaders)) load.mockImplementation(downLater);
    fetchBlogs.mockImplementation(downLater);
    const errors: unknown[] = [];
    const html = await serverHtml({}, { onError: (error) => errors.push(error) });
    const root = parse(html);

    // The header went out first; the strip and the list each throw the feed's failure, which
    // React leaves to the client (its "render on the client" mark), where the (routes) error
    // boundary takes the page as it does for any page that throws.
    expect(root.querySelector('h1')?.textContent).toBe('Media');
    expect(errors.map((error) => (error instanceof Error ? error.message : error))).toEqual([
      'media:feed: down',
      'media:feed: down',
    ]);
    expect(html).toContain('<!--$!-->');
    expect(root.querySelector('tr[data-feed-row]')).toBeNull();
  });

  it('shows the EmptyState, with no filter bar, when nothing is published', async () => {
    loaders.loadVideos.mockResolvedValue([]);
    fetchBlogs.mockResolvedValue([]);
    const root = parse(await serverHtml());

    expect(root.querySelector('[data-state="empty"] h2')?.textContent).toBe(
      'Nothing published yet',
    );
    // The sentence promises what the page's description does (writing, videos and streams).
    expect(root.querySelector('[data-state="empty"]')?.textContent).toContain(
      'Posts, videos and streams show up here as they go out.',
    );
    expect(root.querySelector('[data-filter-part="bar"]')).toBeNull();
  });

  it('gives talks their own section and chip once one exists', async () => {
    loaders.loadTalks.mockResolvedValue([
      makeTalk({ title: 'Edge caching', date: '2025-04-01', videoUrl: 'https://youtu.be/t' }),
    ]);
    const root = parse(await serverHtml());

    expect(chipSlugs(root)).toContain('talk');
    expect(sections(root).map(([heading]) => heading.split(',')[0])).toEqual([
      'Writing',
      'Video',
      'Streams',
      'Talks',
    ]);
    const labels = Array.from(
      root.querySelector('#media-talk')?.closest('section')?.querySelectorAll('th') ?? [],
      (th) => th.textContent,
    );
    expect(labels).toEqual(['Title', 'Where', 'Length', 'Date']);
  });
});

describe('/media streamed: the first byte never waits on a slow source', () => {
  it('renders the whole list in place, with no boundary, when the feed is in within the wait', async () => {
    // React's default chunk size: a list sent from a Suspense boundary would go out after its
    // skeleton, hidden until React's inline script moved it. In place it is simply there.
    const html = await serverHtml({}, { outline: true });
    const root = parse(html);

    expect(html).not.toContain('<!--$');
    expect(root.querySelector('div[hidden], [data-media-part="feed-skeleton"]')).toBeNull();
    expect(root.querySelector('[aria-busy="true"]')).toBeNull();
    expect(root.querySelectorAll('tr[data-feed-row]')).toHaveLength(7);
    // renderToString never waits, so what it prints is in the first HTML: the rows are.
    expect(parse(await firstFlushHtml()).querySelectorAll('tr[data-feed-row]')).toHaveLength(7);
  });

  it('sends the header after the wait when sources hang, with the strip and the list as skeletons', async () => {
    loaders.loadVideos.mockReturnValue(new Promise(() => {}));
    fetchBlogs.mockReturnValue(new Promise(() => {}));
    // The page returns once its short wait is over while two sources have not answered.
    const root = parse(await firstFlushHtml());

    expect(root.querySelector('h1')?.textContent).toBe('Media');
    expect(textOf(root)).toContain('newest first');
    const strip = root.querySelector('dl[aria-label="Totals"]');
    expect(strip?.getAttribute('aria-busy')).toBe('true');
    expect(strip?.querySelectorAll('[data-placeholder]')).toHaveLength(3);
    const list = root.querySelector('[data-media-part="feed-skeleton"]');
    expect(list?.querySelector('[data-filter-part="bar"]')?.getAttribute('aria-busy')).toBe('true');
    expect(list?.querySelectorAll('tr[data-feed-row-skeleton]')).toHaveLength(8);
    expect(textOf(list)).toContain('Loading writing, videos and streams');
    expect(root.querySelector('tr[data-feed-row]')).toBeNull();
  });

  it('holds the loaded list’s place: its root and its sticky bar have the loaded classes', async () => {
    const loaded = parse(await serverHtml());
    // A fresh page whose videos hang past the wait: its first flush has the skeletons.
    vi.resetModules();
    loaders.loadVideos.mockReturnValue(new Promise(() => {}));
    const first = parse(await firstFlushHtml());
    const classOf = (element: Element | null | undefined): string | null | undefined =>
      element?.getAttribute('class');
    const skeletonBar = first.querySelector('[data-filter-part="bar"]');
    const loadedBar = loaded.querySelector('[data-filter-part="bar"]');

    expect(classOf(skeletonBar)).toBeTruthy();
    expect(classOf(skeletonBar)).toBe(classOf(loadedBar));
    expect(classOf(skeletonBar?.firstElementChild)).toBe(classOf(loadedBar?.firstElementChild));
    expect(classOf(first.querySelector('[data-media-part="feed-skeleton"]'))).toBe(
      classOf(loaded.querySelector('[data-media-part="feed"]')),
    );
    // The strip's placeholders stand in its own grid, three figures as the loaded strip has.
    expect(classOf(first.querySelector('dl[aria-label="Totals"]'))).toBe(
      classOf(loaded.querySelector('dl[aria-label="Totals"]')),
    );
    expect(loaded.querySelectorAll('dl[aria-label="Totals"] > div')).toHaveLength(3);
  });

  it('keeps every row in the server HTML when the feed lands after the wait', async () => {
    loaders.loadVideos.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, LATE_MS));
      return VIDEOS;
    });
    // With React's default chunk size a part as big as the list goes out after its fallback, in a
    // hidden segment that React's inline script moves into place. Without JavaScript that
    // segment stays hidden, but every row is in the HTML for anything that reads it.
    const root = parse(await serverHtml({}, { outline: true }));

    for (const video of VIDEOS) {
      expect(
        root.querySelector(`a[data-feed-title][href="${watch(video.videoId)}"]`),
      ).not.toBeNull();
    }
    expect(root.querySelector(`a[data-feed-title][href="${POST_URL}"]`)).not.toBeNull();
    expect(root.querySelector('div[hidden] tr[data-feed-row]')).not.toBeNull();
    expect(root.querySelector('[data-media-part="feed-skeleton"]')).not.toBeNull();
  });
});

describe('/media past the upload cap: 201 uploads, the newest 200 read', () => {
  /**
   * 201 uploads, newest first, ten minutes each: a stream of twelve, a pair its titles number,
   * a short series and one-off videos. The channel listing reads the newest 200 of them.
   */
  const UPLOADS = Array.from({ length: 201 }, (_, n) => {
    const base = {
      videoId: `cap${String(n).padStart(8, '0')}`,
      publishedDate: new Date(Date.UTC(2026, 4, 1) - n * 86_400_000).toISOString(),
      duration: '10:00',
      description: '',
    };
    if (n < 12) return makeVideo({ ...base, title: 'Night stream.', description: TWITCH_LINE });
    if (n === 12) return makeVideo({ ...base, title: 'Build log (part 2)' });
    if (n === 13) return makeVideo({ ...base, title: 'Build log (part 1)' });
    if (n < 17) return makeVideo({ ...base, title: 'Weekly update' });
    return makeVideo({ ...base, title: `One-off video ${n}` });
  });
  const listed = (complete: boolean) => ({ videos: UPLOADS.slice(0, 200), complete });
  const rowAt = (root: HTMLElement, n: number) =>
    rowOf(root, watch(`cap${String(n).padStart(8, '0')}`));
  const seriesLink = (root: HTMLElement, n: number) =>
    rowAt(root, n)?.querySelector('a[data-feed-series]');
  const seriesPlace = (root: HTMLElement, n: number): string =>
    textOf(rowAt(root, n)?.querySelector('[data-feed-series-place]'));

  it('states no total for videos or streams: no header figure, no length, no number', async () => {
    loaders.loadVideoList.mockResolvedValue(listed(false));
    const root = parse(await serverHtml());
    const strip = textOf(root.querySelector('[aria-label="Totals"]'));
    const places = Array.from(
      root.querySelectorAll('a[data-feed-series], [data-feed-series-place]'),
      textOf,
    );

    expect(strip).toContain('post');
    expect(strip).not.toMatch(/video|stream/);
    expect(sections(root).map(([heading]) => heading)).toEqual([
      'Writing, 1 post',
      'Video, 188 videos',
      'Streams, 12 streams',
    ]);
    expect(places.length).toBeGreaterThan(5);
    // Past the cap a place counted from the oldest listed upload is no place the page can vouch
    // for (round 10): neither "of N" nor "Upload N" or "Part N".
    for (const place of places) expect(place).not.toMatch(/ of \d|(?:Upload|Part) \d/);
    // Nor how many earlier uploads there are: more of them may be past the cap.
    expect(textOf(root.querySelector('[data-feed-more]'))).toBe(
      'Earlier uploads. Show all listed uploads of Night stream',
    );
  });

  it('says only the newest uploads are listed, and still counts what it lists', async () => {
    loaders.loadVideoList.mockResolvedValue(listed(false));
    const root = parse(await serverHtml());

    expect(root.querySelector('[data-feed-capped]')?.textContent).toBe(
      'Only the newest uploads are listed, so older videos and streams are missing below.',
    );
    expect(textOf(root.querySelector('[data-filter-part="count"]'))).toBe('201 items');
    expect(textOf(root.querySelector('[data-chip="video"]'))).toContain('188');
    expect(textOf(root.querySelector('[data-chip="stream"]'))).toContain('12');
    // Every listed upload of these two series is in the full list: their place is text, the
    // series' name without a number.
    expect(seriesPlace(root, 13)).toBe('Series: Build log');
    expect(seriesPlace(root, 16)).toBe('Series: Weekly update');
  });

  it('names the series without a number or "first to last" in a link past the cap', async () => {
    loaders.loadVideoList.mockResolvedValue(listed(false));
    const root = parse(await serverHtml({ q: 'part 1' }));
    const link = seriesLink(root, 13);

    expect(root.querySelectorAll('tr[data-feed-row]')).toHaveLength(1);
    expect(textOf(link)).toBe('Series: Build log');
    expect(link?.querySelector('.sr-only')).toBeNull();
    expect(link?.getAttribute('title')).toBe('Show all listed uploads');
  });

  it('states every total, and says nothing of a cap, while the list is complete', async () => {
    loaders.loadVideoList.mockResolvedValue(listed(true));
    const root = parse(await serverHtml());

    expect(root.querySelector('[data-feed-capped]')).toBeNull();
    expect(textOf(root.querySelector('[aria-label="Totals"]'))).toMatch(/videos.*streams/);
    expect(sections(root).map(([heading]) => heading)).toEqual([
      'Writing, 1 post',
      'Video, 188 videos · 31 h 20 min',
      'Streams, 12 streams · 2 h',
    ]);
    expect(seriesPlace(root, 13)).toBe('Part 1 of 2');
    expect(seriesPlace(root, 16)).toBe('Upload 1 of 3');
    expect(textOf(root.querySelector('[data-feed-more]'))).toBe(
      '7 earlier uploads. Show all 12 uploads of Night stream',
    );
  });

  it('keeps the place, the count and "first to last" in a link while the list is complete', async () => {
    loaders.loadVideoList.mockResolvedValue(listed(true));
    const root = parse(await serverHtml({ q: 'part 1' }));
    const link = seriesLink(root, 13);

    expect(textOf(link)).toBe('Series: Part 1 of 2 in Build log');
    expect(link?.getAttribute('title')).toBe('Show all 2, first to last');
  });
});

describe('/media: old links', () => {
  it('redirects an old ?tab= link to the ?kind= it now means', async () => {
    const { default: MediaPage } = await import('@/app/(routes)/(dev)/media/page');

    await expect(MediaPage({ searchParams: Promise.resolve({ tab: 'videos' }) })).rejects.toThrow(
      'NEXT_REDIRECT /media?kind=video',
    );
    expect(loaders.loadVideoList).not.toHaveBeenCalled();
    expect(loaders.loadVideos).not.toHaveBeenCalled();
  });
});
