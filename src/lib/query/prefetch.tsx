import 'server-only';

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
 * @file Server prefetching for client queries. A server component loads a card's data straight
 * from its server source, puts it in a fresh QueryClient under the card's own query key, and
 * hands the dehydrated cache to the browser, so the card's `useQuery` has its data on the first
 * render instead of fetching after hydration.
 */

import {
  dehydrate,
  type FetchQueryOptions,
  HydrationBoundary,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { Schema } from 'effect';
import type { ReactNode } from 'react';
import { withDeadline } from '@/lib/async/deadline';
import { makeQueryClient } from '@/providers/server/query-client';

/**
 * How long a server load may hold up its part of the page. Past it the query is left out of the
 * dehydrated state and the card fetches in the browser as it did before prefetching.
 */
export const PREFETCH_DEADLINE_MS = 2_500;

/** The parts of a card's `queryOptions()` a prefetch needs: its key and freshness. */
export type PrefetchQuery<A, TQueryKey extends QueryKey = QueryKey> = Pick<
  FetchQueryOptions<A, Error, A, TQueryKey>,
  'queryKey' | 'staleTime'
>;

export interface PrefetchSettings {
  /** Names the load in a DeadlineError: `prefetch:<label>`. */
  readonly label: string;
  /** The load's time budget. Defaults to {@link PREFETCH_DEADLINE_MS}. */
  readonly deadlineMs?: number;
}

/**
 * The JSON body the HTTP route would have sent for `value`: dates become ISO strings, undefined
 * fields and functions disappear. Decoding that, not the raw server value, keeps the server and
 * browser paths identical.
 */
const asJsonBody = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

/**
 * Prefetches the query `options` names with data from `load`, a server source (e.g. a route
 * handler's function, called directly, never through a fetch of the site's own API).
 *
 * - The value goes through a JSON round trip and is decoded with the CLIENT's `schema`, so the
 *   cached value is exactly what the browser's HTTP path would produce. A server type that has
 *   drifted from the client schema fails to decode and the card fetches for itself instead of
 *   rendering wrong data.
 * - Never rejects: a failed, mismatched or late load (past `deadlineMs`) leaves the query in
 *   'error', which dehydrate skips. The server never retries (see shouldRetryQuery).
 *
 * @example
 * await prefetchDecoded(qc, githubStatsQuery, GitHubStatsSchema, getGitHubStats, {
 *   label: 'github-stats',
 * });
 */
export async function prefetchDecoded<A, I, TQueryKey extends QueryKey>(
  queryClient: QueryClient,
  { queryKey, staleTime }: PrefetchQuery<A, TQueryKey>,
  schema: Schema.Schema<A, I, never>,
  load: () => Promise<unknown>,
  { label, deadlineMs = PREFETCH_DEADLINE_MS }: PrefetchSettings,
): Promise<void> {
  const decode = Schema.decodeUnknownSync(schema);
  await queryClient.prefetchQuery<A, Error, A, TQueryKey>({
    queryKey,
    staleTime,
    queryFn: async () =>
      decode(asJsonBody(await withDeadline(load(), deadlineMs, `prefetch:${label}`))),
  });
}

export interface PrefetchBoundaryProps {
  /** Fills the boundary's fresh QueryClient, e.g. with {@link prefetchDecoded}. */
  readonly prefetch: (queryClient: QueryClient) => Promise<unknown>;
  readonly children: ReactNode;
}

/**
 * Runs `prefetch` against a new QueryClient (one per render, never shared between requests) and
 * hydrates its successful queries into the browser's client around `children`.
 *
 * - Always place it inside a `<Suspense>`: it awaits its prefetches, so a slow source streams in
 *   behind that boundary's fallback instead of holding up the page.
 * - Always await the prefetches in `prefetch`. A query still pending when this dehydrates would
 *   need streaming hydration, which this app does not use.
 *
 * @example
 * <Suspense fallback={<GitHubStatsSkeleton />}>
 *   <PrefetchBoundary prefetch={prefetchGitHubStats}>
 *     <GitHubStats />
 *   </PrefetchBoundary>
 * </Suspense>
 */
export async function PrefetchBoundary({ prefetch, children }: PrefetchBoundaryProps) {
  const queryClient = makeQueryClient();
  await prefetch(queryClient);
  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}
