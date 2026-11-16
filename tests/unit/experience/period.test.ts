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
 * @file A role's period as both experience pages print it: Sanity calendar dates read as months
 * in UTC (never shifted to the month before), an en-dash range with "Present" for a current
 * role, a role current when Studio says so or when it has no end date, and months counted
 * inclusively (Jan to Mar is 3). The length as text is role-length.test.ts's.
 */

import { describe, expect, it } from 'vitest';

import {
  isCurrentRole,
  monthsBetween,
  parseRoleMonth,
  periodOf,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/period';

const role = (startDate: string, endDate: string | null | undefined, current = false) => ({
  startDate,
  endDate,
  current,
});

describe('parseRoleMonth', () => {
  it('reads a Sanity date as its month, in UTC', () => {
    expect(parseRoleMonth('2026-03-01')).toEqual({
      iso: '2026-03',
      label: 'Mar 2026',
      year: 2026,
      month: 3,
    });
  });

  it('reads a bare month and a timestamp by their calendar month', () => {
    expect(parseRoleMonth('2024-12')?.label).toBe('Dec 2024');
    expect(parseRoleMonth('2023-01-01T00:00:00Z')?.label).toBe('Jan 2023');
  });

  it.each([null, undefined, '', '   ', 'soon', '2024-13-01', '2024-00-10'])(
    'gives null for %j',
    (value) => {
      expect(parseRoleMonth(value)).toBeNull();
    },
  );
});

describe('isCurrentRole', () => {
  it('follows the Studio flag', () => {
    expect(isCurrentRole(role('2024-01-01', '2025-01-01', true))).toBe(true);
  });

  it.each([null, undefined, '', 'not a date'])('treats an end date of %j as still going', (end) => {
    expect(isCurrentRole(role('2024-01-01', end))).toBe(true);
  });

  it('is past once it has a real end date and no flag', () => {
    expect(isCurrentRole(role('2024-01-01', '2025-01-31'))).toBe(false);
  });
});

describe('periodOf', () => {
  it('prints a past role as an en-dash range', () => {
    expect(periodOf(role('2023-09-01', '2024-09-30')).text).toBe('Sep 2023 – Sep 2024');
  });

  it('prints a current role up to "Present", whatever its end date says', () => {
    expect(periodOf(role('2026-03-01', null)).text).toBe('Mar 2026 – Present');
    const flagged = periodOf(role('2025-11-01', '2026-02-01', true));
    expect(flagged).toMatchObject({ text: 'Nov 2025 – Present', current: true, end: null });
  });

  it('prints a role that began and ended in one month once', () => {
    expect(periodOf(role('2024-06-01', '2024-06-30')).text).toBe('Jun 2024');
  });

  it('prints only the end when the start is unreadable', () => {
    expect(periodOf(role('garbage', '2024-06-30')).text).toBe('Jun 2024');
    expect(periodOf(role('garbage', null)).text).toBe('Present');
  });
});

describe('monthsBetween', () => {
  it('counts both the first and the last month', () => {
    const jan = parseRoleMonth('2023-01-01');
    const mar = parseRoleMonth('2023-03-31');
    if (!jan || !mar) throw new Error('fixture months failed to parse');
    expect(monthsBetween(jan, mar)).toBe(3);
    expect(monthsBetween(jan, jan)).toBe(1);
    expect(monthsBetween(mar, jan)).toBe(0);
  });
});
