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
import { SERVICE_STATE_COPY, serviceCopyKey } from '@/lib/status/service-state';
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
    /** How many active monitors are up; total 0 means every monitor is paused. */
    monitors: Schema.optional(Schema.Struct({ up: Schema.Number, total: Schema.Number })),
    /** True when Better Stack just failed and this is its last answer, served from the cache. */
    stale: Schema.optional(Schema.Boolean),
  }),
});

type ServiceState = 'operational' | 'degraded' | 'down' | 'unknown';
type StatusData = Schema.Schema.Type<typeof StatusResponseSchema>['data'];

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

/** What the badge shows: its words (the link's name), its dot's colour, and whether it pulses. */
export interface StatusBadgeView {
  readonly label: string;
  readonly color: string;
  readonly pulse: boolean;
}

/** The badge for a current answer (or none yet). */
function currentView(data: StatusData | undefined): StatusBadgeView {
  const state = data?.state ?? 'unknown';
  if (serviceCopyKey(state, data?.monitors) === 'paused') {
    return {
      label: SERVICE_STATE_COPY.paused.label,
      color: getStatusColor('unknown'),
      pulse: false,
    };
  }
  return { label: getStatusLabel(state), color: getStatusColor(state), pulse: true };
}

/**
 * The badge for an answer (or none yet). An answer that counted no active monitor says
 * 'Monitoring paused' with the neutral dot, not pulsing: Better Stack reports 'operational' then,
 * with nothing being watched, which must never read as 'All Systems Operational'. An answer the
 * route flagged stale (its cached one, after Better Stack failed) says 'Last known: ...' and does
 * not pulse, as the home status tile does. An 'unknown' state is never 'last known'.
 */
export function statusBadgeView(data: StatusData | undefined): StatusBadgeView {
  const view = currentView(data);
  if (data?.stale !== true || data.state === 'unknown') return view;
  return { ...view, label: `Last known: ${view.label}`, pulse: false };
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
          // One attempt: the QueryClient's shared rule (shouldRetryQuery) does the retrying.
          retries: 0,
          timeout: 5_000,
        }),
        Effect.provide(FetchHttpClient.layer),
      );
      return await Effect.runPromise(effect);
    },
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60, // Refetch every minute
  });

  const { label, color, pulse } = statusBadgeView(statusData?.data);

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
      <span
        aria-hidden="true"
        className={cn('h-2 w-2 rounded-full', pulse && 'animate-pulse', color)}
      />
      <span className="hidden sm:inline">Status</span>
    </Link>
  );
});

StatusBadge.displayName = 'StatusBadge';
export default StatusBadge;
