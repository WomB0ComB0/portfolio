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
 * A slim tile of one line: a still dot and the state in words ('All systems up'), the link to the
 * public status page. A count follows only when some monitor is not up ('Degraded · 3/4 up'), and
 * a second line only for an old answer ('as of Nov 5, 11:02 AM ET'). The words name the tile, so
 * its h2 ('Site status') is for screen readers only. Nothing moves: the page's one moving thing is
 * the now-playing equaliser.
 *
 * Its query key is not the footer badge's ['system-status']: that query caches the whole
 * envelope, this one only `data`, and one key holding two shapes would break whichever read
 * second. Retries are the QueryClient's (shouldRetryQuery).
 *
 * Render reads no clock: times are absolute (New York), and whether an answer is old is decided
 * on the server (the route's `stale` flag) or by a failed poll, never by comparing the browser's
 * clock with the server's. The server HTML and the hydrating client therefore agree.
 *
 * Its root says what it shows, for the e2e layout checks (which compare only tiles showing their
 * reference content): data-state 'loading' (with aria-busy), 'ready' for a current answer,
 * 'stale' plus data-stale="" whenever it says 'Last known' (with its 'as of' line), and 'error'
 * for 'Status unavailable'.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactElement, type ReactNode, useEffect } from 'react';

import type { ServiceStatus } from '@/app/api/[[...route]]/status/schema';
import { StatusDot, type StatusTone } from '@/components/console/status-dot';
import { Tile } from '@/components/console/tile';
import { TileLink } from '@/components/console/tile-link';
import {
  CHECKING_STATUS,
  isLastKnownAnswer,
  SERVICE_STATE_COPY,
  STATUS_PAGE_URL,
  STATUS_SEPARATOR,
  serviceStatusWords,
} from '@/lib/status/service-state';
import { formatClockET, formatDay } from '../data/format';
import type { LiveInitial } from '../data/tile-result';
import { fetchJson, parseServiceStatus } from './live-fetch';

export const SERVICE_STATUS_QUERY_KEY = ['service-status'] as const;
const STATUS_URL = '/api/status';
/** How often the tile asks again; the route caches Better Stack's answer for as long. */
export const STATUS_POLL_MS = 60_000;
/** A snapshot younger than this is not fetched again on mount or on focus. */
const STATUS_STALE_MS = 55_000;

export const STATUS_TILE_TITLE = 'Site status';

/**
 * The dot, then the words: one line wherever they fit. The words are the state, so they wrap
 * rather than lose their end to an ellipsis ('All syste…' in a 320 px phone's 150 px lane,
 * 'Degraded · 3/…' at 375 px). The dot sits in a box one line tall, so it stays beside the first.
 */
const STATE_LINE_CLASS = 'flex min-w-0 items-start gap-2 tile-title';
const DOT_BOX_CLASS = 'flex h-[1lh] shrink-0 items-center';
/**
 * The link reads as text in the tile and takes the brand tint while the tile is hovered. Inline
 * text, so the new-tab arrow stays glued to the last word wherever the words wrap.
 */
const LINK_CLASS = 'min-w-0 text-foreground group-hover/tile:text-brand-ink';
const COUNT_CLASS = 'font-normal tabular-nums text-muted-foreground';
const META_CLASS = 'tile-meta text-muted-foreground';

/** What the tile shows: nothing known yet, or a state in words. */
export type ServiceStatusView =
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'status';
      /** The words, prefixed 'Last known: ' when the answer is old. */
      readonly label: string;
      /** '3/4 up', only when some active monitor is not up. */
      readonly count?: string;
      readonly tone: StatusTone;
      /** The answer is old: 'Last known: ...'. */
      readonly lastKnown: boolean;
      /** No answer to show: 'Status unavailable', for a failed check or the route's 'unknown'. */
      readonly unavailable: boolean;
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
  lastKnown: false,
  unavailable: true,
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
 * - Data: its state in words (serviceStatusWords), with '3/4 up' when some monitor is not up;
 *   'Monitoring paused' when no monitor is active. It becomes 'Last known: ...' with 'as of
 *   <day>, <time> ET' when the route marked it stale (its cached answer after Better Stack
 *   failed) or the latest poll failed (isLastKnownAnswer, which the footer badge shares). An
 *   'unknown' state is never 'last known'; it is 'Status unavailable'.
 */
export function serviceStatusView({
  data,
  isError,
  initialKind,
}: ServiceStatusViewInput): ServiceStatusView {
  if (!data) return isError || initialKind === 'error' ? UNAVAILABLE : { kind: 'loading' };

  const lastKnown = isLastKnownAnswer(data.state, data.stale, isError);
  const words = serviceStatusWords(data.state, data.monitors, lastKnown);
  const asOf = lastKnown ? asOfLine(data.lastUpdated) : undefined;
  return {
    kind: 'status',
    ...words,
    lastKnown,
    unavailable: data.state === 'unknown',
    ...(asOf ? { asOf } : {}),
  };
}

