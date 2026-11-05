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
 * @file The /stats Dev Stats and Monkeytype cards. /api/v1/google, /api/v1/wakatime and the
 * Monkeytype profile API are answered by a stubbed fetch, so the cards' real fetchers, schemas
 * and query wiring (shared with the server prefetch, in stats/_lib/stats-queries) run. Labels
 * must name the time frame behind each number. A failed source says so in its card, with Try
 * again, rather than showing a made-up 0 or leaving the card out.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

// Try again also refreshes the route, which re-runs the server prefetch.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

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
// The ticker animates its text in after scrolling into view; these tests read the value directly.
vi.mock('@/components/ui/number-ticker', () => {
  const Ticker = ({ value, className }: { value: number; className?: string }) => (
    <span className={className}>{value}</span>
  );
  return { default: Ticker, NumberTicker: Ticker };
});

import { DevStats, DevStatsSkeleton } from '@/app/(routes)/(dev)/stats/_components/stats';
import {
  monkeytypeQuery,
  pageViewsQuery,
  wakatimeQuery,
} from '@/app/(routes)/(dev)/stats/_lib/stats-queries';

const DEV_STATS_ERROR = "Couldn't load dev stats";
const MONKEYTYPE_ERROR = "Couldn't load Monkeytype stats";
const PAGE_VIEWS = 'Page views (30 days)';
const HOURS_CODED = 'Hours coded (all time)';
const PB_CAPTION = 'WPM and accuracy: 60 s personal best';
const MONKEYTYPE_PATH = '/users/WomB0ComB0/profile';

const wakatime = {
  text: '343 hrs',
  digital: '342:56',
  decimal: '342.94',
  total_seconds: 1_234_567,
};
const monkeytype = {
  data: {
    personalBests: {
      time: {
        '60': [
          { wpm: 98.4, acc: 97.1 },
          { wpm: 112.7, acc: 94.2 },
        ],
      },
    },
    typingStats: { completedTests: 812 },
  },
};

type Reply = { status: number; body: unknown };
/** One reply per endpoint, or a sequence: each request gets the next, the last one from then on. */
type Replies = {
  google: Reply | readonly Reply[];
  wakatime: Reply | readonly Reply[];
  monkeytype: Reply | readonly Reply[];
};

const ok = (body: unknown): Reply => ({ status: 200, body });
const goodReplies: Replies = {
  google: ok({ total_pageviews: 266 }),
  wakatime: ok(wakatime),
  monkeytype: ok(monkeytype),
};

const requestedPaths: string[] = [];

const nth = (replies: Reply | readonly Reply[], index: number): Reply => {
  const sequence: readonly Reply[] = 'status' in replies ? [replies] : replies;
  const reply = sequence[Math.min(index, sequence.length - 1)];
  if (!reply) throw new Error('no reply configured');
  return reply;
};

/** The reply for this request, counting the earlier requests to the same path. */
const replyFor = (pathname: string, replies: Replies): Reply => {
  const index = requestedPaths.filter((path) => path === pathname).length - 1;
  if (pathname === '/api/v1/google') return nth(replies.google, index);
  if (pathname === '/api/v1/wakatime') return nth(replies.wakatime, index);
  if (pathname === MONKEYTYPE_PATH) return nth(replies.monkeytype, index);
  throw new Error(`unexpected request: ${pathname}`);
};

/** Answers the three endpoints the cards read; anything else is a test bug. */
const stubApis = (replies: Replies) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
      requestedPaths.push(url.pathname);
      const { status, body } = replyFor(url.pathname, replies);
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
};

const renderCards = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <DevStats />
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
};

/** The value rendered above a Dev Stats label. */
const valueAbove = (label: string) => screen.getByText(label).parentElement;

/** The icon drawn above a Dev Stats label. */
const iconAbove = (label: string) => {
  const icon = valueAbove(label)?.querySelector('svg');
  if (!icon) throw new Error(`no icon above ${label}`);
  return icon;
};

/** SVGs outside any aria-hidden subtree, which assistive tech can announce as unnamed images. */
const exposedSvgs = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('svg')).filter((svg) => !svg.closest('[aria-hidden="true"]'));

const STAT_LABELS = ['Age', PAGE_VIEWS, HOURS_CODED];

/** A day the age is 21: after the March 24 birthday in 2025. */
const A_DAY_AGED_21 = '2025-06-01T12:00:00Z';

/**
 * The card works out the age from the clock when it renders. Only Date is faked, so the
 * fetches, retries and waits below still run on real timers.
 */
