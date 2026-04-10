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
import { memo } from 'react';
import { SiLeetcode } from 'react-icons/si';
import NumberTicker from '@/components/ui/number-ticker';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from './stat-card';

interface LeetCodeStatsData {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  acceptanceRate: number;
  ranking: number;
}

const ProgressBar = ({
  value,
  max,
  colorClass,
}: {
  value: number;
  max: number;
  colorClass: string;
}) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full bg-primary-background/10 rounded-full h-2">
      <motion.div
        className={`h-2 rounded-full ${colorClass}`}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
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
  const { data, isLoading } = useQuery<LeetCodeStatsData>({
    queryKey: ['leetcode-stats'],
    queryFn: () => fetch('/api/v1/leetcode').then((res) => res.json()),
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
          className="text-xs text-primary-background/50 hover:underline text-center block"
        >
          View Profile
        </a>
      }
    >
      <div className="space-y-4">
        <div className="mx-auto w-full text-center space-y-1">
          <span className="text-sm text-primary-background/70 w-full">Total Solved</span>
          <NumberTicker
            className="text-lg md:text-xl font-bold text-primary-background w-full"
            value={totalSolved}
          />
        </div>
        <div className="space-y-2">
          {breakdown.map((stat) => (
            <div key={stat.label} className="grid grid-cols-5 items-center gap-2 text-sm">
              <span className="col-span-1 text-primary-background/70 text-xs">{stat.label}</span>
              <div className="col-span-3">
                <ProgressBar value={stat.value} max={totalSolved} colorClass={stat.colorClass} />
              </div>
              <span className="col-span-1 text-right font-semibold text-primary-background text-xs">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
        <Separator className="my-4 bg-primary-background/10" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
          <div>
            <span className="text-xs text-primary-background/70">Acceptance</span>
            <p className="text-lg sm:text-xl font-semibold text-primary-background">
              {acceptanceRate.toFixed(1)}%
            </p>
          </div>
          <div>
            <span className="text-xs text-primary-background/70">Ranking</span>
            <p className="text-lg sm:text-xl font-semibold text-primary-background">
              Top {ranking.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </StatCard>
  );
});
LeetCodeStats.displayName = 'LeetCodeStats';
