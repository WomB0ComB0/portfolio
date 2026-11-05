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
 * @file /spotify renders its top lists on the server. Every artist and track is a real link to
 * its Spotify page (Enter works; it used to be a div with an onClick), with a visible rank. A
 * Spotify failure, or a Spotify slower than the deadline, stays inside its own section as
 * "Couldn't load ..." with Try again, and the other list still renders. The page outline has one
 * h2 per section, the now-playing one included, and no duplicate. The page needs no loading.tsx:
 * its header and headings render at once, and each section shows its own loading state.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchTopArtists, fetchTopTracks, refresh, reportApiFailure } = vi.hoisted(() => ({
  fetchTopArtists: vi.fn(),
  fetchTopTracks: vi.fn(),
  refresh: vi.fn(),
  reportApiFailure: vi.fn(() => true),
}));

vi.mock('@/app/api/v1/[[...route]]/top-artists/handlers', () => ({ fetchTopArtists }));
vi.mock('@/app/api/v1/[[...route]]/top-tracks/handlers', () => ({ fetchTopTracks }));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure, reportError: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));
// t3-env validates on import; the now-playing card's fetcher needs no real configuration here.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import {
  TOP_ARTISTS_DEADLINE_MS,
  TopArtists,
} from '@/app/(routes)/(main)/(personal)/spotify/_components/top-artists';
import { TopTracks } from '@/app/(routes)/(main)/(personal)/spotify/_components/top-tracks';
import { Spotify } from '@/app/(routes)/(main)/(personal)/spotify/_interface/spotify/spotify';
import SpotifyPage from '@/app/(routes)/(main)/(personal)/spotify/page';

const artists = [
  {
    name: 'First Artist',
    url: 'https://open.spotify.com/artist/first',
    imageUrl: 'https://i.scdn.co/image/first',
  },
  {
    name: 'Second Artist',
    url: 'https://open.spotify.com/artist/second',
    imageUrl: 'https://i.scdn.co/image/second',
  },
  {
    name: 'Third Artist',
    url: 'https://open.spotify.com/artist/third',
    imageUrl: '',
  },
];

const tracks = [
  {
    name: 'First Song',
    artist: 'Singer One',
    url: 'https://open.spotify.com/track/first',
    imageUrl: 'https://i.scdn.co/image/album-first',
  },
  {
    name: 'Second Song',
    artist: 'Singer Two',
    url: 'https://open.spotify.com/track/second',
    imageUrl: 'https://i.scdn.co/image/album-second',
  },
];

const NEW_TAB = '(opens in a new tab)';
const ARTISTS_ERROR = "Couldn't load top artists";
const TRACKS_ERROR = "Couldn't load top tracks";

// Vitest runs from the repository root (where vitest.config.ts lives).
const ROUTE_DIR = join(process.cwd(), 'src/app/(routes)/(main)/(personal)/spotify');
const LOADING_FILES = ['loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js'] as const;

/** `node` (the Spotify view by default) as its server HTML, parsed so it can be queried. */
const renderViewHtml = (node: ReactNode = <Spotify />): HTMLElement => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement('div');
  container.innerHTML = renderToString(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  );
  return container;
};

const headingTexts = (root: HTMLElement, level: 'h1' | 'h2'): string[] =>
  Array.from(root.querySelectorAll(level), (heading) => heading.textContent?.trim() ?? '');

