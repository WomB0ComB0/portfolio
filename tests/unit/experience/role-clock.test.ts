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
 * @file The clock every role is drawn on: one month a step from the first role's start to the
 * month of the day it is given (never a Date of its own), which roles ran in each month, how
 * many run now, the peak and every run of months at it, the average, and each role's span. Then
 * the axis it is drawn on: a month to a column up to five years, a quarter after that, with
 * year labels that never touch each other or leave the plot. And one role's place on it: the
 * roles that ran beside it with the months they shared, and how many ran at once at its busiest.
 */

import { describe, expect, it, vi } from 'vitest';

import { periodOf } from '@/app/(routes)/(main)/(professioal)/experience/_lib/period';
import {
  buildRoleClock,
  type ClockRole,
  clockAxis,
  columnSpanOf,
  LAST_LABEL_ROOM,
  MAX_MONTH_COLUMNS,
  monthRangeText,
  NARROW_LABEL_ROOM,
  peakSpoken,
  peakText,
  roleContextOf,
  stackOrderOf,
  YEAR_LABEL_ROOM,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-clock';

const role = (id: string, startDate: string, endDate: string | null): ClockRole => ({
  id,
  period: periodOf({ startDate, endDate, current: endDate === null }),
});

/** The fifteen roles' dates as Studio holds them (ids shortened). */
const ROLES: readonly ClockRole[] = [
  role('resq', '2026-03-01', null),
  role('curvance', '2026-03-01', '2026-09-30'),
  role('elysium', '2023-01-01', null),
  role('dfg', '2024-04-01', '2026-02-28'),
  role('talentsprint', '2024-03-01', '2025-09-30'),
  role('mlh', '2024-06-01', '2024-09-30'),
  role('farmingdale', '2024-02-01', null),
  role('handshake', '2025-11-01', null),
  role('educative', '2024-12-01', null),
  role('codepath', '2024-06-01', '2025-06-01'),
  role('campaign', '2023-09-01', '2024-09-30'),
  role('waffle', '2023-08-01', '2025-06-30'),
  role('thinkround', '2023-05-01', '2023-12-31'),
  role('socialpayme', '2023-05-01', '2023-09-30'),
  role('district', '2023-03-01', '2024-01-31'),
];
const TODAY = '2026-11-12';

const countsOf = (clock: ReturnType<typeof buildRoleClock>): number[] =>
  clock.months.map((month) => month.roleIds.length);

describe('buildRoleClock: the months', () => {
  it('runs from the first start to the month of the day it is given, both counted', () => {
    const clock = buildRoleClock(ROLES, TODAY);

    expect(clock.months).toHaveLength(47);
    expect(clock.months[0]).toMatchObject({ index: 0, iso: '2023-01', label: 'Jan 2023' });
    expect(clock.months.at(-1)).toMatchObject({ index: 46, iso: '2026-11', label: 'Nov 2026' });
  });

  it('reads the month from the clock passed in, never from a Date of its own', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2031-06-15T12:00:00Z'));
    try {
      expect(buildRoleClock(ROLES, '2026-11-30').months).toHaveLength(47);
      expect(buildRoleClock(ROLES, '2026-12-01').months).toHaveLength(48);
      expect(buildRoleClock(ROLES, '2027-01-01').months.at(-1)?.label).toBe('Jan 2027');
    } finally {
      vi.useRealTimers();
    }
  });

  it('names the roles that ran in each month, in the order given', () => {
    const clock = buildRoleClock(ROLES, TODAY);

    expect(clock.months[0]?.roleIds).toEqual(['elysium']);
    // May 2023: Think Round and Social PayMe both begin.
    expect(clock.months[4]?.roleIds).toEqual(['elysium', 'thinkround', 'socialpayme', 'district']);
    expect(clock.months.at(-1)?.roleIds).toEqual([
      'resq',
      'elysium',
      'farmingdale',
      'handshake',
      'educative',
    ]);
  });

  it('adds up to every role-month once', () => {
    const counts = countsOf(buildRoleClock(ROLES, TODAY));

    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(253);
    // Never fewer than four at once after April 2023.
    expect(Math.min(...counts.slice(4))).toBe(4);
  });

  it('has no months without a readable clock or a readable start', () => {
    expect(buildRoleClock(ROLES, 'soon').months).toEqual([]);
    expect(buildRoleClock([], TODAY).months).toEqual([]);
    expect(buildRoleClock([role('undated', 'unknown', null)], TODAY).months).toEqual([]);
  });

  it('has no months when every role starts after the clock', () => {
    const clock = buildRoleClock([role('later', '2027-02-01', null)], TODAY);

    expect(clock.months).toEqual([]);
    expect(clock.spans.size).toBe(0);
    expect(clock.now).toBe(0);
  });
});

