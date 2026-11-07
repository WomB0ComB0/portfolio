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

/**
 * @file The words and status-dot tone for each state /api/status reports, and the monitor count.
 * Pure and isomorphic (no directive, no runtime imports), so server and client code share one copy
 * of the wording: the home status tile and the footer StatusBadge both say a state the same way
 * ('All systems up', 'Degraded · 3/4 up', 'Last known: Outage · 2/4 up'), say 'Checking status…'
 * before any answer, and 'Status unavailable' only when the check failed with no answer or the
 * route could not say.
 */

import type { StatusTone } from '@/components/console/status-dot';

/**
 * The public status page. Here, not in the 'use client' status tile, so a server component that
 * imports it gets the string rather than a client reference.
 */
export const STATUS_PAGE_URL = 'https://status.mikeodnis.dev';

/** The states Better Stack's monitors sum up to (see the status route's schema). */
export type ServiceStateKey = 'operational' | 'degraded' | 'down' | 'unknown';

/**
 * What an answer says: its state, or 'paused' when it counted no active monitor. Better Stack
 * then reports 'operational' with nothing being watched, which must never read as 'up'.
 */
export type ServiceCopyKey = ServiceStateKey | 'paused';

/** What a state says, and the dot shown beside the words (never instead of them). */
export interface ServiceStateCopy {
  readonly label: string;
  readonly tone: StatusTone;
}

/** Sentence case, as short as the slim tile's one line allows. */
export const SERVICE_STATE_COPY: Readonly<Record<ServiceCopyKey, ServiceStateCopy>> = {
  operational: { label: 'All systems up', tone: 'live' },
  degraded: { label: 'Degraded', tone: 'ongoing' },
  down: { label: 'Outage', tone: 'down' },
  unknown: { label: 'Status unavailable', tone: 'idle' },
  paused: { label: 'Monitoring paused', tone: 'idle' },
};

/**
 * The words before any answer, while the check runs. No state's words: nothing has failed yet, so
 * it is never 'Status unavailable'. Here, not in the 'use client' status tile, so the footer badge
 * shares them.
 */
export const CHECKING_STATUS = 'Checking status…';

/** Before the words of an old answer (see isLastKnownAnswer). */
export const LAST_KNOWN_PREFIX = 'Last known: ';

/**
 * Between a state and its count. The no-break space keeps the dot on the state's line when the
 * words wrap.
 */
export const STATUS_SEPARATOR = ' · ';

/** How many of the active monitors are up, as the status route reports them. */
export interface MonitorCounts {
  readonly up: number;
  readonly total: number;
}

/**
 * Which copy an answer gets: 'paused' when it counted its monitors and none is active, else its
 * state. 'unknown' stays 'unknown' (it never has counts).
 *
 * @example serviceCopyKey('operational', { up: 0, total: 0 }) // 'paused'
 */
export function serviceCopyKey(state: ServiceStateKey, monitors?: MonitorCounts): ServiceCopyKey {
  return state !== 'unknown' && monitors?.total === 0 ? 'paused' : state;
}

/**
 * '3/4 up': how many active monitors are up, only when some are not. Undefined when every one is
 * up (the state already says so), and without counts or an active monitor, so nothing ever prints
 * a count it was not given ('0/0') or a bare one.
 */
export function monitorsLine(monitors?: MonitorCounts): string | undefined {
  if (!monitors || !(monitors.total > 0) || monitors.up >= monitors.total) return undefined;
  return `${monitors.up}/${monitors.total} up`;
}

/**
 * Whether an answer is an old one, said 'Last known: ...': the route flagged it stale (its cached
 * answer after Better Stack failed), or the latest poll failed and this is the answer kept from
 * before. An 'unknown' state never is. The tile and the footer badge both decide it here, so they
 * never word the same answer differently.
 *
 * @example isLastKnownAnswer('operational', undefined, true) // true: a later poll failed
 */
export function isLastKnownAnswer(
  state: ServiceStateKey,
  stale: boolean | undefined,
  pollFailed: boolean,
): boolean {
  return state !== 'unknown' && (pollFailed || stale === true);
}

/** A state as both the tile and the footer badge word it. */
export interface ServiceStatusWords {
  /** 'All systems up', or 'Last known: All systems up' for an old answer. */
  readonly label: string;
  /** '3/4 up', when some active monitor is not up. */
  readonly count?: string;
  readonly tone: StatusTone;
}

/**
 * An answer's words. `lastKnown` marks an old answer (served from the route's cache after Better
 * Stack failed, or kept after a failed poll) 'Last known: ...'; an 'unknown' state never is. A
 * paused or unknown answer has no count.
 */
export function serviceStatusWords(
  state: ServiceStateKey,
  monitors: MonitorCounts | undefined,
  lastKnown: boolean,
): ServiceStatusWords {
  const key = serviceCopyKey(state, monitors);
  const copy = SERVICE_STATE_COPY[key];
  const isLastKnown = lastKnown && state !== 'unknown';
  const count = key === 'paused' || key === 'unknown' ? undefined : monitorsLine(monitors);
  return {
    label: isLastKnown ? `${LAST_KNOWN_PREFIX}${copy.label}` : copy.label,
    ...(count ? { count } : {}),
    tone: copy.tone,
  };
}

/** The words as one line, e.g. 'Degraded · 3/4 up'. */
export const statusSentence = ({ label, count }: ServiceStatusWords): string =>
  count ? `${label}${STATUS_SEPARATOR}${count}` : label;
