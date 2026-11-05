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
 * @file The /stats Discord card's activity area. Discord activities come from /api/v1/lanyard;
 * when Discord reports no listening activity, the card asks the site's own Spotify endpoint
 * (/api/v1/now-playing). Both endpoints are answered by a stubbed fetch, so the card's real
 * DataLoader, schemas and query wiring run.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// The full '@/components' barrel initialises Firebase; StatCard only needs MagicCard.
vi.mock('@/components', async () => ({
  MagicCard: (await import('@/components/magicui')).MagicCard,
}));
// The shared queue rate-limits now-playing to 5 calls a minute across every test in the file.
vi.mock('@/lib/http-clients/request-queue', () => ({
  requestQueue: {
    enqueue: <T,>(_url: string, _method: string, run: () => Promise<T>) => run(),
  },
}));

import { Discord } from '@/app/(routes)/(dev)/stats/_components/discord';

const ART_ID = 'ab67616d0000b27372d5adcdef5c335651d067aa';
const EMPTY_STATE = 'Currently not in an activity.';
const ERROR_CARD = 'Failed to load Discord status.';

const spotify = {
  name: 'Spotify',
  type: 2,
  details: 'My War',
  state: 'Miura Jam',
  assets: { large_image: `spotify:${ART_ID}`, large_text: 'My War (Attack on Titan)' },
};
const vscode = {
  name: 'Visual Studio Code',
  type: 0,
  details: 'Editing discord.tsx',
  state: 'Workspace: portfolio',
};
const customStatus = { name: 'Custom Status', type: 4, state: 'heads down' };

const lanyard = (activities: unknown[]) => ({
  discord_user: { username: 'tester', discriminator: '0', avatar: 'abc123', id: '42' },
  activities,
  discord_status: 'dnd',
});

const playing = {
  isPlaying: true,
  songName: 'Vogel im Käfig',
  artistName: 'Hiroyuki Sawano',
  songURL: 'https://open.spotify.com/track/3jWNreHk8zyP5KUHyuoXf1',
  imageURL: `https://i.scdn.co/image/${ART_ID}`,
};

type Reply = { status: number; body: unknown };

const json = ({ status, body }: Reply) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const requestedPaths: string[] = [];

/** Answers /api/v1/lanyard and /api/v1/now-playing; anything else is a test bug. */
const stubApi = (replies: { lanyard: Reply; nowPlaying?: Reply }) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
      requestedPaths.push(url.pathname);
      if (url.pathname === '/api/v1/lanyard') return json(replies.lanyard);
      if (url.pathname === '/api/v1/now-playing' && replies.nowPlaying) {
        return json(replies.nowPlaying);
      }
      throw new Error(`unexpected request: ${url.pathname}`);
    }),
  );
};

const NOW_PLAYING_KEY = ['discord-card', 'now-playing'];

const renderCard = (
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) =>
  render(
    <QueryClientProvider client={queryClient}>
      <Discord />
    </QueryClientProvider>,
  );

/** A client already holding a now-playing answer from `ageMs` ago, as after earlier polls. */
const clientWithNowPlaying = (data: typeof playing, ageMs: number) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(NOW_PLAYING_KEY, data, { updatedAt: Date.now() - ageMs });
  return queryClient;
};

/** The card's activity list, once the Lanyard data has rendered. */
const activityList = async () => screen.findByRole('list', { name: 'Current activity' });

