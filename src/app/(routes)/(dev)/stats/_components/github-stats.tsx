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

'use client';

import { FetchHttpClient } from '@effect/platform';
import { useQuery } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import { motion } from 'motion/react';
import { memo } from 'react';
import { FiGithub, FiStar, FiUsers } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import NumberTicker from '@/components/ui/number-ticker';
import { Skeleton } from '@/components/ui/skeleton';
import { get } from '@/lib/http-clients/effect-fetcher';

/**
 * @readonly
 * @author Mike Odnis
 * @version 1.0.0
 * @description
 * Schema definition for the GitHub statistics API response for the portfolio project.
 * Used for validating data shape received from `/api/v1/github-stats`.
 *
 * @see https://effect-ts.org/docs/schema
 * @see https://github.com/WomB0ComB0/portfolio
 */
const GitHubStatsSchema = Schema.Struct({
  user: Schema.Struct({
    repos: Schema.Number,
    followers: Schema.Number,
    avatar_url: Schema.String,
  }),
  stats: Schema.Struct({
    totalStars: Schema.Number,
    topLanguages: Schema.Array(Schema.String),
  }),
  topRepos: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      description: Schema.Union(Schema.String, Schema.Null),
      stars: Schema.Number,
      language: Schema.Union(Schema.String, Schema.Null),
      url: Schema.String,
    }),
  ),
});

/**
 * @function
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @description
 * React memoized component which presents real-time GitHub statistics for the WomB0ComB0 portfolio, including
 * repository count, star count, follower count, top repositories by stars, and most-used languages. Dataa
 * is aggregated from both personal and ElysiumOSS organization repositories, fetched asynchronously from
 * a typed API endpoint and validated with runtime schemas.
 *
 * @returns {JSX.Element | null}
 * Renders complete GitHub statistics layout, loader skeletons, or null if no data is available.
 *
 * @throws {Error}
 * May throw on network error, schema validation error, or other fetch issues during queryFn execution.
 *
 * @see https://tanstack.com/query/v4/docs/framework/react/guides/queries
 * @see https://github.com/WomB0ComB0
 * @see /api/v1/github-stats endpoint
 *
 * @example
 * <GitHubStats />
 */
