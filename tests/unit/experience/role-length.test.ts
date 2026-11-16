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
 * @file A role's length as text: the figures with their units ('3 yrs 11 mos'), the same in
 * whole words for a screen reader, and the parts a row sets as figures. A current role runs to
 * the month of the day it is given.
 */

import { describe, expect, it } from 'vitest';

import { periodOf } from '@/app/(routes)/(main)/(professioal)/experience/_lib/period';
import {
  lengthFromMonths,
  lengthOf,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-length';

const period = (startDate: string, endDate: string | null) =>
  periodOf({ startDate, endDate, current: endDate === null });

describe('lengthFromMonths', () => {
  it('prints years and months with their units', () => {
    expect(lengthFromMonths(47)).toEqual({
      months: 47,
      text: '3 yrs 11 mos',
      spoken: '3 years 11 months',
      parts: [
        { value: 3, unit: 'yrs' },
        { value: 11, unit: 'mos' },
      ],
    });
  });

  it('uses the singular for one year and one month', () => {
    expect(lengthFromMonths(13)).toMatchObject({
      text: '1 yr 1 mo',
      spoken: '1 year 1 month',
      parts: [
        { value: 1, unit: 'yr' },
        { value: 1, unit: 'mo' },
      ],
    });
  });

  it('leaves out a part that is zero', () => {
    expect(lengthFromMonths(9)).toMatchObject({
      text: '9 mos',
      parts: [{ value: 9, unit: 'mos' }],
    });
    expect(lengthFromMonths(24)).toMatchObject({
      text: '2 yrs',
      spoken: '2 years',
      parts: [{ value: 2, unit: 'yrs' }],
    });
  });

  it('prints a length the way a CV does', () => {
    const printed = [1, 4, 12, 13, 23, 24, 47, 120].map((months) => lengthFromMonths(months)?.text);

    expect(printed).toEqual([
      '1 mo',
      '4 mos',
      '1 yr',
      '1 yr 1 mo',
      '1 yr 11 mos',
      '2 yrs',
      '3 yrs 11 mos',
      '10 yrs',
    ]);
  });

  it('is null for no months', () => {
    expect(lengthFromMonths(0)).toBeNull();
    expect(lengthFromMonths(-3)).toBeNull();
  });
});

describe('lengthOf', () => {
  it('runs a current role to the month of the day it is given', () => {
    expect(lengthOf(period('2026-03-01', null), '2026-11-12')?.text).toBe('9 mos');
    expect(lengthOf(period('2023-01-01', null), '2026-11-12')?.text).toBe('3 yrs 11 mos');
    expect(lengthOf(period('2023-01-01', null), '2026-12-01')?.text).toBe('4 yrs');
  });

  it('runs an ended role to its last month, both ends counted', () => {
    expect(lengthOf(period('2026-03-01', '2026-09-30'), '2026-11-12')).toMatchObject({
      months: 7,
      text: '7 mos',
    });
    expect(lengthOf(period('2024-04-01', '2026-02-28'), '2030-01-01')?.text).toBe('1 yr 11 mos');
  });

  it('stops a role not flagged current at the month of the day it is given', () => {
    // Planned to end in February: in November it has run three months, as its lane draws.
    expect(lengthOf(period('2026-09-01', '2027-02-28'), '2026-11-13')).toMatchObject({
      months: 3,
      text: '3 mos',
    });
    // Without a readable day it runs to its end.
    expect(lengthOf(period('2026-09-01', '2027-02-28'), 'soon')?.text).toBe('6 mos');
  });

  it('is null for a role that has not started by the day it is given', () => {
    expect(lengthOf(period('2026-12-01', '2027-03-31'), '2026-11-13')).toBeNull();
    expect(lengthOf(period('2026-12-01', null), '2026-11-13')).toBeNull();
  });

  it('is null without a readable start, or for a current role without a readable day', () => {
    expect(lengthOf(period('', null), '2026-11-12')).toBeNull();
    expect(lengthOf(period('2026-03-01', null), 'soon')).toBeNull();
  });
});
