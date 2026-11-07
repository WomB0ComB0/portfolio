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
 * @file The footer's StatusBadge says a state in the home status tile's words ('All systems up',
 * 'Degraded · 3/4 up'), and its dot never moves: the home page's one moving thing is the
 * now-playing equaliser. /api/status counts the active monitors; when none is active (every
 * monitor paused) Better Stack still reports 'operational', so the badge must say 'Monitoring
 * paused' with the neutral dot rather than 'All systems up'. Before any answer it says 'Checking
 * status…', as the tile does; 'Status unavailable' only when the check failed with no answer or
 * the route could not say. An answer the route flagged stale (its cached one, after Better Stack
 * failed), or one kept after a later poll failed, says 'Last known: ...', exactly as the tile does.
 * The link's name and its title are the same words in every state. The query cache is seeded, or
 * fetch stubbed where the decoding or a failure is checked.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { serviceStatusView } from '@/app/_components/home/live/status-tile';
import { StatusBadge, statusBadgeView } from '@/components/custom/status-badge';
import { CHECKING_STATUS, statusSentence } from '@/lib/status/service-state';

// t3-env validates on import (through the Effect fetcher); these tests need no configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

const LAST_UPDATED = '2026-11-05T14:00:00.000Z';

afterEach(() => {
  vi.unstubAllGlobals();
});

type Answer = NonNullable<Parameters<typeof statusBadgeView>[0]>;

const envelope = (data: Answer) => ({ success: true, message: 'ok', data });
const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const serverError = () => jsonResponse({ success: false, message: 'x', error: 'x' }, 500);

const testClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

/** The badge under a client; `seed` is an answer already cached, `ageMs` how old it is. */
function mountBadge(seed?: Answer, ageMs = 0) {
  const client = testClient();
  if (seed) {
    client.setQueryData(['system-status'], envelope(seed), { updatedAt: Date.now() - ageMs });
  }
  render(
    <QueryClientProvider client={client}>
      <StatusBadge />
    </QueryClientProvider>,
  );
  return screen.getByRole('link');
}

/** A cached answer, current, so the badge fetches nothing on mount. */
const renderBadge = (data: Answer) => mountBadge(data);

