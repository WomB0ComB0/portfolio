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
 * @file The /stats page body, a server component. Each numeric card's data is loaded on the
 * server into TanStack Query behind its own Suspense boundary, so the numbers are in the server
 * HTML and a slow or failing source holds up or breaks only its own card. Discord is a live
 * widget and stays a browser fetch.
 *
 * The route has no loading.tsx on purpose. Nothing here is awaited above the cards, so the header,
 * the grid and each card's skeleton are ready at once; a segment-level skeleton would only be
 * shown first and then replaced by this tree, remounting every card (and the live Discord card).
 */

import type { QueryClient } from '@tanstack/react-query';
import { type ReactElement, type ReactNode, Suspense } from 'react';
import { FiActivity } from 'react-icons/fi';
import {
  DevStats,
  DevStatsSkeleton,
  Discord,
  GitHubStats,
  GitHubStatsSkeleton,
  LeetCodeStats,
  LeetCodeStatsSkeleton,
} from '@/app/(routes)/(dev)/stats/_components';
import {
  prefetchDevStats,
  prefetchGitHubStats,
  prefetchLeetCode,
  prefetchMonkeytype,
} from '@/app/(routes)/(dev)/stats/_lib/stats-prefetch';
import {
  githubStatsQuery,
  leetcodeStatsQuery,
  monkeytypeQuery,
  pageViewsQuery,
  wakatimeQuery,
} from '@/app/(routes)/(dev)/stats/_lib/stats-queries';
import { PageHeader } from '@/components/custom/page-header';
import { SectionBoundary } from '@/components/data/section-boundary';
import { PrefetchBoundary } from '@/lib/query/prefetch';

interface StatsFrameProps {
  /** The wide left column. */
  github: ReactNode;
  /** The narrow right column, top to bottom. */
  discord: ReactNode;
  devStats: ReactNode;
  leetcode: ReactNode;
}

/** The page header and the card grid (3 + 2 columns from lg) around the cards. */
function StatsFrame({ github, discord, devStats, leetcode }: StatsFrameProps): ReactElement {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Development Statistics"
        description="What I'm up to on Discord right now, plus GitHub, LeetCode, coding-time and typing stats that refresh every few hours."
        icon={<FiActivity />}
      />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-3 space-y-8">{github}</div>
        <div className="lg:col-span-2 space-y-8">
          {discord}
          {devStats}
          {leetcode}
        </div>
      </div>
    </div>
  );
}

/** DevStats renders the Monkeytype card inside itself, so its boundary loads both. */
const prefetchDevAndTypingStats = (queryClient: QueryClient): Promise<unknown> =>
  Promise.all([prefetchDevStats(queryClient), prefetchMonkeytype(queryClient)]);

/**
 * The /stats view. Each numeric card streams in behind its skeleton once its server load settles
 * (at most PREFETCH_DEADLINE_MS); a load that fails or runs late leaves its card to fetch in the
 * browser. Each sits in its own SectionBoundary, so a card that throws while rendering leaves the
 * others in place, and its Try again also clears that card's cached queries.
 */
export function Stats(): ReactElement {
  return (
    <StatsFrame
      github={
        <SectionBoundary label="GitHub stats" queryKeys={[githubStatsQuery.queryKey]}>
          <Suspense fallback={<GitHubStatsSkeleton />}>
            <PrefetchBoundary prefetch={prefetchGitHubStats}>
              <GitHubStats />
            </PrefetchBoundary>
          </Suspense>
        </SectionBoundary>
      }
      discord={<Discord />}
      devStats={
        <SectionBoundary
          label="dev and typing stats"
          queryKeys={[pageViewsQuery.queryKey, wakatimeQuery.queryKey, monkeytypeQuery.queryKey]}
        >
          <Suspense fallback={<DevStatsSkeleton />}>
            <PrefetchBoundary prefetch={prefetchDevAndTypingStats}>
              <DevStats />
            </PrefetchBoundary>
          </Suspense>
        </SectionBoundary>
      }
      leetcode={
        <SectionBoundary label="LeetCode stats" queryKeys={[leetcodeStatsQuery.queryKey]}>
          <Suspense fallback={<LeetCodeStatsSkeleton />}>
            <PrefetchBoundary prefetch={prefetchLeetCode}>
              <LeetCodeStats />
            </PrefetchBoundary>
          </Suspense>
        </SectionBoundary>
      }
    />
  );
}

export default Stats;
