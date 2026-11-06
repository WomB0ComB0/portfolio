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

/**
 * @file The home page's service status tile: the server's Better Stack snapshot first, then a
 * poll of /api/status every minute. Plain fetch through TanStack Query, no Effect.
 *
 * Its query key is not the footer badge's ['system-status']: that query caches the whole
 * envelope, this one only `data`, and one key holding two shapes would break whichever read
 * second. Retries are the QueryClient's (shouldRetryQuery).
 *
 * Render reads no clock: times are absolute (New York), and whether an answer is old is decided
 * on the server (the route's `stale` flag) or by a failed poll, never by comparing the browser's
 * clock with the server's. The server HTML and the hydrating client therefore agree.
 */

import { useQuery } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';

import type { ServiceStatus } from '@/app/api/[[...route]]/status/schema';
import { StatusDot, type StatusTone } from '@/components/console/status-dot';
import { Tile } from '@/components/console/tile';
import { TileLink } from '@/components/console/tile-link';
import {
  monitorsLine,
  SERVICE_STATE_COPY,
  STATUS_PAGE_URL,
  serviceCopyKey,
} from '@/lib/status/service-state';
import { cn } from '@/lib/utils';
import { formatClockET, formatDay } from '../data/format';
import type { LiveInitial } from '../data/tile-result';
import { fetchJson, parseServiceStatus } from './live-fetch';

export const SERVICE_STATUS_QUERY_KEY = ['service-status'] as const;
const STATUS_URL = '/api/status';
/** How often the tile asks again; the route caches Better Stack's answer for as long. */
export const STATUS_POLL_MS = 60_000;
/** A snapshot younger than this is not fetched again on mount or on focus. */
const STATUS_STALE_MS = 55_000;

const LABEL_CLASS = 'label-mono text-muted-foreground';
const STATE_LINE_CLASS = 'flex gap-2 text-body font-semibold';
/** One line tall, so the dot stays on the first line when the words wrap. */
const DOT_SLOT_CLASS = 'flex h-[1lh] shrink-0 items-center';
const META_CLASS = 'font-mono text-meta tabular-nums text-muted-foreground';
/** The link reads as text in the tile and takes the brand tint while the tile is hovered. */
const LINK_CLASS = 'min-w-0 text-foreground group-hover/tile:text-brand-ink';
const BAR_CLASS = 'block rounded-sm bg-surface-3 motion-safe:animate-pulse';

/** What the tile shows: nothing known yet, or a state in words. */
export type ServiceStatusView =
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'status';
      /** The words, prefixed 'Last known: ' when the answer is old. */
      readonly label: string;
      readonly tone: StatusTone;
      /** Only a current 'operational' answer with active monitors breathes. */
      readonly pulse: boolean;
      /** '6/6 monitors up', when the answer counted active monitors. */
      readonly monitors?: string;
      /** 'as of Nov 5, 11:02 AM ET', for a last known state. */
      readonly asOf?: string;
    };

export interface ServiceStatusViewInput {
  readonly data: ServiceStatus | undefined;
  /** The latest poll failed (after the QueryClient's retry). */
  readonly isError: boolean;
  /** How the server snapshot went: 'error' means the check already failed during the render. */
  readonly initialKind: LiveInitial<ServiceStatus>['kind'];
}

const UNAVAILABLE: ServiceStatusView = {
  kind: 'status',
  label: SERVICE_STATE_COPY.unknown.label,
  tone: SERVICE_STATE_COPY.unknown.tone,
  pulse: false,
};

/**
 * 'as of Nov 5, 11:02 AM ET': always with the day, so a check from an earlier day never reads as
 * today's. Undefined when `lastUpdated` is not a date.
 */
function asOfLine(lastUpdated: string): string | undefined {
  const day = formatDay(lastUpdated);
  const clock = formatClockET(Date.parse(lastUpdated));
  return day && clock ? `as of ${day}, ${clock}` : undefined;
}