const setClock = (iso: string) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
};

beforeEach(() => {
  requestedPaths.length = 0;
  setClock(A_DAY_AGED_21);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  refresh.mockClear();
});

const requestsTo = (path: string) => requestedPaths.filter((requested) => requested === path);

/** A client holding all three cards' data, as the server prefetch leaves it. */
const prefetchedClient = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(pageViewsQuery.queryKey, { total_pageviews: 266 });
  queryClient.setQueryData(wakatimeQuery.queryKey, wakatime);
  queryClient.setQueryData(monkeytypeQuery.queryKey, monkeytype.data);
  return queryClient;
};

describe('Dev Stats card', () => {
  it('labels page views as the last 30 days and hours as all time, while loading too', async () => {
    stubApis(goodReplies);
    renderCards();

    // The skeleton carries the same labels as the loaded card.
    expect(screen.getByText(PAGE_VIEWS)).toBeInTheDocument();
    expect(screen.getByText(HOURS_CODED)).toBeInTheDocument();

    await screen.findByText('266');
    expect(valueAbove(PAGE_VIEWS)).toHaveTextContent('266');
    expect(valueAbove(HOURS_CODED)).toHaveTextContent('343');
    expect(valueAbove('Age')).toHaveTextContent('21yrs');
    expect(screen.queryByText('Site Views')).not.toBeInTheDocument();
    expect(screen.queryByText('Hours Coded')).not.toBeInTheDocument();
  });

  it('hides its decorative icons from assistive tech, while loading too', async () => {
    stubApis(goodReplies);
    const { container } = renderCards();

    const expectIconsHidden = () => {
      for (const label of STAT_LABELS) {
        expect(iconAbove(label).parentElement).toHaveAttribute('aria-hidden', 'true');
      }
      expect(exposedSvgs(container)).toEqual([]);
    };

    expectIconsHidden();
    await screen.findByText('266');
    await screen.findByText('112.7');
    expectIconsHidden();
  });

  it('asks a failing endpoint once and leaves retrying to TanStack Query', async () => {
    stubApis({ ...goodReplies, google: { status: 500, body: { error: 'GA is down' } } });
    const { queryClient } = renderCards();

    await waitFor(() => expect(queryClient.getQueryState(['google'])?.status).toBe('error'));
    expect(requestedPaths.filter((path) => path === '/api/v1/google')).toHaveLength(1);
  });

  it('says it could not load the stats, rather than showing 0 page views, when GA fails', async () => {
    stubApis({ ...goodReplies, google: { status: 500, body: { error: 'GA is down' } } });
    renderCards();

    expect(await screen.findByRole('heading', { level: 2, name: DEV_STATS_ERROR })).toBeVisible();
    expect(screen.queryByText(PAGE_VIEWS)).not.toBeInTheDocument();
    expect(screen.queryByText(/GA is down|500/)).not.toBeInTheDocument();
    // The Monkeytype card below is a separate source and still renders.
    expect(await screen.findByText('112.7')).toBeInTheDocument();
  });

  it('fetches only the failed source again on Try again, then shows the card', async () => {
    stubApis({
      ...goodReplies,
      google: [{ status: 500, body: { error: 'GA is down' } }, ok({ total_pageviews: 266 })],
    });
    renderCards();

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('266')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: DEV_STATS_ERROR })).not.toBeInTheDocument();
    expect(requestsTo('/api/v1/google')).toHaveLength(2);
    expect(requestsTo('/api/v1/wakatime')).toHaveLength(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('renders prefetched data on the first render, from the shared query keys, without fetching', () => {
    stubApis(goodReplies);
    render(
      <QueryClientProvider client={prefetchedClient()}>
        <DevStats />
      </QueryClientProvider>,
    );

    expect(valueAbove(PAGE_VIEWS)).toHaveTextContent('266');
    expect(valueAbove(HOURS_CODED)).toHaveTextContent('343');
    expect(screen.getByText('112.7')).toBeInTheDocument();
    expect(requestedPaths).toEqual([]);
  });
});

