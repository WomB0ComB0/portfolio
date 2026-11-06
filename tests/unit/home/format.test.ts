// @vitest-environment node
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
 * @file The home tiles' date, time and coordinate formatting (src/app/_components/home/data/
 * format.ts). Days and clock times are New York's, whatever the machine's time zone: the tests
 * run under America/Los_Angeles, where reading a Sanity date in local time would shift it to the
 * day before.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  formatAsOfDay,
  formatClockET,
  formatCoordinates,
  formatDay,
  formatDaySpan,
  formatMonthYear,
  formatRelative,
  isOngoing,
  lastVisitDay,
  nyToday,
} from '@/app/_components/home/data/format';

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Noon in New York (EST, UTC-5) on Thursday 2026-11-05. */
const NOW = Date.UTC(2026, 10, 5, 17, 0);
const ago = (ms: number): string => new Date(NOW - ms).toISOString();

const MACHINE_TIME_ZONE = 'America/Los_Angeles';
const originalTimeZone = process.env.TZ;

beforeAll(() => {
  process.env.TZ = MACHINE_TIME_ZONE;
  // In Los Angeles, a Sanity date read as local time falls on the day before.
  if (new Date(Date.parse('2026-03-01')).getDate() !== 28) {
    throw new Error(`TZ=${MACHINE_TIME_ZONE} did not take effect`);
  }
});

