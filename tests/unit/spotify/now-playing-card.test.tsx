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
 * @file The /spotify now-playing card says what is true. Idle reads "Not listening right now"
 * with nothing to click, where it used to say "Last Played / Unknown / Unknown Artist" over
 * links to "#". A failed load says Spotify couldn't be reached, with a retry instead of links.
 * While a track plays, the track links to the track and the artist to the artist. The real
 * DataLoader and fetcher run against a stubbed fetch.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// The shared queue rate-limits now-playing to 5 calls a minute across every test in the file.
vi.mock('@/lib/http-clients/request-queue', () => ({
  requestQueue: {
    enqueue: <T,>(_url: string, _method: string, run: () => Promise<T>) => run(),
  },
}));

import { NowPlaying } from '@/app/(routes)/(main)/(personal)/spotify/_components/now-playing';
import { logger } from '@/utils';

const NOW_PLAYING_PATH = '/api/v1/now-playing';

const playing = {
  isPlaying: true,
  songName: 'Test Song',
  artistName: 'Test Artist',
  songURL: 'https://open.spotify.com/track/test-song',
  artistURL: 'https://open.spotify.com/artist/test-artist',
  imageURL: 'https://i.scdn.co/image/test-art',
};

interface Reply {
  status: number;
  body: unknown;
}

/** Answers /api/v1/now-playing with each reply in turn (the last one repeats). */
const stubNowPlaying = (...replies: Reply[]) => {
  let call = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
    if (url.pathname !== NOW_PLAYING_PATH) throw new Error(`unexpected request: ${url.pathname}`);
    const reply = replies[Math.min(call, replies.length - 1)] as Reply;
    call += 1;
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const ok = (body: unknown): Reply => ({ status: 200, body });
const serverError: Reply = { status: 500, body: { error: 'Internal Server Error' } };

const renderCard = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <NowPlaying />
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
};

/** Runs the card's next poll now, as its 60 s refetchInterval would. */
const pollAgain = async (queryClient: QueryClient) => {
  await act(async () => {
    await queryClient.refetchQueries();
  });
};

const expectNoLinks = (container: HTMLElement) => {
  expect(screen.queryAllByRole('link')).toHaveLength(0);
  expect(container.querySelector('a[href="#"]')).toBeNull();
};

/** The pulsing "Now playing" dot, shown only while the card claims something plays. */
const liveDot = (container: HTMLElement) => container.querySelector('[class*="animate-pulse"]');

beforeEach(() => {
  // DataLoader logs each failed request, and React logs the error its boundary caught.
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('/spotify now-playing card', () => {
  it('says nothing is playing, with no links and no "Unknown" placeholders', async () => {
    stubNowPlaying(ok({ isPlaying: false }));

    const { container } = renderCard();

    expect(await screen.findByText('Not listening right now')).toBeInTheDocument();
    expectNoLinks(container);
    expect(container).not.toHaveTextContent(/unknown/i);
    expect(container).not.toHaveTextContent(/last played/i);
  });

  it('says Spotify could not be reached when the API fails, with no links', async () => {
    stubNowPlaying(serverError);

    const { container } = renderCard();

    expect(await screen.findByText("Couldn't reach Spotify")).toBeInTheDocument();
    expectNoLinks(container);
    expect(screen.queryByText('Not listening right now')).toBeNull();
  });

  it('loads again from the error state when asked to', async () => {
    const fetchMock = stubNowPlaying(serverError, ok({ isPlaying: false }));

    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Not listening right now')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('links the track to the track and the artist to the artist', async () => {
    stubNowPlaying(ok(playing));

    renderCard();

    const song = await screen.findByRole('link', { name: /Test Song/ });
    const artist = screen.getByRole('link', { name: /Test Artist/ });
    expect(song).toHaveAttribute('href', playing.songURL);
    expect(artist).toHaveAttribute('href', playing.artistURL);
    for (const link of [song, artist]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
  });

  it('shows the track without links when Spotify sent no pages for it', async () => {
    stubNowPlaying(ok({ isPlaying: true, songName: 'Local File', artistName: 'Someone' }));

    const { container } = renderCard();

    expect(await screen.findByText('Local File')).toBeInTheDocument();
    expect(screen.getByText('Someone')).toBeInTheDocument();
    expectNoLinks(container);
  });

  it('stops claiming the last track is live once a later poll fails', async () => {
    stubNowPlaying(ok(playing), serverError);

    const { container, queryClient } = renderCard();
    expect(await screen.findByRole('link', { name: /Test Song/ })).toBeInTheDocument();
    expect(liveDot(container)).not.toBeNull();

    await pollAgain(queryClient);

    expect(await screen.findByText("Couldn't reach Spotify")).toBeInTheDocument();
    expect(screen.queryByText('Test Song')).toBeNull();
    expect(liveDot(container)).toBeNull();
    expectNoLinks(container);
  });

  it('shows the track again once a poll after the failure succeeds', async () => {
    stubNowPlaying(ok(playing), serverError, ok(playing));

    const { queryClient } = renderCard();
    await screen.findByRole('link', { name: /Test Song/ });
    await pollAgain(queryClient);
    await screen.findByText("Couldn't reach Spotify");

    await pollAgain(queryClient);

    expect(await screen.findByRole('link', { name: /Test Song/ })).toBeInTheDocument();
    expect(screen.queryByText("Couldn't reach Spotify")).toBeNull();
  });

  it('names the playing state when Spotify sends no track details', async () => {
    stubNowPlaying(ok({ isPlaying: true }));

    const { container } = renderCard();

    expect(await screen.findByText('Listening on Spotify')).toBeInTheDocument();
    expectNoLinks(container);
  });
});