/**
 * The tile's state:
 * - No data: 'Status unavailable' when the snapshot or the latest poll failed, else loading.
 * - Data: its state in words, with the monitor count; 'Monitoring paused' (idle, no count) when
 *   no monitor is active. It becomes 'Last known: ...' with 'as of <day>, <time> ET' when the
 *   route marked it stale (its cached answer after Better Stack failed) or the latest poll
 *   failed. An 'unknown' state is never 'last known'.
 */
export function serviceStatusView({
  data,
  isError,
  initialKind,
}: ServiceStatusViewInput): ServiceStatusView {
  if (!data) return isError || initialKind === 'error' ? UNAVAILABLE : { kind: 'loading' };

  const copyKey = serviceCopyKey(data.state, data.monitors);
  const copy = SERVICE_STATE_COPY[copyKey];
  const isLastKnown = data.state !== 'unknown' && (isError || data.stale === true);

  return {
    kind: 'status',
    label: isLastKnown ? `Last known: ${copy.label}` : copy.label,
    tone: copy.tone,
    pulse: copyKey === 'operational' && !isLastKnown,
    monitors: monitorsLine(data.monitors),
    asOf: isLastKnown ? asOfLine(data.lastUpdated) : undefined,
  };
}

function useServiceStatus(initial: LiveInitial<ServiceStatus>) {
  const seeded = initial.kind === 'data' ? initial : undefined;
  return useQuery({
    queryKey: SERVICE_STATUS_QUERY_KEY,
    queryFn: async ({ signal }) => parseServiceStatus(await fetchJson(STATUS_URL, { signal })),
    initialData: seeded?.data,
    initialDataUpdatedAt: seeded?.fetchedAt,
    staleTime: STATUS_STALE_MS,
    refetchInterval: STATUS_POLL_MS,
  });
}

interface StatusFrameProps {
  variant: 'plain' | 'linked';
  busy?: boolean;
  children: ReactNode;
}

function StatusFrame({ variant, busy, children }: StatusFrameProps): ReactElement {
  return (
    <Tile variant={variant} className="h-full gap-2" aria-busy={busy ? 'true' : undefined}>
      <h2 className={LABEL_CLASS}>Status</h2>
      {children}
    </Tile>
  );
}

/** The tile before any answer: the real label, an idle dot and the words for what it is doing. */
export function StatusTileSkeleton(): ReactElement {
  return (
    <StatusFrame variant="plain" busy>
      <p className={STATE_LINE_CLASS}>
        <span className={DOT_SLOT_CLASS}>
          <StatusDot tone="idle" />
        </span>
        <span className="text-muted-foreground">Checking status…</span>
      </p>
      <span aria-hidden="true" className={cn(BAR_CLASS, 'my-0.5 h-3.5 w-28')} />
    </StatusFrame>
  );
}

/**
 * The site's health in words, linked to the public status page. The dot beside the words only
 * decorates them; it never carries the state alone.
 *
 * @example
 * <StatusTile initial={await loadServiceStatus()} />
 */
export function StatusTile({ initial }: { initial: LiveInitial<ServiceStatus> }): ReactElement {
  const { data, isError } = useServiceStatus(initial);
  const view = serviceStatusView({ data, isError, initialKind: initial.kind });
  if (view.kind === 'loading') return <StatusTileSkeleton />;

  return (
    <StatusFrame variant="linked">
      <p className={STATE_LINE_CLASS}>
        <span className={DOT_SLOT_CLASS}>
          <StatusDot tone={view.tone} pulse={view.pulse} />
        </span>
        <TileLink
          href={STATUS_PAGE_URL}
          external
          srSuffix="(service status page)"
          className={LINK_CLASS}
        >
          {view.label}
        </TileLink>
      </p>
      {view.monitors && <p className={META_CLASS}>{view.monitors}</p>}
      {view.asOf && <p className={cn(META_CLASS, 'mt-auto')}>{view.asOf}</p>}
    </StatusFrame>
  );
}
