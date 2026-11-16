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
 * @file A role's length as text: '3 yrs 11 mos' as both experience pages print it, the same as
 * parts so a row can set the figures apart from their units, and in whole words for a screen
 * reader. Pure: a role runs at most to the month of the day passed in.
 */

import { monthsBetween, parseRoleMonth, type RoleMonth, type RolePeriod } from './period';

const MONTHS_PER_YEAR = 12;

export type LengthUnit = 'yr' | 'yrs' | 'mo' | 'mos';

/** One figure of a length with its unit: 3 'yrs'. */
export interface LengthPart {
  readonly value: number;
  readonly unit: LengthUnit;
}

export interface RoleLength {
  /** Whole months, the first and the last both counted. */
  readonly months: number;
  /** '3 yrs 11 mos'. */
  readonly text: string;
  /** '3 years 11 months'. */
  readonly spoken: string;
  readonly parts: readonly LengthPart[];
}

const SPOKEN_UNIT: Readonly<Record<LengthUnit, string>> = {
  yr: 'year',
  yrs: 'years',
  mo: 'month',
  mos: 'months',
};

/** A length of `months`: years then months, a zero part left out; null for no months. */
export function lengthFromMonths(months: number): RoleLength | null {
  if (months <= 0) return null;
  const years = Math.floor(months / MONTHS_PER_YEAR);
  const rest = months % MONTHS_PER_YEAR;
  const parts: LengthPart[] = [
    ...(years > 0 ? [{ value: years, unit: years === 1 ? 'yr' : 'yrs' } as const] : []),
    ...(rest > 0 ? [{ value: rest, unit: rest === 1 ? 'mo' : 'mos' } as const] : []),
  ];
  return {
    months,
    text: parts.map((part) => `${part.value} ${part.unit}`).join(' '),
    spoken: parts.map((part) => `${part.value} ${SPOKEN_UNIT[part.unit]}`).join(' '),
    parts,
  };
}

/** The earlier of two months. */
const earlierOf = (a: RoleMonth, b: RoleMonth): RoleMonth =>
  a.year * MONTHS_PER_YEAR + a.month <= b.year * MONTHS_PER_YEAR + b.month ? a : b;

/**
 * How long the role has run by `today`'s month (a YYYY-MM-DD day, the caller's clock): a current
 * role to that month, any other to its end month or that month, whichever is earlier, so a
 * planned end never prints more months than the role's lane draws. Null without a readable
 * start, for a role that has not started by then, or for a current role without a readable
 * today; with no readable today an ended role runs to its end.
 */
export function lengthOf(period: RolePeriod, today: string): RoleLength | null {
  if (!period.start) return null;
  const clock = parseRoleMonth(today);
  const end = period.end && clock ? earlierOf(period.end, clock) : period.end;
  const last = period.current ? clock : end;
  return last ? lengthFromMonths(monthsBetween(period.start, last)) : null;
}
