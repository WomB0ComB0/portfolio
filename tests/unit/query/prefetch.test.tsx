// @vitest-environment node
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
 * @file Server prefetching for client queries (src/lib/query/prefetch.tsx).
 * - A prefetched query is dehydrated under the card's own key, so the card's `useQuery` renders
 *   the data on its first (server) render and never runs its browser fetch.
 * - A load that fails, times out or no longer matches the client schema is left out: the card
 *   renders pending, fetches for itself once mounted, and no timer is left behind.
 * - The server value goes through a JSON round trip before the client schema decodes it, so the
 *   cache holds what the HTTP path would have produced (a Date becomes its ISO string).
 *
 * Runs in node, like a server render. The browser side is the app's own client (makeQueryClient)
 * rendered with renderToString; "mount" is a QueryObserver subscribing, which is what useQuery
 * does in its effect.
 */

import {
  type DehydratedState,
  HydrationBoundary,
  type HydrationBoundaryProps,
  type QueryClient,
  QueryClientProvider,
  QueryObserver,
  useQuery,
} from '@tanstack/react-query';
import { Schema } from 'effect';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The fetcher (imported by the query client) reads env only for the Vercel bypass header.
vi.mock('@/env', () => ({ env: {}, default: {} }));

import { DeadlineError } from '@/lib/async/deadline';
import {
  PREFETCH_DEADLINE_MS,
  PrefetchBoundary,
  type PrefetchSettings,
  prefetchDecoded,
} from '@/lib/query/prefetch';
import { makeQueryClient } from '@/providers/server/query-client';
import { logger } from '@/utils';

const QUERY_KEY = ['test-card'] as const;
const STALE_TIME_MS = 60 * 60_000;
const TEST_DEADLINE_MS = 50;

/** The card's client schema, as a /stats card declares it. */
const CardSchema = Schema.Struct({
  total: Schema.Number,
  label: Schema.String,
  updatedAt: Schema.String,
});
type CardData = Schema.Schema.Type<typeof CardSchema>;

const UPDATED_AT = new Date('2026-11-05T12:00:00.000Z');

/** What the card's server source returns: a Date, and a field the client schema does not know. */
const serverValue = () => ({
  total: 692,
  label: 'Solved',
  updatedAt: UPDATED_AT,
  internalNote: 'never sent to the browser',
});

const cardQuery = { queryKey: QUERY_KEY, staleTime: STALE_TIME_MS };

/** A card written the way the /stats cards are: useQuery with its own browser fetcher. */
function Card({ queryFn }: { readonly queryFn: () => Promise<CardData> }) {
  const { data, status } = useQuery({ ...cardQuery, queryFn });
  if (status !== 'success') return <p>Loading card</p>;
  return <p>{`${data.label}: ${data.total} at ${data.updatedAt}`}</p>;
}

/** The server render: a PrefetchBoundary around the card, as a page would place it. */
const renderOnServer = (
  load: () => Promise<unknown>,
  browserFetch: () => Promise<CardData>,
  settings: Partial<PrefetchSettings> = {},
): Promise<ReactElement> =>
  PrefetchBoundary({
    prefetch: (queryClient) =>
      prefetchDecoded(queryClient, cardQuery, CardSchema, load, { label: 'card', ...settings }),
    children: <Card queryFn={browserFetch} />,
  });

/** The state PrefetchBoundary hands to the browser. */
const dehydratedStateOf = (element: ReactElement): DehydratedState => {
  expect(element.type).toBe(HydrationBoundary);
  const { state } = element.props as HydrationBoundaryProps;
  if (!state) throw new Error('PrefetchBoundary rendered no dehydrated state');
  return state;
};

const keysIn = (state: DehydratedState) => state.queries.map((query) => query.queryKey);

/**
 * The browser: the app's own client hydrates the boundary. The state goes through JSON first,
 * as it does in the RSC payload. Returns the first render's HTML.
 */
const renderInBrowser = (element: ReactElement): { client: QueryClient; html: string } => {
  const { state, children } = element.props as HydrationBoundaryProps;
  const client = makeQueryClient();
  const html = renderToString(
    <QueryClientProvider client={client}>
      <HydrationBoundary state={JSON.parse(JSON.stringify(state))}>{children}</HydrationBoundary>
    </QueryClientProvider>,
  );
  return { client, html };
};

/** What useQuery does once the card mounts: subscribe, fetching unless fresh data is cached. */
const mountCard = (client: QueryClient, browserFetch: () => Promise<CardData>): (() => void) =>
  new QueryObserver(client, { ...cardQuery, queryFn: browserFetch }).subscribe(() => {});

