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
 * @file The home status island says every state in words (the dot only decorates them), counts
 * the monitors, says 'Monitoring paused' when none is active, marks an answer 'Last known' with
 * its New York day and time when the route flagged it stale or a poll failed (never by comparing
 * clocks), and links to the public status page in a new tab. It caches under its own key, not
 * the footer badge's, and renders the same HTML whatever the clock says, so hydration matches.
 * On a return to '/', a server snapshot newer than the cached answer replaces it.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LiveInitial } from '@/app/_components/home/data/tile-result';
import { FetchStatusError } from '@/app/_components/home/live/live-fetch';
import {
  SERVICE_STATUS_QUERY_KEY,
  STATUS_POLL_MS,
  StatusTile,
  StatusTileSkeleton,
  serviceStatusView,
} from '@/app/_components/home/live/status-tile';
import type { ServiceStatus } from '@/app/api/[[...route]]/status/schema';
import { STATUS_PAGE_URL } from '@/lib/status/service-state';

/** 11:00 AM in New York (EST). */
const NOW = new Date('2026-11-05T16:00:00.000Z');
const MINUTE_MS = 60_000;
const STATUS_PATH = '/api/status';

const status = (overrides: Partial<ServiceStatus> = {}): ServiceStatus => ({
  state: 'operational',
  lastUpdated: NOW.toISOString(),
  monitors: { up: 6, total: 6 },
  ...overrides,
});

/** What the home loader hands the island: fetchedAt is the check's own time. */
const snapshot = (data: ServiceStatus, fetchedAt = Date.parse(data.lastUpdated)) =>
  ({ kind: 'data', data, fetchedAt }) satisfies LiveInitial<ServiceStatus>;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const envelope = (data: ServiceStatus) => ({ success: true, message: 'Status retrieved', data });

/** Answers /api/status with each response in turn (the last one repeats). */
function stubStatus(...responses: (() => Response)[]) {
  let call = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url !== STATUS_PATH) throw new Error(`unexpected request: ${url}`);
    const respond = responses[Math.min(call, responses.length - 1)];
    call += 1;
    if (!respond) throw new Error('no response stubbed');
    return respond();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const answer = (data: ServiceStatus) => () => jsonResponse(envelope(data));
/** The route's cached answer after Better Stack failed, as handleStatusCheck flags it. */
const cachedOnError = (overrides: Partial<ServiceStatus> = {}): ServiceStatus =>
  status({ message: 'Using cached status data due to API error', stale: true, ...overrides });
const serverError = () => jsonResponse({ success: false, message: 'x', error: 'x' }, 500);

const testQueryClient = (retry: (count: number, error: unknown) => boolean = () => false) =>
  new QueryClient({ defaultOptions: { queries: { retry } } });

