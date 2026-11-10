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
 * @file The guestbook's dates and header figures. Pure and isomorphic: the server rows and the
 * client island's posted rows format through the same functions.
 *
 * A row shows the month only ("Oct 2025"). Most messages share one import timestamp, so a time
 * of day would repeat one moment 26 times. Dates are read in UTC, so the server's HTML and the
 * browser's render always print the same month.
 */

import type { GuestbookMessage } from '@/lib/guestbook/types';

const MONTH = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Epoch ms for an ISO string, or null when it is not a date. */
const timeOf = (iso: string): number | null => {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : null;
};

/** "Oct 2025" for an ISO date (UTC), or null when it cannot be read. */
export function monthOf(iso: string): string | null {
  const time = timeOf(iso);
  return time === null ? null : MONTH.format(time);
}

/** "2025-10-27" for a <time dateTime>: the UTC day, or null when it cannot be read. */
export function dayOf(iso: string): string | null {
  const time = timeOf(iso);
  return time === null ? null : new Date(time).toISOString().slice(0, 10);
}

/** The header's figures. */
export interface GuestbookStats {
  /** How many messages the page lists; '500+' when the safety cap cut the list. */
  readonly count: number | string;
  /** The month of the earliest message listed, or null when there is none. */
  readonly firstMonth: string | null;
}

/** The month of the earliest readable date among `messages`, or null when there is none. */
function earliestMonth(messages: readonly GuestbookMessage[]): string | null {
  let first: number | null = null;
  for (const { createdAt } of messages) {
    const time = timeOf(createdAt);
    if (time !== null && (first === null || time < first)) first = time;
  }
  return first === null ? null : MONTH.format(first);
}

/** The count and the first message's month, for the header's stat strip. */
export function guestbookStats(
  messages: readonly GuestbookMessage[],
  truncated: boolean,
): GuestbookStats {
  return {
    count: truncated ? `${messages.length}+` : messages.length,
    firstMonth: earliestMonth(messages),
  };
}

/**
 * The header's figures with `posted` counted too: stored messages posted on this page that the
 * server list doesn't have yet. The count goes up by their number, unless the list was capped
 * ('500+' stays as it is), and the first month comes from them only when the list had none. With
 * nothing posted, `stats` itself.
 */
export function withPosted(
  stats: GuestbookStats,
  posted: readonly GuestbookMessage[],
): GuestbookStats {
  if (posted.length === 0) return stats;
  return {
    count: typeof stats.count === 'number' ? stats.count + posted.length : stats.count,
    firstMonth: stats.firstMonth ?? earliestMonth(posted),
  };
}