describe('buildRoleClock: the figures', () => {
  it('counts the roles that run now: the ones flagged current', () => {
    expect(buildRoleClock(ROLES, TODAY).now).toBe(5);
    // September 2026: Curvance ran that month too, but it was not flagged current (it ended in
    // it), so the list files it under Before and it is not "now".
    const september = buildRoleClock(ROLES, '2026-09-15');
    expect(september.months.at(-1)?.roleIds).toHaveLength(6);
    expect(september.now).toBe(5);
  });

  it('finds the peak and the months it held', () => {
    const { peak } = buildRoleClock(ROLES, TODAY);

    expect(peak?.count).toBe(8);
    expect(peak?.runs.map((run) => [run.from.label, run.to.label])).toEqual([
      ['Jun 2024', 'Sep 2024'],
    ]);
  });

  it('keeps every run of months at the peak, earliest first', () => {
    const clock = buildRoleClock(
      [
        role('long', '2024-01-01', null),
        role('spring', '2024-03-01', '2024-04-30'),
        role('autumn', '2024-09-01', '2024-09-30'),
      ],
      '2024-12-05',
    );

    expect(clock.peak?.count).toBe(2);
    expect(clock.peak?.runs.map((run) => [run.from.label, run.to.label])).toEqual([
      ['Mar 2024', 'Apr 2024'],
      ['Sep 2024', 'Sep 2024'],
    ]);
  });

  it('averages the roles at once over every month', () => {
    const clock = buildRoleClock(ROLES, TODAY);

    expect(clock.average).toBeCloseTo(253 / 47, 10);
    expect(clock.average.toFixed(1)).toBe('5.4');
  });

  it('has no peak and a zero average with no months', () => {
    expect(buildRoleClock([], TODAY)).toMatchObject({ now: 0, peak: null, average: 0 });
  });
});

describe('buildRoleClock: spans', () => {
  it("gives each role its first month and one past its last, on the axis' months", () => {
    const clock = buildRoleClock(ROLES, TODAY);

    expect(clock.spans.get('elysium')).toEqual({ start: 0, end: 47, current: true });
    expect(clock.spans.get('resq')).toEqual({ start: 38, end: 47, current: true });
    expect(clock.spans.get('curvance')).toEqual({ start: 38, end: 45, current: false });
    expect(clock.spans.get('mlh')).toEqual({ start: 17, end: 21, current: false });
  });

  it("is as long as the role's length in months", () => {
    const clock = buildRoleClock(ROLES, TODAY);
    const lengthOf = (id: string): number => {
      const span = clock.spans.get(id);
      return span ? span.end - span.start : 0;
    };

    expect(lengthOf('resq')).toBe(9);
    expect(lengthOf('dfg')).toBe(23);
    expect(lengthOf('educative')).toBe(24);
  });

  it('leaves out a role with no readable start, and one that starts after the clock', () => {
    const clock = buildRoleClock(
      [
        role('known', '2024-01-01', null),
        role('undated', '', null),
        role('later', '2030-01-01', null),
      ],
      '2024-06-01',
    );

    expect([...clock.spans.keys()]).toEqual(['known']);
    expect(clock.months).toHaveLength(6);
  });

  it('stops a role that ends after the clock at the clock month, without calling it current', () => {
    const clock = buildRoleClock([role('booked', '2024-01-01', '2024-12-31')], '2024-03-10');

    expect(clock.spans.get('booked')).toEqual({ start: 0, end: 3, current: false });
    // Not flagged current, so not "now", even with a planned end still to come.
    expect(clock.now).toBe(0);
  });

  it('takes its first month only from a role it can draw: an end before its start stretches nothing', () => {
    const clock = buildRoleClock(
      [role('known', '2026-01-01', null), role('backwards', '2020-01-01', '2019-06-30')],
      '2026-11-13',
    );

    expect(clock.months).toHaveLength(11);
    expect(clock.months[0]?.label).toBe('Jan 2026');
    expect(clock.months[0]?.roleIds).toEqual(['known']);
    expect([...clock.spans.keys()]).toEqual(['known']);
  });
});

