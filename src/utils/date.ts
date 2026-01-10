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
