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
 * @file The home now-playing island shows the server's snapshot without fetching again, then
 * polls every 30 s while the tab is focused. A failed poll drops the old track and its link, a
 * slow snapshot shows the skeleton until the island's own answer, and nothing links to '#'.
 * Retries are left to the QueryClient. The server HTML (JavaScript off) already holds each state.
 * On a return to '/', a server snapshot newer than the cached answer replaces it.
 */

import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactElement, ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({
    href,
    prefetch,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean | null;
    children?: ReactNode;
  }) => (
    <a {...rest} href={href} data-prefetch={String(prefetch)}>
      {children}
    </a>
  ),
}));

import type { LiveInitial } from '@/app/_components/home/data/tile-result';
import { FetchStatusError } from '@/app/_components/home/live/live-fetch';
import {
  NOW_PLAYING_POLL_MS,
  NOW_PLAYING_QUERY_KEY,
  NowPlayingTile,
  NowPlayingTileSkeleton,
} from '@/app/_components/home/live/now-playing-tile';
import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';

const NOW = new Date('2026-11-05T16:00:00.000Z');
const NOW_PLAYING_PATH = '/api/v1/now-playing';

const TRACK: NowPlayingResponse = {
  isPlaying: true,
  songName: 'My War',
  artistName: 'Shinsei Kamattechan',
  songURL: 'https://open.spotify.com/track/abc',
  imageURL: 'https://i.scdn.co/image/ghi',
};
const NEXT_TRACK: NowPlayingResponse = {
  isPlaying: true,
  songName: 'Unravel',
  artistName: 'TK from Ling tosite sigure',
  songURL: 'https://open.spotify.com/track/xyz',
};
const IDLE: NowPlayingResponse = { isPlaying: false };

const TRACK_LINK_NAME = 'My War by Shinsei Kamattechan on Spotify (opens in a new tab)';

