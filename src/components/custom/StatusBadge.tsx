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

import { FetchHttpClient } from '@effect/platform';
import { useQuery } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import Link from 'next/link';
import { memo } from 'react';
import { get } from '@/lib/http-clients/effect-fetcher';
import { cn } from '@/lib/utils';

const StatusResponseSchema = Schema.Struct({
  success: Schema.Literal(true),
  message: Schema.String,
  data: Schema.Struct({
    state: Schema.Union(
      Schema.Literal('operational'),
      Schema.Literal('degraded'),
      Schema.Literal('down'),
      Schema.Literal('unknown'),
    ),
    lastUpdated: Schema.String,
    message: Schema.optional(Schema.String),
  }),
});

type ServiceState = 'operational' | 'degraded' | 'down' | 'unknown';

interface StatusBadgeProps {
  className?: string;
}

/**
 * Get color classes based on service state
 */
function getStatusColor(state: ServiceState): string {
  switch (state) {
    case 'operational':
      return 'bg-emerald-500';
    case 'degraded':
      return 'bg-amber-500';
    case 'down':
      return 'bg-red-500';
    default:
      return 'bg-zinc-400';
  }
}

/**
 * Get text label based on service state
 */
function getStatusLabel(state: ServiceState): string {
  switch (state) {
    case 'operational':
      return 'All Systems Operational';
    case 'degraded':
      return 'Degraded Performance';
    case 'down':
      return 'Service Outage';
    default:
      return 'Status Unknown';
  }
}

/**
 * Client component that displays live status from Better Stack
 * Uses React Query for data fetching with Effect-based HTTP client
 */
export const StatusBadge = memo(({ className }: StatusBadgeProps) => {
  const { data: statusData } = useQuery({
    queryKey: ['system-status'],
    queryFn: async () => {
      const effect = pipe(
        get('/api/status', {
          schema: StatusResponseSchema,
          retries: 2,
          timeout: 5_000,
        }),
        Effect.provide(FetchHttpClient.layer),
      );
      return await Effect.runPromise(effect);
    },
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60, // Refetch every minute
    retry: 1,
  });

  const state = statusData?.data.state ?? 'unknown';
  const color = getStatusColor(state);
  const label = getStatusLabel(state);

  return (
    <Link
      href="https://status.mikeodnis.dev"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
        className,
      )}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true" className={cn('h-2 w-2 rounded-full animate-pulse', color)} />
      <span className="hidden sm:inline">Status</span>
    </Link>
  );
});

StatusBadge.displayName = 'StatusBadge';
export default StatusBadge;
