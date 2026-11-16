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
 * @file /spotify as the Chart ledger, read from its server HTML alone (renderToString, no
 * hydration, no effects): the page awaits its data at the top, so the ranked tracks, the artist
 * strip, the header figures and the hero's first state are all in the HTML a crawler or a
 * visitor without JavaScript gets. No hidden streamed segment, no skeleton, no loading.tsx. A
 * Spotify failure or a Spotify slower than the deadline stays inside its own section. The
 * production route keeps the approved plain artwork; no lab switches or samples are imported.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { loadNowPlaying, reportApiFailure, topArtists, topTracks } = vi.hoisted(() => ({
  loadNowPlaying: vi.fn(),
  reportApiFailure: vi.fn(() => true),
  topArtists: vi.fn(),
  topTracks: vi.fn(),
}));

vi.mock('@/lib/api-integrations/spotify', () => ({ topArtists, topTracks }));
vi.mock('@/app/_components/home/data/loaders', () => ({ loadNowPlaying }));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure, reportError: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
// Vitest can't run the app's PostCSS on a CSS module; the home tile's test mocks it the same way.
vi.mock('@/app/_components/home/live/equaliser.module.css', () => ({
  default: new Proxy(
    {},
    { get: (_target, name) => (typeof name === 'string' ? `eq-${name}` : undefined) },
  ),
}));
// t3-env validates on import; nothing here needs real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import {
  CHART_DEADLINE_MS,
  CHART_TTL_MS,
  resetSpotifyLoaders,
} from '@/app/(routes)/(main)/(personal)/spotify/_lib/loaders';
import SpotifyPage, { metadata } from '@/app/(routes)/(main)/(personal)/spotify/page';

const FETCHED_AT = 1_700_000_000_000;
const NEW_TAB = '(opens in a new tab)';

const image = (name: string, width: number) => ({
  url: `https://i.scdn.co/image/${name}-${width}`,
  width,
  height: width,
});

const rawTracks = [
  {
    id: 'one',
    name: 'First Song',
    duration_ms: 185_000,
    external_urls: { spotify: 'https://open.spotify.com/track/one' },
    artists: [{ name: 'Singer One' }],
    album: { name: 'First Album', images: [image('one', 640), image('one', 300)] },
  },
  {
    id: 'two',
    name: 'Second Song',
    duration_ms: 3_725_000,
    external_urls: { spotify: 'https://open.spotify.com/track/two' },
    artists: [{ name: 'Singer Two' }, { name: 'Guest' }],
    album: { name: 'Second Album', images: [image('two', 300)] },
  },
  {
    id: 'three',
    name: 'Local Song',
    duration_ms: 61_000,
    external_urls: {},
    artists: [{ name: 'Singer One' }],
    album: { name: 'Bare Album', images: [] },
  },
];

const rawArtists = Array.from({ length: 12 }, (_, index) => ({
  id: `artist-${index + 1}`,
  name: `Artist ${index + 1}`,
  external_urls: { spotify: `https://open.spotify.com/artist/${index + 1}` },
  images: index === 1 ? [] : [image(`artist-${index + 1}`, 160)],
}));

const playingSnapshot = {
  kind: 'data',
  data: {
    isPlaying: true,
    songName: 'Live Song',
    artistName: 'Live Singer',
    songURL: 'https://open.spotify.com/track/live',
    imageURL: 'https://i.scdn.co/image/live',
  },
  fetchedAt: FETCHED_AT,
} as const;

const idleSnapshot = { kind: 'data', data: { isPlaying: false }, fetchedAt: FETCHED_AT } as const;

/** `node`'s server HTML, parsed so it can be queried; no hydration and no effects run. */
function serverHtml(node: ReactElement): HTMLElement {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement('div');
  container.innerHTML = renderToString(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  );
  return container;
}

const textOf = (element: Element | null | undefined): string =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const pageHtml = async (): Promise<HTMLElement> => serverHtml(await SpotifyPage());

