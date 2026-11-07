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
 * @file The home status island is a slim tile: one line, a still dot and the state in words (the
 * dot only decorates them), linked to the public status page in a new tab. Its h2 ('Site status')
 * is for screen readers only. It counts the monitors only when some are not up ('Degraded · 5/6
 * up'), says 'Monitoring paused' when none is active, and marks an answer 'Last known' with its
 * New York day and time on a second line when the route flagged it stale or a poll failed (never
 * by comparing clocks). Nothing on it moves. It caches under its own key, not the footer badge's,
 * and renders the same HTML whatever the clock says, so hydration matches. On a return to '/', a
 * server snapshot newer than the cached answer replaces it.
 *
 * Its root says what it shows (the e2e layout checks compare only tiles showing their reference
 * content): data-state 'loading' with aria-busy, 'ready' for a current answer, 'stale' plus
 * data-stale="" whenever the 'Last known' words or the 'as of' line show, and 'error' for 'Status
 * unavailable'.
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
import { CHECKING_STATUS, STATUS_PAGE_URL } from '@/lib/status/service-state';

/** 11:00 AM in New York (EST). */
const NOW = new Date('2026-11-05T16:00:00.000Z');
const MINUTE_MS = 60_000;
const STATUS_PATH = '/api/status';
/**
 * Between a state and its count, as toHaveTextContent sees it: the markup's no-break space before
 * the dot (service-state.test.ts checks it) is whitespace, which the matcher collapses to a space.
 */
const SEP = ' · ';

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
/** The tile's root, which carries its data-state (and data-stale for an old answer). */
const rootOf = (container: HTMLElement) => container.firstElementChild;
const dot = (container: HTMLElement) => container.querySelector('[data-status-dot]');
/** The tile's paragraphs, in order: its state line, then a line for an old answer. */
const linesOf = (container: HTMLElement) => [...container.querySelectorAll('p')];

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
    ['degraded', 'Degraded', 'ongoing'],
    ['down', 'Outage', 'down'],
    ['unknown', 'Status unavailable', 'idle'],
  ] as const)('says %s in words (%s) beside a %s dot', (state, words, tone) => {
    stubStatus(answer(status({ state })));
    const { container } = renderTile(snapshot(status({ state })));

    expect(statusLink()).toHaveTextContent(new RegExp(`^${words}`));
    expect(dot(container)).toHaveAttribute('data-tone', tone);
    expect(dot(container)).toHaveAttribute('aria-hidden', 'true');
  });

  // The visible 'STATUS' label is gone: the words name the tile.
  it("names itself 'Site status' for screen readers only, with no visible label", () => {
    stubStatus(answer(status()));
    const { container } = renderTile(snapshot(status()));

    expect(screen.getByRole('heading', { level: 2, name: 'Site status' })).toHaveClass('sr-only');
    expect(container.querySelector('h2 ~ *')?.textContent).not.toMatch(/^Status/);
  });

  it('is one line while the answer is current: no count, no second line', () => {
    stubStatus(answer(status()));
    const { container } = renderTile(snapshot(status()));

    expect(linesOf(container)).toHaveLength(1);
    expect(linesOf(container)[0]).toHaveClass('tile-title');
    expect(container.textContent).not.toMatch(/\d/);
    expect(statusLink().querySelector('[data-status-words]')).toHaveTextContent('All systems up');
  });

  // The words are the state: in a narrow lane they wrap, never 'All syste…' or 'Degraded · 3/…'.
  it.each([
    ['operational', 'All systems up'],
    ['degraded', 'Degraded'],
  ] as const)('wraps the %s words rather than cutting them short', (state, words) => {
    stubStatus(answer(status({ state })));
    const { container } = renderTile(snapshot(status({ state })));

    expect(statusLink()).toHaveTextContent(new RegExp(`^${words}`));
    expect(container.querySelector('.truncate, .text-ellipsis, .line-clamp-1')).toBeNull();
    expect(statusLink()).not.toHaveClass('flex');
    // The dot keeps to the first line's middle when the words run onto a second.
    expect(dot(container)?.parentElement).toHaveClass('h-[1lh]', 'items-center');
  });

  // 'Checking status…' is no state: wrapped, the skeleton was a line taller than the one-line
  // answer in a 375 px window's 181 px lane, and the tiles below moved when the answer landed.
  it('keeps the checking words to one line, as tall as the answer it stands in for', () => {
    const { container } = render(<StatusTileSkeleton />);

    expect(container).toHaveTextContent(CHECKING_STATUS);
    expect(container.querySelector('p')).toHaveClass('tile-title');
    expect(screen.getByText(CHECKING_STATUS)).toHaveClass('truncate', 'min-w-0');
  });

  // Motion is the now-playing equaliser's alone: the dot breathed while every service was up.
  it.each(['operational', 'degraded', 'down', 'unknown'] as const)(
    'keeps the %s dot still',
    (state) => {
      stubStatus(answer(status({ state })));
      const { container } = renderTile(snapshot(status({ state })));

      expect(dot(container)?.className).not.toMatch(/animate/);
    },
  );

  it('counts the monitors after the words only when some are not up', () => {
    stubStatus(answer(status()));
    renderTile(snapshot(status({ state: 'degraded', monitors: { up: 5, total: 6 } })));

    expect(statusLink()).toHaveTextContent(`Degraded${SEP}5/6 up`);
    const count = screen.getByText(/5\/6 up/);
    expect(count).toHaveClass('tabular-nums', 'font-normal', 'text-muted-foreground');
  });

  it.each([
    ['every monitor up', { up: 6, total: 6 }],
    ['no counts', undefined],
    ['no active monitor', { up: 0, total: 0 }],
  ])('prints no count for %s', (_label, monitors) => {
    stubStatus(answer(status()));
    const { container } = renderTile(snapshot(status({ monitors })));

    expect(container.textContent).not.toMatch(/\d+\/\d+/);
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

  it("says 'Monitoring paused' beside an idle, still dot, with no count", () => {
    stubStatus(answer(paused()));
    const { container } = renderTile(snapshot(paused()));

    expect(statusLink()).toHaveTextContent(/^Monitoring paused/);
    expect(screen.queryByText(/All systems up/)).toBeNull();
    expect(dot(container)).toHaveAttribute('data-tone', 'idle');
    expect(dot(container)?.className).not.toMatch(/animate/);
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('says it in the server HTML too (JavaScript off)', () => {
    const markup = renderToString(withClient(<StatusTile initial={snapshot(paused())} />));

    expect(markup).toContain('Monitoring paused');
    expect(markup).not.toContain('All systems up');
    expect(markup).not.toContain('animate');
  });

  it("marks a stale paused answer 'Last known: Monitoring paused'", () => {
    const stale = cachedOnError({ monitors: { up: 0, total: 0 } });
    stubStatus(answer(stale));
    renderTile(snapshot(stale));

    expect(statusLink()).toHaveTextContent('Last known: Monitoring paused');
  });
});

describe('StatusTile last known state', () => {
  it("marks an answer the route flagged stale 'Last known', with its day and time below", () => {
    // As the loader seeds it: fetchedAt is the check's own time, whatever its age.
    const old = cachedOnError({ lastUpdated: '2026-11-05T15:55:00.000Z' });
    stubStatus(answer(old));
    const { container } = renderTile(snapshot(old));

    expect(statusLink()).toHaveTextContent('Last known: All systems up');
    const asOf = screen.getByText('as of Nov 5, 10:55 AM ET');
    expect(asOf).toHaveClass('tile-meta', 'text-muted-foreground');
    expect(linesOf(container)).toEqual([expect.anything(), asOf]);
    expect(rootOf(container)).toHaveAttribute('data-state', 'stale');
    expect(rootOf(container)).toHaveAttribute('data-stale', '');
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
    expect(rootOf(container)).toHaveAttribute('data-state', 'ready');
    expect(rootOf(container)).not.toHaveAttribute('data-stale');
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
    renderTile(snapshot(status({ state: 'degraded', monitors: { up: 5, total: 6 } })));

    await act(() => vi.advanceTimersByTimeAsync(STATUS_POLL_MS));

    await waitFor(() => expect(statusLink()).toHaveTextContent(`Last known: Degraded${SEP}5/6 up`));
    expect(screen.getByText('as of Nov 5, 11:00 AM ET')).toBeInTheDocument();
  });

  it('marks its root stale (data-stale) once a later poll fails, and drops it when one answers', async () => {
    stubStatus(serverError, answer(status()));
    const { container } = renderTile(snapshot(status()));
    expect(rootOf(container)).not.toHaveAttribute('data-stale');

    await act(() => vi.advanceTimersByTimeAsync(STATUS_POLL_MS));
    await waitFor(() => expect(rootOf(container)).toHaveAttribute('data-stale', ''));
    expect(rootOf(container)).toHaveAttribute('data-state', 'stale');

    await act(() => vi.advanceTimersByTimeAsync(STATUS_POLL_MS));
    await waitFor(() => expect(rootOf(container)).not.toHaveAttribute('data-stale'));
    expect(rootOf(container)).toHaveAttribute('data-state', 'ready');
    expect(screen.queryByText(/as of/)).toBeNull();
  });

  it("never calls an unknown state 'last known'", () => {
    const unknown = cachedOnError({ state: 'unknown', lastUpdated: '2026-11-05T15:00:00.000Z' });
    stubStatus(answer(unknown));
    const { container } = renderTile(snapshot(unknown));

    expect(statusLink()).toHaveTextContent(/^Status unavailable/);
    expect(screen.queryByText(/as of/)).toBeNull();
    expect(rootOf(container)).toHaveAttribute('data-state', 'error');
    expect(rootOf(container)).not.toHaveAttribute('data-stale');
  });
});

describe('StatusTile polling', () => {
  it('shows the snapshot without fetching, then polls /api/status once a minute', async () => {
    const fetchMock = stubStatus(answer(status({ state: 'down', monitors: { up: 4, total: 6 } })));
    renderTile(snapshot(status()));

    expect(statusLink()).toHaveTextContent('All systems up');
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(fetchMock).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(STATUS_POLL_MS));

    await waitFor(() => expect(statusLink()).toHaveTextContent(`Outage${SEP}4/6 up`));
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
    const { container } = renderTile({ kind: 'timeout' });

    await waitFor(() => expect(statusLink()).toHaveTextContent('Status unavailable'));
    expect(screen.queryByText(/as of/)).toBeNull();
    expect(rootOf(container)).toHaveAttribute('data-state', 'error');
    expect(rootOf(container)).not.toHaveAttribute('aria-busy');
  });

  it("says 'Status unavailable' for a failed snapshot while it fetches its own answer", async () => {
    stubStatus(answer(status()));
    const { container } = renderTile({ kind: 'error' });

    expect(statusLink()).toHaveTextContent('Status unavailable');
    expect(rootOf(container)).toHaveAttribute('data-state', 'error');
    await waitFor(() => expect(statusLink()).toHaveTextContent('All systems up'));
    expect(rootOf(container)).toHaveAttribute('data-state', 'ready');
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

      await waitFor(() => expect(statusLink()).toHaveTextContent(/^Outage/));
      expect(dot(container)).toHaveAttribute('data-tone', 'down');
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

    expect(statusLink()).toHaveTextContent(/^Outage/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('StatusTile server HTML', () => {
  const html = (initial: LiveInitial<ServiceStatus>) =>
    renderToString(withClient(<StatusTile initial={initial} />));

  it('holds the state and the link, and no count while all is up (JavaScript off)', () => {
    const markup = html(snapshot(status()));

    expect(markup).toContain('All systems up');
    expect(markup).not.toContain('6/6');
    expect(markup).toContain(`href="${STATUS_PAGE_URL}"`);
  });

  it('holds the count when some monitor is down', () => {
    const markup = html(snapshot(status({ state: 'down', monitors: { up: 2, total: 6 } })));

    expect(markup).toContain('Outage');
    expect(markup).toContain('2/6 up');
  });

  it('holds the unavailable copy for a failed snapshot, not a skeleton', () => {
    const markup = html({ kind: 'error' });

    expect(markup).toContain('Status unavailable');
    expect(markup).not.toContain('aria-busy');
    expect(markup).toContain('data-state="error"');
  });

  it("marks the route's stale answer 'Last known' in the server HTML (JavaScript off)", () => {
    const markup = html(snapshot(cachedOnError({ lastUpdated: '2026-11-05T14:00:00.000Z' })));

    expect(markup).toContain('Last known: All systems up');
    expect(markup).toContain('as of Nov 5, 9:00 AM ET');
    expect(markup).not.toContain('animate');
    expect(markup).toContain('data-state="stale"');
    expect(markup).toContain('data-stale=""');
  });

  it('marks a current answer ready, with no data-stale (JavaScript off)', () => {
    const markup = html(snapshot(status()));

    expect(markup).toContain('data-state="ready"');
    expect(markup).not.toContain('data-stale');
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
  it("is busy, says 'Checking status…' beside an idle dot on its one line, and links nowhere", () => {
    const { container } = render(<StatusTileSkeleton />);

    expect(rootOf(container)).toHaveAttribute('aria-busy', 'true');
    expect(rootOf(container)).toHaveAttribute('data-state', 'loading');
    expect(rootOf(container)).not.toHaveAttribute('data-stale');
    expect(screen.getByRole('heading', { level: 2, name: 'Site status' })).toHaveClass('sr-only');
    expect(screen.getByText('Checking status…')).toBeInTheDocument();
    expect(dot(container)).toHaveAttribute('data-tone', 'idle');
    expect(container.querySelector('a')).toBeNull();
  });

  // The tile hugs its line, so the skeleton has the current answer's one line and nothing more.
  it('is the loaded one-line tile: one tile-title line, no placeholder bar', () => {
    const { container } = render(<StatusTileSkeleton />);

    expect(linesOf(container)).toHaveLength(1);
    expect(linesOf(container)[0]).toHaveClass('tile-title');
    expect(container.querySelector('[aria-hidden="true"]:not([data-status-dot])')).toBeNull();
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
    ['operational', { up: 6, total: 6 }, { label: 'All systems up', tone: 'live' }],
    ['degraded', { up: 5, total: 6 }, { label: 'Degraded', count: '5/6 up', tone: 'ongoing' }],
    ['down', { up: 1, total: 6 }, { label: 'Outage', count: '1/6 up', tone: 'down' }],
    ['unknown', undefined, { label: 'Status unavailable', tone: 'idle' }],
  ] as const)('words a current %s answer with %o monitors', (state, monitors, words) => {
    expect(
      serviceStatusView({ data: status({ state, monitors }), isError: false, initialKind: 'data' }),
    ).toEqual({ kind: 'status', ...words, lastKnown: false, unavailable: state === 'unknown' });
  });

  it.each([
    ['the latest poll failed', true, 'timeout'],
    ['the server snapshot failed', false, 'error'],
  ] as const)("is 'Status unavailable' with no data when %s", (_why, isError, initialKind) => {
    expect(serviceStatusView({ data: undefined, isError, initialKind })).toEqual({
      kind: 'status',
      label: 'Status unavailable',
      tone: 'idle',
      lastKnown: false,
      unavailable: true,
    });
  });

  it('says a stale answer is the last known one, with when it was checked', () => {
    expect(
      serviceStatusView({
        data: cachedOnError({ lastUpdated: '2026-11-05T15:55:00.000Z' }),
        isError: false,
        initialKind: 'data',
      }),
    ).toEqual({
      kind: 'status',
      label: 'Last known: All systems up',
      tone: 'live',
      lastKnown: true,
      unavailable: false,
      asOf: 'as of Nov 5, 10:55 AM ET',
    });
  });

  it('prints no time for a last known answer with an unreadable lastUpdated', () => {
    const view = serviceStatusView({
      data: status({ lastUpdated: 'yesterday' }),
      isError: true,
      initialKind: 'data',
    });

    expect(view).toMatchObject({ kind: 'status', label: 'Last known: All systems up' });
    expect(view).not.toHaveProperty('asOf');
  });
});
