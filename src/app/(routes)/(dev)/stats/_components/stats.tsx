'use client';

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

import { useQueries } from '@tanstack/react-query';
import { memo } from 'react';
import { FiCalendar, FiClock, FiCode, FiEye } from 'react-icons/fi';
import { RetryButton } from '@/components/data/retry-button';
import { SectionError } from '@/components/data/section-error';
import NumberTicker from '@/components/ui/number-ticker';
import { Skeleton } from '@/components/ui/skeleton';
import { ageOn } from '@/constants/app';
import {
  type GoogleResponse,
  pageViewsQuery,
  type WakaTimeResponse,
  wakatimeQuery,
} from '../_lib/stats-queries';
import { MonkeytypeStats, MonkeytypeStatsSkeleton } from './monkeytype-stats';
import { StatCard } from './stat-card';

const SECONDS_PER_HOUR = 3600;

/** Shared by the skeleton and the loaded card. Page views are GA's last 30 days; hours are all time. */
const LABELS = {
  age: 'Age',
  pageViews: 'Page views (30 days)',
  hoursCoded: 'Hours coded (all time)',
} as const;

const StatItem = ({
  icon,
  title,
  value,
  unit,
  isLoading,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  unit?: string;
  isLoading: boolean;
}) => (
  <div className="flex flex-col items-center text-center">
    {/* Decorative: the label below names the stat. */}
    <div aria-hidden="true" className="text-muted-foreground">
      {icon}
    </div>
    {isLoading ? (
      <Skeleton className="h-10 w-20 mt-2" />
    ) : (
      <div className="flex items-baseline gap-1">
        <NumberTicker className="text-md md:text-xl font-bold text-card-foreground" value={value} />
        {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
      </div>
    )}
    <p className="text-xs text-muted-foreground mt-1">{title}</p>
  </div>
);

const DevStatsCardSkeleton = () => (
  <StatCard title="Dev Stats" icon={<FiCode />} hasEntrance={false}>
    <div className="grid grid-cols-3 gap-4">
      <StatItem icon={<FiCalendar />} title={LABELS.age} value={0} isLoading />
      <StatItem icon={<FiEye />} title={LABELS.pageViews} value={0} isLoading />
      <StatItem icon={<FiClock />} title={LABELS.hoursCoded} value={0} isLoading />
    </div>
  </StatCard>
);

/**
 * What {@link DevStats} shows while its data loads: the Dev Stats card and the Monkeytype card
 * below it, each with the loaded card's frame.
 */
export const DevStatsSkeleton = () => (
  <div className="space-y-8">
    <DevStatsCardSkeleton />
    <MonkeytypeStatsSkeleton />
  </div>
);

interface DevStatsCardProps {
  pageViews: GoogleResponse;
  wakatime: WakaTimeResponse;
}

/**
 * The age is worked out when the card renders, from a UTC birth date, so the server HTML and the
 * hydrating browser compute the same number whatever the visitor's time zone or however long the
 * server process has been up.
 */
const DevStatsCard = ({ pageViews, wakatime }: DevStatsCardProps) => (
  <StatCard title="Dev Stats" icon={<FiCode />}>
    <div className="grid grid-cols-3 gap-4">
      <StatItem
        icon={<FiCalendar size={20} />}
        title={LABELS.age}
        value={ageOn(new Date())}
        unit="yrs"
        isLoading={false}
      />
      <StatItem
        icon={<FiEye size={20} />}
        title={LABELS.pageViews}
        value={pageViews.total_pageviews ?? 0}
        isLoading={false}
      />
      <StatItem
        icon={<FiClock size={20} />}
        title={LABELS.hoursCoded}
        value={wakatime.total_seconds ? Math.round(wakatime.total_seconds / SECONDS_PER_HOUR) : 0}
        isLoading={false}
      />
    </div>
  </StatCard>
);

/**
 * The Dev Stats card, from page views (Google Analytics) and coding time (WakaTime). If either
 * failed with nothing cached, the card says so rather than showing a made-up 0, and Try again
 * fetches the failed ones again.
 */
const DevStatsSection = () => {
  const [pageViews, wakatime] = useQueries({ queries: [pageViewsQuery, wakatimeQuery] });
  const failed = [pageViews, wakatime].filter((query) => query.isError && query.data === undefined);

  if (failed.length > 0) {
    const retry = () => {
      for (const query of failed) void query.refetch();
    };
    return (
      <SectionError
        title="Couldn't load dev stats"
        headingLevel={2}
        action={<RetryButton onRetry={retry} />}
      />
    );
  }
  if (pageViews.data === undefined || wakatime.data === undefined) return <DevStatsCardSkeleton />;
  return <DevStatsCard pageViews={pageViews.data} wakatime={wakatime.data} />;
};

/**
 * The Dev Stats card with the Monkeytype card below it. Their data is usually prefetched on the
 * server (see the /stats page); otherwise each shows its skeleton and fetches in the browser.
 */
export const DevStats = memo(() => (
  <div className="space-y-8">
    <DevStatsSection />
    <MonkeytypeStats />
  </div>
));
DevStats.displayName = 'DevStats';
export default DevStats;