const browserData = (): Promise<CardData> =>
  Promise.resolve({ total: 1, label: 'From the browser', updatedAt: 'later' });

/** A load that never settles: only the deadline can end it. */
const hangingLoad = (): Promise<unknown> => new Promise(() => {});

beforeEach(() => {
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  vi.spyOn(logger, 'debug').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('PrefetchBoundary with a load that resolves', () => {
  it('dehydrates the query under the card key', async () => {
    const element = await renderOnServer(async () => serverValue(), browserData);

    expect(keysIn(dehydratedStateOf(element))).toEqual([QUERY_KEY]);
  });

  it('renders the decoded data on the first render and never runs the browser fetch', async () => {
    const browserFetch = vi.fn(browserData);
    const element = await renderOnServer(async () => serverValue(), browserFetch);

    const { client, html } = renderInBrowser(element);
    const unmount = mountCard(client, browserFetch);
    unmount();

    expect(html).toContain('Solved: 692 at 2026-11-05T12:00:00.000Z');
    expect(html).not.toContain('Loading card');
    expect(browserFetch).not.toHaveBeenCalled();
  });

  it('caches what the HTTP path would give: a Date as its ISO string, unknown fields dropped', async () => {
    const element = await renderOnServer(async () => serverValue(), browserData);

    const { client } = renderInBrowser(element);

    expect(client.getQueryData(QUERY_KEY)).toEqual({
      total: 692,
      label: 'Solved',
      updatedAt: '2026-11-05T12:00:00.000Z',
    });
  });
});

describe('PrefetchBoundary with a load that fails', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /** The card renders pending first, then fetches for itself on mount. */
  const expectBrowserFallback = async (element: ReactElement) => {
    const browserFetch = vi.fn(browserData);

    const { client, html } = renderInBrowser(element);
    expect(html).toContain('Loading card');
    expect(browserFetch).not.toHaveBeenCalled();

    const unmount = mountCard(client, browserFetch);
    await vi.waitFor(() => expect(client.getQueryData(QUERY_KEY)).toMatchObject({ total: 1 }));
    unmount();
    expect(browserFetch).toHaveBeenCalledTimes(1);
  };

  it('leaves out a query whose load rejects, and leaves no timer behind', async () => {
    const element = await renderOnServer(
      () => Promise.reject(new Error('upstream down')),
      browserData,
      { deadlineMs: TEST_DEADLINE_MS },
    );

    expect(keysIn(dehydratedStateOf(element))).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    await expectBrowserFallback(element);
  });

  it('leaves out a query whose load misses its deadline, and leaves no timer behind', async () => {
    let settled = false;
    const rendering = renderOnServer(hangingLoad, browserData, {
      deadlineMs: TEST_DEADLINE_MS,
    }).finally(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(TEST_DEADLINE_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const element = await rendering;

    expect(keysIn(dehydratedStateOf(element))).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    await expectBrowserFallback(element);
  });

  it('leaves out a server value that no longer matches the client schema', async () => {
    const element = await renderOnServer(
      async () => ({ ...serverValue(), total: 'six hundred' }),
      browserData,
    );

    expect(keysIn(dehydratedStateOf(element))).toEqual([]);
    await expectBrowserFallback(element);
  });
});

describe('prefetchDecoded', () => {
  it(`gives a load ${PREFETCH_DEADLINE_MS} ms by default, then fails the query with a DeadlineError`, async () => {
    vi.useFakeTimers();
    const queryClient = makeQueryClient();

    let settled = false;
    const prefetching = prefetchDecoded(queryClient, cardQuery, CardSchema, hangingLoad, {
      label: 'card',
    }).finally(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(PREFETCH_DEADLINE_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(prefetching).resolves.toBeUndefined();

    const { status, error } = queryClient.getQueryState(QUERY_KEY) ?? {};
    expect(status).toBe('error');
    expect(error).toBeInstanceOf(DeadlineError);
    expect(error).toMatchObject({ label: 'prefetch:card', ms: PREFETCH_DEADLINE_MS });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never rejects and never retries on the server', async () => {
    const queryClient = makeQueryClient();
    const load = vi.fn(() => Promise.reject(new Error('upstream down')));

    await expect(
      prefetchDecoded(queryClient, cardQuery, CardSchema, load, { label: 'card' }),
    ).resolves.toBeUndefined();

    expect(load).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryState(QUERY_KEY)?.status).toBe('error');
  });
});
