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

// Schema for GitHub Stats response
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

export default memo(function GitHubStats() {
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
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, index) => (
          <Card
            key={`github-skeleton-${index}`}
            className="overflow-hidden h-full shadow-lg bg-gradient-to-br from-gray-700 to-gray-800"
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

  if (!githubData) {
    return null;
  }

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
      <div>
        <h2 className="text-2xl font-bold text-purple-300 mb-2">GitHub Statistics</h2>
        <p className="text-gray-400">
          Combined stats from personal repos and ElysiumOSS organization
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {statsCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card className="overflow-hidden h-full shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-gray-700 to-gray-800 text-white border-gray-600">
              <CardHeader>
                <CardTitle className="text-gray-200 text-lg">{card.title}</CardTitle>
                <p className="text-xs text-gray-400">{card.description}</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {card.icon}
                  <NumberTicker
                    className="text-2xl font-bold text-white"
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
        <h3 className="text-xl font-semibold text-purple-300 mb-4">Top Repositories by Stars</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {githubData.topRepos.map((repo, index) => (
            <motion.div
              key={repo.url}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <a
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full"
              >
                <Card className="h-full hover:border-purple-500 transition-all duration-300 bg-[#1E1E1E] border-gray-700">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-purple-300 text-base mb-1">
                          {repo.name}
                        </CardTitle>
                        <p className="text-sm text-gray-400 line-clamp-2">
                          {repo.description || 'No description available'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-400 ml-2">
                        <FiStar className="h-4 w-4" />
                        <span className="text-sm font-semibold">{repo.stars}</span>
                      </div>
                    </div>
                  </CardHeader>
                  {repo.language && (
                    <CardContent>
                      <span className="inline-block px-2 py-1 text-xs bg-purple-700/30 text-purple-300 rounded-full">
                        {repo.language}
                      </span>
                    </CardContent>
                  )}
                </Card>
              </a>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Top Languages Section */}
      {githubData.stats.topLanguages.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-purple-300 mb-4">Top Languages</h3>
          <div className="flex flex-wrap gap-2">
            {githubData.stats.topLanguages.map((language, index) => (
              <motion.span
                key={language}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full text-sm font-medium shadow-md"
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
