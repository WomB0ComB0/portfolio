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

import { FetchHttpClient } from '@effect/platform';
import { useQuery } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import { motion } from 'motion/react';
import { memo } from 'react';
import { SiLeetcode } from 'react-icons/si';
import NumberTicker from '@/components/ui/number-ticker';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { get } from '@/lib/http-clients/effect-fetcher';
import { cn } from '@/lib/utils';
import { StatCard } from './stat-card';

const LeetCodeStatsSchema = Schema.Struct({
  totalSolved: Schema.Number,
  easySolved: Schema.Number,
  mediumSolved: Schema.Number,
  hardSolved: Schema.Number,
  acceptanceRate: Schema.Number,
  ranking: Schema.Number,
});
type LeetCodeStatsData = Schema.Schema.Type<typeof LeetCodeStatsSchema>;

/** A non-2xx or malformed response rejects, so the query errors instead of rendering bad data. */
const fetchLeetCodeStats = (): Promise<LeetCodeStatsData> =>
  Effect.runPromise(
    pipe(
      get('/api/v1/leetcode', { retries: 0, timeout: 10_000, schema: LeetCodeStatsSchema }),
      Effect.provide(FetchHttpClient.layer),
    ),
  );

interface ProgressBarProps {
  value: number;
  max: number;
  colorClass: string;
}

const clampFraction = (value: number, max: number) =>
  max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;

/**
 * Fills by sliding a full-width pill in from the left, so the animation stays on the compositor.
 * A translate keeps the pill's rounded right end a semicircle (a scale would squash it), and the
 * track's rounded clip shapes the left end. `isolate` guards against older WebKit dropping that
 * rounded clip while the fill animates on its own compositing layer.
 */
const ProgressBar = ({ value, max, colorClass }: ProgressBarProps) => {
  const fraction = clampFraction(value, max);
  return (
    <div className="isolate h-2 w-full overflow-hidden rounded-full bg-primary-background/10">
      <motion.div
        className={`h-2 w-full rounded-full ${colorClass}`}
        initial={{ x: '-100%' }}
        animate={{ x: `${(fraction - 1) * 100}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  );
};

interface SummaryStatProps {
  label: string;
  value: string;
}

const SummaryStat = ({ label, value }: SummaryStatProps) => (
  <div>
    <span className="text-xs text-muted-foreground">{label}</span>
    <p className="text-lg sm:text-xl font-semibold text-card-foreground">{value}</p>
  </div>
);

interface SummaryProps {
  acceptanceRate: number;
  ranking: number;
}

/** LeetCode reports a ranking of 0 when it has none; the rank is left out rather than read "#0". */
const Summary = ({ acceptanceRate, ranking }: SummaryProps) => {
  const isRanked = ranking > 0;
  return (
    <div className={cn('grid grid-cols-1 gap-4 text-center', isRanked && 'sm:grid-cols-2')}>
      <SummaryStat label="Acceptance" value={`${acceptanceRate.toFixed(1)}%`} />
      {isRanked && (
        <SummaryStat label="Global rank" value={`#${ranking.toLocaleString('en-US')}`} />
      )}
    </div>
  );
};

const LeetCodeSkeleton = () => (
  <StatCard title="LeetCode Stats" icon={<SiLeetcode />}>
    <div className="space-y-4">
      <div className="flex items-center justify-center">
        <Skeleton className="h-12 w-24" />
      </div>
      <div className="space-y-3">
        {new Array(3).fill(null).map((_, i) => (
          <div key={`skeleton-${Number(i)}`} className="flex items-center gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
      <Separator className="bg-primary-background/10" />
      <div className="flex justify-around">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  </StatCard>
);

export const LeetCodeStats = memo(() => {
  const { data, isLoading } = useQuery({
    queryKey: ['leetcode-stats'],
    queryFn: fetchLeetCodeStats,
    staleTime: 1000 * 60 * 60 * 6, // 6 hours
  });

  if (isLoading) {
    return <LeetCodeSkeleton />;
  }

  if (!data) return null;

  const { totalSolved, easySolved, mediumSolved, hardSolved, acceptanceRate, ranking } = data;
  const breakdown = [
    { label: 'Easy', value: easySolved, colorClass: 'bg-green-500' },
    { label: 'Medium', value: mediumSolved, colorClass: 'bg-yellow-500' },
    { label: 'Hard', value: hardSolved, colorClass: 'bg-red-500' },
  ];

  return (
    <StatCard
      title="LeetCode Stats"
      icon={<SiLeetcode />}
      footer={
        <a
          href="https://leetcode.com/WomB0ComB0/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:underline text-center block"
        >
          View Profile
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      }
    >
      <div className="space-y-4">
        <div className="mx-auto w-full text-center space-y-1">
          <span className="text-sm text-muted-foreground w-full">Total Solved</span>
          <NumberTicker
            className="text-lg md:text-xl font-bold text-card-foreground w-full"
            value={totalSolved}
          />
        </div>
        <div className="space-y-2">
          {breakdown.map((stat) => (
            <div key={stat.label} className="grid grid-cols-5 items-center gap-2 text-sm">
              <span className="col-span-1 text-muted-foreground text-xs">{stat.label}</span>
              <div className="col-span-3">
                <ProgressBar value={stat.value} max={totalSolved} colorClass={stat.colorClass} />
              </div>
              <span className="col-span-1 text-right font-semibold text-card-foreground text-xs">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
        <Separator className="my-4 bg-primary-background/10" />
        <Summary acceptanceRate={acceptanceRate} ranking={ranking} />
      </div>
    </StatCard>
  );
});
LeetCodeStats.displayName = 'LeetCodeStats';
