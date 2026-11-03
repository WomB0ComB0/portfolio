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

import type { DateFormatOptions } from './date.types';

/**
 * Formats a date string to a consistent format to prevent hydration mismatches.
 * Always uses 'en-US' locale and UTC timezone to ensure server/client consistency.
 *
 * @param {string | Date} date - The date to format (ISO string or Date object).
 * @param {DateFormatOptions} [options] - Optional formatting options.
 * @returns {string} The formatted date string.
 * @throws {Error} If the date is invalid.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @example
 * formatDate('2023-01-15T10:00:00Z', { month: 'short', year: 'numeric' })
 * // Returns: "Jan 2023"
 */
export function formatDate(
  date: string | Date,
  options = {
    month: 'short',
    year: 'numeric',
  } as DateFormatOptions,
): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (Number.isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }

    // Use Intl.DateTimeFormat with explicit locale and timeZone for consistency
    const formatter = new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: 'UTC',
    });

    return formatter.format(dateObj);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}

/**
 * Formats a date period (start to end or start to present).
 * Prevents hydration mismatches by using consistent formatting.
 *
 * @param {string | Date} startDate - The start date.
 * @param {string | Date | null} [endDate] - The end date, or null for ongoing.
 * @param {boolean} [isCurrent=false] - Whether the period is current/ongoing.
 * @returns {string} The formatted date period string.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @example
 * formatDatePeriod('2023-01-01', '2023-12-31')
 * // Returns: "Jan 2023 - Dec 2023"
 *
 * formatDatePeriod('2023-01-01', null, true)
 * // Returns: "Jan 2023 - Present"
 */
export function formatDatePeriod(
  startDate: string | Date,
  endDate?: string | Date | null,
  isCurrent: boolean = false,
): string {
  const formattedStart = formatDate(startDate, { month: 'short', year: 'numeric' });

  if (isCurrent) {
    return `${formattedStart} - Present`;
  }

  if (endDate) {
    const formattedEnd = formatDate(endDate, { month: 'short', year: 'numeric' });
    return `${formattedStart} - ${formattedEnd}`;
  }

  return `${formattedStart} - Present`;
}

const RANGE_SEPARATOR = ' – ';
const MONTH_DAY: DateFormatOptions = { month: 'short', day: 'numeric' };
const MONTH_DAY_YEAR: DateFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };

const toValidDate = (value: string | Date): Date | null => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Midnight UTC of the date's UTC calendar day, so times within one day compare equal. */
const utcDay = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/** Display labels for each end of a date range; `end` is absent for a single day. */
export interface DateRangeParts {
  start: string;
  end?: string;
}

/**
 * Splits a calendar-day range into compact start/end labels, collapsing the shared month
 * and year (e.g. `{ start: 'May 19', end: '20, 2026' }`), so each end can sit in its own
 * `<time>` element. Days are compared in UTC; the start shows alone when the end is
 * missing, invalid, or not on a later day.
 *
 * Built from {@link formatDate} (en-US, UTC) rather than `Intl.DateTimeFormat#formatRange`,
 * whose separator varies across ICU versions and would risk hydration mismatches.
 *
 * @param {string | Date | null} [startDate] - First day (e.g. Sanity `date` value "2026-05-19").
 * @param {string | Date | null} [endDate] - Optional last day.
 * @returns {DateRangeParts | null} The labels, or null when the start is missing or invalid.
 * @public
 */
export function formatDateRangeParts(
  startDate?: string | Date | null,
  endDate?: string | Date | null,
): DateRangeParts | null {
  const start = startDate ? toValidDate(startDate) : null;
  if (!start) return null;

  const end = endDate ? toValidDate(endDate) : null;
  if (!end || utcDay(end) <= utcDay(start)) return { start: formatDate(start, MONTH_DAY_YEAR) };

  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    return { start: formatDate(start, MONTH_DAY_YEAR), end: formatDate(end, MONTH_DAY_YEAR) };
  }

  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const endDay = sameMonth ? String(end.getUTCDate()) : formatDate(end, MONTH_DAY);
  return { start: formatDate(start, MONTH_DAY), end: `${endDay}, ${start.getUTCFullYear()}` };
}

/**
 * Formats a calendar-day range compactly as one string. See {@link formatDateRangeParts}.
 *
 * @param {string | Date | null} [startDate] - First day (e.g. Sanity `date` value "2026-05-19").
 * @param {string | Date | null} [endDate] - Optional last day.
 * @returns {string} The formatted range, '' when there is no start date, or 'Invalid date'.
 * @public
 * @example
 * formatDateRange('2026-05-19', '2026-05-20') // "May 19 – 20, 2026"
 * formatDateRange('2026-07-29', '2026-09-15') // "Jul 29 – Sep 15, 2026"
 * formatDateRange('2025-12-30', '2026-01-02') // "Dec 30, 2025 – Jan 2, 2026"
 */
export function formatDateRange(
  startDate?: string | Date | null,
  endDate?: string | Date | null,
): string {
  if (!startDate) return '';
  const parts = formatDateRangeParts(startDate, endDate);
  if (!parts) return 'Invalid date';
  return parts.end ? `${parts.start}${RANGE_SEPARATOR}${parts.end}` : parts.start;
}

/**
 * Formats a full date with time for display.
 * Uses consistent formatting to prevent hydration mismatches.
 *
 * @param {string | Date} date - The date to format.
 * @returns {string} The formatted date and time string.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @example
 * formatDateTime('2023-01-15T14:30:00Z')
 * // Returns: "January 15, 2023, 02:30 PM"
 */
export function formatDateTime(date: string | Date): string {
  return formatDate(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a date for display without time.
 * Uses consistent formatting to prevent hydration mismatches.
 *
 * @param {string | Date} date - The date to format.
 * @returns {string} The formatted date string.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @example
 * formatDateOnly('2023-01-15')
 * // Returns: "January 15, 2023"
 */
export function formatDateOnly(date: string | Date): string {
  return formatDate(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formats a month and year for display.
 * Uses consistent formatting to prevent hydration mismatches.
 *
 * @param {string | Date} date - The date to format.
 * @returns {string} The formatted month and year string.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @example
 * formatMonthYear('2023-01-15')
 * // Returns: "Jan 2023"
 */
export function formatMonthYear(date: string | Date): string {
  return formatDate(date, {
    month: 'short',
    year: 'numeric',
  });
}