describe('buildRoleClock: one definition of "now"', () => {
  it('counts the roles flagged current: one that ended this month is not "now"', () => {
    const clock = buildRoleClock(
      [
        role('lead', '2026-03-01', null),
        role('other', '2025-01-01', null),
        role('done', '2025-06-01', '2026-11-05'),
      ],
      '2026-11-13',
    );

    // All three ran in November, but one of them ended in it.
    expect(clock.months.at(-1)?.roleIds).toEqual(['lead', 'other', 'done']);
    expect(clock.now).toBe(2);
  });

  it('never counts a current role that has not started: it has no month on the clock yet', () => {
    const clock = buildRoleClock(
      [role('lead', '2026-03-01', null), role('next', '2026-12-01', null)],
      '2026-11-13',
    );

    expect(clock.spans.has('next')).toBe(false);
    expect(clock.now).toBe(1);
  });
});

describe('clockAxis: a month to a column, then a quarter', () => {
  it('draws a month to a column while the history fits five years', () => {
    const axis = clockAxis(buildRoleClock(ROLES, TODAY));

    expect(MAX_MONTH_COLUMNS).toBe(60);
    expect(axis.unit).toBe('month');
    expect(axis.columns).toHaveLength(47);
    expect(axis.columns[0]).toMatchObject({ start: 0, end: 1, now: false, roleIds: ['elysium'] });
    expect(axis.columns.at(-1)).toMatchObject({ start: 46, end: 47, now: true });
    expect(axis.columns.filter((column) => column.now)).toHaveLength(1);
  });

  it('still draws months at exactly five years', () => {
    const axis = clockAxis(buildRoleClock(ROLES, '2027-12-01'));

    expect(axis.columns).toHaveLength(60);
    expect(axis.unit).toBe('month');
  });

  it('draws calendar quarters once a month would be too narrow on a phone', () => {
    const clock = buildRoleClock(ROLES, '2028-01-20');
    const axis = clockAxis(clock);

    expect(clock.months).toHaveLength(61);
    expect(axis.unit).toBe('quarter');
    // Jan 2023 to Jan 2028: twenty whole quarters and the one that has just begun.
    expect(axis.columns).toHaveLength(21);
    expect(axis.columns[0]).toMatchObject({ start: 0, end: 3 });
    expect(axis.columns.at(-1)).toMatchObject({ start: 60, end: 61, now: true });
  });

  it('starts the first quarter where the history starts, inside its calendar quarter', () => {
    const clock = buildRoleClock([role('only', '2020-02-01', null)], '2026-11-12');
    const axis = clockAxis(clock);

    expect(axis.unit).toBe('quarter');
    // Feb and Mar 2020 are the rest of Q1; Apr to Jun is the first whole quarter.
    expect(axis.columns[0]).toMatchObject({ start: 0, end: 2 });
    expect(axis.columns[1]).toMatchObject({ start: 2, end: 5 });
  });

  it("stacks a quarter at its busiest month, so no column outgrows the month's peak", () => {
    const clock = buildRoleClock(
      [
        role('long', '2019-01-01', null),
        role('april', '2025-04-01', '2025-04-30'),
        role('june', '2025-06-01', '2025-06-30'),
      ],
      '2026-11-12',
    );
    const axis = clockAxis(clock);
    const q2 = axis.columns.find((column) => column.start === 75);

    expect(clock.peak?.count).toBe(2);
    expect(Math.max(...axis.columns.map((column) => column.roleIds.length))).toBe(2);
    // April and June tie at two; the later month is drawn.
    expect(q2?.roleIds).toEqual(['long', 'june']);
  });

  it("stacks the column that holds this month with this month's roles, so it shows who runs now", () => {
    const clock = buildRoleClock(
      [
        role('long', '2019-01-01', null),
        role('october', '2026-10-01', '2026-10-31'),
        role('autumn', '2026-09-01', '2026-10-31'),
        role('new', '2026-11-01', null),
      ],
      '2026-11-13',
    );
    const axis = clockAxis(clock);
    const last = axis.columns.at(-1);

    expect(axis.unit).toBe('quarter');
    // October ran three at once and November two: the column still shows November's.
    expect(last).toMatchObject({ now: true });
    expect(last?.roleIds).toEqual(['long', 'new']);
    expect(last?.roleIds).toEqual(clock.months.at(-1)?.roleIds);
  });

  it('accepts another limit', () => {
    expect(clockAxis(buildRoleClock(ROLES, TODAY), 36).unit).toBe('quarter');
  });

  it('is empty for an empty clock', () => {
    expect(clockAxis(buildRoleClock([], TODAY))).toEqual({ unit: 'month', columns: [], ticks: [] });
  });
});

