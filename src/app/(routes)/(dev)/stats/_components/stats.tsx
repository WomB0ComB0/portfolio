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

import NumberTicker from '@/components/ui/number-ticker';
import { Skeleton } from '@/components/ui/skeleton';
import { age } from '@/constants';
import { get } from '@/lib/http-clients/effect-fetcher';
import { FetchHttpClient } from '@effect/platform';
import { useQueries } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import { memo, useMemo } from 'react';
import { FiCalendar, FiClock, FiCode, FiEye } from 'react-icons/fi';
import { MonkeytypeStats } from './monkeytype-stats';
import { StatCard } from './stat-card';

const GoogleResponseSchema = Schema.Struct({
  total_pageviews: Schema.optional(Schema.Number),
});

const WakaTimeResponseSchema = Schema.Struct({
  text: Schema.String,
  digital: Schema.String,
  decimal: Schema.String,
  total_seconds: Schema.Number,
});

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
    <div className="text-primary-background/80">{icon}</div>
    {isLoading ? (
      <Skeleton className="h-10 w-20 mt-2" />
    ) : (
      <div className="flex items-baseline gap-1">
        <NumberTicker
          className="text-xl md:text-2xl font-bold text-primary-background"
          value={value}
        />
        {unit && <span className="text-sm font-medium text-primary-background/70">{unit}</span>}
      </div>
    )}
    <p className="text-xs text-primary-background/60 mt-1">{title}</p>
  </div>
);

const DevStatsSkeleton = () => (
  <StatCard title="Dev Stats" icon={<FiCode />}>
    <div className="grid grid-cols-3 gap-4">
      <StatItem icon={<FiCalendar />} title="Age" value={0} isLoading />
      <StatItem icon={<FiEye />} title="Site Views" value={0} isLoading />
      <StatItem icon={<FiClock />} title="Hours Coded" value={0} isLoading />
    </div>
  </StatCard>
);

export const DevStats = memo(() => {
  const queries = useQueries({
    queries: [
      {
        queryKey: ['google'],
        queryFn: async () => {
          const effect = pipe(
            get('/api/v1/google', {
              retries: 2,
              timeout: 10_000,
              schema: GoogleResponseSchema,
            }),
            Effect.provide(FetchHttpClient.layer),
          );
          return await Effect.runPromise(effect);
        },
        staleTime: 1000 * 60 * 5,
      },
      {
        queryKey: ['wakatime'],
        queryFn: async () => {
          const effect = pipe(
            get('/api/v1/wakatime', {
              retries: 2,
              timeout: 10_000,
              schema: WakaTimeResponseSchema,
            }),
            Effect.provide(FetchHttpClient.layer),
          );
          return await Effect.runPromise(effect);
        },
        staleTime: 1000 * 60 * 60,
      },
    ],
  });

  const googleData = useMemo(() => queries[0].data ?? null, [queries[0].data]);
  const wakatimeData = useMemo(() => queries[1].data ?? null, [queries[1].data]);
  const isLoading = queries.some((query) => query.isLoading);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <DevStatsSkeleton />
        <MonkeytypeStats />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <StatCard title="Dev Stats" icon={<FiCode />}>
        <div className="grid grid-cols-3 gap-4">
          <StatItem
            icon={<FiCalendar size={20} />}
            title="Age"
            value={age}
            unit="yrs"
            isLoading={false}
          />
          <StatItem
            icon={<FiEye size={20} />}
            title="Site Views"
            value={googleData?.total_pageviews ?? 0}
            isLoading={false}
          />
          <StatItem
            icon={<FiClock size={20} />}
            title="Hours Coded"
            value={wakatimeData?.total_seconds ? Math.round(wakatimeData.total_seconds / 3600) : 0}
            isLoading={false}
          />
        </div>
      </StatCard>
      <MonkeytypeStats />
    </div>
  );
});
DevStats.displayName = 'DevStats';
export default DevStats;