afterAll(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

describe('nyToday', () => {
  it("gives New York's date, not UTC's, late in the evening", () => {
    expect(nyToday(new Date('2026-11-06T03:30:00Z'))).toBe('2026-11-05');
  });

  it('accepts epoch milliseconds', () => {
    // 11:30 PM on Nov 5 in New York.
    expect(nyToday(Date.UTC(2026, 10, 6, 4, 30))).toBe('2026-11-05');
  });
});

describe('formatMonthYear', () => {
  it('prints a Sanity date as written, without shifting to the month before', () => {
    expect(formatMonthYear('2026-03-01')).toBe('Mar 2026');
    expect(formatMonthYear('2024-01')).toBe('Jan 2024');
  });

  it('prints a timestamp in New York time', () => {
    expect(formatMonthYear('2026-03-01T03:00:00Z')).toBe('Feb 2026');
  });

  it('prints nothing for a value that is not a real date', () => {
    expect(formatMonthYear('soon')).toBe('');
    expect(formatMonthYear('2026-02-30')).toBe('');
  });

  it('prints nothing for a timestamp on a day that does not exist, never the day it rolls to', () => {
    // Date.parse reads this as March 2.
    expect(formatMonthYear('2026-02-30T12:00:00Z')).toBe('');
    expect(formatMonthYear('2026-04-31T09:00:00-04:00')).toBe('');
  });

  it('checks the day as written, before the offset moves it to the next day', () => {
    // 11:30 PM on Feb 28 at UTC-5 is Mar 1 in UTC, and still Feb 28 in New York.
    expect(formatMonthYear('2026-02-28T23:30:00-05:00')).toBe('Feb 2026');
  });
});

describe('formatDay', () => {
  it('prints a Sanity date as written', () => {
    expect(formatDay('2026-10-30')).toBe('Oct 30');
  });

  it('prints a timestamp on its New York day', () => {
    expect(formatDay('2026-10-31T02:00:00Z')).toBe('Oct 30');
  });

  it('adds the year only when the day is in another year than now', () => {
    expect(formatDay('2025-10-30', NOW)).toBe('Oct 30, 2025');
    expect(formatDay('2026-10-30', NOW)).toBe('Oct 30');
  });

  it('prints nothing for a value that is not a date', () => {
    expect(formatDay('')).toBe('');
    expect(formatDay('2026-02-30T12:00:00Z', NOW)).toBe('');
  });
});

describe('formatAsOfDay', () => {
  it('says which New York day stale data was loaded, with the year once it differs', () => {
    // 11:02 PM on Nov 4 in New York.
    expect(formatAsOfDay('2026-11-05T04:02:00Z', NOW)).toBe('as of Nov 4');
    expect(formatAsOfDay('2025-12-31T17:00:00Z', NOW)).toBe('as of Dec 31, 2025');
  });

  it('says nothing without a load time it can read', () => {
    expect(formatAsOfDay(undefined, NOW)).toBe('');
    expect(formatAsOfDay('soon', NOW)).toBe('');
    expect(formatAsOfDay('2026-02-30T12:00:00Z', NOW)).toBe('');
  });
});

describe('formatRelative', () => {
  it('counts seconds, minutes and hours within a day', () => {
    expect(formatRelative(ago(30 * SECOND_MS), NOW)).toBe('just now');
    expect(formatRelative(ago(59 * MINUTE_MS), NOW)).toBe('59 min ago');
    expect(formatRelative(ago(HOUR_MS), NOW)).toBe('1 h ago');
    expect(formatRelative(ago(DAY_MS - MINUTE_MS), NOW)).toBe('23 h ago');
  });

  it('says hours, not yesterday, for last night when it is under a day ago', () => {
    // 11 PM in New York on Nov 4.
    expect(formatRelative('2026-11-05T04:00:00Z', NOW)).toBe('13 h ago');
  });

  it('says yesterday a day or more ago on the previous New York day', () => {
    expect(formatRelative(ago(DAY_MS), NOW)).toBe('yesterday');
  });

  it('counts New York calendar days, not 24-hour periods, past a day', () => {
    // 1 AM on Nov 5 in New York; 11 PM on Nov 3 is 26 h earlier but two calendar days back.
    const earlyMorning = Date.UTC(2026, 10, 5, 6, 0);
    expect(formatRelative('2026-11-04T04:00:00Z', earlyMorning)).toBe('2 d ago');
  });

  it('counts days up to 13, then prints the date, with the year when it differs', () => {
    expect(formatRelative(ago(13 * DAY_MS), NOW)).toBe('13 d ago');
    expect(formatRelative(ago(14 * DAY_MS), NOW)).toBe('Oct 22');
    expect(formatRelative('2025-10-01T16:00:00Z', NOW)).toBe('Oct 1, 2025');
  });

  it('counts whole days for a Sanity date, whatever the hour', () => {
    expect(formatRelative('2026-11-05', NOW)).toBe('today');
    expect(formatRelative('2026-11-04', NOW)).toBe('yesterday');
    expect(formatRelative('2026-11-02', NOW)).toBe('3 d ago');
    expect(formatRelative('2026-10-01', NOW)).toBe('Oct 1');
  });

  it('prints nothing for a future moment or a value that is not a date', () => {
    expect(formatRelative('2026-11-06', NOW)).toBe('');
    expect(formatRelative(new Date(NOW + 5 * MINUTE_MS).toISOString(), NOW)).toBe('');
    expect(formatRelative('not a date', NOW)).toBe('');
    expect(formatRelative('2026-02-30T12:00:00Z', NOW)).toBe('');
  });
});

describe('formatClockET', () => {
  it('prints the New York time with AM/PM and ET, in winter and in summer', () => {
    expect(formatClockET(Date.UTC(2026, 10, 5, 16, 2))).toBe('11:02 AM ET');
    expect(formatClockET(Date.UTC(2026, 6, 1, 19, 5))).toBe('3:05 PM ET');
  });

  it('prints a plain space where ICU puts a narrow no-break space, so server and browser match', () => {
    // Newer ICU versions put U+202F before 'AM'; whether one does depends on the runtime.
    const icuClock = `11:02${String.fromCodePoint(0x202f)}AM`;
    const prototype = Intl.DateTimeFormat.prototype as unknown as { format: unknown };
    const format = vi.spyOn(prototype, 'format', 'get').mockReturnValue(() => icuClock);
    try {
      expect(formatClockET(Date.UTC(2026, 10, 5, 16, 2))).toBe('11:02 AM ET');
    } finally {
      format.mockRestore();
    }
  });

  it('prints nothing for a value that is not a moment', () => {
    expect(formatClockET(Number.NaN)).toBe('');
  });
});

describe('formatCoordinates', () => {
  it('prints north and west for New York', () => {
    expect(formatCoordinates(40.7128, -74.006)).toBe('40.71° N, 74.01° W');
  });

  it('prints south and east for Sydney', () => {
    expect(formatCoordinates(-33.8688, 151.2093)).toBe('33.87° S, 151.21° E');
  });

  it('gives a value that rounds to zero the positive hemisphere', () => {
    expect(formatCoordinates(-0.001, -0.004)).toBe('0.00° N, 0.00° E');
  });

  it('prints nothing for a value that is not a number', () => {
    expect(formatCoordinates(Number.NaN, 0)).toBe('');
  });
});

describe('isOngoing', () => {
  const TODAY = '2026-11-05';

  it('is true on the day of a single-day place', () => {
    expect(isOngoing({ startDate: TODAY }, TODAY)).toBe(true);
  });

  it('is true on any day within a range, ends included', () => {
    expect(isOngoing({ startDate: '2026-11-03', endDate: '2026-11-07' }, TODAY)).toBe(true);
    expect(isOngoing({ startDate: '2026-11-01', endDate: TODAY }, TODAY)).toBe(true);
  });

  it('is false for a past place, an ended range and an undated place', () => {
    expect(isOngoing({ startDate: '2026-11-04' }, TODAY)).toBe(false);
    expect(isOngoing({ startDate: '2026-10-01', endDate: '2026-11-04' }, TODAY)).toBe(false);
    expect(isOngoing({ startDate: null }, TODAY)).toBe(false);
  });

  it('is false for a place that has not started', () => {
    expect(isOngoing({ startDate: '2026-11-06', endDate: '2026-11-08' }, TODAY)).toBe(false);
  });
});

describe('lastVisitDay', () => {
  const TODAY = '2026-11-05';

  it('is the one day of a single-day place on or before today', () => {
    expect(lastVisitDay({ startDate: '2026-08-21' }, TODAY)).toBe('2026-08-21');
    expect(lastVisitDay({ startDate: TODAY, endDate: null }, TODAY)).toBe(TODAY);
  });

  it('is the last day of a range that is over, not its first', () => {
    expect(lastVisitDay({ startDate: '2026-07-29', endDate: '2026-09-15' }, TODAY)).toBe(
      '2026-09-15',
    );
    expect(lastVisitDay({ startDate: '2026-10-01', endDate: TODAY }, TODAY)).toBe(TODAY);
  });

  // A stated run of visits (Corgi NYC: Jul 29 and Sep 15) is not a visit on every day between.
  it('is the first day while a range is on, until its last day comes', () => {
    const corgi = { startDate: '2026-07-29', endDate: '2026-09-15' };

    expect(lastVisitDay({ startDate: '2026-09-01', endDate: '2026-12-31' }, TODAY)).toBe(
      '2026-09-01',
    );
    expect(lastVisitDay(corgi, '2026-07-29')).toBe('2026-07-29');
    expect(lastVisitDay(corgi, '2026-09-14')).toBe('2026-07-29');
    expect(lastVisitDay(corgi, '2026-09-15')).toBe('2026-09-15');
  });

  it('is null for a place that has not started, or has no start date', () => {
    expect(lastVisitDay({ startDate: '2026-11-06', endDate: '2026-11-08' }, TODAY)).toBe(null);
    expect(lastVisitDay({ startDate: '2026-12-01' }, TODAY)).toBe(null);
    expect(lastVisitDay({ startDate: null, endDate: '2026-10-01' }, TODAY)).toBe(null);
    expect(lastVisitDay({}, TODAY)).toBe(null);
  });

  it('keeps the start when the end is not after it', () => {
    expect(lastVisitDay({ startDate: '2026-10-20', endDate: '2026-10-02' }, TODAY)).toBe(
      '2026-10-20',
    );
  });
});

describe('formatDaySpan', () => {
  it('splits a range in this year into its first and last day, without the year', () => {
    expect(formatDaySpan({ startDate: '2026-07-29', endDate: '2026-09-15' }, NOW)).toEqual({
      start: 'Jul 29',
      end: 'Sep 15',
    });
  });

  it('names the month once for a range within one month, as /places does', () => {
    expect(formatDaySpan({ startDate: '2026-11-03', endDate: '2026-11-07' }, NOW)).toEqual({
      start: 'Nov 3',
      end: '7',
    });
    expect(formatDaySpan({ startDate: '2025-05-19', endDate: '2025-05-20' }, NOW)).toEqual({
      start: 'May 19',
      end: '20, 2025',
    });
  });

  it('prints the year once, at the end, for a range in another year than now', () => {
    expect(formatDaySpan({ startDate: '2025-07-29', endDate: '2025-09-15' }, NOW)).toEqual({
      start: 'Jul 29',
      end: 'Sep 15, 2025',
    });
  });

  it('prints both years for a range that crosses a year', () => {
    expect(formatDaySpan({ startDate: '2025-12-28', endDate: '2026-01-03' }, NOW)).toEqual({
      start: 'Dec 28, 2025',
      end: 'Jan 3, 2026',
    });
  });

  it('gives a single day no end, printed as formatDay does, as for an end not after the start', () => {
    expect(formatDaySpan({ startDate: '2026-10-30' }, NOW)).toEqual({ start: 'Oct 30' });
    expect(formatDaySpan({ startDate: '2025-10-30', endDate: null }, NOW)).toEqual({
      start: 'Oct 30, 2025',
    });
    expect(formatDaySpan({ startDate: '2026-10-30', endDate: '2026-10-30' }, NOW)).toEqual({
      start: 'Oct 30',
    });
    expect(formatDaySpan({ startDate: '2026-10-30', endDate: '2026-10-02' }, NOW)).toEqual({
      start: 'Oct 30',
    });
  });

  it('gives the start alone when the end is not a date, and null without a start', () => {
    expect(formatDaySpan({ startDate: '2026-10-30', endDate: '2026-02-30' }, NOW)).toEqual({
      start: 'Oct 30',
    });
    expect(formatDaySpan({ startDate: null, endDate: '2026-10-30' }, NOW)).toBe(null);
    expect(formatDaySpan({ startDate: 'soon' }, NOW)).toBe(null);
  });
});
