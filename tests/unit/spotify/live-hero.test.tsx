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
 * @file The live Spotify hero ages remembered tracks using each shared query answer's time.
 * Cache updates stand in for successful polls; the query is disabled, so no API is called.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The app's PostCSS config cannot run in Vitest; this matches the home tile's CSS stub.
vi.mock('@/app/_components/home/live/equaliser.module.css', () => ({
  default: new Proxy(
    {},
    { get: (_target, name) => (typeof name === 'string' ? `eq-${name}` : undefined) },
  ),
}));

import { NOW_PLAYING_QUERY_KEY } from '@/app/_components/home/live/now-playing-tile';
import { LiveHero } from '@/app/(routes)/(main)/(personal)/spotify/_components/live-hero';
import {
  RECENT_MAX_AGE_MS,
  type RecentTrack,
} from '@/app/(routes)/(main)/(personal)/spotify/_lib/hero-state';
import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';

const SEEN_AT = 1_700_000_000_000;
const RECENT: RecentTrack = {
  at: SEEN_AT,
  track: {
    kind: 'playing',
    title: 'Earlier song',
    subtitle: 'Earlier artist',
    spokenSuffix: 'by Earlier artist on Spotify',
    href: 'https://open.spotify.com/track/earlier',
  },
};
const IDLE: NowPlayingResponse = { isPlaying: false };
const PLAYING: NowPlayingResponse = {
  isPlaying: true,
  songName: 'Current song',
  artistName: 'Current artist',
  songURL: 'https://open.spotify.com/track/current',
};
const clients: QueryClient[] = [];

/** A real shared query cache with networking disabled for this component test. */
function makeClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } });
  clients.push(client);
  return client;
}

/** The hero starts with the same idle server snapshot and remembered track every time. */
function hero(client: QueryClient, fetchedAt = SEEN_AT + 1_000): ReactElement {
  return (
    <QueryClientProvider client={client}>
      <LiveHero initial={{ kind: 'data', data: IDLE, fetchedAt }} recent={RECENT} />
    </QueryClientProvider>
  );
}

/** Publish a successful shared poll, including its timestamp even when the payload is unchanged. */
async function answer(client: QueryClient, data: NowPlayingResponse, at: number): Promise<void> {
  await act(async () => {
    client.setQueryData(NOW_PLAYING_QUERY_KEY, data, { updatedAt: at });
  });
}

const state = (container: HTMLElement): string | null | undefined =>
  container.querySelector('[data-spotify-hero]')?.getAttribute('data-state');

afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.useRealTimers();
});

describe('LiveHero recent tracks', () => {
  it('expires a remembered track on a later idle poll, even when the payload is unchanged', async () => {
    const client = makeClient();
    const { container } = render(hero(client));
    expect(state(container)).toBe('recent');

    await answer(client, IDLE, SEEN_AT + RECENT_MAX_AGE_MS + 1);

    await waitFor(() => expect(state(container)).toBe('nothing'));
    expect(container).not.toHaveTextContent('Earlier song');
  });

  it('keeps a remembered track through the inclusive twelve-hour boundary', async () => {
    const client = makeClient();
    const { container } = render(hero(client));

    await answer(client, IDLE, SEEN_AT + RECENT_MAX_AGE_MS);

    expect(state(container)).toBe('recent');
    expect(container).toHaveTextContent('Earlier song');
  });

  it('remembers a new playing track and uses its new sighting time after playback stops', async () => {
    const client = makeClient();
    const { container } = render(hero(client));
    const newSighting = SEEN_AT + RECENT_MAX_AGE_MS + 30_000;

    await answer(client, PLAYING, newSighting);
    await waitFor(() => expect(state(container)).toBe('playing'));
    expect(container).toHaveTextContent('Current song');

    await answer(client, IDLE, newSighting + 30_000);

    await waitFor(() => expect(state(container)).toBe('recent'));
    expect(container).toHaveTextContent('Current song');
    expect(container).not.toHaveTextContent('Earlier song');
  });

  it('drops a remembered sighting outside the future clock-skew tolerance', async () => {
    const client = makeClient();
    const { container } = render(hero(client));

    await answer(client, IDLE, SEEN_AT - 120_000);

    await waitFor(() => expect(state(container)).toBe('nothing'));
  });

  it('keeps server and hydration states identical when the browser clock crosses the age limit', async () => {
    const fetchedAt = SEEN_AT + RECENT_MAX_AGE_MS;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(fetchedAt);
    const container = document.createElement('div');
    container.innerHTML = renderToString(hero(makeClient(), fetchedAt));
    document.body.append(container);
    expect(state(container)).toBe('recent');
    vi.setSystemTime(fetchedAt + 30_000);
    const errors: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, hero(makeClient(), fetchedAt), {
          onRecoverableError: (error) => errors.push(error),
        });
      });

      expect(errors).toEqual([]);
      expect(state(container)).toBe('recent');
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });
});