beforeEach(() => {
  resetSpotifyLoaders();
  topTracks.mockResolvedValue(rawTracks);
  topArtists.mockResolvedValue(rawArtists);
  loadNowPlaying.mockResolvedValue(idleSnapshot);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('/spotify server HTML', () => {
  it('keeps plain artwork in the production route while a track plays', async () => {
    loadNowPlaying.mockResolvedValue(playingSnapshot);
    const page = await pageHtml();

    expect(page.querySelector('[data-spotify-hero]')?.getAttribute('data-state')).toBe('playing');
    expect(page.querySelector('[data-backlight]')).toBeNull();
  });

  it('has the h1 "Spotify", as the nav names it, and no skeleton or hidden stream', async () => {
    const page = await pageHtml();

    expect(Array.from(page.querySelectorAll('h1'), (h1) => textOf(h1))).toEqual(['Spotify']);
    expect(page.querySelector('div[hidden][id^="S:"]')).toBeNull();
    expect(page.querySelector('[aria-busy="true"]')).toBeNull();
    expect(page.querySelector('.animate-pulse, [class*="animate-pulse"]')).toBeNull();
  });

  it('renders every top track as a ranked row: rank, art, title, artist, album and length', async () => {
    const rows = Array.from((await pageHtml()).querySelectorAll('[data-spotify-track]'));

    expect(rows).toHaveLength(rawTracks.length);
    const first = rows[0] as HTMLElement;
    expect(textOf(first.querySelector('[data-rank]'))).toBe('1');
    expect(first.querySelector('img')).not.toBeNull();
    expect(textOf(first)).toContain('First Song');
    expect(textOf(first)).toContain('Singer One');
    expect(textOf(first)).toContain('First Album');
    expect(first.querySelector('time')?.getAttribute('datetime')).toBe('PT3M5S');
    expect(textOf(first.querySelector('time'))).toBe('3:05');
    expect(textOf(rows[1]?.querySelector('time'))).toBe('1:02:05');
    expect(textOf(rows[1])).toContain('Singer Two, Guest');
  });

  it('links each track out to Spotify in a new tab, and leaves a local file unlinked', async () => {
    const rows = Array.from((await pageHtml()).querySelectorAll('[data-spotify-track]'));

    const link = rows[0]?.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://open.spotify.com/track/one');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(textOf(link)).toContain(NEW_TAB);
    expect(rows[2]?.querySelector('a')).toBeNull();
    expect(textOf(rows[2])).toContain('Local Song');
  });

  it('draws the glyph in place of missing album art', async () => {
    const rows = Array.from((await pageHtml()).querySelectorAll('[data-spotify-track]'));

    expect(rows[2]?.querySelector('img')).toBeNull();
    expect(rows[2]?.querySelector('[data-art-glyph]')).not.toBeNull();
  });

  it('puts the tracks in a real table named by its heading', async () => {
    const page = await pageHtml();
    const table = page.querySelector('table');
    const headingId = table?.getAttribute('aria-labelledby');

    expect(headingId).toBeTruthy();
    expect(textOf(page.querySelector(`[id="${headingId}"]`))).toContain('Top tracks');
    expect(table?.querySelectorAll('tbody tr')).toHaveLength(rawTracks.length);
  });

  it('shows the top ten artists as links out, a portrait or a glyph each', async () => {
    const artists = Array.from((await pageHtml()).querySelectorAll('[data-spotify-artist]'));

    expect(artists).toHaveLength(10);
    const first = artists[0]?.querySelector('a');
    expect(first?.getAttribute('href')).toBe('https://open.spotify.com/artist/1');
    expect(first?.getAttribute('target')).toBe('_blank');
    expect(textOf(first)).toContain('Artist 1');
    expect(textOf(first)).toContain(NEW_TAB);
    expect(artists[1]?.querySelector('img')).toBeNull();
    expect(artists[1]?.querySelector('[data-art-glyph]')).not.toBeNull();
    expect(artists[0]?.closest('ol')).not.toBeNull();
  });

  it('draws the focus ring on an artist link: no outline-none, which would zero the ring style', async () => {
    const link = (await pageHtml()).querySelector('[data-spotify-artist] a');
    const classes = link?.className.split(/\s+/) ?? [];

    // Tailwind v4's outline-none sets --tw-outline-style: none, which outline-2 then reuses.
    expect(classes).not.toContain('outline-none');
    expect(classes).toContain('focus-visible:outline-2');
    expect(classes).toContain('focus-visible:-outline-offset-2');
  });

  // That a focused artist is scrolled whole into the strip is measured in a browser, at the
  // browser's own text size and with a phone's text at 200%, in e2e/journeys/spotify.spec.ts.

  it('lets the last artist scroll clear of the end fade', async () => {
    const page = await pageHtml();
    const list = page.querySelector('[data-spotify-artist]')?.closest('ol');
    const items = Array.from(page.querySelectorAll('[data-spotify-artist]'));

    expect(list?.className.split(/\s+/)).toContain('pe-[calc(var(--page-gutter)+3rem)]');
    expect(items.at(-1)?.className.split(/\s+/)).toContain('last:snap-end');
  });

  it('keeps the length out of the truncating part of the phone meta line', async () => {
    const rows = Array.from((await pageHtml()).querySelectorAll('[data-spotify-track]'));
    const meta = rows[1]?.querySelector('[data-phone-meta]');
    const [artist, , length] = Array.from(meta?.children ?? []);

    expect(textOf(meta)).toBe('Singer Two, Guest · 1:02:05');
    expect(meta?.className.split(/\s+/)).toContain('flex');
    expect(meta?.className.split(/\s+/)).not.toContain('truncate');
    expect(artist?.className.split(/\s+/)).toContain('truncate');
    expect(textOf(length)).toBe('1:02:05');
    expect(length?.className.split(/\s+/)).toContain('shrink-0');
  });

  it('titles the page "Spotify", as its h1 and the nav do, with a description of what it shows', () => {
    expect(metadata.openGraph).toMatchObject({ title: 'Spotify' });
    expect(String(metadata.title)).not.toContain('Stats');
    expect(metadata.description).toBe(
      "What I'm listening to on Spotify right now, plus my top tracks and artists of the last four weeks.",
    );
  });

  it('heads the page with the chart figures', async () => {
    const strip = (await pageHtml()).querySelector('dl');

    // 3 tracks; Singer One, Singer Two and Guest; 185 + 3725 + 61 s is 66 min.
    expect(textOf(strip)).toContain('3');
    expect(textOf(strip)).toContain('66');
    expect(Array.from(strip?.querySelectorAll('dt') ?? [], (dt) => textOf(dt))).toEqual([
      'top tracks',
      'artists in them',
      'runtime',
    ]);
  });

  it('has no loading.tsx, which would put only a skeleton in the HTML', () => {
    const routeDir = join(process.cwd(), 'src/app/(routes)/(main)/(personal)/spotify');
    const present = ['loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js'].filter((file) =>
      existsSync(join(routeDir, file)),
    );

    expect(present).toEqual([]);
  });
});

describe('the hero first state in the HTML', () => {
  it('names and links the track while one plays', async () => {
    loadNowPlaying.mockResolvedValue(playingSnapshot);

    const hero = (await pageHtml()).querySelector('[data-spotify-hero]');

    expect(hero?.getAttribute('data-state')).toBe('playing');
    expect(textOf(hero)).toContain('Playing now');
    expect(textOf(hero)).toContain('Live Song');
    expect(textOf(hero)).toContain('Live Singer');
    expect(hero?.querySelector('a')?.getAttribute('href')).toBe(
      'https://open.spotify.com/track/live',
    );
  });

  it('shows the track it last saw playing once nothing plays', async () => {
    loadNowPlaying.mockResolvedValueOnce(playingSnapshot);
    await SpotifyPage();
    loadNowPlaying.mockResolvedValue(idleSnapshot);

    const hero = (await pageHtml()).querySelector('[data-spotify-hero]');

    expect(hero?.getAttribute('data-state')).toBe('recent');
    expect(textOf(hero)).toContain('Recently played');
    expect(textOf(hero)).toContain('Live Song');
  });

  // "Recently played · 5 min ago" took two lines beside the art on a 320px phone, which made
  // this state 10px taller than the others and moved the page on a poll.
  it('keeps the recent label on one line, with a shorter word on a narrow tile', async () => {
    loadNowPlaying.mockResolvedValueOnce(playingSnapshot);
    await SpotifyPage();
    loadNowPlaying.mockResolvedValue(idleSnapshot);

    const hero = (await pageHtml()).querySelector('[data-spotify-hero]');
    // The label is the hero's h2, so the state is heard once.
    const label = hero?.querySelector('h2[data-hero-label]');
    const full = label?.querySelector('[data-recent-words="full"]');
    const short = label?.querySelector('[data-recent-words="short"]');

    expect(label?.className.split(' ')).toContain('truncate');
    expect(full?.textContent).toContain('Recently played');
    expect(full?.className).toContain('@max-[17.5rem]:hidden');
    expect(short?.textContent).toContain('Recent');
    expect(short?.className.split(' ')).toEqual(
      expect.arrayContaining(['hidden', '@max-[17.5rem]:inline']),
    );
    // One spoken name whatever the width: the visible words are for the eye only.
    expect(full?.getAttribute('aria-hidden')).toBe('true');
    expect(short?.getAttribute('aria-hidden')).toBe('true');
    expect(label?.querySelector('.sr-only')?.textContent).toBe('Recently played, ');
  });

  it('says "Nothing playing" in the tile every other state uses, so a poll never moves the page', async () => {
    const hero = (await pageHtml()).querySelector('[data-spotify-hero]');

    expect(hero?.getAttribute('data-state')).toBe('nothing');
    expect(textOf(hero?.querySelector('h2'))).toBe('Nothing playing');
    // The dashed empty box has its own height; the tile with the art-sized glyph does not.
    expect(hero?.querySelector('[data-state="empty"]')).toBeNull();
    expect(hero?.querySelector('[data-art-glyph]')).not.toBeNull();
  });

  it('gives nothing playing and unreachable the same tile, row and glyph box', async () => {
    const nothing = (await pageHtml()).querySelector('[data-spotify-hero]');
    loadNowPlaying.mockResolvedValue({ kind: 'error' });
    const unreachable = (await pageHtml()).querySelector('[data-spotify-hero]');

    expect(nothing?.className).toBe(unreachable?.className);
    expect(nothing?.querySelector('[data-art-glyph]')?.className).toBe(
      unreachable?.querySelector('[data-art-glyph]')?.className,
    );
    expect(nothing?.querySelector('[data-art-glyph]')?.parentElement?.className).toBe(
      unreachable?.querySelector('[data-art-glyph]')?.parentElement?.className,
    );
  });

  it('says Spotify is unreachable, not that nothing plays, when the snapshot failed', async () => {
    loadNowPlaying.mockResolvedValue({ kind: 'error' });

    const hero = (await pageHtml()).querySelector('[data-spotify-hero]');

    expect(hero?.getAttribute('data-state')).toBe('unreachable');
    expect(textOf(hero)).toContain('Spotify unreachable');
  });

  it('renders an unavailable message instead of a permanent skeleton after the deadline', async () => {
    loadNowPlaying.mockResolvedValue({ kind: 'timeout' });

    const page = await pageHtml();
    const hero = page.querySelector('[data-spotify-hero]');

    expect(textOf(hero)).toContain('Spotify unreachable');
    expect(page.querySelector('[aria-busy="true"]')).toBeNull();
    expect(hero?.querySelector('[class*="animate-pulse"]')).toBeNull();
    expect(page.querySelectorAll('[data-spotify-track]')).toHaveLength(rawTracks.length);
  });
});

describe('/spotify when Spotify fails', () => {
  it('keeps the last good chart when a refresh fails after its cache expires', async () => {
    vi.useFakeTimers();
    await SpotifyPage();
    await vi.advanceTimersByTimeAsync(CHART_TTL_MS + 1);
    topTracks.mockRejectedValue(new Error('Spotify temporarily unavailable'));

    const page = await pageHtml();

    expect(page.querySelectorAll('[data-spotify-track]')).toHaveLength(rawTracks.length);
    expect(textOf(page)).toContain('First Song');
    expect(textOf(page)).not.toContain("Couldn't load top tracks");
    expect(reportApiFailure).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: 'render /spotify top tracks', level: 'warning' }),
    );
  });

  it('keeps the cached chart when a refresh misses the deadline', async () => {
    vi.useFakeTimers();
    await SpotifyPage();
    await vi.advanceTimersByTimeAsync(CHART_TTL_MS + 1);
    topTracks.mockReturnValue(new Promise(() => {}));

    const pending = SpotifyPage();
    await vi.advanceTimersByTimeAsync(CHART_DEADLINE_MS);
    const page = serverHtml(await pending);

    expect(page.querySelectorAll('[data-spotify-track]')).toHaveLength(rawTracks.length);
    expect(textOf(page)).toContain('First Song');
    expect(textOf(page)).not.toContain("Couldn't load top tracks");
  });

  it('keeps a failed top tracks inside its section; the artists still render', async () => {
    topTracks.mockRejectedValue(new Error('spotify down'));

    const page = await pageHtml();

    expect(textOf(page)).toContain("Couldn't load top tracks");
    expect(page.querySelectorAll('[data-spotify-track]')).toHaveLength(0);
    expect(page.querySelectorAll('[data-spotify-artist]')).toHaveLength(10);
    expect(textOf(page.querySelector('dl'))).toContain('unavailable');
    expect(reportApiFailure).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: 'render /spotify top tracks', level: 'error' }),
    );
  });

  it('gives up on a Spotify slower than the deadline instead of holding the page', async () => {
    vi.useFakeTimers();
    topArtists.mockReturnValue(new Promise(() => {}));

    const pending = SpotifyPage();
    await vi.advanceTimersByTimeAsync(CHART_DEADLINE_MS);
    const page = serverHtml(await pending);

    expect(textOf(page)).toContain("Couldn't load top artists");
    expect(page.querySelectorAll('[data-spotify-track]')).toHaveLength(rawTracks.length);
    expect(reportApiFailure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ context: 'render /spotify top artists', level: 'warning' }),
    );
  });
});
