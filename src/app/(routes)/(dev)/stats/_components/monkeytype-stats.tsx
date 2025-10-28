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

import { MagicCard } from '@/components';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import NumberTicker from '@/components/ui/number-ticker';
import { Skeleton } from '@/components/ui/skeleton';
import { get } from '@/lib/http-clients/effect-fetcher';
import { FetchHttpClient } from '@effect/platform';
import { useQuery } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import { motion } from 'motion/react';
import { memo } from 'react';
import { FiCheckCircle, FiTarget, FiType } from 'react-icons/fi';

const MonkeytypeDataSchema = Schema.Struct({
  personalBests: Schema.Struct({
    time: Schema.Struct({
      '60': Schema.Array(
        Schema.Struct({
          wpm: Schema.Number,
          acc: Schema.Number,
        }),
      ),
    }),
  }),
  typingStats: Schema.Struct({
    completedTests: Schema.Number,
  }),
});

const MonkeytypeResponseSchema = Schema.Struct({
  data: MonkeytypeDataSchema,
});

export type MonkeytypeData = Schema.Schema.Type<typeof MonkeytypeDataSchema>;

const MonkeytypeStatsSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    {[...Array(3)].map((_, i) => (
      <Card key={`monkeytype-stat-skeleton-${i}`} className="bg-card/50">
        <CardHeader>
          <Skeleton className="h-5 w-24 mb-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20" />
        </CardContent>
      </Card>
    ))}
  </div>
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
    return <MonkeytypeStatsSkeleton />;
  }

  if (!monkeytypeData) return null;

  const best60 = monkeytypeData.personalBests.time['60']?.[0];

  if (!best60) return null;

  const stats = [
    {
      title: 'Best WPM (60s)',
      value: best60.wpm,
      icon: <FiType className="h-4 w-4" />,
    },
    {
      title: 'Best Accuracy (60s)',
      value: best60.acc,
      icon: <FiTarget className="h-4 w-4" />,
    },
    {
      title: 'Tests Completed',
      value: monkeytypeData.typingStats.completedTests,
      icon: <FiCheckCircle className="h-4 w-4" />,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-xl font-semibold text-primary mb-4">Monkeytype Stats</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <MagicCard className="overflow-hidden h-full shadow-lg hover:shadow-xl transition-all duration-300 text-primary-background">
              <CardHeader>
                <CardTitle className="text-primary-background/80 text-sm font-medium">
                  {stat.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {stat.icon}
                  <NumberTicker
                    className="text-2xl font-bold text-primary-background"
                    value={stat.value}
                    decimalPlaces={stat.title.includes('Accuracy') ? 2 : 0}
                  />
                  {stat.title.includes('Accuracy') && <span>%</span>}
                </div>
              </CardContent>
            </MagicCard>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
});

MonkeytypeStats.displayName = 'MonkeytypeStats';
export default MonkeytypeStats;
