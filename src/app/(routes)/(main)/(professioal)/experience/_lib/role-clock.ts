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
 * @file The clock every role is drawn on. Pure and isomorphic: the last month is the month of
 * the day the caller passes in (the page's nyToday()), never a Date read here.
 *
 * - buildRoleClock: one month a step from the first role's start to the clock's month, the
 *   roles that ran in each, how many run now, the peak with every run of months at it, the
 *   average, and each role's span in months.
 * - clockAxis: the columns the clock is drawn in. A month to a column while the history fits
 *   five years; after that a calendar quarter to a column, so a column never falls under about
 *   4px on a phone. Year ticks come with a rule for their labels: one is dropped when it would
 *   touch the label before it, cover the mark at this month or leave the plot, and fewer are
 *   kept for a plot too narrow, in the reader's own text size, for that rule to hold.
 * - columnSpanOf: a role's span in those columns, for its lane.
 * - roleContextOf: one role among the others, for its own page: the roles that shared a month
 *   with it, and how many ran at once at its busiest.
 */

import { parseRoleMonth, RANGE_SEPARATOR, type RoleMonth, type RolePeriod } from './period';

const MONTHS_PER_YEAR = 12;
const MONTHS_PER_QUARTER = 3;
const QUARTERS_PER_YEAR = 4;

/** The longest history drawn a month to a column: five years. Longer ones are drawn in quarters. */
export const MAX_MONTH_COLUMNS = 60;
/**
 * The share of the axis two year labels need between their starts. A four-figure year at 13px is
 * about 2.25rem wide, and all the labels are printed down to a 14.5rem plot (the narrowest at
 * the browser's own text size is the 15rem lane column): this leaves a third of a rem between.
 */
export const YEAR_LABEL_ROOM = 0.18;
/**
 * The share the last label needs before the plot's end: its inset from its year's line, itself,
 * and the mark at this month, which it must neither cover nor run past. About 3.25rem of a
 * 14.5rem plot.
 */
export const LAST_LABEL_ROOM = 0.225;
/**
 * The share a label needs in a narrow plot, between labels and at the end alike. A plot is
 * narrower than 14.5rem once a phone's text is enlarged: at 200% a 390px phone leaves it about
 * 8rem, where this much of the axis is the 3.25rem a label and the mark need.
 */
export const NARROW_LABEL_ROOM = 0.4;

/** What the clock reads of a role. */
export interface ClockRole {
  readonly id: string;
  readonly period: RolePeriod;
}

/** One month of the axis. */
export interface ClockMonth extends RoleMonth {
  /** 0 for the first role's first month. */
  readonly index: number;
  /** The roles that ran this month, in the order they were given. */
  readonly roleIds: readonly string[];
}

/** A role's months on the axis. */
export interface ClockSpan {
  /** Its first month's index. */
  readonly start: number;
  /** One past its last month's index, so `end - start` is its length in months. */
  readonly end: number;
  /**
   * Flagged current, so it runs to the clock's month. A role not flagged current may end in the
   * clock's month (or be planned to end later, and stop there) and is still not current.
   */
  readonly current: boolean;
}

/** A run of months, both counted. */
export interface ClockRun {
  readonly from: ClockMonth;
  readonly to: ClockMonth;
}

export interface ClockPeak {
  /** The most roles that ran in one month. */
  readonly count: number;
  /** Every run of months at that count, earliest first. */
  readonly runs: readonly ClockRun[];
}

export interface RoleClock {
  /** Every month from the first start to the clock's month; none when nothing can be dated. */
  readonly months: readonly ClockMonth[];
  /** Each dated role's span, by id, in the order the roles were given. */
  readonly spans: ReadonlyMap<string, ClockSpan>;
  /**
   * The roles that run now: those flagged current that have a span, which are exactly the roles
   * the list calls current (the lead and "Also now"). A role that ended this month is not one.
   */
  readonly now: number;
  readonly peak: ClockPeak | null;
  /** Role-months over months: how many roles ran at once on average. */
  readonly average: number;
}

export type ClockUnit = 'month' | 'quarter';

/** One column of the drawing: a month, or a calendar quarter. */
export interface ClockColumn {
  readonly index: number;
  /** Its first month's index and one past its last. */
  readonly start: number;
  readonly end: number;
  /**
   * The roles stacked in it: a month's own, or those of a quarter's busiest month (the later
   * one on a tie), so no column is taller than the peak the page prints. The column that holds
   * the clock's month stacks that month, so its "now" cells are the roles that run now.
   */
  readonly roleIds: readonly string[];
  /** Holds the clock's month. */
  readonly now: boolean;
}

/** A year's start on the axis. */
export interface YearTick {
  readonly column: number;
  readonly year: number;
  /** Whether its label has room; the tick's line is drawn either way. */
  readonly labelled: boolean;
  /** Whether its label still has room in a narrow plot: one of the labelled, never another. */
  readonly narrow: boolean;
}

export interface ClockAxis {
  readonly unit: ClockUnit;
  readonly columns: readonly ClockColumn[];
  readonly ticks: readonly YearTick[];
}

/** A role that ran beside another. */
export interface ClockNeighbour {
  readonly id: string;
  /** The months both ran. */
  readonly shared: number;
}

/** One role among the others on the clock. */
export interface RoleContext {
  readonly span: ClockSpan;
  /** Every other role that shared a month with it: the most shared first, then as given. */
  readonly alongside: readonly ClockNeighbour[];
  /** The most roles that ran at once during it, itself counted, and each run of its months there. */
  readonly busiest: ClockPeak;
}

const EMPTY_CLOCK: RoleClock = { months: [], spans: new Map(), now: 0, peak: null, average: 0 };
const EMPTY_AXIS: ClockAxis = { unit: 'month', columns: [], ticks: [] };

/** A month as a count of months, so two months subtract. */
const ordinalOf = (month: Pick<RoleMonth, 'year' | 'month'>): number =>
  month.year * MONTHS_PER_YEAR + (month.month - 1);

/** The month a count of months names. */
function monthAt(ordinal: number): RoleMonth {
  const year = Math.floor(ordinal / MONTHS_PER_YEAR);
  const month = (ordinal % MONTHS_PER_YEAR) + 1;
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  return parseRoleMonth(iso) ?? { iso, label: iso, year, month };
}

/** A role's first and last month, as counts of months. */
interface MonthRange {
  readonly first: number;
  readonly last: number;
}

/**
 * The months a role can be drawn in on a clock that ends at the month `clock` counts: from its
 * start to its end, or to the clock when it is current or ends later. Null without a readable
 * start, for a role that starts after the clock, and for one that ends before it starts.
 */
function rangeOf(period: RolePeriod, clock: number): MonthRange | null {
  if (!period.start) return null;
  const first = ordinalOf(period.start);
  const last = Math.min(period.end ? ordinalOf(period.end) : clock, clock);
  return first <= last ? { first, last } : null;
}

const runsIn = (span: ClockSpan | undefined, index: number): boolean =>
  span !== undefined && span.start <= index && index < span.end;

/** Every run of consecutive months at `count`, earliest first. */
function runsAt(months: readonly ClockMonth[], count: number): ClockRun[] {
  const runs: ClockRun[] = [];
  for (const month of months) {
    if (month.roleIds.length !== count) continue;
    const open = runs.at(-1);
    if (open && open.to.index === month.index - 1) {
      runs[runs.length - 1] = { from: open.from, to: month };
    } else {
      runs.push({ from: month, to: month });
    }
  }
  return runs;
}

/**
 * The clock for `roles`, ending in the month `today` (YYYY-MM-DD, the caller's clock) falls in,
 * and starting at the first month of a role it can draw. A role with no readable start, one that
 * starts after `today` and one that ends before it starts have no span and move nothing; with
 * no such role, or an unreadable `today`, the clock has no months.
 */
export function buildRoleClock(roles: readonly ClockRole[], today: string): RoleClock {
  const last = parseRoleMonth(today);
  if (!last) return EMPTY_CLOCK;
  const clock = ordinalOf(last);
  const drawn = roles.flatMap((role) => {
    const range = rangeOf(role.period, clock);
    return range ? [{ role, range }] : [];
  });
  if (drawn.length === 0) return EMPTY_CLOCK;
  const origin = Math.min(...drawn.map(({ range }) => range.first));
  const total = clock - origin + 1;

  const spans = new Map(
    drawn.map(({ role, range }): [string, ClockSpan] => [
      role.id,
      { start: range.first - origin, end: range.last - origin + 1, current: role.period.current },
    ]),
  );
  const months = Array.from({ length: total }, (_, index): ClockMonth => {
    const running = roles.filter((role) => runsIn(spans.get(role.id), index));
    return { ...monthAt(origin + index), index, roleIds: running.map((role) => role.id) };
  });
  const counts = months.map((month) => month.roleIds.length);
  const most = Math.max(...counts);
  return {
    months,
    spans,
    // The roles flagged current (each runs to this month); one that ended this month is not.
    now: [...spans.values()].filter((span) => span.current).length,
    peak: { count: most, runs: runsAt(months, most) },
    average: counts.reduce((sum, count) => sum + count, 0) / total,
  };
}

/** The calendar quarter a month falls in, as a count of quarters. */
const quarterOf = (month: RoleMonth): number =>
  month.year * QUARTERS_PER_YEAR + Math.floor((month.month - 1) / MONTHS_PER_QUARTER);

/** The months in groups: one each, or by calendar quarter. */
function groupMonths(months: readonly ClockMonth[], unit: ClockUnit): ClockMonth[][] {
  if (unit === 'month') return months.map((month) => [month]);
  const groups: ClockMonth[][] = [];
  for (const month of months) {
    const open = groups.at(-1);
    const first = open?.[0];
    if (open && first && quarterOf(first) === quarterOf(month)) open.push(month);
    else groups.push([month]);
  }
  return groups;
}

/** The busiest of a column's months; the later one on a tie. */
const busiestOf = (group: readonly ClockMonth[]): ClockMonth | undefined =>
  group.reduce<ClockMonth | undefined>(
    (best, month) => (!best || month.roleIds.length >= best.roleIds.length ? month : best),
    undefined,
  );

interface TickCandidate {
  readonly column: number;
  readonly year: number;
  /** The first column of a history that does not begin in January. */
  readonly partial: boolean;
}

/** Each January's column, and the first column under its own year. */
function tickCandidates(groups: readonly (readonly ClockMonth[])[]): TickCandidate[] {
  return groups.flatMap((group, column): TickCandidate[] => {
    const january = group.find((month) => month.month === 1);
    if (january) return [{ column, year: january.year, partial: false }];
    const first = group[0];
    return column === 0 && first ? [{ column, year: first.year, partial: true }] : [];
  });
}

/** The room labels need, as shares of the axis. */
interface LabelRoom {
  /** From one label's start to the next one's, and for a part first year before its January. */
  readonly between: number;
  /** From the last label's start to the plot's end. */
  readonly last: number;
}

/**
 * The columns of the ticks that keep their label, left to right. A label needs `room.between`
 * of the axis clear of the label kept before it and `room.last` before the plot's end; the
 * first year of a history that begins mid-year also gives way to the January after it.
 */
function keptColumns(
  candidates: readonly TickCandidate[],
  total: number,
  room: LabelRoom,
): ReadonlySet<number> {
  const share = (columns: number): number => columns / total;
  return candidates.reduce<{ columns: Set<number>; kept: number | null }>(
    ({ columns, kept }, tick, index) => {
      const next = candidates[index + 1]?.column ?? total;
      const fits =
        share(total - tick.column) >= room.last &&
        (kept === null || share(tick.column - kept) >= room.between) &&
        (!tick.partial || share(next - tick.column) >= room.between);
      return fits
        ? { columns: new Set([...columns, tick.column]), kept: tick.column }
        : { columns, kept };
    },
    { columns: new Set<number>(), kept: null },
  ).columns;
}

const WIDE_ROOM: LabelRoom = { between: YEAR_LABEL_ROOM, last: LAST_LABEL_ROOM };
const NARROW_ROOM: LabelRoom = { between: NARROW_LABEL_ROOM, last: NARROW_LABEL_ROOM };

/**
 * Every tick with whether it keeps its label: with the room a plot of ordinary width needs,
 * and, of those, with the room a narrow one needs.
 */
function labelTicks(candidates: readonly TickCandidate[], total: number): YearTick[] {
  const labelled = keptColumns(candidates, total, WIDE_ROOM);
  const narrow = keptColumns(
    candidates.filter((tick) => labelled.has(tick.column)),
    total,
    NARROW_ROOM,
  );
  return candidates.map((tick) => ({
    column: tick.column,
    year: tick.year,
    labelled: labelled.has(tick.column),
    narrow: narrow.has(tick.column),
  }));
}

/**
 * The columns a clock is drawn in: its months while there are no more than `maxMonthColumns`,
 * calendar quarters after that (the first and last may be part quarters).
 */
export function clockAxis(clock: RoleClock, maxMonthColumns = MAX_MONTH_COLUMNS): ClockAxis {
  const { months } = clock;
  if (months.length === 0) return EMPTY_AXIS;
  const unit: ClockUnit = months.length <= maxMonthColumns ? 'month' : 'quarter';
  const groups = groupMonths(months, unit);
  const lastIndex = months.length - 1;
  const columns = groups.map((group, index): ClockColumn => {
    const start = group[0]?.index ?? 0;
    const end = (group.at(-1)?.index ?? start) + 1;
    const now = start <= lastIndex && lastIndex < end;
    // The column with this month in it stacks this month: the roles that run now.
    const drawn = now ? months[lastIndex] : busiestOf(group);
    return { index, start, end, roleIds: drawn?.roleIds ?? [], now };
  });
  return { unit, columns, ticks: labelTicks(tickCandidates(groups), columns.length) };
}

/**
 * A span in the axis's columns: every column the role touched, so a role with months always has
 * at least one. `end` is one past the last column.
 */
export function columnSpanOf(
  axis: ClockAxis,
  span: Pick<ClockSpan, 'start' | 'end'>,
): { readonly start: number; readonly end: number } {
  const touched = axis.columns.filter(
    (column) => column.end > span.start && column.start < span.end,
  );
  const first = touched[0];
  const last = touched.at(-1);
  return first && last ? { start: first.index, end: last.index + 1 } : { start: 0, end: 0 };
}

/**
 * The roles in the order the stack piles them, bottom first: those still running (the longest
 * running at the bottom), then the ended ones by their start. Roles alike keep the order given.
 */
export function stackOrderOf(clock: RoleClock): string[] {
  return [...clock.spans]
    .map(([id, span], given) => ({ id, span, given }))
    .sort(
      (a, b) =>
        Number(b.span.current) - Number(a.span.current) ||
        a.span.start - b.span.start ||
        a.given - b.given,
    )
    .map(({ id }) => id);
}

/** The months two spans both cover; 0 when they never met. */
const sharedMonths = (a: ClockSpan, b: ClockSpan): number =>
  Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));