describe('clockAxis: year labels', () => {
  const labelsOf = (today: string): (number | null)[] =>
    clockAxis(buildRoleClock(ROLES, today)).ticks.map((tick) => (tick.labelled ? tick.year : null));

  it('marks each January and labels it with its year', () => {
    const axis = clockAxis(buildRoleClock(ROLES, TODAY));

    expect(axis.ticks).toEqual([
      { column: 0, year: 2023, labelled: true, narrow: true },
      { column: 12, year: 2024, labelled: true, narrow: false },
      { column: 24, year: 2025, labelled: true, narrow: true },
      { column: 36, year: 2026, labelled: true, narrow: false },
    ]);
  });

  it('drops a year label that would leave the plot, and keeps its tick', () => {
    const axis = clockAxis(buildRoleClock(ROLES, '2027-01-04'));

    expect(axis.ticks.at(-1)).toEqual({ column: 48, year: 2027, labelled: false, narrow: false });
    expect(labelsOf('2027-01-04')).toEqual([2023, 2024, 2025, 2026, null]);
  });

  it('brings the label back once the year has room for it and the mark at this month', () => {
    // Nine months into 2027 a label would still run into the "now" mark at the plot's end.
    expect(labelsOf('2027-08-01')).toEqual([2023, 2024, 2025, 2026, null]);
    expect(labelsOf('2027-09-01')).toEqual([2023, 2024, 2025, 2026, null]);
    // In quarters, 2027 is five columns of 21 from the end.
    expect(labelsOf('2028-03-01')).toEqual([2023, 2024, 2025, 2026, 2027, null]);
  });

  it("keeps the last label clear of the plot's end, where this month's mark is", () => {
    for (const today of ['2026-11-12', '2027-01-04', '2027-09-01', '2029-03-01', '2033-07-01']) {
      const axis = clockAxis(buildRoleClock(ROLES, today));
      const last = axis.ticks.filter((tick) => tick.labelled).at(-1);
      const total = axis.columns.length;

      expect(last).toBeDefined();
      expect((total - (last?.column ?? total)) / total).toBeGreaterThanOrEqual(LAST_LABEL_ROOM);
    }
  });

  it('asks for more room at the end than between two labels', () => {
    expect(LAST_LABEL_ROOM).toBeGreaterThan(YEAR_LABEL_ROOM);
  });

  it('never sets two labels closer than a label is wide', () => {
    for (const today of ['2026-11-12', '2027-01-04', '2029-03-01', '2033-07-01', '2041-12-01']) {
      const axis = clockAxis(buildRoleClock(ROLES, today));
      const labelled = axis.ticks.filter((tick) => tick.labelled);
      const total = axis.columns.length;

      expect(labelled.length).toBeGreaterThan(0);
      for (const [index, tick] of labelled.entries()) {
        const next = labelled[index + 1]?.column ?? total;
        expect((next - tick.column) / total).toBeGreaterThanOrEqual(YEAR_LABEL_ROOM);
      }
    }
  });

  it('labels the first column with its year when the history does not start in January', () => {
    const axis = clockAxis(buildRoleClock([role('only', '2024-03-01', null)], '2026-11-12'));

    expect(axis.ticks[0]).toEqual({ column: 0, year: 2024, labelled: true, narrow: false });
    expect(axis.ticks[1]).toEqual({ column: 10, year: 2025, labelled: true, narrow: true });
  });

  it('gives a January the label over a first year only a month or two long', () => {
    const axis = clockAxis(buildRoleClock([role('only', '2023-11-01', null)], '2026-11-12'));

    expect(axis.ticks.slice(0, 2)).toEqual([
      { column: 0, year: 2023, labelled: false, narrow: false },
      { column: 2, year: 2024, labelled: true, narrow: true },
    ]);
  });
});

