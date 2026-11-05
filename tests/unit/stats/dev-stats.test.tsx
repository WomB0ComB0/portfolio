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
 * and query wiring run. Labels must name the time frame behind each number.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
// The real age depends on today's date.
vi.mock('@/constants', () => ({ age: 21 }));

import { DevStats } from '@/app/(routes)/(dev)/stats/_components/stats';

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
type Replies = { google: Reply; wakatime: Reply; monkeytype: Reply };

const ok = (body: unknown): Reply => ({ status: 200, body });
const goodReplies: Replies = {
  google: ok({ total_pageviews: 266 }),
  wakatime: ok(wakatime),
  monkeytype: ok(monkeytype),
};

const requestedPaths: string[] = [];

const replyFor = (pathname: string, replies: Replies): Reply => {
  if (pathname === '/api/v1/google') return replies.google;
  if (pathname === '/api/v1/wakatime') return replies.wakatime;
  if (pathname === MONKEYTYPE_PATH) return replies.monkeytype;
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

beforeEach(() => {
  requestedPaths.length = 0;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
});
