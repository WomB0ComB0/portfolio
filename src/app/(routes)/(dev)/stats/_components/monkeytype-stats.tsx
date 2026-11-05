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
import { FaKeyboard } from 'react-icons/fa';
import { RetryButton } from '@/components/data/retry-button';
import { SectionError } from '@/components/data/section-error';
import NumberTicker from '@/components/ui/number-ticker';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsServerHtmlRender } from '@/hooks/use-is-server-html-render';
import { type MonkeytypeData, monkeytypeQuery } from '../_lib/stats-queries';
import { StatCard } from './stat-card';

/**
 * The ring draws itself in when it mounts in the browser. A ring hydrated from server HTML
 * already shows its value there (and without JavaScript), so it rests at it instead of emptying
 * and redrawing.
 */
const CircularProgress = ({ value, colorClass }: { value: number; colorClass: string }) => {
  const isServerHtml = useIsServerHtmlRender();
  const [skipsEntrance] = useState(isServerHtml);
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative w-20 h-20">
      <svg className="w-full h-full" viewBox="0 0 80 80" aria-hidden="true">
        <circle
          className="text-card-foreground/10"
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
          initial={skipsEntrance ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-base sm:text-lg font-bold text-card-foreground">
        {value.toFixed(0)}%
      </div>
    </div>
  );
};

/** WPM and accuracy come from the best 60 s personal best, not an average or the latest test. */
const PersonalBestCaption = () => (
  <p className="text-xs text-muted-foreground text-center">WPM and accuracy: 60 s personal best</p>
);

/** The card while its data loads: the loaded card's frame, with placeholders for its content. */
export const MonkeytypeStatsSkeleton = () => (
  <StatCard
    title="Monkeytype Stats"
    icon={<FaKeyboard />}
    footer={<PersonalBestCaption />}
    hasEntrance={false}
  >
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

const MonkeytypeStatsCard = ({ data }: { data: MonkeytypeData }) => {
  const best60 = data.personalBests.time['60']?.reduce(
    (best, current) => {
      return current.wpm > best.wpm ? current : best;
    },
    { wpm: 0, acc: 0 },
  );

  if (!best60) return null;

  return (
    <StatCard title="Monkeytype Stats" icon={<FaKeyboard />} footer={<PersonalBestCaption />}>
      <div className="grid grid-cols-3 gap-4 text-center items-center">
        <div className="flex flex-col items-center">
          <span className="text-xs text-muted-foreground">WPM</span>
          <NumberTicker
            className="text-md md:text-lg font-bold text-card-foreground"
            value={best60.wpm}
          />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-muted-foreground mb-1">Accuracy</span>
          <CircularProgress value={best60.acc} colorClass="text-green-400" />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-muted-foreground">Tests</span>
          <NumberTicker
            className="text-md md:text-lg font-bold text-card-foreground"
            value={data.typingStats.completedTests}
          />
        </div>
      </div>
    </StatCard>
  );
};

/**
 * The Monkeytype card. Its data is usually prefetched on the server, with the Dev Stats card's
 * (see the /stats page); otherwise it shows its skeleton and asks Monkeytype from the browser. A
 * failed load with nothing cached says so, with Try again.
 */
export const MonkeytypeStats = memo(() => {
  const { data, isError, refetch } = useQuery(monkeytypeQuery);

  if (data !== undefined) return <MonkeytypeStatsCard data={data} />;
  if (!isError) return <MonkeytypeStatsSkeleton />;
  return (
    <SectionError
      title="Couldn't load Monkeytype stats"
      headingLevel={2}
      action={<RetryButton onRetry={() => void refetch()} />}
    />
  );
});
MonkeytypeStats.displayName = 'MonkeytypeStats';
export default MonkeytypeStats;
