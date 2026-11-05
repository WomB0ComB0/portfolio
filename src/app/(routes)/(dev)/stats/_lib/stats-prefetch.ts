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
 * @file Server prefetches for the /stats numeric cards, one per PrefetchBoundary. Each calls the
 * card's server source directly (the route handler's function, with its cache and upstream
 * failure reporting), never a fetch of the site's own /api/v1, and stores the result under the
 * card's own query key. server-only also keeps the analytics credentials the Google handler uses
 * out of client bundles.
 *
 * Next bundles those handler modules once for this page and once for /api/v1, but the GitHub,
 * LeetCode, WakaTime and Google handlers keep their cache and running load in processGlobal, so
 * both copies share them. When a load misses PREFETCH_DEADLINE_MS, the card's browser fallback to
 * /api/v1 joins that load if it is still running, or reads the cache it filled, instead of asking
 * the upstream again. Monkeytype has no /api/v1 route: its card falls back to api.monkeytype.com.
 */

import type { QueryClient } from '@tanstack/react-query';
import { getGitHubStats } from '@/app/api/v1/[[...route]]/github-stats/handlers';
import { getGoogleAnalytics } from '@/app/api/v1/[[...route]]/google/handlers';
import { getLeetCodeStats } from '@/app/api/v1/[[...route]]/leetcode/handlers';
import { getWakaTimeData } from '@/app/api/v1/[[...route]]/wakatime/handlers';
import { getMonkeytypeProfile } from '@/lib/api-integrations/monkeytype';
import { prefetchDecoded } from '@/lib/query/prefetch';
import {
  GitHubStatsSchema,
  GoogleResponseSchema,
  githubStatsQuery,
  LeetCodeStatsSchema,
  leetcodeStatsQuery,
  MonkeytypeDataSchema,
  monkeytypeQuery,
  pageViewsQuery,
  WakaTimeResponseSchema,
  wakatimeQuery,
} from './stats-queries';

/** The GitHub card: profile counts and top repositories. */
export const prefetchGitHubStats = (queryClient: QueryClient): Promise<void> =>
  prefetchDecoded(queryClient, githubStatsQuery, GitHubStatsSchema, getGitHubStats, {
    label: 'github-stats',
  });

/** The LeetCode card: solved counts, acceptance and rank. */
export const prefetchLeetCode = (queryClient: QueryClient): Promise<void> =>
  prefetchDecoded(queryClient, leetcodeStatsQuery, LeetCodeStatsSchema, getLeetCodeStats, {
    label: 'leetcode-stats',
  });

/** The Dev Stats card's two sources, page views and coding time, loaded in parallel. */
export const prefetchDevStats = async (queryClient: QueryClient): Promise<void> => {
  await Promise.all([
    prefetchDecoded(queryClient, pageViewsQuery, GoogleResponseSchema, getGoogleAnalytics, {
      label: 'google',
    }),
    prefetchDecoded(queryClient, wakatimeQuery, WakaTimeResponseSchema, getWakaTimeData, {
      label: 'wakatime',
    }),
  ]);
};

/**
 * The Monkeytype card. The card's schema needs a 60 s personal best; a profile without one fails
 * to decode here, so the card fetches for itself as before.
 */
export const prefetchMonkeytype = (queryClient: QueryClient): Promise<void> =>
  prefetchDecoded(queryClient, monkeytypeQuery, MonkeytypeDataSchema, getMonkeytypeProfile, {
    label: 'monkeytype',
  });
