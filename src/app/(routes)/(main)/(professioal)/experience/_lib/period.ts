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
 * @file A role's period, as /experience and /experience/[id] print it. Pure and isomorphic.
 *
 * - Sanity stores calendar dates (YYYY-MM-DD). They are read as written, by their year and month,
 *   never through a Date in some time zone, so 2024-01-01 is always January.
 * - A role is current when Studio says so, or when it has no readable end date (the old
 *   timeline printed "Present" for those too).
 * - The range is an en dash ('Mar 2026 – Present'); a role that began and ended in one month is
 *   that month once.
 * - Months are counted with both the first and the last, as a CV does: Jan to Mar is 3.
 */

/** A role's start or end month. */
export interface RoleMonth {
  /** 'YYYY-MM', for <time dateTime>. */
  readonly iso: string;
  /** 'Mar 2026'. */
  readonly label: string;
  readonly year: number;
  /** 1 to 12. */
  readonly month: number;
}

/** A role's span, as printed. */
export interface RolePeriod {
  readonly start: RoleMonth | null;
  /** Null for a current role, whatever its end date says. */
  readonly end: RoleMonth | null;
  readonly current: boolean;
  /** 'Mar 2026 – Present', 'Sep 2023 – Sep 2024', 'Jun 2024'. */
  readonly text: string;
}

/** The fields of an experience a period is read from. */
export interface RoleDates {
  readonly startDate: string;
  readonly endDate?: string | null;
  readonly current: boolean;
}

/** What a current role's range ends with. */
export const PRESENT_LABEL = 'Present';
/** The range's dash, with its spaces. Screen readers are given 'to' instead (RolePeriodText). */
export const RANGE_SEPARATOR = ' – ';

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const MONTHS_PER_YEAR = 12;
/** A date's leading year and month: '2024-01-01', '2024-01' and '2024-01-01T00:00:00Z' all match. */
const LEADING_MONTH = /^(\d{4})-(\d{2})(?![\d])/u;

/**
 * The month a Sanity date falls in, or null when it is missing, blank or not a real month
 * (month 00 or 13 included).
 */
export function parseRoleMonth(value: string | null | undefined): RoleMonth | null {
  const match = value ? LEADING_MONTH.exec(value.trim()) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const name = MONTH_NAMES[month - 1];
  if (!name) return null;
  return { iso: `${match[1]}-${match[2]}`, label: `${name} ${year}`, year, month };
}

/** Current when Studio flags it, or when it has no readable end date. */
export function isCurrentRole(role: RoleDates): boolean {
  return role.current || parseRoleMonth(role.endDate) === null;
}

/**
 * The printed range: start to end, or to Present. A role inside one month prints that month
 * once; an unreadable start leaves only the end (or Present).
 */
function rangeText(start: RoleMonth | null, end: RoleMonth | null): string {
  const endLabel = end ? end.label : PRESENT_LABEL;
  if (!start) return endLabel;
  if (end && end.iso === start.iso) return start.label;
  return `${start.label}${RANGE_SEPARATOR}${endLabel}`;
}

/** A role's period: its months, whether it is current, and the range as printed. */
export function periodOf(role: RoleDates): RolePeriod {
  const current = isCurrentRole(role);
  const start = parseRoleMonth(role.startDate);
  const end = current ? null : parseRoleMonth(role.endDate);
  return { start, end, current, text: rangeText(start, end) };
}

/**
 * Months from `start` to `end`, both counted (Jan to Mar is 3); 0 when `end` is earlier. A
 * length as text is role-length.ts's.
 */
export function monthsBetween(start: RoleMonth, end: RoleMonth): number {
  const span = (end.year - start.year) * MONTHS_PER_YEAR + (end.month - start.month) + 1;
  return Math.max(0, span);
}
