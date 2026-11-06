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
 * @file The words and status-dot tone for each state /api/status reports, and the monitor count
 * line. Pure and isomorphic (no directive, no runtime imports), so server and client code share
 * one copy of the wording.
 *
 * The home status tile uses it all. The footer StatusBadge uses serviceCopyKey and the paused
 * words so far; PR F should move its other words here too, so the footer and the tile never
 * describe the same state in different words.
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

export const SERVICE_STATE_COPY: Readonly<Record<ServiceCopyKey, ServiceStateCopy>> = {
  operational: { label: 'All systems up', tone: 'live' },
  degraded: { label: 'Degraded performance', tone: 'ongoing' },
  down: { label: 'Service outage', tone: 'down' },
  unknown: { label: 'Status unavailable', tone: 'idle' },
  paused: { label: 'Monitoring paused', tone: 'idle' },
};

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
 * '6/6 monitors up', or undefined when there are no counts or no active monitor, so a tile never
 * prints a count it was not given ('0/0').
 */
export function monitorsLine(monitors?: MonitorCounts): string | undefined {
  if (!monitors || monitors.total === 0) return undefined;
  return `${monitors.up}/${monitors.total} monitors up`;
}
