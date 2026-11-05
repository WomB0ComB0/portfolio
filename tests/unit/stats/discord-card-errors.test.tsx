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
 * @file A Lanyard failure stays inside the /stats Discord card. With the browser's two attempts,
 * a failed first load used to throw out of the card (useSuspenseQuery throws when it has no
 * data) to src/app/error.tsx, replacing the whole page; and one failed 30 s poll replaced a live
 * card with the error message. The card runs as in production: the real <Discord/>, the real
 * createQueryClient()(), and no boundary of the test's own around the card. PageErrorBoundary
 * stands in for src/app/error.tsx.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
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
// The shared queue rate-limits and deduplicates across tests; run each request directly.
vi.mock('@/lib/http-clients/request-queue', () => ({
  requestQueue: {
    enqueue: <T,>(_url: string, _method: string, run: () => Promise<T>) => run(),
  },
}));

import { Discord } from '@/app/(routes)/(dev)/stats/_components/discord';
import { createQueryClient } from '@/providers/server/query-client';

const ERROR_CARD = 'Failed to load Discord status.';
const PAGE_ERROR = 'the whole page failed';
const SIBLING = 'GitHub card';
/** DataLoader's key for the card's query starts with these. */
const LANYARD_KEY = ['dataloader', '/api/v1/lanyard'];

const lanyard = {
  discord_user: { username: 'tester', discriminator: '0', avatar: 'abc123', id: '42' },
  activities: [],
  discord_status: 'online',
};

/** Stands in for src/app/error.tsx: an error that escapes a card replaces the whole page. */
class PageErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  render() {
    return this.state.crashed ? <p>{PAGE_ERROR}</p> : this.props.children;
  }
}

/** The production client, with only the retry delay shortened; whether to retry is unchanged. */
const productionClient = () => {
  const client = createQueryClient()();
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, retryDelay: 1 } });
  return client;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Every /api/v1/lanyard request made in the current test. */
const lanyardRequests: string[] = [];

/** Answers /api/v1/lanyard with `status` (the route's own 500 body when failing). */
const stubLanyard = (status: number) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
      if (url.pathname === '/api/v1/lanyard') {
        lanyardRequests.push(url.pathname);
        return status === 200
          ? json(200, lanyard)
          : json(status, { error: 'Failed to fetch Lanyard data' });
      }
      // No listening activity in Discord, so the card asks Spotify; nothing is playing.
      if (url.pathname === '/api/v1/now-playing') return json(200, { isPlaying: false });
      throw new Error(`unexpected request: ${url.pathname}`);
    }),
  );
};

const renderStatsPage = (client = productionClient()) =>
  render(
    <QueryClientProvider client={client}>
      <PageErrorBoundary>
        <Discord />
        <p>{SIBLING}</p>
      </PageErrorBoundary>
    </QueryClientProvider>,
  );

const discordCard = () => screen.getByRole('region', { name: 'Discord Status' });

beforeEach(() => {
  lanyardRequests.length = 0;
  // React and the QueryCache log the expected failures on console.error.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Discord card when Lanyard fails', () => {
  it('shows the error inside the card on a failed first load, and the page stays', async () => {
    stubLanyard(500);
    renderStatsPage();

    expect(await screen.findByText(ERROR_CARD)).toBeInTheDocument();
    expect(within(discordCard()).getByText(ERROR_CARD)).toBeInTheDocument();
    expect(screen.getByText(SIBLING)).toBeInTheDocument();
    expect(screen.queryByText(PAGE_ERROR)).not.toBeInTheDocument();
    // One attempt and the QueryClient's one retry.
    expect(lanyardRequests).toHaveLength(2);
  });

  it("loads again from the error card's Try again button", async () => {
    stubLanyard(500);
    renderStatsPage();
    await screen.findByText(ERROR_CARD);

    stubLanyard(200);
    fireEvent.click(within(discordCard()).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('tester')).toBeInTheDocument();
    expect(screen.queryByText(ERROR_CARD)).not.toBeInTheDocument();
    expect(lanyardRequests).toHaveLength(3);
  });

  it('keeps showing the loaded status when a background refetch fails', async () => {
    const client = productionClient();
    stubLanyard(200);
    renderStatsPage(client);
    expect(await screen.findByText('tester')).toBeInTheDocument();

    // The next 30 s poll fails, retry included. TanStack hands observers the new state on a
    // setTimeout(0) (its notifyManager), so wait for that tick: the card re-renders with the error.
    stubLanyard(500);
    await act(async () => {
      await client.refetchQueries({ queryKey: LANYARD_KEY });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const [query] = client.getQueryCache().findAll({ queryKey: LANYARD_KEY });
    expect(query?.state.status).toBe('error');
    expect(lanyardRequests).toHaveLength(3);
    expect(within(discordCard()).getByText('tester')).toBeInTheDocument();
    expect(screen.queryByText(ERROR_CARD)).not.toBeInTheDocument();
  });
});