function withClient(ui: ReactElement, client = testQueryClient()): ReactElement {
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

function renderTile(initial: LiveInitial<ServiceStatus>, client = testQueryClient()) {
  return render(withClient(<StatusTile initial={initial} />, client));
}

const statusLink = () => screen.getByRole('link');
const dot = (container: HTMLElement) => container.querySelector('[data-status-dot]');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('StatusTile states', () => {
  it.each([
    ['operational', 'All systems up', 'live'],
    ['degraded', 'Degraded performance', 'ongoing'],
    ['down', 'Service outage', 'down'],
    ['unknown', 'Status unavailable', 'idle'],
  ] as const)('says %s in words (%s) beside a %s dot', (state, words, tone) => {
    stubStatus(answer(status({ state })));
    const { container } = renderTile(snapshot(status({ state })));

    expect(screen.getByRole('heading', { level: 2, name: 'Status' })).toBeInTheDocument();
    expect(statusLink()).toHaveTextContent(words);
    expect(dot(container)).toHaveAttribute('data-tone', tone);
    expect(dot(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('pulses only while operational', () => {
    stubStatus(answer(status()));
    const { container, unmount } = renderTile(snapshot(status()));
    expect(dot(container)).toHaveClass('motion-safe:animate-live-pulse');
    unmount();

    const down = renderTile(snapshot(status({ state: 'down' })));
    expect(dot(down.container)).not.toHaveClass('motion-safe:animate-live-pulse');
  });

  it('counts the monitors in mono', () => {
    stubStatus(answer(status()));
    renderTile(snapshot(status({ state: 'degraded', monitors: { up: 5, total: 6 } })));

    const line = screen.getByText('5/6 monitors up');
    expect(line).toHaveClass('font-mono', 'text-meta', 'tabular-nums');
  });

  it.each([
    ['no counts', undefined],
    ['no active monitor', { up: 0, total: 0 }],
  ])('prints no monitor line for %s', (_label, monitors) => {
    stubStatus(answer(status()));
    renderTile(snapshot(status({ monitors })));

    expect(screen.queryByText(/monitors up/)).toBeNull();
  });

  it('links the words to the status page in a new tab', () => {
    stubStatus(answer(status()));
    renderTile(snapshot(status()));

    const link = screen.getByRole('link', {
      name: 'All systems up (service status page) (opens in a new tab)',
    });
    expect(link).toHaveAttribute('href', 'https://status.mikeodnis.dev');
    expect(STATUS_PAGE_URL).toBe('https://status.mikeodnis.dev');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.closest('[data-linked-tile]')).not.toBeNull();
    expect(document.querySelector('a[href="#"]')).toBeNull();
  });
});

describe('StatusTile monitoring paused', () => {
  const paused = () => status({ monitors: { up: 0, total: 0 } });

  it("says 'Monitoring paused' beside an idle, still dot, with no monitor line", () => {
    stubStatus(answer(paused()));
    const { container } = renderTile(snapshot(paused()));

    expect(statusLink()).toHaveTextContent(/^Monitoring paused/);
    expect(screen.queryByText(/All systems up/)).toBeNull();
    expect(dot(container)).toHaveAttribute('data-tone', 'idle');
    expect(dot(container)).not.toHaveClass('motion-safe:animate-live-pulse');
    expect(screen.queryByText(/monitors/)).toBeNull();
  });

  it('says it in the server HTML too (JavaScript off)', () => {
    const markup = renderToString(withClient(<StatusTile initial={snapshot(paused())} />));

    expect(markup).toContain('Monitoring paused');
    expect(markup).not.toContain('All systems up');
    expect(markup).not.toContain('animate-live-pulse');
  });

  it("marks a stale paused answer 'Last known: Monitoring paused'", () => {
    const stale = cachedOnError({ monitors: { up: 0, total: 0 } });
    stubStatus(answer(stale));
    renderTile(snapshot(stale));

    expect(statusLink()).toHaveTextContent('Last known: Monitoring paused');
  });
});

describe('StatusTile last known state', () => {
  it("marks an answer the route flagged stale 'Last known', with its day and time", () => {
    // As the loader seeds it: fetchedAt is the check's own time, whatever its age.
    const old = cachedOnError({ lastUpdated: '2026-11-05T15:55:00.000Z' });
    stubStatus(answer(old));
    const { container } = renderTile(snapshot(old));

    expect(statusLink()).toHaveTextContent('Last known: All systems up');
    expect(screen.getByText('as of Nov 5, 10:55 AM ET')).toHaveClass('tabular-nums');
    expect(dot(container)).not.toHaveClass('motion-safe:animate-live-pulse');
  });

  it('dates a stale answer from an earlier day with that day', () => {
    // 9:00 AM in New York the day before NOW.
    const yesterday = cachedOnError({ lastUpdated: '2026-11-04T14:00:00.000Z' });
    stubStatus(answer(yesterday));
    renderTile(snapshot(yesterday));

    expect(screen.getByText('as of Nov 4, 9:00 AM ET')).toBeInTheDocument();
  });

  it.each([
    ['older than the 3 min the browser used to allow', 5 * MINUTE_MS],
    ['received by a browser whose clock runs 90 s fast', 100_000],
  ])('does not mark an unflagged answer %s: clocks are never compared', (_label, age) => {
    const unflagged = status({ lastUpdated: new Date(NOW.getTime() - age).toISOString() });
    stubStatus(answer(unflagged));
    const { container } = renderTile(snapshot(unflagged, NOW.getTime() + 90_000));

    expect(statusLink()).toHaveTextContent(/^All systems up/);
    expect(screen.queryByText(/as of/)).toBeNull();
    expect(dot(container)).toHaveClass('motion-safe:animate-live-pulse');
  });

  it("shows a poll's cached-on-error answer as 'Last known'", async () => {
    const cached = cachedOnError({ lastUpdated: '2026-11-05T15:50:00.000Z' });
    stubStatus(answer(cached));
    renderTile(snapshot(status()));

    await act(() => vi.advanceTimersByTimeAsync(STATUS_POLL_MS));

    await waitFor(() => expect(statusLink()).toHaveTextContent('Last known: All systems up'));
    expect(screen.getByText('as of Nov 5, 10:50 AM ET')).toBeInTheDocument();
  });

  it("keeps the last answer as 'Last known' when a later poll fails", async () => {
    stubStatus(serverError);
    renderTile(snapshot(status({ state: 'degraded' })));

    await act(() => vi.advanceTimersByTimeAsync(STATUS_POLL_MS));

    await waitFor(() => expect(statusLink()).toHaveTextContent('Last known: Degraded performance'));
    expect(screen.getByText('as of Nov 5, 11:00 AM ET')).toBeInTheDocument();
  });

  it("never calls an unknown state 'last known'", () => {
    const unknown = cachedOnError({ state: 'unknown', lastUpdated: '2026-11-05T15:00:00.000Z' });
    stubStatus(answer(unknown));
    renderTile(snapshot(unknown));

    expect(statusLink()).toHaveTextContent(/^Status unavailable/);
    expect(screen.queryByText(/as of/)).toBeNull();
  });
});

describe('StatusTile polling', () => {
  it('shows the snapshot without fetching, then polls /api/status once a minute', async () => {
    const fetchMock = stubStatus(answer(status({ state: 'down' })));
    renderTile(snapshot(status()));

    expect(statusLink()).toHaveTextContent('All systems up');
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(fetchMock).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(STATUS_POLL_MS));

    await waitFor(() => expect(statusLink()).toHaveTextContent('Service outage'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [50_000, 0],
    [56_000, 1],
  ])(
    'on mount, fetches a snapshot checked %i ms ago %i time(s): it is fresh for 55 s',
    async (age, calls) => {
      const fetchMock = stubStatus(answer(status({ state: 'down' })));
      const checked = status({ lastUpdated: new Date(NOW.getTime() - age).toISOString() });
      renderTile(snapshot(checked));

      await act(() => vi.advanceTimersByTimeAsync(0));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(calls));
    },
  );

  it('shows the skeleton for a timed-out snapshot, then the state it fetches', async () => {
    const fetchMock = stubStatus(answer(status()));
    const { container } = renderTile({ kind: 'timeout' });

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText('Checking status…')).toBeInTheDocument();

    await waitFor(() => expect(statusLink()).toHaveTextContent('All systems up'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[aria-busy]')).toBeNull();
  });

  it("says 'Status unavailable' when the first poll fails with no snapshot", async () => {
    stubStatus(serverError);
    renderTile({ kind: 'timeout' });

    await waitFor(() => expect(statusLink()).toHaveTextContent('Status unavailable'));
    expect(screen.queryByText(/as of/)).toBeNull();
  });

  it("says 'Status unavailable' for a failed snapshot while it fetches its own answer", async () => {
    stubStatus(answer(status()));
    renderTile({ kind: 'error' });

    expect(statusLink()).toHaveTextContent('Status unavailable');
    await waitFor(() => expect(statusLink()).toHaveTextContent('All systems up'));
  });

  it('leaves retrying to the QueryClient default', async () => {
    stubStatus(serverError);
    const retry = vi.fn((_failureCount: number, _error: unknown) => false);
    renderTile({ kind: 'timeout' }, testQueryClient(retry));

    await waitFor(() => expect(retry).toHaveBeenCalledWith(0, expect.any(FetchStatusError)));
  });

  it("caches under ['service-status'], never the footer badge's ['system-status']", () => {
    stubStatus(answer(status()));
    const client = testQueryClient();
    renderTile(snapshot(status()), client);

    expect(SERVICE_STATUS_QUERY_KEY).not.toEqual(['system-status']);
    expect(client.getQueryData(['service-status'])).toEqual(status());
    expect(client.getQueryData(['system-status'])).toBeUndefined();
  });
});

describe('StatusTile on a return to the home page', () => {
  // The QueryClient outlives client navigations, so the tile can mount over an earlier answer.
  it.each([
    ['fresh', 10_000],
    ['stale', 2 * MINUTE_MS],
  ])(
    'shows an outage in a server snapshot newer than a %s cached answer, without fetching again',
    async (_freshness, cacheAge) => {
      const fetchMock = stubStatus(answer(status()));
      const client = testQueryClient();
      client.setQueryData(SERVICE_STATUS_QUERY_KEY, status(), {
        updatedAt: NOW.getTime() - cacheAge,
      });
      const outage = snapshot(status({ state: 'down' }));

      const { container } = renderTile(outage, client);

      await waitFor(() => expect(statusLink()).toHaveTextContent('Service outage'));
      expect(dot(container)).toHaveAttribute('data-tone', 'down');
      expect(dot(container)).not.toHaveClass('motion-safe:animate-live-pulse');
      expect(client.getQueryState(SERVICE_STATUS_QUERY_KEY)?.dataUpdatedAt).toBe(outage.fetchedAt);
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('keeps a cached answer newer than the server snapshot', async () => {
    const fetchMock = stubStatus(answer(status()));
    const client = testQueryClient();
    client.setQueryData(SERVICE_STATUS_QUERY_KEY, status({ state: 'down' }), {
      updatedAt: NOW.getTime(),
    });
    const older = status({ lastUpdated: new Date(NOW.getTime() - 30_000).toISOString() });

    renderTile(snapshot(older), client);
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(statusLink()).toHaveTextContent('Service outage');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('StatusTile server HTML', () => {
  const html = (initial: LiveInitial<ServiceStatus>) =>
    renderToString(withClient(<StatusTile initial={initial} />));

  it('holds the state, the count and the link (JavaScript off)', () => {
    const markup = html(snapshot(status()));

    expect(markup).toContain('All systems up');
    expect(markup).toContain('6/6 monitors up');
    expect(markup).toContain(`href="${STATUS_PAGE_URL}"`);
  });

  it('holds the unavailable copy for a failed snapshot, not a skeleton', () => {
    const markup = html({ kind: 'error' });

    expect(markup).toContain('Status unavailable');
    expect(markup).not.toContain('aria-busy');
  });

  it("marks the route's stale answer 'Last known' in the server HTML (JavaScript off)", () => {
    const markup = html(snapshot(cachedOnError({ lastUpdated: '2026-11-05T14:00:00.000Z' })));

    expect(markup).toContain('Last known: All systems up');
    expect(markup).toContain('as of Nov 5, 9:00 AM ET');
    expect(markup).not.toContain('animate-live-pulse');
  });

  it('is the same whatever the clock says, so hydration matches', () => {
    const checked = snapshot(status({ lastUpdated: '2026-11-05T15:59:00.000Z' }));
    const first = html(checked);
    expect(first).not.toContain('Last known');

    vi.setSystemTime(new Date(NOW.getTime() + 90 * MINUTE_MS));

    expect(html(checked)).toBe(first);
  });
});

describe('StatusTileSkeleton', () => {
  it("is busy, says 'Checking status…' beside an idle dot, and links nowhere", () => {
    const { container } = render(<StatusTileSkeleton />);

    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'Status' })).toBeInTheDocument();
    expect(screen.getByText('Checking status…')).toBeInTheDocument();
    expect(dot(container)).toHaveAttribute('data-tone', 'idle');
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('serviceStatusView', () => {
  it('is loading with no data and no failure', () => {
    expect(
      serviceStatusView({
        data: undefined,
        isError: false,
        initialKind: 'timeout',
      }),
    ).toEqual({ kind: 'loading' });
  });

  it.each([
    ['operational', true],
    ['degraded', false],
    ['down', false],
    ['unknown', false],
  ] as const)('asks the dot to breathe for a current %s answer: %s', (state, pulse) => {
    const view = serviceStatusView({
      data: status({ state }),
      isError: false,
      initialKind: 'data',
    });

    expect(view).toHaveProperty('pulse', pulse);
  });

  it('asks a stale operational answer, or one with no active monitor, not to breathe', () => {
    const view = (data: ServiceStatus) =>
      serviceStatusView({ data, isError: false, initialKind: 'data' });

    expect(view(cachedOnError())).toHaveProperty('pulse', false);
    expect(view(status({ monitors: { up: 0, total: 0 } }))).toMatchObject({
      label: 'Monitoring paused',
      tone: 'idle',
      pulse: false,
      monitors: undefined,
    });
  });

  it('prints no time for a last known answer with an unreadable lastUpdated', () => {
    const view = serviceStatusView({
      data: status({ lastUpdated: 'yesterday' }),
      isError: true,
      initialKind: 'data',
    });

    expect(view).toMatchObject({ kind: 'status', label: 'Last known: All systems up' });
    expect(view).toHaveProperty('asOf', undefined);
  });
});
