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
 * @file Dates, times and coordinates as the home tiles print them. Pure and isomorphic (no
 * directive), so server tiles and client islands share it. Everything that depends on the clock
 * takes `now`, so tests and hydration-sensitive callers pass their own.
 *
 * - "Today", "yesterday" and clock times are New York's, where the site's owner lives.
 * - A Sanity calendar date (YYYY-MM-DD, or YYYY-MM) is a day, not a moment: it is printed as
 *   written, in UTC, which never shifts it to the day before.
 * - A timestamp (ISO 8601 with a time) is printed in New York time.
 * - A value that is not a real date prints as '' (never 'Invalid Date').
 */

import { formatAge } from '@/components/console/format-age';

export const NY_TIME_ZONE = 'America/New_York';

const DAY_MS = 24 * 60 * 60_000;
/** From this many days back, a relative time gives way to the date itself. */
const RELATIVE_DAYS_LIMIT = 14;
const COORDINATE_DECIMALS = 2;

/** A Sanity `date` (YYYY-MM-DD) or a month (YYYY-MM). */
const CALENDAR_DATE = /^\d{4}-\d{2}(?:-\d{2})?$/;

/** A moment as a Date or epoch milliseconds. */
export type Instant = Date | number;

/** A place's or event's days, as Sanity stores them. */
export interface DateSpan {
  readonly startDate?: string | null;
  readonly endDate?: string | null;
}

interface DayFormats {
  readonly monthYear: Intl.DateTimeFormat;
  readonly day: Intl.DateTimeFormat;
  readonly dayWithYear: Intl.DateTimeFormat;
}

const dayFormatsIn = (timeZone: string): DayFormats => ({
  monthYear: new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', year: 'numeric' }),
  day: new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }),
  dayWithYear: new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }),
});

const CALENDAR_DAY_FORMATS = dayFormatsIn('UTC');
const NY_DAY_FORMATS = dayFormatsIn(NY_TIME_ZONE);