type ServiceStatusSnapshot = Extract<LiveInitial<ServiceStatus>, { kind: 'data' }>;

/**
 * Puts a server snapshot newer than the cached answer into the cache, so a return to '/' shows
 * an outage the server just saw instead of the answer cached before: the QueryClient outlives
 * client navigations, and initialData only fills an empty cache. An effect, as in TanStack's
 * HydrationBoundary: on a first load the cache holds this very snapshot, so the hydrating render
 * still matches the server HTML. Called before useQuery, so the query sees the newer answer when
 * it decides whether to fetch on mount.
 */
function useNewerSnapshot(seeded: ServiceStatusSnapshot | undefined): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!seeded) return;
    const cachedAt = queryClient.getQueryState(SERVICE_STATUS_QUERY_KEY)?.dataUpdatedAt ?? 0;
    if (seeded.fetchedAt <= cachedAt) return;
    queryClient.setQueryData(SERVICE_STATUS_QUERY_KEY, seeded.data, {
      updatedAt: seeded.fetchedAt,
    });
  }, [queryClient, seeded]);
}

function useServiceStatus(initial: LiveInitial<ServiceStatus>) {
  const seeded = initial.kind === 'data' ? initial : undefined;
  useNewerSnapshot(seeded);
  return useQuery({
    queryKey: SERVICE_STATUS_QUERY_KEY,
    queryFn: async ({ signal }) => parseServiceStatus(await fetchJson(STATUS_URL, { signal })),
    initialData: seeded?.data,
    initialDataUpdatedAt: seeded?.fetchedAt,
    staleTime: STATUS_STALE_MS,
    refetchInterval: STATUS_POLL_MS,
  });
}

/** The root's data-state: what the tile shows (see the file header). */
type StatusFrameState = 'loading' | 'ready' | 'stale' | 'error';

interface StatusFrameProps {
  variant: 'plain' | 'linked';
  state: StatusFrameState;
  children: ReactNode;
}

/** What a shown answer marks the tile: 'Status unavailable', an old answer, or a current one. */
const frameStateOf = (view: Extract<ServiceStatusView, { kind: 'status' }>): StatusFrameState => {
  if (view.unavailable) return 'error';
  return view.lastKnown ? 'stale' : 'ready';
};

/**
 * The slim tile: its hidden h2, then its line or two. It hugs them. A stale tile also carries
 * data-stale, as every tile showing a 'Last known' or 'as of' line does.
 */
function StatusFrame({ variant, state, children }: StatusFrameProps): ReactElement {
  return (
    <Tile
      variant={variant}
      className="gap-1"
      data-state={state}
      data-stale={state === 'stale' ? '' : undefined}
      aria-busy={state === 'loading' ? 'true' : undefined}
    >
      <h2 className="sr-only">{STATUS_TILE_TITLE}</h2>
      {children}
    </Tile>
  );
}

/**
 * The tile before any answer: an idle dot and the words for what it is doing, on its one line.
 * They are no state, so they are cut short rather than wrapped: wrapped in a 181 px lane they made
 * the skeleton a line taller than the 'All systems up' it stands in for, and the tiles below
 * moved when the answer landed.
 */
export function StatusTileSkeleton(): ReactElement {
  return (
    <StatusFrame variant="plain" state="loading">
      <p className={STATE_LINE_CLASS}>
        <span className={DOT_BOX_CLASS}>
          <StatusDot tone="idle" />
        </span>
        <span className="min-w-0 truncate text-muted-foreground">{CHECKING_STATUS}</span>
      </p>
    </StatusFrame>
  );
}

/**
 * The site's health in words, linked to the public status page. The dot beside the words only
 * decorates them; it never carries the state alone, and it never moves.
 *
 * @example
 * <StatusTile initial={await loadServiceStatus()} />
 */
export function StatusTile({ initial }: { initial: LiveInitial<ServiceStatus> }): ReactElement {
  const { data, isError } = useServiceStatus(initial);
  const view = serviceStatusView({ data, isError, initialKind: initial.kind });
  if (view.kind === 'loading') return <StatusTileSkeleton />;

  return (
    <StatusFrame variant="linked" state={frameStateOf(view)}>
      <p className={STATE_LINE_CLASS}>
        <span className={DOT_BOX_CLASS}>
          <StatusDot tone={view.tone} />
        </span>
        <TileLink
          href={STATUS_PAGE_URL}
          external
          srSuffix="(service status page)"
          className={LINK_CLASS}
        >
          <span data-status-words="">
            {view.label}
            {view.count && (
              <span className={COUNT_CLASS}>
                {STATUS_SEPARATOR}
                {view.count}
              </span>
            )}
          </span>
        </TileLink>
      </p>
      {view.asOf && <p className={META_CLASS}>{view.asOf}</p>}
    </StatusFrame>
  );
}
