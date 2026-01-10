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

import { Badge } from '@/components/ui/badge';
import NumberTicker from '@/components/ui/number-ticker';
import { Skeleton } from '@/components/ui/skeleton';
import { get } from '@/lib/http-clients/effect-fetcher';
import { FetchHttpClient } from '@effect/platform';
import { useQuery } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import { motion } from 'motion/react';
import { memo } from 'react';
import { FiArrowUpRight, FiGithub, FiStar, FiUsers } from 'react-icons/fi';
import { StatCard } from './stat-card';

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

const StatItem = ({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) => (
  <div className="flex items-center gap-3">
    <div className="text-primary-background/80">{icon}</div>
    <div>
      <NumberTicker
        className="text-lg md:text-xl font-bold text-primary-background"
        value={value}
      />
      <p className="text-xs text-primary-background/60">{label}</p>
    </div>
  </div>
);

const GitHubStatsSkeleton = () => (
  <div className="space-y-8">
    <StatCard title="GitHub Stats" icon={<FiGithub />}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </StatCard>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-4">
        <Skeleton className="h-6 w-40" />
        {new Array(3).fill(null).map((_, i) => (
          <Skeleton key={`skeleton-${Number(i)}`} className="h-16 w-full" />
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  </div>
);

export const GitHubStats = memo(() => {
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
    return <GitHubStatsSkeleton />;
  }

  if (!githubData) {
    return null;
  }

  return (
    <div className="space-y-8">
      <StatCard title="GitHub Stats" icon={<FiGithub />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left">
          <StatItem
            icon={<FiGithub size={24} />}
            value={githubData.user.repos}
            label="Repositories"
          />
          <StatItem
            icon={<FiStar size={24} />}
            value={githubData.stats.totalStars}
            label="Total Stars"
          />
          <StatItem
            icon={<FiUsers size={24} />}
            value={githubData.user.followers}
            label="Followers"
          />
        </div>
      </StatCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-3 space-y-4">
          <h3 className="text-xl font-semibold text-primary">Top Repositories</h3>
          <div className="space-y-2">
            {githubData.topRepos.map((repo, index) => (
              <motion.a
                key={repo.url}
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg hover:bg-card/50 transition-colors group"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-foreground group-hover:text-primary">
                      {repo.name}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {repo.description || 'No description'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                    <div className="flex items-center gap-1">
                      <FiStar className="h-4 w-4" />
                      <span>{repo.stars}</span>
                    </div>
                    <FiArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100" />
                  </div>
                </div>
                {repo.language && (
                  <Badge
                    variant="secondary"
                    className="mt-2 text-xs bg-primary/10 text-primary border-primary/20"
                  >
                    {repo.language}
                  </Badge>
                )}
              </motion.a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
GitHubStats.displayName = 'GitHubStats';
export default GitHubStats;
