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
 * @file Date Utility Tests
 * @description Unit tests for date formatting utilities.
 */

import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatDateOnly,
  formatDatePeriod,
  formatDateRange,
  formatDateRangeParts,
  formatDateTime,
  formatMonthYear,
} from '../../../src/utils/date';

describe('Date Utilities', () => {
  describe('formatDate', () => {
    it('formats ISO date string to short month and year', () => {
      const result = formatDate('2025-01-08T12:00:00Z');
      expect(result).toBe('Jan 2025');
    });

    it('formats Date object correctly', () => {
      const date = new Date('2025-06-15T00:00:00Z');
      const result = formatDate(date);
      expect(result).toBe('Jun 2025');
    });

    it('handles custom format options', () => {
      const result = formatDate('2025-01-08T12:00:00Z', {
        month: 'long',
        year: 'numeric',
        day: 'numeric',
      });
      expect(result).toBe('January 8, 2025');
    });

    it('returns "Invalid date" for invalid input', () => {
      const result = formatDate('not-a-date');
      expect(result).toBe('Invalid date');
    });

    it('returns "Invalid date" for empty string', () => {
      const result = formatDate('');
      expect(result).toBe('Invalid date');
    });

    it('uses UTC timezone for consistency', () => {
      // This ensures server/client hydration consistency
      const result = formatDate('2025-12-31T23:59:59Z');
      expect(result).toBe('Dec 2025');
    });
  });

  describe('formatDatePeriod', () => {
    it('formats start to end date range', () => {
      const result = formatDatePeriod('2023-01-01', '2024-12-31');
      expect(result).toBe('Jan 2023 - Dec 2024');
    });

    it('formats current/ongoing period', () => {
      const result = formatDatePeriod('2023-01-01', null, true);
      expect(result).toBe('Jan 2023 - Present');
    });

    it('shows Present when endDate is null and not explicitly current', () => {
      const result = formatDatePeriod('2023-01-01');
      expect(result).toBe('Jan 2023 - Present');
    });

    it('handles Date objects', () => {
      const start = new Date('2022-06-15T00:00:00Z');
      const end = new Date('2023-08-20T00:00:00Z');
      const result = formatDatePeriod(start, end);
      expect(result).toBe('Jun 2022 - Aug 2023');
    });
  });

  describe('formatDateRange', () => {
    it('returns an empty string without a start date', () => {
      expect(formatDateRange(undefined)).toBe('');
      expect(formatDateRange(null, '2026-05-20')).toBe('');
    });

    it('formats a single Sanity date without shifting the day', () => {
      expect(formatDateRange('2026-05-12')).toBe('May 12, 2026');
    });

    it('collapses a same-day range to one date', () => {
      expect(formatDateRange('2026-05-19', '2026-05-19')).toBe('May 19, 2026');
    });

    it('collapses month and year within the same month', () => {
      expect(formatDateRange('2026-05-19', '2026-05-20')).toBe('May 19 – 20, 2026');
    });

    it('collapses only the year across months', () => {
      expect(formatDateRange('2026-07-29', '2026-09-15')).toBe('Jul 29 – Sep 15, 2026');
    });

    it('spells out both dates across years', () => {
      expect(formatDateRange('2025-12-30', '2026-01-02')).toBe('Dec 30, 2025 – Jan 2, 2026');
    });

    it('ignores an end date that is before the start date', () => {
      expect(formatDateRange('2026-05-20', '2026-05-19')).toBe('May 20, 2026');
    });

    it('ignores an invalid end date', () => {
      expect(formatDateRange('2026-05-19', 'not-a-date')).toBe('May 19, 2026');
    });

    it('reports an invalid start date', () => {
      expect(formatDateRange('not-a-date', '2026-05-20')).toBe('Invalid date');
    });

    it('handles Date objects', () => {
      const start = new Date('2026-06-01T00:00:00Z');
      const end = new Date('2026-06-05T00:00:00Z');
      expect(formatDateRange(start, end)).toBe('Jun 1 – 5, 2026');
    });

    it('treats different times on the same UTC day as one day', () => {
      expect(formatDateRange('2026-05-19T10:00:00Z', '2026-05-19T18:00:00Z')).toBe('May 19, 2026');
      expect(formatDateRange('2026-05-19', '2026-05-19T23:59:59Z')).toBe('May 19, 2026');
    });

    it('compares days, not instants, for timed Date objects', () => {
      const start = new Date('2026-06-01T09:00:00Z');
      const end = new Date('2026-06-05T17:00:00Z');
      expect(formatDateRange(start, end)).toBe('Jun 1 – 5, 2026');
    });
  });

  describe('formatDateRangeParts', () => {
    it('returns null for a missing or invalid start date', () => {
      expect(formatDateRangeParts(null)).toBeNull();
      expect(formatDateRangeParts('not-a-date', '2026-05-20')).toBeNull();
    });

    it('returns only a start label for a single day', () => {
      expect(formatDateRangeParts('2026-05-12')).toEqual({ start: 'May 12, 2026' });
    });

    it('collapses the shared month and year into the end label', () => {
      expect(formatDateRangeParts('2026-05-19', '2026-05-20')).toEqual({
        start: 'May 19',
        end: '20, 2026',
      });
      expect(formatDateRangeParts('2026-07-29', '2026-09-15')).toEqual({
        start: 'Jul 29',
        end: 'Sep 15, 2026',
      });
    });

    it('keeps full labels across years', () => {
      expect(formatDateRangeParts('2025-12-30', '2026-01-02')).toEqual({
        start: 'Dec 30, 2025',
        end: 'Jan 2, 2026',
      });
    });
  });

  describe('formatDateTime', () => {
    it('formats date with time', () => {
      const result = formatDateTime('2025-01-08T14:30:00Z');
      // Format: "January 8, 2025 at 02:30 PM" (exact format may vary by locale handling)
      expect(result).toContain('January');
      expect(result).toContain('8');
      expect(result).toContain('2025');
    });
  });

  describe('formatDateOnly', () => {
    it('formats date without time', () => {
      const result = formatDateOnly('2025-01-08');
      expect(result).toBe('January 8, 2025');
    });

    it('handles Date objects', () => {
      const date = new Date('2025-07-04T00:00:00Z');
      const result = formatDateOnly(date);
      expect(result).toBe('July 4, 2025');
    });
  });

  describe('formatMonthYear', () => {
    it('formats to short month and year', () => {
      const result = formatMonthYear('2025-01-08');
      expect(result).toBe('Jan 2025');
    });

    it('handles different months', () => {
      expect(formatMonthYear('2025-03-15')).toBe('Mar 2025');
      expect(formatMonthYear('2025-12-25')).toBe('Dec 2025');
    });
  });
});
