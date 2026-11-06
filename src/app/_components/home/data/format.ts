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
 * @file Dates and times as the home tiles print them. Pure and isomorphic (no
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

/** A Sanity `date` (YYYY-MM-DD) or a month (YYYY-MM). */
const CALENDAR_DATE = /^\d{4}-\d{2}(?:-\d{2})?$/;
/** The calendar day a timestamp starts with: 2026-02-30 of 2026-02-30T12:00:00Z. */
const LEADING_DAY = /^\d{4}-\d{2}-\d{2}/;

/** A moment as a Date or epoch milliseconds. */
export type Instant = Date | number;

/** A place's or event's days, as Sanity stores them. */
export interface DateSpan {
  readonly startDate?: string | null;
  readonly endDate?: string | null;
}

/**
 * A span of days as printed: its first day, and its last when it ends on a later one. Apart, so a
 * page can set the two ends apart in markup (an en dash for the eye, 'to' for a screen reader).
 */
export interface DaySpanParts {
  readonly start: string;
  readonly end?: string;
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

/** `at` in epoch milliseconds. */
export const toMs = (at: Instant): number => (at instanceof Date ? at.getTime() : at);

interface ParsedDate {
  readonly ms: number;
  /** True for a calendar date, false for a timestamp. */
  readonly isCalendarDate: boolean;
}

/**
 * True when `day` (YYYY-MM-DD or YYYY-MM) is on the calendar. Date.parse rolls 2026-02-30 over to
 * March 2; a real day, read as UTC midnight, reads back as written.
 */
function isRealDay(day: string): boolean {
  const ms = Date.parse(day);
  return Number.isFinite(ms) && new Date(ms).toISOString().startsWith(day);
}

/**
 * `value` as epoch ms, or null when it is not a real date: 2026-02-30 is not, and neither is a
 * timestamp on that day (its day is checked as written, before its offset moves it).
 */
function parseDate(value: string): ParsedDate | null {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const isCalendarDate = CALENDAR_DATE.test(value);
  const day = isCalendarDate ? value : LEADING_DAY.exec(value)?.[0];
  if (day !== undefined && !isRealDay(day)) return null;
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

/** The day `parsed` falls on where it is printed, YYYY-MM-DD: UTC for a calendar date, else NY. */
const dayOf = (parsed: ParsedDate): string =>
  parsed.isCalendarDate ? new Date(parsed.ms).toISOString().slice(0, 10) : nyToday(parsed.ms);

/** The year `parsed` falls in, where it is printed. */
const yearOf = (parsed: ParsedDate): string => dayOf(parsed).slice(0, 4);

const formatsFor = (parsed: ParsedDate): DayFormats =>
  parsed.isCalendarDate ? CALENDAR_DAY_FORMATS : NY_DAY_FORMATS;

/** 'Oct 30', or 'Oct 30, 2025' with the year. */
function printDay(parsed: ParsedDate, withYear: boolean): string {
  const formats = formatsFor(parsed);
  return plainSpaces((withYear ? formats.dayWithYear : formats.day).format(parsed.ms));
}

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
  return printDay(parsed, now !== undefined && yearOf(parsed) !== nyToday(now).slice(0, 4));
}

/**
 * A span of days, split at the dash: { start: 'Jul 29', end: 'Sep 15' }, or { start: 'Nov 3',
 * end: '7' } within one month (the /places convention, src/utils/date.ts formatDateRangeParts).
 * As in formatDay, the year shows only when it is not `now`'s: once, at the end, for a span within
 * one year ('Sep 15, 2025'), and on both days for a span that crosses one ('Dec 28, 2025' to
 * 'Jan 3, 2026'). Without an end on a later day, just the start, as formatDay prints it. Null when
 * the start is not a date.
 */
export function formatDaySpan({ startDate, endDate }: DateSpan, now: Instant): DaySpanParts | null {
  const start = startDate ? parseDate(startDate) : null;
  if (!(startDate && start)) return null;
  const end = endDate ? parseDate(endDate) : null;
  if (!end || dayOf(end) <= dayOf(start)) return { start: formatDay(startDate, now) };

  const year = yearOf(end);
  if (yearOf(start) !== year) return { start: printDay(start, true), end: printDay(end, true) };
  const withYear = year !== nyToday(now).slice(0, 4);
  const yearSuffix = withYear ? `, ${year}` : '';
  const sameMonth = dayOf(start).slice(0, 7) === dayOf(end).slice(0, 7);
  const last = sameMonth
    ? `${Number(dayOf(end).slice(8, 10))}${yearSuffix}`
    : printDay(end, withYear);
  return { start: printDay(start, false), end: last };
}

/**
 * 'as of Nov 5': the day stale data was loaded (`asOf`, ISO 8601), for a tile whose data changes
 * too slowly to need the clock. '' without an `asOf` or when it is not a date: never a guess.
 */
export function formatAsOfDay(asOf: string | undefined, now: Instant): string {
  const day = asOf ? formatDay(asOf, now) : '';
  return day ? `as of ${day}` : '';
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

/**
 * The span's last day, YYYY-MM-DD (date parts only): its end when it has one on or after its
 * start, else its start. Null without a start date. A visit is over once this day is.
 *
 * Venues visited on and off store their latest visit as the start, and a stated run of visits as
 * a range (Corgi NYC: Jul 29 and Sep 15), whose last day is its end.
 *
 * @example
 * lastDayOf({ startDate: '2026-07-29', endDate: '2026-09-15' }) // '2026-09-15'
 * lastDayOf({ startDate: '2026-10-20', endDate: '2026-10-02' }) // '2026-10-20' (end before start)
 */
export function lastDayOf({ startDate, endDate }: DateSpan): string | null {
  const start = startDate?.slice(0, 10);
  if (!start) return null;
  const end = endDate?.slice(0, 10);
  return end && end >= start ? end : start;
}
