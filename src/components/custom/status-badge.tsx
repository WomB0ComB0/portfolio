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
import { StatusDot, type StatusTone } from '@/components/console/status-dot';
import { NEW_TAB_LABEL } from '@/components/console/tile-link';
import { get } from '@/lib/http-clients/effect-fetcher';
import {
  CHECKING_STATUS,
  isLastKnownAnswer,
  SERVICE_STATE_COPY,
  serviceStatusWords,
  statusSentence,
} from '@/lib/status/service-state';
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

type StatusData = Schema.Schema.Type<typeof StatusResponseSchema>['data'];

interface StatusBadgeProps {
  className?: string;
}

/**
 * What the badge shows: its words (in the link's name and title) and its dot's tone, the home
 * status tile's for the same answer, painted by the console kit's StatusDot with the palette's
 * live, ongoing, down and faint tokens.
 */
export interface StatusBadgeView {
  readonly label: string;
  readonly tone: StatusTone;
}

/**
 * The badge for an answer (or none yet), in the home status tile's words (serviceStatusWords):
 * - no answer: 'Checking status…' while the check runs, 'Status unavailable' once it failed;
 * - an answer: 'All systems up', 'Degraded · 3/4 up', 'Outage · 2/4 up'. One that counted no
 *   active monitor says 'Monitoring paused' with the neutral dot: Better Stack reports
 *   'operational' then, with nothing being watched, which must never read as up. The route's
 *   'unknown' says 'Status unavailable';
 * - an old answer, which the route flagged stale (its cached one, after Better Stack failed) or
 *   kept after a later poll failed (`isError`), says 'Last known: ...', exactly as the tile does
 *   (isLastKnownAnswer). An 'unknown' state is never 'last known'.
 *
 * The dot never moves: the home page's one moving thing is the now-playing equaliser. Paused and
 * unknown answers, and no answer yet, share the neutral (idle) dot.
 *
 * @example statusBadgeView(undefined) // { label: 'Checking status…', tone: 'idle' }
 */
export function statusBadgeView(data: StatusData | undefined, isError = false): StatusBadgeView {
  if (!data) {
    return {
      label: isError ? SERVICE_STATE_COPY.unknown.label : CHECKING_STATUS,
      tone: SERVICE_STATE_COPY.unknown.tone,
    };
  }
  const lastKnown = isLastKnownAnswer(data.state, data.stale, isError);
  const words = serviceStatusWords(data.state, data.monitors, lastKnown);
  return { label: statusSentence(words), tone: words.tone };
}

/**
 * Client component that displays live status from Better Stack
 * Uses React Query for data fetching with Effect-based HTTP client
 */
export const StatusBadge = memo(({ className }: StatusBadgeProps) => {
  const { data: statusData, isError } = useQuery({
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

  /**
   * The title is the state's words. The name starts with the visible word 'Status', shown at every
   * width (label in name, so voice control's "click Status" finds the link), then the same words,
   * then the new-tab cue every other external link carries.
   */
  const { label, tone } = statusBadgeView(statusData?.data, isError);

  return (
    <Link
      href="https://status.mikeodnis.dev"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
        className,
      )}
      aria-label={`Status: ${label} ${NEW_TAB_LABEL}`}
      title={label}
    >
      <StatusDot tone={tone} />
      <span>Status</span>
    </Link>
  );
});

StatusBadge.displayName = 'StatusBadge';