beforeEach(() => {
  requestedPaths.length = 0;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Discord card activity', () => {
  it('shows a Spotify activity from Discord with the song, artist and album art', async () => {
    stubApi({ lanyard: { status: 200, body: lanyard([spotify]) } });
    renderCard();

    const list = await activityList();
    expect(within(list).getByText('Listening to Spotify')).toBeInTheDocument();
    expect(within(list).getByText('My War')).toBeInTheDocument();
    expect(within(list).getByText('Miura Jam')).toBeInTheDocument();

    const art = within(list).getByRole('img', { name: 'Album art for My War (Attack on Titan)' });
    // next/image serves remote art through /_next/image, which the CSP's img-src 'self' covers.
    expect(art.getAttribute('src')).toContain(
      encodeURIComponent(`https://i.scdn.co/image/${ART_ID}`),
    );
    expect(art).toHaveAttribute('width', '40');
    expect(art).toHaveAttribute('height', '40');
    expect(art).toHaveAttribute('loading', 'lazy');

    // Discord already says what's playing, so the Spotify endpoint is not asked.
    expect(requestedPaths).not.toContain('/api/v1/now-playing');
  });

  it('shows a Playing activity with its verb, details and state', async () => {
    stubApi({
      lanyard: { status: 200, body: lanyard([vscode]) },
      nowPlaying: { status: 200, body: { isPlaying: false } },
    });
    renderCard();

    const list = await activityList();
    expect(within(list).getByText('Playing Visual Studio Code')).toBeInTheDocument();
    expect(within(list).getByText('Editing discord.tsx')).toBeInTheDocument();
    expect(within(list).getByText('Workspace: portfolio')).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_STATE)).not.toBeInTheDocument();
  });

  it('lists listening before playing when Discord reports both', async () => {
    stubApi({ lanyard: { status: 200, body: lanyard([vscode, spotify]) } });
    renderCard();

    const rows = within(await activityList()).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Listening to Spotify'),
      expect.stringContaining('Playing Visual Studio Code'),
    ]);
  });

  it('ignores a custom status, so a status alone leaves the empty state', async () => {
    stubApi({
      lanyard: { status: 200, body: lanyard([customStatus]) },
      nowPlaying: { status: 200, body: { isPlaying: false } },
    });
    renderCard();

    expect(await screen.findByText(EMPTY_STATE)).toBeInTheDocument();
    expect(screen.queryByText('heads down')).not.toBeInTheDocument();
    expect(screen.queryByText(/Custom Status/)).not.toBeInTheDocument();
  });

  it("falls back to the site's Spotify now-playing when Discord reports no listening", async () => {
    stubApi({
      lanyard: { status: 200, body: lanyard([customStatus]) },
      nowPlaying: { status: 200, body: playing },
    });
    renderCard();

    const link = await screen.findByRole('link', {
      name: 'Listening on Spotify: Vogel im Käfig by Hiroyuki Sawano (opens in a new tab)',
    });
    expect(link).toHaveAttribute('href', playing.songURL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(link).getByText('Listening on Spotify')).toBeInTheDocument();
    expect(within(link).getByText('Vogel im Käfig')).toBeInTheDocument();
    expect(within(link).getByText('Hiroyuki Sawano')).toBeInTheDocument();

    const art = within(link).getByRole('img', { name: 'Album art for Vogel im Käfig' });
    expect(art.getAttribute('src')).toContain(encodeURIComponent(playing.imageURL));
    expect(art).toHaveAttribute('loading', 'lazy');
    expect(screen.queryByText(EMPTY_STATE)).not.toBeInTheDocument();
  });

  it('keeps Discord rows and adds the now-playing fallback above them', async () => {
    stubApi({
      lanyard: { status: 200, body: lanyard([vscode]) },
      nowPlaying: { status: 200, body: playing },
    });
    renderCard();

    await screen.findByRole('link', { name: /^Listening on Spotify/ });
    const rows = within(await activityList()).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Listening on Spotify'),
      expect.stringContaining('Playing Visual Studio Code'),
    ]);
  });

  it('shows the empty state when now-playing says nothing is playing', async () => {
    stubApi({
      lanyard: { status: 200, body: lanyard([]) },
      nowPlaying: { status: 200, body: { ...playing, isPlaying: false } },
    });
    renderCard();

    expect(await screen.findByText(EMPTY_STATE)).toBeInTheDocument();
    expect(screen.queryByText('Vogel im Käfig')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Spotify/ })).not.toBeInTheDocument();
  });

  it('shows the empty state, not the error card, when now-playing fails', async () => {
    stubApi({
      lanyard: { status: 200, body: lanyard([]) },
      nowPlaying: { status: 500, body: { error: 'Spotify is down' } },
    });
    renderCard();

    expect(await screen.findByText(EMPTY_STATE, {}, { timeout: 5_000 })).toBeInTheDocument();
    expect(requestedPaths).toContain('/api/v1/now-playing');
    expect(screen.queryByText(ERROR_CARD)).not.toBeInTheDocument();
    // The rest of the card is still there.
    expect(screen.getByText('tester')).toBeInTheDocument();
  });

  it('drops a song from earlier polls once now-playing keeps failing', async () => {
    stubApi({
      lanyard: { status: 200, body: lanyard([]) },
      nowPlaying: { status: 500, body: { error: 'Spotify is down' } },
    });
    // The last good answer is two minutes old, e.g. the endpoint has failed since, or the
    // fallback was off while Discord reported the song itself.
    const queryClient = clientWithNowPlaying(playing, 120_000);
    renderCard(queryClient);

    expect(await screen.findByText(EMPTY_STATE)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Spotify/ })).not.toBeInTheDocument();
    // The fetcher retries once after a delay before the query settles as failed.
    await waitFor(() => expect(queryClient.getQueryState(NOW_PLAYING_KEY)?.status).toBe('error'), {
      timeout: 5_000,
    });
    expect(screen.getByText(EMPTY_STATE)).toBeInTheDocument();
    expect(screen.queryByText(playing.songName)).not.toBeInTheDocument();
    expect(screen.queryByText(ERROR_CARD)).not.toBeInTheDocument();
  });

  it('keeps a recent song through a single failed poll', async () => {
    stubApi({
      lanyard: { status: 200, body: lanyard([]) },
      nowPlaying: { status: 500, body: { error: 'Spotify is down' } },
    });
    const queryClient = clientWithNowPlaying(playing, 5_000);
    renderCard(queryClient);

    await screen.findByRole('link', { name: /^Listening on Spotify/ });
    await act(() => queryClient.refetchQueries({ queryKey: NOW_PLAYING_KEY }));

    expect(queryClient.getQueryState(NOW_PLAYING_KEY)?.status).toBe('error');
    expect(screen.getByRole('link', { name: /^Listening on Spotify/ })).toBeInTheDocument();
  });
});