/** Answers /api/status with each response in turn (the last one repeats). */
function stubStatus(...responses: (() => Response | Promise<Response>)[]) {
  let call = 0;
  const fetchMock = vi.fn(async () => {
    const respond = responses[Math.min(call, responses.length - 1)];
    call += 1;
    if (!respond) throw new Error('no response stubbed');
    return respond();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The link's name and its title: always the same words. */
function expectWords(link: HTMLElement, words: string) {
  expect(link).toHaveAccessibleName(words);
  expect(link).toHaveAttribute('title', words);
}

/** Older than the badge's one-minute staleTime, so it asks again on mount. */
const OLD_MS = 2 * 60_000;

/** The home status tile's separator between a state and its count: a no-break space, then '· '. */
const SEP = ' · ';

describe('statusBadgeView', () => {
  it('says Monitoring paused, with the neutral dot, when no monitor is active', () => {
    expect(
      statusBadgeView({
        state: 'operational',
        lastUpdated: LAST_UPDATED,
        monitors: { up: 0, total: 0 },
      }),
    ).toEqual({ label: 'Monitoring paused', color: 'bg-zinc-400' });
  });

  // The tile's words, in sentence case: 'All Systems Operational' and 'Service Outage' are gone.
  it.each([
    ['operational', { up: 3, total: 3 }, 'All systems up', 'bg-emerald-500'],
    ['operational', undefined, 'All systems up', 'bg-emerald-500'],
    ['degraded', { up: 1, total: 2 }, `Degraded${SEP}1/2 up`, 'bg-amber-500'],
    ['down', { up: 0, total: 2 }, `Outage${SEP}0/2 up`, 'bg-red-500'],
    ['unknown', undefined, 'Status unavailable', 'bg-zinc-400'],
  ] as const)(
    'says the %s state with %o monitors as the tile does',
    (state, monitors, label, color) => {
      expect(statusBadgeView({ state, lastUpdated: LAST_UPDATED, monitors })).toEqual({
        label,
        color,
      });
    },
  );

  // Loading is no failure: the tile says 'Checking status…' then, and so does the badge.
  it("says 'Checking status…' before any answer, with the neutral dot", () => {
    expect(statusBadgeView(undefined)).toEqual({ label: CHECKING_STATUS, color: 'bg-zinc-400' });
    expect(statusBadgeView(undefined, false)).toEqual({
      label: 'Checking status…',
      color: 'bg-zinc-400',
    });
  });

  it("says 'Status unavailable' only once the check failed with no answer", () => {
    expect(statusBadgeView(undefined, true)).toEqual({
      label: 'Status unavailable',
      color: 'bg-zinc-400',
    });
  });

  it.each([
    ['operational', { up: 3, total: 3 }, 'Last known: All systems up', 'bg-emerald-500'],
    ['degraded', { up: 3, total: 4 }, `Last known: Degraded${SEP}3/4 up`, 'bg-amber-500'],
    ['down', { up: 1, total: 2 }, `Last known: Outage${SEP}1/2 up`, 'bg-red-500'],
    ['operational', { up: 0, total: 0 }, 'Last known: Monitoring paused', 'bg-zinc-400'],
  ] as const)(
    'says a %s answer (%o monitors) kept after a later poll failed is the last known one',
    (state, monitors, label, color) => {
      expect(statusBadgeView({ state, lastUpdated: LAST_UPDATED, monitors }, true)).toEqual({
        label,
        color,
      });
    },
  );

  it('says an unknown answer is unavailable whether or not a later poll failed', () => {
    expect(statusBadgeView({ state: 'unknown', lastUpdated: LAST_UPDATED }, true)).toEqual({
      label: 'Status unavailable',
      color: 'bg-zinc-400',
    });
  });

  // The tile is the reference: for every answer, failure and flag, the badge's words are its.
  describe('words every case as the home status tile does', () => {
    const answers: readonly (Answer | undefined)[] = [
      undefined,
      ...(['operational', 'degraded', 'down', 'unknown'] as const).flatMap((state) =>
        [undefined, { up: 4, total: 4 }, { up: 2, total: 4 }, { up: 0, total: 0 }].flatMap(
          (monitors) =>
            [false, true].map((stale) => ({ state, lastUpdated: LAST_UPDATED, monitors, stale })),
        ),
      ),
    ];
    const nameOf = (data: Answer | undefined) =>
      data
        ? `${data.state}, monitors ${data.monitors ? `${data.monitors.up}/${data.monitors.total}` : 'none'}, stale ${data.stale}`
        : 'no answer';
    const cases = answers.flatMap((data) =>
      [false, true].map((isError) => [nameOf(data), data, isError] as const),
    );

    it.each(cases)('%s, poll failed %s', (_name, data, isError) => {
      const view = serviceStatusView({ data, isError, initialKind: 'timeout' });
      const tileWords = view.kind === 'loading' ? CHECKING_STATUS : statusSentence(view);
      expect(statusBadgeView(data, isError).label).toBe(tileWords);
    });
  });

  it.each([
    ['operational', { up: 3, total: 3 }, 'Last known: All systems up', 'bg-emerald-500'],
    ['down', { up: 1, total: 2 }, `Last known: Outage${SEP}1/2 up`, 'bg-red-500'],
    ['operational', { up: 0, total: 0 }, 'Last known: Monitoring paused', 'bg-zinc-400'],
  ] as const)(
    'says a stale %s answer (%o monitors) is the last known one',
    (state, monitors, label, color) => {
      expect(statusBadgeView({ state, lastUpdated: LAST_UPDATED, monitors, stale: true })).toEqual({
        label,
        color,
      });
    },
  );

  it('never calls an unknown state last known', () => {
    expect(
      statusBadgeView({ state: 'unknown', lastUpdated: LAST_UPDATED, stale: true }),
    ).toMatchObject({ label: 'Status unavailable' });
  });
});

describe('StatusBadge before and without an answer', () => {
  it("names the link 'Checking status…', and titles it so, while the first check runs", () => {
    stubStatus(() => new Promise<Response>(() => {}));
    const link = mountBadge();

    expectWords(link, 'Checking status…');
    expect(link.querySelector('[aria-hidden="true"]')).toHaveClass('bg-zinc-400');
  });

  // No query seeds the badge, so this is every page's server HTML, and the page with JS off.
  it("says 'Checking status…' in the server HTML, never 'Status unavailable'", () => {
    const markup = renderToString(
      <QueryClientProvider client={testClient()}>
        <StatusBadge />
      </QueryClientProvider>,
    );

    expect(markup).toContain('aria-label="Checking status…"');
    expect(markup).toContain('title="Checking status…"');
    expect(markup).not.toContain('Status unavailable');
  });

  it.each([
    ['answers 500', serverError],
    [
      'is unreachable',
      () => {
        throw new TypeError('Failed to fetch');
      },
    ],
  ])("says 'Status unavailable' once the route %s and there is no answer", async (_how, fail) => {
    stubStatus(fail);
    const link = mountBadge();

    await waitFor(() => expect(link).toHaveAccessibleName('Status unavailable'));
    expectWords(link, 'Status unavailable');
  });

  it("says 'Status unavailable' when the route answers unknown", () => {
    const link = renderBadge({ state: 'unknown', lastUpdated: LAST_UPDATED });

    expectWords(link, 'Status unavailable');
  });
});

describe('StatusBadge last known answers', () => {
  it("keeps the last answer as 'Last known' when a later poll fails, as the tile does", async () => {
    const fetchMock = stubStatus(serverError);
    const link = mountBadge(
      { state: 'degraded', lastUpdated: LAST_UPDATED, monitors: { up: 3, total: 4 } },
      OLD_MS,
    );
    expectWords(link, `Degraded${SEP}3/4 up`);

    await waitFor(() => expect(link).toHaveAccessibleName(`Last known: Degraded${SEP}3/4 up`));
    expectWords(link, `Last known: Degraded${SEP}3/4 up`);
    expect(link.querySelector('[aria-hidden="true"]')).toHaveClass('bg-amber-500');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("drops 'Last known' once a later poll answers again", async () => {
    stubStatus(() =>
      jsonResponse(
        envelope({
          state: 'operational',
          lastUpdated: LAST_UPDATED,
          monitors: { up: 3, total: 3 },
        }),
      ),
    );
    const link = mountBadge(
      {
        state: 'operational',
        lastUpdated: LAST_UPDATED,
        monitors: { up: 3, total: 3 },
        stale: true,
      },
      OLD_MS,
    );
    expectWords(link, 'Last known: All systems up');

    await waitFor(() => expect(link).toHaveAccessibleName('All systems up'));
    expectWords(link, 'All systems up');
  });

  it.each([
    ['operational', { up: 3, total: 3 }, 'Last known: All systems up'],
    ['down', { up: 1, total: 2 }, `Last known: Outage${SEP}1/2 up`],
    ['operational', { up: 0, total: 0 }, 'Last known: Monitoring paused'],
  ] as const)("names and titles a stale %s answer (%o) '%s'", (state, monitors, words) => {
    expectWords(renderBadge({ state, lastUpdated: LAST_UPDATED, monitors, stale: true }), words);
  });
});

describe('StatusBadge', () => {
  it.each([
    ['operational', { up: 3, total: 3 }, 'All systems up'],
    ['operational', undefined, 'All systems up'],
    ['degraded', { up: 3, total: 4 }, `Degraded${SEP}3/4 up`],
    ['down', { up: 0, total: 2 }, `Outage${SEP}0/2 up`],
    ['operational', { up: 0, total: 0 }, 'Monitoring paused'],
  ] as const)(
    'names and titles a current %s answer (%o) in its words',
    (state, monitors, words) => {
      expectWords(renderBadge({ state, lastUpdated: LAST_UPDATED, monitors }), words);
    },
  );

  it('names the link Monitoring paused, with a still dot, when every monitor is paused', () => {
    const link = renderBadge({
      state: 'operational',
      lastUpdated: LAST_UPDATED,
      monitors: { up: 0, total: 0 },
    });

    expect(link).toHaveAccessibleName('Monitoring paused');
    expect(link.querySelector('[aria-hidden="true"]')?.className).not.toMatch(/animate/);
  });

  it('decodes the monitor counts and the stale flag /api/status answers', async () => {
    const body = {
      success: true,
      message: 'Status retrieved successfully',
      data: {
        state: 'operational',
        lastUpdated: LAST_UPDATED,
        monitors: { up: 3, total: 3 },
        stale: true,
      },
    };
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <StatusBadge />
      </QueryClientProvider>,
    );

    const link = screen.getByRole('link');
    await waitFor(() => expect(link).toHaveAccessibleName('Last known: All systems up'));
    expectWords(link, 'Last known: All systems up');
    expect(link.querySelector('[aria-hidden="true"]')?.className).not.toMatch(/animate/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('decodes the monitor counts, so every monitor paused reads Monitoring paused', async () => {
    const body = {
      success: true,
      message: 'Status retrieved successfully',
      data: { state: 'operational', lastUpdated: LAST_UPDATED, monitors: { up: 0, total: 0 } },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
      ),
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <StatusBadge />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByRole('link')).toHaveAccessibleName('Monitoring paused'));
  });

  // It pulsed while every monitor was up. Motion is the now-playing equaliser's alone.
  it('keeps its dot still beside All systems up, when every monitor is up', () => {
    const link = renderBadge({
      state: 'operational',
      lastUpdated: LAST_UPDATED,
      monitors: { up: 3, total: 3 },
    });

    expect(link).toHaveAccessibleName('All systems up');
    const dot = link.querySelector('[aria-hidden="true"]');
    expect(dot).toHaveClass('bg-emerald-500');
    expect(dot?.className).not.toMatch(/animate/);
  });

  it('names the link with the count when some monitor is not up', () => {
    const link = renderBadge({
      state: 'degraded',
      lastUpdated: LAST_UPDATED,
      monitors: { up: 3, total: 4 },
    });

    expect(link).toHaveAccessibleName(`Degraded${SEP}3/4 up`);
    expect(link).toHaveAttribute('title', `Degraded${SEP}3/4 up`);
  });
});
