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

import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { memo, useState } from 'react';
import { FiArrowUpRight, FiGithub, FiStar, FiUsers } from 'react-icons/fi';
import { RetryButton } from '@/components/data/retry-button';
import { SectionError } from '@/components/data/section-error';
import { Badge } from '@/components/ui/badge';
import NumberTicker from '@/components/ui/number-ticker';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsServerHtmlRender } from '@/hooks/use-is-server-html-render';
import { type GitHubStatsData, githubStatsQuery } from '../_lib/stats-queries';
import { StatCard } from './stat-card';

/** Screen-reader unit for a repo's star count, which is shown as a bare number. */
const starsLabel = (stars: number) => (stars === 1 ? 'star' : 'stars');

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
    <div aria-hidden="true" className="text-muted-foreground">
      {icon}
    </div>
    <div>
      <NumberTicker className="text-lg md:text-xl font-bold text-card-foreground" value={value} />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </div>
);

/** The card while its data loads: the loaded card's frame, with placeholders for its content. */
export const GitHubStatsSkeleton = () => (
  <div className="space-y-8">
    <StatCard title="GitHub Stats" icon={<FiGithub />} hasEntrance={false}>
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

type TopRepo = GitHubStatsData['topRepos'][number];

/**
 * The repositories slide in one after another when the list mounts in the browser. A list
 * hydrated from server HTML is already in place, so it stays put (its server HTML never hides it).
 */
const TopRepoList = ({ repos }: { repos: readonly TopRepo[] }) => {
  const isServerHtml = useIsServerHtmlRender();
  const [skipsEntrance] = useState(isServerHtml);
  return (
    <div className="space-y-2">
      {repos.map((repo, index) => (
        <motion.a
          key={repo.url}
          href={repo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-3 rounded-lg hover:bg-card/50 transition-colors group"
          initial={skipsEntrance ? false : { opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: index * 0.05 }}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-foreground group-hover:text-primary group-focus-visible:text-primary">
                {repo.name}
              </p>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {repo.description || 'No description'}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
              <div className="flex items-center gap-1">
                <FiStar aria-hidden="true" className="h-4 w-4" />
                <span>
                  {repo.stars} <span className="sr-only">{starsLabel(repo.stars)}</span>
                </span>
              </div>
              <FiArrowUpRight
                aria-hidden="true"
                className="h-4 w-4 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
              />
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
          <span className="sr-only"> (opens in a new tab)</span>
        </motion.a>
      ))}
    </div>
  );
};

const GitHubStatsCard = ({ data }: { data: GitHubStatsData }) => (
  <div className="space-y-8">
    <StatCard title="GitHub Stats" icon={<FiGithub />}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left">
        <StatItem icon={<FiGithub size={24} />} value={data.user.repos} label="Repositories" />
        <StatItem icon={<FiStar size={24} />} value={data.stats.totalStars} label="Total Stars" />
        <StatItem icon={<FiUsers size={24} />} value={data.user.followers} label="Followers" />
      </div>
    </StatCard>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-3 space-y-4">
        <h3 className="text-xl font-semibold text-primary">Top Repositories</h3>
        <TopRepoList repos={data.topRepos} />
      </div>
    </div>
  </div>
);

/**
 * The GitHub card. Its data is usually prefetched on the server (see the /stats page), so it
 * renders on the first pass; otherwise it shows its skeleton and fetches in the browser. A failed
 * load with nothing cached says so, with Try again.
 */
export const GitHubStats = memo(() => {
  const { data, isError, refetch } = useQuery(githubStatsQuery);

  if (data !== undefined) return <GitHubStatsCard data={data} />;
  if (!isError) return <GitHubStatsSkeleton />;
  return (
    <SectionError
      title="Couldn't load GitHub stats"
      headingLevel={2}
      action={<RetryButton onRetry={() => void refetch()} />}
    />
  );
});
GitHubStats.displayName = 'GitHubStats';
export default GitHubStats;