export const GitHubStats = memo(() => {
  /**
   * @async
   * @private
   * @author Mike Odnis
   * @description
   * Uses TanStack Query and `effect/fetch` to asynchronously fetch and validate GitHub stats from API.
   * Provides stale-while-revalidate caching for 1 hour.
   *
   * @returns {{data: any, isLoading: boolean}}
   *     Object with `data` (parsed/validated) and `isLoading` loading state boolean.
   *
   * @throws {Error} If network error or schema mismatch occurs.
   *
   * @see https://tanstack.com/query/latest/docs/react/reference/useQuery
   * @see https://github.com/WomB0ComB0/portfolio
   */
  const { data: githubData, isLoading } = useQuery({
    queryKey: ['github-stats'],
    queryFn: async () => {
      const effect = pipe(
        get('/api/v1/github-stats', {
          retries: 2,
          timeout: 10_000,
          schema: GitHubStatsSchema,
        }),
        Effect.provide(FetchHttpClient.layer),
      );
      return await Effect.runPromise(effect);
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  if (isLoading) {
    /**
     * @description
     * Renders loading skeleton placeholders while GitHub stats are being loaded via API.
     *
     * @returns {JSX.Element}
     *      Skeleton cards matching the target UI grid.
     */
    return (
      <div className="space-y-6">
        {/* Header section skeleton */}
        <div>
          <Skeleton className="h-7 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Stat Cards section skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, index) => (
            <Card
              key={`github-stat-skeleton-${index}`}
              className="overflow-hidden h-full shadow-lg bg-card"
            >
              <CardHeader>
                <Skeleton className="h-4 w-3/4 mb-1" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Top Repositories Section skeleton */}
        <div className="mt-8">
          <Skeleton className="h-6 w-72 mb-4" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...Array(2)].map((_, index) => (
              <Card key={`repo-skeleton-${index}`} className="h-full bg-card border-border">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Skeleton className="h-4 w-3/4 mb-1" />
                      <Skeleton className="h-3 w-full mb-1" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Top Languages Section skeleton */}
        <div className="mt-8">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="flex flex-wrap gap-2">
            {[...Array(4)].map((_, index) => (
              <Skeleton key={`lang-skeleton-${index}`} className="h-7 w-24 rounded-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!githubData) {
    /**
     * @description
     * Returns null if GitHub API data is not available after loading completes.
     *
     * @returns {null}
     */
    return null;
  }

  /**
   * @readonly
   * @type {Array<{
   *   title: string,
   *   value: number,
   *   icon: JSX.Element,
   *   description: string
   * }>}
   * @description
   * Card display configuration for the top-level stats cards (total repos, total stars, followers)
   * in the GitHub statistics dashboard.
   *
   * @author Mike Odnis
   */
  const statsCards = [
    {
      title: 'Total Repositories',
      value: githubData.user.repos,
      icon: <FiGithub className="h-4 w-4" />,
      description: 'Personal + ElysiumOSS',
    },
    {
      title: 'Total Stars',
      value: githubData.stats.totalStars,
      icon: <FiStar className="h-4 w-4" />,
      description: 'Across all repositories',
    },
    {
      title: 'Followers',
      value: githubData.user.followers,
      icon: <FiUsers className="h-4 w-4" />,
      description: 'GitHub followers',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div>
        <h2 className="text-2xl font-bold text-primary mb-2">GitHub Statistics</h2>
        <p className="text-muted-foreground">
          Combined stats from personal repos and ElysiumOSS organization
        </p>
      </div>

      {/* Stat Cards section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:grid-rows-[auto_1fr]">
        {statsCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="grid lg:grid-rows-[auto_1fr] lg:row-span-2"
          >
            <Card className="grid lg:grid-rows-subgrid lg:row-span-2 overflow-hidden h-full shadow-lg hover:shadow-xl transition-all duration-300 bg-card text-card-foreground border-border">
              <CardHeader className="lg:row-start-1">
                <CardTitle className="text-card-foreground text-lg">{card.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </CardHeader>
              <CardContent className="lg:row-start-2">
                <div className="flex items-center space-x-2">
                  {card.icon}
                  <NumberTicker
                    className="text-2xl font-bold text-card-foreground"
                    value={card.value}
                    decimalPlaces={0}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Top Repositories Section */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold text-primary mb-4">Top Repositories by Stars</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:grid-rows-[auto_1fr]">
          {githubData.topRepos.map((repo, index) => (
            <motion.div
              key={repo.url}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="grid lg:grid-rows-[auto_1fr] lg:row-span-2"
            >
              <a
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-full grid lg:grid-rows-[auto_1fr] lg:row-span-2"
              >
                <Card className="grid lg:grid-rows-subgrid lg:row-span-2 h-full hover:border-primary transition-all duration-300 bg-card border-border">
                  <CardHeader className="lg:row-start-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-primary text-base mb-1">{repo.name}</CardTitle>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {repo.description || 'No description available'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-400 ml-2">
                        <FiStar className="h-4 w-4" />
                        <span className="text-sm font-semibold">{repo.stars}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="lg:row-start-2">
                    {repo.language && (
                      <span className="inline-block px-2 py-1 text-xs bg-primary/20 text-primary rounded-full">
                        {repo.language}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </a>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Top Languages Section */}
      {githubData.stats.topLanguages.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-primary mb-4">Top Languages</h3>
          <div className="flex flex-wrap gap-2">
            {githubData.stats.topLanguages.map((language, index) => (
              <motion.span
                key={language}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium shadow-md"
              >
                {language}
              </motion.span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
GitHubStats.displayName = 'GitHubStats';
export default GitHubStats;
