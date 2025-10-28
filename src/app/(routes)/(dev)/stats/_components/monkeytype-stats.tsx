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
import { get } from '@/lib/http-clients/effect-fetcher';
import { FetchHttpClient } from '@effect/platform';
import { useQuery } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import { motion } from 'motion/react';
import { memo } from 'react';
import { FaKeyboard } from 'react-icons/fa';
import { StatCard } from './stat-card';

const MonkeytypeDataSchema = Schema.Struct({
  personalBests: Schema.Struct({
    time: Schema.Struct({
      '60': Schema.Array(Schema.Struct({ wpm: Schema.Number, acc: Schema.Number })),
    }),
  }),
  typingStats: Schema.Struct({ completedTests: Schema.Number }),
});
const MonkeytypeResponseSchema = Schema.Struct({ data: MonkeytypeDataSchema });
export type MonkeytypeData = Schema.Schema.Type<typeof MonkeytypeDataSchema>;

const CircularProgress = ({ value, colorClass }: { value: number; colorClass: string }) => {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative w-20 h-20">
      <svg className="w-full h-full" viewBox="0 0 80 80">
        <circle
          className="text-primary-background/10"
          strokeWidth="6"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="40"
          cy="40"
        />
        <motion.circle
          className={colorClass}
          strokeWidth="6"
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="40"
          cy="40"
          style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-primary-background">
        {value.toFixed(0)}%
      </div>
    </div>
  );
};

const MonkeytypeSkeleton = () => (
  <StatCard title="Monkeytype Stats" icon={<FaKeyboard />}>
    <div className="grid grid-cols-3 gap-4 text-center">
      <div className="space-y-1">
        <Skeleton className="h-4 w-16 mx-auto" />
        <Skeleton className="h-10 w-20 mx-auto" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-4 w-20 mx-auto" />
        <Skeleton className="h-20 w-20 rounded-full mx-auto" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-4 w-24 mx-auto" />
        <Skeleton className="h-10 w-16 mx-auto" />
      </div>
    </div>
  </StatCard>
);

export const MonkeytypeStats = memo(() => {
  const { data: monkeytypeData, isLoading } = useQuery({
    queryKey: ['monkeytype-stats'],
    queryFn: async () => {
      const effect = pipe(
        get('https://api.monkeytype.com/users/WomB0ComB0/profile', {
          schema: MonkeytypeResponseSchema,
          retries: 2,
          timeout: 10_000,
        }),
        Effect.provide(FetchHttpClient.layer),
      );
      return (await Effect.runPromise(effect)).data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  if (isLoading) {
    return <MonkeytypeSkeleton />;
  }

  if (!monkeytypeData) return null;

  const best60 = monkeytypeData.personalBests.time['60']?.reduce(
    (best, current) => {
      return current.wpm > best.wpm ? current : best;
    },
    { wpm: 0, acc: 0 },
  );

  if (!best60) return null;

  return (
    <StatCard title="Monkeytype Stats" icon={<FaKeyboard />}>
      <div className="grid grid-cols-3 gap-4 text-center items-center">
        <div className="flex flex-col items-center">
          <span className="text-xs text-primary-background/70">WPM</span>
          <NumberTicker className="text-4xl font-bold text-primary-background" value={best60.wpm} />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-primary-background/70 mb-1">Accuracy</span>
          <CircularProgress value={best60.acc} colorClass="text-green-400" />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-primary-background/70">Tests</span>
          <NumberTicker
            className="text-4xl font-bold text-primary-background"
            value={monkeytypeData.typingStats.completedTests}
          />
        </div>
      </div>
    </StatCard>
  );
});
MonkeytypeStats.displayName = 'MonkeytypeStats';
export default MonkeytypeStats;