beforeEach(() => {
  fetchTopArtists.mockResolvedValue(artists);
  fetchTopTracks.mockResolvedValue(tracks);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('TopArtists', () => {
  it('renders each artist as a link to its Spotify page with its rank and name', async () => {
    render(await TopArtists());

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(artists.length);
    artists.forEach((artist, index) => {
      const link = links[index] as HTMLElement;
      expect(link).toHaveAttribute('href', artist.url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAccessibleName(`${index + 1} ${artist.name} ${NEW_TAB}`);
      expect(within(link).getByText(String(index + 1))).toBeVisible();
    });
  });

  it('ranks the artists in an ordered list', async () => {
    render(await TopArtists());

    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    expect(within(list).getAllByRole('listitem')).toHaveLength(artists.length);
  });

  it('shows the Spotify mark instead of an image when an artist has none', async () => {
    render(await TopArtists());

    const links = screen.getAllByRole('link');
    expect(links[0]?.querySelector('img')).not.toBeNull();
    expect(links[2]?.querySelector('img')).toBeNull();
    expect(links[2]?.querySelector('svg')).not.toBeNull();
  });

  it('renders no motion entrance that would hide the grid without JavaScript', async () => {
    const html = renderToString(await TopArtists());

    expect(html).toContain('First Artist');
    expect(html).not.toMatch(/opacity:\s*0/);
    expect(html).not.toMatch(/transform:/);
  });

  it('does not link an artist whose URL is missing or not https', async () => {
    fetchTopArtists.mockResolvedValue([
      { ...artists[0], url: '' },
      { ...artists[1], url: 'javascript:alert(1)' },
    ]);

    const { container } = render(await TopArtists());

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText('First Artist')).toBeVisible();
    expect(screen.getByText('Second Artist')).toBeVisible();
    expect(container.querySelector('[href]')).toBeNull();
  });

  it('says so when Spotify has no top artists', async () => {
    fetchTopArtists.mockResolvedValue([]);

    render(await TopArtists());

    expect(screen.getByText('No top artists data available at the moment.')).toBeVisible();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows "Couldn\'t load top artists" with Try again when Spotify fails, and reports it', async () => {
    const failure = new Error('Spotify answered 503');
    fetchTopArtists.mockRejectedValue(failure);

    render(await TopArtists());

    expect(screen.getByRole('heading', { name: ARTISTS_ERROR })).toBeVisible();
    expect(screen.queryByText(/503/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reportApiFailure).toHaveBeenCalledWith(failure, {
      context: 'render /spotify top artists',
      level: 'error',
    });
  });

  it('gives up on a Spotify slower than the deadline instead of holding the page', async () => {
    vi.useFakeTimers();
    fetchTopArtists.mockReturnValue(new Promise(() => {}));

    const pending = TopArtists();
    await vi.advanceTimersByTimeAsync(TOP_ARTISTS_DEADLINE_MS);
    render(await pending);

    expect(screen.getByRole('heading', { name: ARTISTS_ERROR })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(reportApiFailure).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'DeadlineError' }),
      { context: 'render /spotify top artists', level: 'warning' },
    );
  });
});

describe('TopTracks', () => {
  it('renders each track as a link to its Spotify page with its rank, name and artist', async () => {
    render(await TopTracks());

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(tracks.length);
    tracks.forEach((track, index) => {
      const link = links[index] as HTMLElement;
      expect(link).toHaveAttribute('href', track.url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAccessibleName(`${index + 1} ${track.name} by ${track.artist} ${NEW_TAB}`);
      expect(within(link).getByText(String(index + 1))).toBeVisible();
      expect(within(link).getByText(track.artist)).toBeVisible();
    });
  });

  it('keeps a local file (no Spotify URL) as plain text, never an empty link', async () => {
    fetchTopTracks.mockResolvedValue([{ ...tracks[0], url: '' }, tracks[1]]);

    const { container } = render(await TopTracks());

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText('First Song')).toBeVisible();
    expect(container.querySelector('a[href=""], a[href="#"], a:not([href])')).toBeNull();
  });

  it('still renders when the top artists fail (the sections are independent)', async () => {
    fetchTopArtists.mockRejectedValue(new Error('Spotify answered 502'));

    render(
      <>
        {await TopArtists()}
        {await TopTracks()}
      </>,
    );

    expect(screen.getByRole('heading', { name: ARTISTS_ERROR })).toBeVisible();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(tracks.length);
    expect(links[0]).toHaveAttribute('href', tracks[0]?.url);
  });

  it('shows "Couldn\'t load top tracks" with Try again when Spotify fails', async () => {
    fetchTopTracks.mockRejectedValue(new Error('Spotify answered 502'));

    render(await TopTracks());

    expect(screen.getByRole('heading', { name: TRACKS_ERROR })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(reportApiFailure).toHaveBeenCalledWith(expect.any(Error), {
      context: 'render /spotify top tracks',
      level: 'error',
    });
  });
});

describe('Spotify view', () => {
  it('server-renders one h2 per section, with no duplicate now-playing heading', () => {
    const view = renderViewHtml();

    expect(headingTexts(view, 'h1')).toEqual(['My Spotify Stats']);
    expect(headingTexts(view, 'h2')).toEqual(['Now Playing', 'Top Artists', 'Top Tracks']);
  });

  it('names each section, the list sections by their h2', () => {
    const view = renderViewHtml();

    expect(view.querySelector('section[aria-label="Now playing"]')).not.toBeNull();
    for (const title of ['Top Artists', 'Top Tracks']) {
      const heading = Array.from(view.querySelectorAll('h2')).find(
        (h2) => h2.textContent === title,
      );
      expect(heading?.id).toBeTruthy();
      expect(heading?.closest('section')).toHaveAttribute('aria-labelledby', heading?.id);
    }
  });

  it('streams the lists behind their skeletons, with the headings already in place', () => {
    fetchTopArtists.mockReturnValue(new Promise(() => {}));
    fetchTopTracks.mockReturnValue(new Promise(() => {}));

    const view = renderViewHtml();

    expect(view.querySelector('output[aria-label="Loading top artists"]')).not.toBeNull();
    expect(view.querySelector('output[aria-label="Loading top tracks"]')).not.toBeNull();
    expect(headingTexts(view, 'h2')).toContain('Top Artists');
  });
});

describe('/spotify page', () => {
  it('has no loading.tsx, which would show a second skeleton and remount the page', () => {
    const present = LOADING_FILES.filter((file) => existsSync(join(ROUTE_DIR, file)));

    expect(present).toEqual([]);
  });

  it('server-renders the header and headings at once, each section in its own loading state', () => {
    fetchTopArtists.mockReturnValue(new Promise(() => {}));
    fetchTopTracks.mockReturnValue(new Promise(() => {}));

    const page = renderViewHtml(<SpotifyPage />);

    expect(headingTexts(page, 'h1')).toEqual(['My Spotify Stats']);
    expect(headingTexts(page, 'h2')).toEqual(['Now Playing', 'Top Artists', 'Top Tracks']);
    const nowPlaying = page.querySelector('section[aria-label="Now playing"]');
    expect(nowPlaying?.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(page.querySelector('output[aria-label="Loading top artists"]')).not.toBeNull();
    expect(page.querySelector('output[aria-label="Loading top tracks"]')).not.toBeNull();
    expect(page.querySelector('a[href]')).toBeNull();
  });
});
