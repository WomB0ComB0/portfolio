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
 * would double the requests a failing /api/v1/now-playing gets. The real fetcher runs against a
 * stubbed fetch; only the site shell is stubbed, since it needs the router and the command menu.
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

const stubNowPlaying = (body: unknown) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
    if (url.pathname !== NOW_PLAYING_PATH) throw new Error(`unexpected request: ${url.pathname}`);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const renderHomePage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
});