/**
 * `id` among the other roles of the clock: who ran beside it and for how many months, and the
 * most that ran at once during its own months (itself counted) with when. Null for a role the
 * clock has no span for.
 */
export function roleContextOf(clock: RoleClock, id: string): RoleContext | null {
  const span = clock.spans.get(id);
  if (!span) return null;
  const alongside = [...clock.spans]
    .map(([other, its], given) => ({ id: other, shared: sharedMonths(span, its), given }))
    .filter((each) => each.id !== id && each.shared > 0)
    .sort((a, b) => b.shared - a.shared || a.given - b.given)
    .map(({ id: other, shared }): ClockNeighbour => ({ id: other, shared }));
  const own = clock.months.slice(span.start, span.end);
  const most = Math.max(...own.map((month) => month.roleIds.length));
  return { span, alongside, busiest: { count: most, runs: runsAt(own, most) } };
}

/** 'Jun' of 'Jun 2024'. */
const monthName = (month: RoleMonth): string => month.label.slice(0, month.label.lastIndexOf(' '));

/** 'Jun – Sep 2024', 'Dec 2024 – Jun 2025', or one month alone: 'Aug 2024'. */
export function monthRangeText(from: RoleMonth, to: RoleMonth): string {
  if (from.iso === to.iso) return from.label;
  const start = from.year === to.year ? monthName(from) : from.label;
  return `${start}${RANGE_SEPARATOR}${to.label}`;
}

/** When the peak held: its one run of months, or its first when it came back; '' without one. */
export function peakText(peak: ClockPeak | null): string {
  const first = peak?.runs[0];
  if (!peak || !first) return '';
  const range = monthRangeText(first.from, first.to);
  return peak.runs.length === 1 ? range : `first in ${range}`;
}

/**
 * When the peak held, in words for a screen reader, which would read peakText's dash aloud or
 * skip it: 'from Jun 2024 to Sep 2024', a month alone as 'in Sep 2023', and 'first …' when the
 * count came back later; '' without one.
 */
export function peakSpoken(peak: ClockPeak | null): string {
  const first = peak?.runs[0];
  if (!peak || !first) return '';
  const when =
    first.from.iso === first.to.iso
      ? `in ${first.from.label}`
      : `from ${first.from.label} to ${first.to.label}`;
  return peak.runs.length === 1 ? when : `first ${when}`;
}
