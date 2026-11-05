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
 * @file The homepage's now-playing card asks effect-fetcher for a single attempt: TanStack
 * Query's shared default (shouldRetryQuery) is the one retry layer, so a fetcher retry on top
 * would double the requests a failing /api/v1/now-playing gets. The tile only says what is known:
 * a failed request (the API answers 500 now, not `isPlaying: false`) reads "Spotify unavailable"
 * and is not a link, and nothing claims "Not Currently Listening" before the first answer. The
 * real fetcher runs against a stubbed fetch; only the site shell is stubbed, since it needs the
 * router and the command menu.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/components/layout/layout', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/lib/http-clients/effect-fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http-clients/effect-fetcher')>();
  return { ...actual, get: vi.fn(actual.get) };
});

import { HomePage } from '@/app/_components/home';
import { get } from '@/lib/http-clients/effect-fetcher';

const NOW_PLAYING_PATH = '/api/v1/now-playing';

/** The homepage tile's query key, for seeding an answer from an earlier poll. */
const NOW_PLAYING_QUERY_KEY = ['now-playing-homepage'];
/** Older than the tile's 30 s staleTime, so mounting refetches it. */
const EARLIER_POLL_AGE_MS = 60_000;

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const stubNowPlaying = (body: unknown, status = 200) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
    if (url.pathname !== NOW_PLAYING_PATH) throw new Error(`unexpected request: ${url.pathname}`);
    return jsonResponse(body, status);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const stubNowPlayingFailure = () => stubNowPlaying({ error: 'Internal Server Error' }, 500);

const createTestQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderHomePage = (queryClient = createTestQueryClient()) => {
  render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(get).mockClear();
});

describe('homepage now-playing card', () => {
  it('shows the track the API reports', async () => {
    stubNowPlaying({ isPlaying: true, songName: 'Test Song', artistName: 'Test Artist' });

    renderHomePage();

    expect(await screen.findByText('Test Song')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
  });

  it('leaves retries to TanStack Query by asking the fetcher for zero retries', async () => {
    const fetchMock = stubNowPlaying({ isPlaying: false });

    renderHomePage();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const nowPlayingCalls = vi
      .mocked(get)
      .mock.calls.filter(([url]) => String(url) === NOW_PLAYING_PATH);
    expect(nowPlayingCalls).toHaveLength(1);
    expect(nowPlayingCalls[0]?.[1]).toMatchObject({ retries: 0 });
  });

  it('is not a link while nothing plays, so keyboard users never reach a dead "#"', async () => {
    stubNowPlaying({ isPlaying: false });

    renderHomePage();

    const status = await screen.findByText('Not Currently Listening');
    expect(status.closest('a')).toBeNull();
    expect(document.querySelector('a[href="#"]')).toBeNull();
  });

  it('names the playing state even when Spotify sends no track details', async () => {
    stubNowPlaying({ isPlaying: true });

    renderHomePage();

    expect(await screen.findByText('Listening on Spotify')).toBeInTheDocument();
  });

  it('is a quiet, non-link "Spotify unavailable" tile when now-playing fails', async () => {
    stubNowPlayingFailure();

    renderHomePage();

    const status = await screen.findByText('Spotify unavailable');
    expect(status.closest('a')).toBeNull();
    expect(screen.queryByText('Not Currently Listening')).toBeNull();
  });

  it("shows the failure rather than an earlier poll's track", async () => {
    stubNowPlayingFailure();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      NOW_PLAYING_QUERY_KEY,
      { isPlaying: true, songName: 'Earlier Song', songURL: 'https://open.spotify.com/track/x' },
      { updatedAt: Date.now() - EARLIER_POLL_AGE_MS },
    );

    renderHomePage(queryClient);

    const status = await screen.findByText('Spotify unavailable');
    expect(status.closest('a')).toBeNull();
    expect(screen.queryByText('Earlier Song')).toBeNull();
  });

  it('does not claim nothing is playing before the first answer arrives', async () => {
    let answer: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderHomePage();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(screen.getByText('Checking Spotify…')).toBeInTheDocument();
    expect(screen.queryByText('Not Currently Listening')).toBeNull();

    answer(jsonResponse({ isPlaying: false }, 200));
    expect(await screen.findByText('Not Currently Listening')).toBeInTheDocument();
  });
});
