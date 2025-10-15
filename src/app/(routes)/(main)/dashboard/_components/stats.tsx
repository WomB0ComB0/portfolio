'use client';

import { FetchHttpClient } from '@effect/platform';
import { useQueries } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useMemo } from 'react';
import { FiCalendar, FiClock, FiEye } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import NumberTicker from '@/components/ui/number-ticker';
import { Skeleton } from '@/components/ui/skeleton';
import { age } from '@/constants';
import { get } from '@/lib/http-clients/effect-fetcher';

interface StatCard {
  title: string;
  link: string;
  query: string;
}

// Schema for Google Analytics response
const GoogleResponseSchema = Schema.Struct({
  total_pageviews: Schema.optional(Schema.Number),
});

// Schema for WakaTime response
const WakaTimeResponseSchema = Schema.Struct({
  text: Schema.String,
  digital: Schema.String,
  decimal: Schema.String,
  total_seconds: Schema.Number,
});

const statCards: StatCard[] = [
  {
    title: 'Age',
    link: 'https://mikeodnis.dev',
    query: 'age',
  },
  {
    title: 'Views',
    link: '',
    query: 'google',
  },
  {
    title: 'Hours Coded',
    link: 'https://wakatime.com/@',
    query: 'wakatime',
  },
];

export default memo(function Stats() {
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

  const googleData = useMemo(() => {
    // Data is already parsed and validated by Effect Schema
    return queries[0].data ?? null;
  }, [queries[0].data]);

  const wakatimeData = useMemo(() => {
    // Data is already parsed and validated by Effect Schema
    return queries[1].data ?? null;
  }, [queries[1].data]);

  const isLoading = queries.some((query) => query.isLoading);

  const getCardValue = (card: StatCard) => {
    switch (card.query) {
      case 'age':
        return age;
      case 'google':
        return googleData?.total_pageviews ?? 'N/A';
      case 'wakatime':
        return wakatimeData?.total_seconds
          ? Math.round(wakatimeData.total_seconds / 3600)
          : undefined;
      default:
        return undefined;
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, index) => (
          <Card
            key={`${card.title}-${index}-skeleton`}
            className="overflow-hidden h-full shadow-lg bg-gradient-to-br from-purple-600 to-indigo-700"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-9 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {statCards.map((card, index) => {
        const value = getCardValue(card);
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card className="overflow-hidden h-full shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-600 to-indigo-700 text-white">
              <CardHeader>
                <CardTitle
                  className={`${card.title === 'Site Views' ? 'text-white' : 'text-gray-300'}`}
                >
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {card.query === 'age' && <FiCalendar className="h-4 w-4" />}
                  {card.query === 'google' && <FiEye className="h-4 w-4" />}
                  {card.query === 'wakatime' && <FiClock className="h-4 w-4" />}
                  <AnimatePresence>
                    <NumberTicker
                      className="text-2xl font-bold text-white"
                      value={Number(value) ?? '-'}
                      decimalPlaces={0}
                    />
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
});