describe('clockAxis: year labels in a narrow plot', () => {
  const narrowOf = (today: string): number[] =>
    clockAxis(buildRoleClock(ROLES, today))
      .ticks.filter((tick) => tick.narrow)
      .map((tick) => tick.year);

  it('keeps every second year of four, and never the one nearest the end', () => {
    // 47 columns: a year is a quarter of the axis, under the room a label needs when narrow.
    expect(narrowOf(TODAY)).toEqual([2023, 2025]);
  });

  it('keeps only labels the wide plot prints, each with the narrow room to itself', () => {
    for (const today of ['2026-11-12', '2027-01-04', '2029-03-01', '2033-07-01', '2041-12-01']) {
      const axis = clockAxis(buildRoleClock(ROLES, today));
      const narrow = axis.ticks.filter((tick) => tick.narrow);
      const total = axis.columns.length;

      expect(narrow.length).toBeGreaterThan(0);
      for (const [index, tick] of narrow.entries()) {
        const next = narrow[index + 1]?.column ?? total;
        expect(tick.labelled).toBe(true);
        expect((next - tick.column) / total).toBeGreaterThanOrEqual(NARROW_LABEL_ROOM);
      }
    }
  });

  it('asks for more room than a wide plot does, between labels and at the end', () => {
    expect(NARROW_LABEL_ROOM).toBeGreaterThan(YEAR_LABEL_ROOM);
    expect(NARROW_LABEL_ROOM).toBeGreaterThan(LAST_LABEL_ROOM);
  });
});

describe('columnSpanOf', () => {
  it("is the role's own months on a month axis", () => {
    const clock = buildRoleClock(ROLES, TODAY);
    const axis = clockAxis(clock);

    expect(columnSpanOf(axis, { start: 17, end: 21 })).toEqual({
      start: 17,
      end: 21,
    });
  });

  it('covers every quarter the role touched on a quarter axis', () => {
    const clock = buildRoleClock(ROLES, '2028-01-20');
    const axis = clockAxis(clock);

    // MLH, Jun to Sep 2024 (months 17 to 20): the end of Q2 and all of Q3.
    expect(columnSpanOf(axis, { start: 17, end: 21 })).toEqual({
      start: 5,
      end: 7,
    });
    // A current role reaches the last column.
    const elysium = clock.spans.get('elysium');
    expect(elysium && columnSpanOf(axis, elysium)).toEqual({ start: 0, end: 21 });
  });

  it('never gives a role with months no column', () => {
    const clock = buildRoleClock(ROLES, '2028-01-20');
    const axis = clockAxis(clock);

    for (const span of clock.spans.values()) {
      const columns = columnSpanOf(axis, span);
      expect(columns.end).toBeGreaterThan(columns.start);
    }
  });
});

describe('stackOrderOf', () => {
  it('piles the roles still running first, the longest running at the bottom', () => {
    expect(stackOrderOf(buildRoleClock(ROLES, TODAY)).slice(0, 5)).toEqual([
      'elysium',
      'farmingdale',
      'educative',
      'handshake',
      'resq',
    ]);
  });

  it('piles the ended roles above them by their start, equal starts in the order given', () => {
    const order = stackOrderOf(buildRoleClock(ROLES, TODAY)).slice(5);

    expect(order).toEqual([
      'district',
      'thinkround',
      'socialpayme',
      'waffle',
      'campaign',
      'talentsprint',
      'dfg',
      'mlh',
      'codepath',
      'curvance',
    ]);
  });

  it('lists only the roles on the axis', () => {
    expect(stackOrderOf(buildRoleClock([role('undated', '', null)], TODAY))).toEqual([]);
  });
});