describe('Dev Stats age', () => {
  const renderPrefetched = () =>
    render(
      <QueryClientProvider client={prefetchedClient()}>
        <DevStats />
      </QueryClientProvider>,
    );

  it('shows the age on the day the card renders, not the day its module loaded', () => {
    setClock('2026-03-23T23:59:59Z');
    renderPrefetched();
    expect(valueAbove('Age')).toHaveTextContent('21yrs');
    cleanup();

    setClock('2026-03-24T00:00:00Z');
    renderPrefetched();
    expect(valueAbove('Age')).toHaveTextContent('22yrs');
  });

  it('server-renders the age the hydrating browser computes, so hydration does not mismatch', async () => {
    const tree = () => (
      <QueryClientProvider client={prefetchedClient()}>
        <DevStats />
      </QueryClientProvider>
    );
    const originalZone = process.env.TZ;
    try {
      // The server runs in UTC, a few hours into the birthday, which is still March 23 in New York.
      process.env.TZ = 'UTC';
      setClock('2026-03-24T02:00:00Z');
      const page = document.createElement('div');
      page.innerHTML = renderToString(tree());
      document.body.append(page);
      expect(valueAbove('Age')).toHaveTextContent('22yrs');

      // A browser in New York hydrates a few seconds later. An age from local dates would read 21
      // here, and React would report the mismatch.
      process.env.TZ = 'America/New_York';
      setClock('2026-03-24T02:00:05Z');
      const onRecoverableError = vi.fn();
      const root = await act(async () => hydrateRoot(page, tree(), { onRecoverableError }));

      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(valueAbove('Age')).toHaveTextContent('22yrs');
      act(() => root.unmount());
      page.remove();
    } finally {
      if (originalZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalZone;
    }
  });
});

describe('DevStatsSkeleton', () => {
  it('has the Dev Stats and Monkeytype card frames, with the same labels as the loaded cards', () => {
    const { container } = render(<DevStatsSkeleton />);

    expect(screen.getByRole('heading', { level: 2, name: 'Dev Stats' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Monkeytype Stats' })).toBeInTheDocument();
    expect(screen.getByText(PAGE_VIEWS)).toBeInTheDocument();
    expect(screen.getByText(PB_CAPTION)).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});

describe('Monkeytype card', () => {
  it('shows the best 60 s personal best and says so', async () => {
    stubApis(goodReplies);
    renderCards();

    expect(await screen.findByText('112.7')).toBeInTheDocument();
    expect(screen.getByText('94%')).toBeInTheDocument();
    expect(screen.getByText(PB_CAPTION)).toBeInTheDocument();
    expect(screen.getByText('812')).toBeInTheDocument();
  });

  it('asks the Monkeytype API once when it fails', async () => {
    stubApis({ ...goodReplies, monkeytype: { status: 503, body: { message: 'down' } } });
    const { queryClient } = renderCards();

    await waitFor(() =>
      expect(queryClient.getQueryState(['monkeytype-stats'])?.status).toBe('error'),
    );
    expect(requestedPaths.filter((path) => path === MONKEYTYPE_PATH)).toHaveLength(1);
    expect(screen.queryByText(PB_CAPTION)).not.toBeInTheDocument();
  });

  it('says it could not load the typing stats, with Try again, and fetches again on it', async () => {
    stubApis({
      ...goodReplies,
      monkeytype: [{ status: 503, body: { message: 'down' } }, ok(monkeytype)],
    });
    renderCards();

    expect(await screen.findByRole('heading', { level: 2, name: MONKEYTYPE_ERROR })).toBeVisible();
    // The Dev Stats card above is a separate source and still renders.
    expect(await screen.findByText('266')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('112.7')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: MONKEYTYPE_ERROR })).not.toBeInTheDocument();
    expect(requestsTo(MONKEYTYPE_PATH)).toHaveLength(2);
  });

  it('server-renders the accuracy ring at rest on its value, so hydrating it does not redraw it', () => {
    const page = document.createElement('div');
    page.innerHTML = renderToString(
      <QueryClientProvider client={prefetchedClient()}>
        <DevStats />
      </QueryClientProvider>,
    );
    const ring = page.querySelector('circle[stroke-linecap="round"]');
    const styleOffset = /stroke-dashoffset:\s*([\d.]+)/.exec(
      ring?.getAttribute('style') ?? '',
    )?.[1];
    // motion writes the value an animation starts from as the attribute.
    const startOffset = ring?.getAttribute('stroke-dashoffset');

    // 94.2% accuracy: 5.8% of the 2 * pi * 32 circumference is left undrawn.
    const restingOffset = 2 * Math.PI * 32 * 0.058;
    expect(Number(styleOffset)).toBeCloseTo(restingOffset, 1);
    expect(Number(startOffset)).toBeCloseTo(restingOffset, 1);
  });
});
