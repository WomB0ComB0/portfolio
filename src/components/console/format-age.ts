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
 * @file How old a moment is, in words ('5 min ago'). No directive on purpose: this is a pure
 * function that server components call directly. Inside a 'use client' module it would reach a
 * server component only as a client reference, which throws when called.
 */

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Younger than this reads 'just now'. */
const JUST_NOW_MS = 45 * SECOND_MS;
/** Clock skew allowed for a timestamp in the future; beyond it the age is unknown. */
const FUTURE_TOLERANCE_MS = MINUTE_MS;

/** A moment as a Date, an ISO string or epoch milliseconds. */
export type Timestamp = Date | string | number;

/** Epoch milliseconds for `at`; NaN when it is not a valid moment. */
export const toTime = (at: Timestamp): number =>
  at instanceof Date ? at.getTime() : new Date(at).getTime();

/**
 * How long ago `at` was, in words: 'just now' under 45 s, then '5 min ago', '3 h ago', '2 d ago'
 * (whole units, rounded down). '' when `at` is not a valid moment or is more than a minute in
 * the future.
 */
export function formatAge(at: Timestamp, now: number = Date.now()): string {
  const age = now - toTime(at);
  if (!Number.isFinite(age) || age < -FUTURE_TOLERANCE_MS) return '';
  if (age < JUST_NOW_MS) return 'just now';
  if (age < HOUR_MS) return `${Math.max(1, Math.floor(age / MINUTE_MS))} min ago`;
  if (age < DAY_MS) return `${Math.floor(age / HOUR_MS)} h ago`;
  return `${Math.floor(age / DAY_MS)} d ago`;
}