const snapshot = (data: NowPlayingResponse): LiveInitial<NowPlayingResponse> => ({
  kind: 'data',
  data,
  fetchedAt: Date.now(),
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Answers now-playing with each response in turn (the last one repeats). */
function stubNowPlaying(...responses: (() => Response)[]) {
  let call = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url !== NOW_PLAYING_PATH) throw new Error(`unexpected request: ${url}`);
    const respond = responses[Math.min(call, responses.length - 1)];
    call += 1;
    if (!respond) throw new Error('no response stubbed');
    return respond();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const answer = (body: NowPlayingResponse) => () => jsonResponse(body);
const serverError = () => jsonResponse({ error: 'Internal Server Error' }, 500);

const testQueryClient = (retry: (count: number, error: unknown) => boolean = () => false) =>
  new QueryClient({ defaultOptions: { queries: { retry } } });

function withClient(ui: ReactElement, client = testQueryClient()): ReactElement {
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

function renderTile(initial: LiveInitial<NowPlayingResponse>, client = testQueryClient()) {
  return render(withClient(<NowPlayingTile initial={initial} />, client));
}

/** Lets TanStack's scheduled notifications and the stubbed fetch settle. */
const flush = () => act(() => vi.advanceTimersByTimeAsync(0));

function expectNoDeadLinks(root: ParentNode = document) {
  expect(root.querySelector('a[href="#"]')).toBeNull();
  expect(root.querySelector('a[href=""]')).toBeNull();
  expect(root.querySelector('a:not([href])')).toBeNull();
}

const tileOf = (element: HTMLElement): HTMLElement | null => element.closest('.rounded-tile');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('NowPlayingTile', () => {
  it('shows the server snapshot without fetching on mount, then polls once after 30 s', async () => {
    const fetchMock = stubNowPlaying(answer(NEXT_TRACK));
    renderTile(snapshot(TRACK));

    expect(screen.getByRole('link', { name: TRACK_LINK_NAME })).toBeInTheDocument();
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(NOW_PLAYING_POLL_MS));

    await waitFor(() => expect(screen.getByText('Unravel')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(NOW_PLAYING_PATH);
  });

  it('fetches on mount when the snapshot is already over 25 s old', async () => {
    const fetchMock = stubNowPlaying(answer(NEXT_TRACK));
    renderTile({ kind: 'data', data: TRACK, fetchedAt: Date.now() - 26_000 });

    expect(await screen.findByText('Unravel')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cancels a poll in flight when the tile unmounts', async () => {
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => {});
      }),
    );
    const { unmount } = renderTile({ kind: 'timeout' });
    await waitFor(() => expect(requestSignal).toBeDefined());

    unmount();

    expect(requestSignal?.aborted).toBe(true);
  });

  it('polls every 30 s: twice after a minute', async () => {
    const fetchMock = stubNowPlaying(answer(TRACK));
    renderTile(snapshot(TRACK));

    await act(() => vi.advanceTimersByTimeAsync(2 * NOW_PLAYING_POLL_MS));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("shows 'Spotify is unreachable' after a failed poll and drops the old track's link", async () => {
    stubNowPlaying(serverError);
    renderTile(snapshot(TRACK));
    expect(screen.getByRole('link', { name: TRACK_LINK_NAME })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(NOW_PLAYING_POLL_MS));

    const message = await screen.findByText('Spotify is unreachable');
    expect(screen.getByText('retrying every 30 s')).toBeInTheDocument();
    expect(screen.queryByText('My War')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(tileOf(message)).not.toHaveAttribute('data-linked-tile');
    expect(screen.queryByText('Live')).toBeNull();
    expectNoDeadLinks();
  });

  it('shows the next track again once a later poll succeeds', async () => {
    stubNowPlaying(serverError, answer(NEXT_TRACK));
    renderTile(snapshot(TRACK));

    await act(() => vi.advanceTimersByTimeAsync(NOW_PLAYING_POLL_MS));
    await screen.findByText('Spotify is unreachable');
    await act(() => vi.advanceTimersByTimeAsync(NOW_PLAYING_POLL_MS));

    expect(await screen.findByText('Unravel')).toBeInTheDocument();
    expect(screen.queryByText('Spotify is unreachable')).toBeNull();
  });

  it('leaves retrying to the QueryClient default', async () => {
    stubNowPlaying(serverError);
    const retry = vi.fn((_failureCount: number, _error: unknown) => false);
    renderTile(snapshot(TRACK), testQueryClient(retry));

    await act(() => vi.advanceTimersByTimeAsync(NOW_PLAYING_POLL_MS));
    await screen.findByText('Spotify is unreachable');

    expect(retry).toHaveBeenCalledWith(0, expect.any(FetchStatusError));
    expect(retry.mock.calls[0]?.[1]).toMatchObject({ status: 500 });
  });

  it('renders a playing track as one external link with its art and artist', () => {
    stubNowPlaying(answer(TRACK));
    const { container } = renderTile(snapshot(TRACK));

    expect(screen.getByRole('heading', { level: 2, name: 'Now playing' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: TRACK_LINK_NAME });
    expect(link).toHaveAttribute('href', TRACK.songURL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText('Shinsei Kamattechan')).toBeInTheDocument();
    expect(screen.getByText('Live')).toHaveClass('text-live');
    expect(tileOf(link)).toHaveAttribute('data-linked-tile');

    const art = container.querySelector('img');
    expect(art).toHaveAttribute('alt', '');
    expect(art?.getAttribute('src')).toContain(encodeURIComponent('https://i.scdn.co/image/ghi'));
    expect(art).toHaveAttribute('sizes', '96px');
    expectNoDeadLinks();
  });

  it('pulses the live dot while a track plays', () => {
    stubNowPlaying(answer(TRACK));
    const { container } = renderTile(snapshot(TRACK));

    const dot = container.querySelector('[data-status-dot]');
    expect(dot).toHaveAttribute('data-tone', 'live');
    expect(dot).toHaveClass('motion-safe:animate-live-pulse');
  });

  it('is a plain tile with the track as text when Spotify sent no page for it', () => {
    stubNowPlaying(answer(TRACK));
    renderTile(snapshot({ ...TRACK, songURL: undefined }));

    const title = screen.getByText('My War');
    expect(screen.queryByRole('link')).toBeNull();
    expect(tileOf(title)).not.toHaveAttribute('data-linked-tile');
    expectNoDeadLinks();
  });

  it("says 'Listening on Spotify' with the live word and no link when the track is unnamed", () => {
    stubNowPlaying(answer({ isPlaying: true }));
    renderTile(snapshot({ isPlaying: true }));

    expect(screen.getByText('Listening on Spotify')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('links to /spotify while idle, without prefetching it', () => {
    stubNowPlaying(answer(IDLE));
    renderTile(snapshot(IDLE));

    expect(screen.getByText('Not playing right now')).toBeInTheDocument();
    expect(screen.getByText('Spotify · idle')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Top tracks and artists I listen to most' });
    expect(link).toHaveAttribute('href', '/spotify');
    expect(link).toHaveAttribute('data-prefetch', 'false');
    expect(link).not.toHaveAttribute('target');
    expect(tileOf(link)).toHaveAttribute('data-linked-tile');
    expect(screen.queryByText('Live')).toBeNull();
    expectNoDeadLinks();
  });

  it('shows the skeleton for a timed-out snapshot, then the state it fetches', async () => {
    const fetchMock = stubNowPlaying(answer(IDLE));
    const { container } = renderTile({ kind: 'timeout' });

    const busy = container.querySelector('[aria-busy="true"]');
    expect(busy).not.toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Now playing' })).toBeInTheDocument();
    expect(screen.getByText('Loading now playing')).toHaveClass('sr-only');
    expect(screen.queryByRole('link')).toBeNull();

    expect(await screen.findByText('Not playing right now')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[aria-busy]')).toBeNull();
  });

  it('shows the error state for a failed snapshot while it fetches its own answer', async () => {
    const fetchMock = stubNowPlaying(answer(TRACK));
    renderTile({ kind: 'error' });

    expect(screen.getByText('Spotify is unreachable')).toBeInTheDocument();
    expect(document.querySelector('[aria-busy]')).toBeNull();

    expect(await screen.findByRole('link', { name: TRACK_LINK_NAME })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not poll while the window is unfocused, and refetches on focus', async () => {
    const fetchMock = stubNowPlaying(answer(NEXT_TRACK));
    renderTile(snapshot(TRACK));

    act(() => focusManager.setFocused(false));
    await act(() => vi.advanceTimersByTimeAsync(2 * NOW_PLAYING_POLL_MS));
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => focusManager.setFocused(true));
    expect(await screen.findByText('Unravel')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [24_000, 0],
    [26_000, 1],
  ])(
    'on focus after %i ms, refetches %i time(s): the snapshot is fresh for 25 s',
    async (age, calls) => {
      const fetchMock = stubNowPlaying(answer(NEXT_TRACK));
      renderTile(snapshot(TRACK));

      await act(() => vi.advanceTimersByTimeAsync(age));
      act(() => focusManager.setFocused(false));
      act(() => focusManager.setFocused(true));
      await flush();

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(calls));
    },
  );

  it('caches under its own key', () => {
    stubNowPlaying(answer(TRACK));
    const client = testQueryClient();
    renderTile(snapshot(IDLE), client);

    expect(NOW_PLAYING_QUERY_KEY).toEqual(['home', 'now-playing']);
    expect(client.getQueryData(['home', 'now-playing'])).toEqual(IDLE);
  });

  it('never announces polls through a live region', () => {
    stubNowPlaying(answer(TRACK));
    const { container } = renderTile(snapshot(TRACK));

    expect(container.querySelector('[aria-live]')).toBeNull();
  });
});

describe('NowPlayingTile on a return to the home page', () => {
  // The QueryClient outlives client navigations, so the tile can mount over an earlier answer.
  it.each([
    ['fresh', 10_000],
    ['stale', 60_000],
  ])(
    'shows a server snapshot newer than a %s cached answer, without fetching again',
    async (_freshness, cacheAge) => {
      const fetchMock = stubNowPlaying(answer(TRACK));
      const client = testQueryClient();
      client.setQueryData(NOW_PLAYING_QUERY_KEY, TRACK, { updatedAt: Date.now() - cacheAge });
      const fetchedAt = Date.now();

      renderTile({ kind: 'data', data: IDLE, fetchedAt }, client);

      expect(await screen.findByText('Not playing right now')).toBeInTheDocument();
      expect(screen.queryByText('My War')).toBeNull();
      expect(screen.queryByText('Live')).toBeNull();
      expect(client.getQueryState(NOW_PLAYING_QUERY_KEY)?.dataUpdatedAt).toBe(fetchedAt);
      await flush();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('keeps a cached answer newer than the server snapshot', async () => {
    const fetchMock = stubNowPlaying(answer(IDLE));
    const client = testQueryClient();
    client.setQueryData(NOW_PLAYING_QUERY_KEY, TRACK, { updatedAt: Date.now() });

    renderTile({ kind: 'data', data: IDLE, fetchedAt: Date.now() - 5_000 }, client);
    await flush();

    expect(screen.getByRole('link', { name: TRACK_LINK_NAME })).toBeInTheDocument();
    expect(screen.queryByText('Not playing right now')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hydrates the server HTML of a first load as is', async () => {
    const fetchMock = stubNowPlaying(answer(IDLE));
    const initial = snapshot(TRACK);
    const container = document.createElement('div');
    container.innerHTML = renderToString(withClient(<NowPlayingTile initial={initial} />));
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, withClient(<NowPlayingTile initial={initial} />), {
        onRecoverableError,
      }),
    );

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: TRACK_LINK_NAME })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });
});

describe('NowPlayingTile server HTML (JavaScript off)', () => {
  const html = (initial: LiveInitial<NowPlayingResponse>) =>
    renderToString(withClient(<NowPlayingTile initial={initial} />));

  it('holds the playing track and its link', () => {
    const markup = html(snapshot(TRACK));

    expect(markup).toContain('My War');
    expect(markup).toContain(`href="${TRACK.songURL}"`);
    expect(markup).not.toContain('aria-busy');
  });

  it('holds the idle state and its /spotify link', () => {
    const markup = html(snapshot(IDLE));

    expect(markup).toContain('Not playing right now');
    expect(markup).toContain('href="/spotify"');
  });

  it('holds the error copy for a failed snapshot, not a skeleton', () => {
    const markup = html({ kind: 'error' });

    expect(markup).toContain('Spotify is unreachable');
    expect(markup).not.toContain('aria-busy');
  });

  it('holds the skeleton for a timed-out snapshot', () => {
    const markup = html({ kind: 'timeout' });

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('Loading now playing');
  });
});

describe('NowPlayingTileSkeleton', () => {
  it('has the real label, aria-busy and words for screen readers, and no link', () => {
    const { container } = render(<NowPlayingTileSkeleton />);

    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'Now playing' })).toBeInTheDocument();
    expect(screen.getByText('Loading now playing')).toBeInTheDocument();
    expect(container.querySelector('a')).toBeNull();
  });
});
