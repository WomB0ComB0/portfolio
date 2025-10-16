'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import NumberTicker from '@/components/ui/number-ticker';
import { Skeleton } from '@/components/ui/skeleton';
import { age } from '@/constants';
import { get } from '@/lib/http-clients/effect-fetcher';
import { FetchHttpClient } from '@effect/platform';
import { useQueries } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useMemo } from 'react';
import { FiCalendar, FiClock, FiEye } from 'react-icons/fi';

/**
 * @interface StatCard
 * @version 1.0.0
 * @readonly
 * @description
 * Defines the structure and required fields for displaying a statistic card within the DevStats component.
 * Each card presents a specific metric, optionally linking to a relevant resource and referencing the backend query key.
 *
 * @property {string} title - The display title of the statistic.
 * @property {string} link - The associated URL for additional details or references, may be empty.
 * @property {string} query - The backend or local statistic identifier key.
 *
 * @author Mike Odnis
 * @see https://github.com/WomB0ComB0/portfolio
 */
interface StatCard {
  title: string;
  link: string;
  query: string;
}

/**
 * @readonly
 * @description Effect Schema for parsing and validating the shape of the response
 * returned by the /api/v1/google endpoint.
 *
 * @see https://effect-ts.org/docs/schema
 * @see https://tanstack.com/query/v4/docs/framework/react/guides/queries
 * @author Mike Odnis
 * @version 1.0.0
 */
const GoogleResponseSchema = Schema.Struct({
  total_pageviews: Schema.optional(Schema.Number),
});

/**
 * @readonly
 * @description Effect Schema for parsing and validating the shape of the response
 * returned by the /api/v1/wakatime endpoint.
 *
 * @see https://wakatime.com/developers#stats
 * @see https://effect-ts.org/docs/schema
 * @author Mike Odnis
 * @version 1.0.0
 */
const WakaTimeResponseSchema = Schema.Struct({
  text: Schema.String,
  digital: Schema.String,
  decimal: Schema.String,
  total_seconds: Schema.Number,
});

/**
 * @readonly
 * @description Array of StatCard definitions to determine which stats to display and their properties.
 *
 * @author Mike Odnis
 * @version 1.0.0
 */
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

/**
 * DevStats React component displays a set of developer-related statistics using animated cards.
 * Stats values are sourced from Google Analytics (`/api/v1/google`), WakaTime (`/api/v1/wakatime`),
 * and a locally-derived age constant.
 *
 * Utilizes TanStack React Query for asynchronous fetching and effect schema for robust run-time validation.
 * Provides skeleton loading state and fade-in motion transitions for a responsive and dynamic UI.
 *
 * @function
 * @web
 * @public
 * @version 1.0.0
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 *
 * @returns {JSX.Element}
 * Returns a grid of stat cards, dynamically populated with live or computed values.
 *
 * @throws {Error} May throw if fetch fails, schema does not match, or network is not available.
 *
 * @see https://github.com/WomB0ComB0/portfolio
 * @see https://tanstack.com/query/v4/docs/framework/react/guides/queries
 *
 * @example
 * <DevStats />
 */
export default memo(function DevStats() {
  /**
   * Uses TanStack React Query's useQueries to fetch Google Analytics and WakaTime stats in parallel,
   * validating their structure at runtime.
   *
   * @type {{
   *   data?: any; isLoading: boolean; error?: any;
   * }[]}
   */
  const queries = useQueries({
    queries: [
      {
        /**
         * @async
         * @private
         * @description
         * Fetches total page views from Google Analytics API, using Effect for request composition
         * and schema validation.
         * @returns {Promise<{total_pageviews?: number}>} Google Analytics stat object
         * @throws {Error} If network, schema, or server errors occur
         * @see /api/v1/google
         * @see GoogleResponseSchema
         */
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
        /**
         * @async
         * @private
         * @description
         * Fetches total coding time stats from WakaTime API, using Effect for promise management
         * and schema validation.
         * @returns {Promise<{total_seconds: number, text: string, digital: string, decimal: string}>}
         * @throws {Error} If network, schema, or server errors occur
         * @see /api/v1/wakatime
         * @see WakaTimeResponseSchema
         */
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

  /**
   * Returns Google Analytics data from the query cache, or null if not available or errored.
   *
   * @readonly
   * @private
   * @type {null | {total_pageviews?: number}}
   *
   * @author Mike Odnis
   * @see GoogleResponseSchema
   */
  const googleData = useMemo(() => {
    const data = queries[0].data ?? null;
    return data;
  }, [queries[0].data, queries[0].error]);

  /**
   * Returns WakaTime data from the query cache, or null if not available or errored.
   *
   * @readonly
   * @private
   * @type {null | {total_seconds: number, text: string, digital: string, decimal: string}}
   *
   * @author Mike Odnis
   * @see WakaTimeResponseSchema
   */
  const wakatimeData = useMemo(() => {
    const data = queries[1].data ?? null;
    return data;
  }, [queries[1].data, queries[1].error]);

  /**
   * @readonly
   * @private
   * Boolean indicating if any of the stats are still loading.
   *
   * @type {boolean}
   */
  const isLoading = queries.some((query) => query.isLoading);

  /**
   * Returns the value for the provided stat card, conditionally drawing from constants,
   * Google Analytics, or WakaTime API responses.
   *
   * @private
   * @function
   * @param {StatCard} card - The stat card configuration object.
   * @returns {string | number | undefined} The corresponding value to render for this card.
   *
   * @throws {Error} If underlying API data is not properly shaped or unavailable.
   * @author Mike Odnis
   * @see statCards
   * @example
   * getCardValue(statCards[0]) // returns number (age)
   * getCardValue(statCards[1]) // returns number of views or 'N/A'
   * getCardValue(statCards[2]) // returns coding hours as rounded number
   */
  const getCardValue = (card: StatCard): string | number | undefined => {
    switch (card.query) {
      case 'age':
        return age;
      case 'google': {
        const pageviews = googleData?.total_pageviews;
        return pageviews ?? 'N/A';
      }
      case 'wakatime':
        return wakatimeData?.total_seconds
          ? Math.round(wakatimeData.total_seconds / 3600)
          : undefined;
      default:
        return undefined;
    }
  };

  // Render skeletons while loading
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

  // Render main animated statistics grid
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
