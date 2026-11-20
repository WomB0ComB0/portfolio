/**
 * Copyright 2026 Mike Odnis
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
 * @file The one /api/status query the footer StatusBadge (every page) and the home status tile
 * share: one key, so one cached answer and one poll per tab, where each used to poll every minute
 * under its own key. Pure (no directive) and free of Effect, like live-fetch.
 *
 * - Every 5 minutes, and only while the tab is visible: TanStack's refetchInterval skips a hidden
 *   tab (refetchIntervalInBackground false), and its focus refetch asks again on return once the
 *   answer is stale.
 * - The first load still happens on mount when nothing fresh is cached: the badge fetches on any
 *   page, the tile shows the server's snapshot and the badge reads the same entry.
 * - Retries are the QueryClient's (shouldRetryQuery).
 */

import { queryOptions } from '@tanstack/react-query';
import type { ServiceStatus } from '@/app/api/[[...route]]/status/schema';
import { fetchJson, parseServiceStatus } from './live-fetch';

/** The cache entry both readers share: `data` of /api/status's answer (ServiceStatus). */
export const SERVICE_STATUS_QUERY_KEY = ['service-status'] as const;

const STATUS_URL = '/api/status';

/** How often a visible tab asks again. */
export const STATUS_POLL_MS = 5 * 60_000;

/** An answer younger than this is not fetched again on mount or on focus. */
export const STATUS_STALE_MS = STATUS_POLL_MS - 5_000;

/** The shared query: spread it into useQuery, adding only a reader's own initialData. */
export const serviceStatusQuery = queryOptions({
  queryKey: SERVICE_STATUS_QUERY_KEY,
  queryFn: async ({ signal }): Promise<ServiceStatus> =>
    parseServiceStatus(await fetchJson(STATUS_URL, { signal })),
  staleTime: STATUS_STALE_MS,
  refetchInterval: STATUS_POLL_MS,
  refetchIntervalInBackground: false,
});
