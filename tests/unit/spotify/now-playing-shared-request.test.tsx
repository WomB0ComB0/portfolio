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
 * @file The /spotify card and the /stats Discord card's fallback both ask /api/v1/now-playing,
 * and each decodes the answer with its own schema; the Discord one has no artistURL. The request
 * queue used to hand a card that asked while the fallback's request was in flight the fallback's
 * decoded result, so the card lost its artist link until its next poll. The real request queue,
 * fetcher and both cards run against a stubbed fetch.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

import { Discord } from '@/app/(routes)/(dev)/stats/_components/discord';
import { NowPlaying } from '@/app/(routes)/(main)/(personal)/spotify/_components/now-playing';
import { requestQueue } from '@/lib/http-clients/request-queue';

const NOW_PLAYING_PATH = '/api/v1/now-playing';

const playing = {
  isPlaying: true,
  songName: 'Test Song',
  artistName: 'Test Artist',
  songURL: 'https://open.spotify.com/track/test-song',
  artistURL: 'https://open.spotify.com/artist/test-artist',
  imageURL: 'https://i.scdn.co/image/test-art',
};

/** Discord reports no listening activity, so the Discord card asks now-playing instead. */
const lanyard = {
  discord_user: { username: 'tester', discriminator: '0', avatar: 'abc123', id: '42' },
  activities: [{ name: 'Visual Studio Code', type: 0, details: 'Editing now-playing.tsx' }],
  discord_status: 'online',
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

/** Answers Lanyard at once and holds every now-playing answer until `release` is called. */
const stubApi = () => {
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
      if (url.pathname === '/api/v1/lanyard') return json(lanyard);
      if (url.pathname !== NOW_PLAYING_PATH) throw new Error(`unexpected request: ${url.pathname}`);
      await released;
      return json(playing);
    }),
  );
  return { release };
};

const withClient = (queryClient: QueryClient, children: ReactNode) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('now-playing shared between the Discord card and the /spotify card', () => {
  it('keeps the artist link when the card asks while the fallback request is in flight', async () => {
    const api = stubApi();
    const enqueue = vi.spyOn(requestQueue, 'enqueue');
    const nowPlayingCalls = () =>
      enqueue.mock.calls.filter(([url]) => url === NOW_PLAYING_PATH).length;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(withClient(queryClient, <Discord />));
    await waitFor(() => expect(nowPlayingCalls()).toBe(1));
    const card = render(withClient(queryClient, <NowPlaying />));
    await waitFor(() => expect(nowPlayingCalls()).toBe(2));
    api.release();

    const view = within(card.container);
    expect(await view.findByRole('link', { name: /Test Song/ })).toHaveAttribute(
      'href',
      playing.songURL,
    );
    expect(view.getByRole('link', { name: /Test Artist/ })).toHaveAttribute(
      'href',
      playing.artistURL,
    );
  });
});
