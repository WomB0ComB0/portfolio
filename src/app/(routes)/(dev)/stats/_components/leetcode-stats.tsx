'use client';

import { MagicCard } from '@/components';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import NumberTicker from '@/components/ui/number-ticker';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { memo } from 'react';
import { FiCode, FiPercent, FiTrendingUp } from 'react-icons/fi';

interface LeetCodeStatsData {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  acceptanceRate: number;
  ranking: number;
}

const LeetCodeStatsSkeleton = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
    {[...Array(3)].map((_, i) => (
      <Card key={`leetcode-stat-skeleton-${i}`} className="bg-card/50">
        <CardHeader>
          <Skeleton className="h-5 w-20 mb-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    ))}
  </div>
);

export const LeetCodeStats = memo(() => {
  const { data, isLoading } = useQuery<LeetCodeStatsData>({
    queryKey: ['leetcode-stats'],
    queryFn: () => fetch('/api/v1/leetcode').then((res) => res.json()),
    staleTime: 1000 * 60 * 60 * 6, // 6 hours
  });

  if (isLoading) {
    return <LeetCodeStatsSkeleton />;
  }

  if (!data) return null;

  const stats = [
    { title: 'Total Solved', value: data.totalSolved, icon: <FiCode /> },
    { title: 'Acceptance Rate', value: data.acceptanceRate, icon: <FiPercent />, unit: '%' },
    { title: 'Top Ranking', value: data.ranking, icon: <FiTrendingUp />, unit: '%' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <h3 className="text-xl font-semibold text-primary mb-4">LeetCode Stats</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                    decimalPlaces={stat.unit === '%' ? 2 : 0}
                  />
                  {stat.unit && <span>{stat.unit}</span>}
                </div>
              </CardContent>
            </MagicCard>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
});

LeetCodeStats.displayName = 'LeetCodeStats';