describe('monthRangeText and peakText', () => {
  const month = (iso: string) => {
    const found = buildRoleClock(ROLES, TODAY).months.find((each) => each.iso === iso);
    if (!found) throw new Error(`no month ${iso}`);
    return found;
  };

  it('prints a run inside one year with its year once', () => {
    expect(monthRangeText(month('2024-06'), month('2024-09'))).toBe('Jun – Sep 2024');
  });

  it('prints both years when a run crosses one, and one month alone', () => {
    expect(monthRangeText(month('2024-12'), month('2025-06'))).toBe('Dec 2024 – Jun 2025');
    expect(monthRangeText(month('2024-08'), month('2024-08'))).toBe('Aug 2024');
  });

  it('says when the peak held: its one run, or its first when it came back', () => {
    expect(peakText(buildRoleClock(ROLES, TODAY).peak)).toBe('Jun – Sep 2024');
    const twice = buildRoleClock(
      [
        role('long', '2024-01-01', null),
        role('spring', '2024-03-01', '2024-04-30'),
        role('autumn', '2024-09-01', '2024-09-30'),
      ],
      '2024-12-05',
    );
    expect(peakText(twice.peak)).toBe('first in Mar – Apr 2024');
    expect(peakText(null)).toBe('');
  });

  it('says the same in words for a screen reader: no dash to read aloud', () => {
    const clock = buildRoleClock(ROLES, TODAY);

    expect(peakSpoken(clock.peak)).toBe('from Jun 2024 to Sep 2024');
    // One month alone is "in" that month.
    expect(peakSpoken(roleContextOf(clock, 'district')?.busiest ?? null)).toBe('in Sep 2023');
    const twice = buildRoleClock(
      [
        role('long', '2024-01-01', null),
        role('spring', '2024-03-01', '2024-04-30'),
        role('autumn', '2024-09-01', '2024-09-30'),
      ],
      '2024-12-05',
    );
    expect(peakSpoken(twice.peak)).toBe('first from Mar 2024 to Apr 2024');
    expect(peakSpoken(null)).toBe('');
  });
});

describe('roleContextOf: one role among the others', () => {
  const clock = buildRoleClock(ROLES, TODAY);

  it('lists every role that shared a month with it, the most months shared first', () => {
    const context = roleContextOf(clock, 'curvance');

    // Mar to Sep 2026: five roles ran through all seven months; Handshake began before it.
    expect(context?.alongside).toEqual([
      { id: 'resq', shared: 7 },
      { id: 'elysium', shared: 7 },
      { id: 'farmingdale', shared: 7 },
      { id: 'handshake', shared: 7 },
      { id: 'educative', shared: 7 },
    ]);
  });

  it('counts only the months both ran, and leaves out a role that never overlapped', () => {
    const context = roleContextOf(clock, 'mlh');
    const shared = new Map(context?.alongside.map((each) => [each.id, each.shared]));

    // Jun to Sep 2024, the peak: seven others, each for all four months.
    expect(context?.alongside).toHaveLength(7);
    expect([...shared.values()].every((months) => months === 4)).toBe(true);
    expect(shared.has('district')).toBe(false);
    expect(shared.has('educative')).toBe(false);
  });

  it('orders equal shares as the roles were given', () => {
    const context = roleContextOf(clock, 'socialpayme');

    // May to Sep 2023: Elysium, Think Round and District 1 for all five; then Waffle Hacks for
    // two (Aug, Sep) and Campaign 180 for one (Sep).
    expect(context?.alongside).toEqual([
      { id: 'elysium', shared: 5 },
      { id: 'thinkround', shared: 5 },
      { id: 'district', shared: 5 },
      { id: 'waffle', shared: 2 },
      { id: 'campaign', shared: 1 },
    ]);
  });

  it('finds how many ran at once at its busiest, itself counted, and when', () => {
    const curvance = roleContextOf(clock, 'curvance');
    expect(curvance?.busiest.count).toBe(6);
    expect(peakText(curvance?.busiest ?? null)).toBe('Mar – Sep 2026');

    // Develop for Good ran through the page's own peak.
    const dfg = roleContextOf(clock, 'dfg');
    expect(dfg?.busiest.count).toBe(8);
    expect(peakText(dfg?.busiest ?? null)).toBe('Jun – Sep 2024');
  });

  it('looks for the busiest months inside its own months only', () => {
    const district = roleContextOf(clock, 'district');

    // Mar 2023 to Jan 2024: six at once in Sep 2023, never the eight of 2024.
    expect(district?.busiest.count).toBe(6);
    expect(peakText(district?.busiest ?? null)).toBe('Sep 2023');
  });

  it('carries the span it was read from', () => {
    expect(roleContextOf(clock, 'curvance')?.span).toEqual({ start: 38, end: 45, current: false });
  });

  it('is null for a role that is not on the clock', () => {
    expect(roleContextOf(clock, 'nope')).toBeNull();
    expect(roleContextOf(buildRoleClock([], TODAY), 'curvance')).toBeNull();
  });

  it('has no one alongside a role that ran alone', () => {
    const alone = buildRoleClock([role('only', '2025-01-01', '2025-03-31')], TODAY);

    expect(roleContextOf(alone, 'only')).toMatchObject({ alongside: [], busiest: { count: 1 } });
  });
});
