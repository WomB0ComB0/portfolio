/**
 * Copyright 2026 Mike Odnis
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
 * @file The words /media writes for dates and lengths: "Dec 30, 2025" in a section's row, "Dec 30"
 * in the one feed's (its year bar holds the year, so unlike src/utils/date.ts's ranges these never
 * repeat it), "2026" over "latest, May" in the header, "Aug 24 – Dec 30" for a folded stream and
 * "10 h 10 min" for a total length. Always en-US in UTC, so the server and any browser write the
 * same text. Pure and server-safe.
 */

const MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const FULL_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const MONTH_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const DAY = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' });

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
/** "8:32:20" or "11:34": one to three hour digits, then one or two groups of two. */
const LENGTH_PATTERN = /^\d{1,3}(?::\d{1,2}){1,2}$/;

/** "Dec 30". */
export const monthDay = (iso: string): string => MONTH_DAY.format(new Date(iso));

/** "Dec 30, 2025": a day with its year, for a list no year bar heads. */
export const fullDay = (iso: string): string => FULL_DAY.format(new Date(iso));

/** "May 2026". */
export const monthYear = (iso: string): string => MONTH_YEAR.format(new Date(iso));

/** "May": the month alone, for the header's label. */
export const monthName = (iso: string): string => MONTH.format(new Date(iso));

/** "2026": the year a timestamp falls in (UTC), the header's one-line figure. */
export const yearOf = (iso: string): string => new Date(iso).toISOString().slice(0, 4);

/** "2025-12-30", the day a timestamp falls on in UTC, for <time dateTime>. */
export const isoDay = (iso: string): string => new Date(iso).toISOString().slice(0, 10);

/** "2025-12" for a timestamp, so two dates can be compared by month. */
const isoMonth = (iso: string): string => isoDay(iso).slice(0, 7);

/**
 * The span from the first part to the last: one day ("Dec 29"), days of one month
 * ("Dec 29 – 30") or across months ("Aug 24 – Dec 30").
 */
export function dateRange(first: string, last: string): string {
  if (isoDay(first) === isoDay(last)) return monthDay(first);
  const end = isoMonth(first) === isoMonth(last) ? DAY.format(new Date(last)) : monthDay(last);
  return `${monthDay(first)} – ${end}`;
}

/** A YouTube length ("8:32:20", "11:34") in seconds, or null when it is not one. */
export function lengthSeconds(length: string | null | undefined): number | null {
  const trimmed = length?.trim() ?? '';
  if (!LENGTH_PATTERN.test(trimmed)) return null;
  return trimmed.split(':').reduce((total, part) => total * SECONDS_PER_MINUTE + Number(part), 0);
}

/** A number of seconds as "42 h", "10 h 10 min" or "21 min", rounded to the minute. */
export function lengthText(seconds: number): string {
  const minutes = Math.round(seconds / SECONDS_PER_MINUTE);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * The lengths added up: "42 h", "10 h 10 min" or "21 min" (rounded to the minute); null when
 * none can be read.
 */
export function totalLength(lengths: readonly (string | null | undefined)[]): string | null {
  const seconds = lengths.map(lengthSeconds).filter((value): value is number => value !== null);
  if (seconds.length === 0) return null;
  return lengthText(seconds.reduce((sum, value) => sum + value, 0));
}