const NY_DATE_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: NY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const NY_CLOCK = new Intl.DateTimeFormat('en-US', {
  timeZone: NY_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Plain spaces only. Some ICU versions put a narrow no-break space before 'AM'; a server and a
 * browser that disagree on it would make hydration fail.
 */
const plainSpaces = (text: string): string => text.replace(/\s+/gu, ' ');

const toMs = (at: Instant): number => (at instanceof Date ? at.getTime() : at);

interface ParsedDate {
  readonly ms: number;
  /** True for a calendar date, false for a timestamp. */
  readonly isCalendarDate: boolean;
}

/** `value` as epoch ms, or null when it is not a real date (2026-02-30 included). */
function parseDate(value: string): ParsedDate | null {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const isCalendarDate = CALENDAR_DATE.test(value);
  // Date.parse rolls 2026-02-30 over to March 2; a real calendar date reads back as written.
  if (isCalendarDate && !new Date(ms).toISOString().startsWith(value)) return null;
  return { ms, isCalendarDate };
}

/**
 * Today's date in New York, YYYY-MM-DD. `now` must be a valid moment.
 *
 * @example nyToday(new Date('2026-11-06T03:30:00Z')) // '2026-11-05' (10:30 PM in New York)
 */
export function nyToday(now: Instant = new Date()): string {
  const parts = NY_DATE_PARTS.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** The year `parsed` falls in, where it is printed. */
const yearOf = (parsed: ParsedDate): string =>
  parsed.isCalendarDate
    ? new Date(parsed.ms).toISOString().slice(0, 4)
    : nyToday(parsed.ms).slice(0, 4);

const formatsFor = (parsed: ParsedDate): DayFormats =>
  parsed.isCalendarDate ? CALENDAR_DAY_FORMATS : NY_DAY_FORMATS;

/** 'Mar 2026'. '' when `value` is not a date. */
export function formatMonthYear(value: string): string {
  const parsed = parseDate(value);
  return parsed ? plainSpaces(formatsFor(parsed).monthYear.format(parsed.ms)) : '';
}

/**
 * 'Oct 30'. With `now`, a day in another year than `now`'s adds the year ('Oct 30, 2025'), so
 * an old date never reads as a recent one. '' when `value` is not a date.
 */
export function formatDay(value: string, now?: Instant): string {
  const parsed = parseDate(value);
  if (!parsed) return '';
  const formats = formatsFor(parsed);
  const otherYear = now !== undefined && yearOf(parsed) !== nyToday(now).slice(0, 4);
  return plainSpaces((otherYear ? formats.dayWithYear : formats.day).format(parsed.ms));
}

/** Whole days from calendar day `from` to calendar day `to` (both YYYY-MM-DD, or YYYY-MM). */
const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

/** A past day, `days` (at least 1) New York calendar days before `now`. */
function formatDaysAgo(days: number, value: string, now: Instant): string {
  if (days === 1) return 'yesterday';
  if (days < RELATIVE_DAYS_LIMIT) return `${days} d ago`;
  return formatDay(value, now);
}

/** A calendar date: 'today', 'yesterday', '3 d ago', then the date. '' when it is ahead. */
function formatRelativeDay(value: string, now: Instant): string {
  const days = daysBetween(value, nyToday(now));
  if (days < 0) return '';
  if (days === 0) return 'today';
  return formatDaysAgo(days, value, now);
}

/**
 * How long ago `value` was.
 *
 * - A timestamp under a day old reads like the console's Freshness ('just now' under 45 s, then
 *   '5 min ago', '3 h ago'). Older ones count New York calendar days: 'yesterday', then
 *   '3 d ago' up to 13 days, then the date ('Oct 30', with the year when it is not `now`'s).
 * - A calendar date counts days only: 'today', 'yesterday', '3 d ago', then the date.
 * - '' when `value` is not a date or lies ahead of `now` (beyond a minute of clock skew).
 */
export function formatRelative(value: string, now: Instant = Date.now()): string {
  const parsed = parseDate(value);
  if (!parsed) return '';
  if (parsed.isCalendarDate) return formatRelativeDay(value, now);

  const nowMs = toMs(now);
  if (nowMs - parsed.ms < DAY_MS) return formatAge(parsed.ms, nowMs);
  const days = daysBetween(nyToday(parsed.ms), nyToday(nowMs));
  // Only on the 25-hour day when clocks fall back can a day-old moment share today's date.
  if (days === 0) return formatAge(parsed.ms, nowMs);
  return formatDaysAgo(days, value, nowMs);
}

/**
 * A New York clock time: '11:02 AM ET'. en-US hours are 12-hour, so AM/PM stays. '' when `ms`
 * is not a number.
 */
export function formatClockET(ms: number): string {
  if (!Number.isFinite(ms)) return '';
  return `${plainSpaces(NY_CLOCK.format(ms))} ET`;
}

/** One axis to 2 decimals with its hemisphere. A value that rounds to 0 takes the positive one. */
function formatAxis(value: number, positive: string, negative: string): string {
  const magnitude = Math.abs(value).toFixed(COORDINATE_DECIMALS);
  const hemisphere = value < 0 && Number(magnitude) !== 0 ? negative : positive;
  return `${magnitude}° ${hemisphere}`;
}

/** '40.71° N, 74.01° W'. '' when either value is not a finite number. */
export function formatCoordinates(latitude: number, longitude: number): string {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  return `${formatAxis(latitude, 'N', 'S')}, ${formatAxis(longitude, 'E', 'W')}`;
}

/**
 * True when `today` (YYYY-MM-DD) is one of the span's days: its start day, or any day from start
 * to end when it has an end. False without a start date.
 */
export function isOngoing({ startDate, endDate }: DateSpan, today: string): boolean {
  if (!startDate) return false;
  const start = startDate.slice(0, 10);
  if (start === today) return true;
  const end = endDate?.slice(0, 10);
  return end ? start <= today && today <= end : false;
}
