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
 * @file The /stats LeetCode card. /api/v1/leetcode is answered by a stubbed fetch, so the card's
 * real fetcher, schema and query wiring run. A failed or malformed answer must leave the card out
 * rather than throw while rendering, which with no error boundary takes down the whole page.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { LeetCodeStats } from '@/app/(routes)/(dev)/stats/_components/leetcode-stats';

const QUERY_KEY = ['leetcode-stats'];
const CARD_TITLE = 'LeetCode Stats';

const stats = {
  totalSolved: 520,
  easySolved: 200,
  mediumSolved: 260,
  hardSolved: 60,
  acceptanceRate: 73.46,
  ranking: 103_562,
};

type Reply = { status: number; body: unknown };

const requestedPaths: string[] = [];

/** Answers /api/v1/leetcode; anything else is a test bug. */
const stubLeetCode = (reply: Reply) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
      requestedPaths.push(url.pathname);
      if (url.pathname !== '/api/v1/leetcode') {
        throw new Error(`unexpected request: ${url.pathname}`);
      }
      return new Response(JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
};

const renderCard = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <LeetCodeStats />
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
};

/** The moving fill inside a breakdown row's rounded track. */
const fillFor = (label: string): HTMLElement => {
  const row = screen.getByText(label).parentElement;
  const fill = row?.querySelector('.overflow-hidden > div');
  if (!(fill instanceof HTMLElement)) throw new Error(`no progress fill in the ${label} row`);
  return fill;
};

const settledAsError = (queryClient: QueryClient) =>
  waitFor(() => expect(queryClient.getQueryState(QUERY_KEY)?.status).toBe('error'));

beforeEach(() => {
  requestedPaths.length = 0;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LeetCode card', () => {
  it('shows the acceptance rate to one decimal and the global rank', async () => {
    stubLeetCode({ status: 200, body: stats });
    renderCard();

    expect(await screen.findByText('73.5%')).toBeInTheDocument();
    const rank = screen.getByText('Global rank');
    expect(rank.parentElement).toHaveTextContent('#103,562');
    expect(rank.closest('.grid')).toHaveClass('sm:grid-cols-2');
    // A global rank is not a top-N bracket.
    expect(screen.queryByText(/Top\s/)).not.toBeInTheDocument();
    expect(screen.getByText('Total Solved')).toBeInTheDocument();
    expect(screen.getByText('520')).toBeInTheDocument();
  });

  it('leaves the rank out, and the summary one column, when LeetCode has no ranking', async () => {
    stubLeetCode({ status: 200, body: { ...stats, ranking: 0 } });
    renderCard();

    const acceptance = await screen.findByText('Acceptance');
    expect(screen.getByText('73.5%')).toBeInTheDocument();
    expect(screen.queryByText('Global rank')).not.toBeInTheDocument();
    expect(screen.queryByText(/#0\b/)).not.toBeInTheDocument();
    // A lone cell in a two-column row would sit off-centre.
    expect(acceptance.closest('.grid')).not.toHaveClass('sm:grid-cols-2');
  });

  it('says the profile link opens a new tab', async () => {
    stubLeetCode({ status: 200, body: stats });
    renderCard();

    // dom-accessibility-api trims the sr-only span's leading space; browsers keep it.
    const link = await screen.findByRole('link', {
      name: /^View Profile ?\(opens in a new tab\)$/,
    });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('href', 'https://leetcode.com/WomB0ComB0/');
  });

  it('leaves the card out, without throwing, when the API answers 500', async () => {
    stubLeetCode({ status: 500, body: { error: 'Failed to fetch LeetCode stats' } });
    const { container, queryClient } = renderCard();

    await settledAsError(queryClient);
    expect(screen.queryByText(CARD_TITLE)).not.toBeInTheDocument();
    expect(screen.queryByText('Total Solved')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
    // TanStack Query owns retries; the fetcher asks once.
    expect(requestedPaths).toEqual(['/api/v1/leetcode']);
  });

  it('leaves the card out when a 200 answer does not match the stats shape', async () => {
    stubLeetCode({ status: 200, body: { ...stats, acceptanceRate: 'n/a' } });
    const { container, queryClient } = renderCard();

    await settledAsError(queryClient);
    expect(screen.queryByText(CARD_TITLE)).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});

describe('LeetCode progress bars', () => {
  // Jump every animation to its target, so the fill's resting transform can be read.
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false;
  });

  it('slide each fill in from the left rather than scaling it, keeping its rounded end', async () => {
    stubLeetCode({ status: 200, body: stats });
    renderCard();
    await screen.findByText('Easy');

    // Easy is 200 of 520 solved, so its fill rests (200 / 520 - 1) * 100 = -61.54% off its track.
    await waitFor(() =>
      expect(fillFor('Easy').style.transform).toMatch(/^translateX\(-61\.53\d*%\)$/),
    );
    // Hard is 60 of 520: -88.46%.
    expect(fillFor('Hard').style.transform).toMatch(/^translateX\(-88\.46\d*%\)$/);
    expect(fillFor('Medium').style.transform).not.toMatch(/scale/);
  });
});
