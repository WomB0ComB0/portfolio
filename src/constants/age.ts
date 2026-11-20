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
 * @file The owner's age, whole and to the decimal. No imports, so the /stats LiveAge island can use
 * it without pulling the site's metadata constants (app.ts) into the browser bundle.
 */

/**
 * Birth date, March 24, 2004, at midnight UTC. Fixed in UTC rather than parsed in local time so
 * a server (UTC) and a browser in any time zone roll the age over at the same instant.
 */
const BIRTH_DATE = new Date(Date.UTC(2004, 2, 24));

/**
 * How many decimals the live age on /stats shows. The eighth is 1e-8 of a year, a step every
 * 315.36 ms (316.224 ms in a 366-day year), so the last digit visibly ticks about three times a
 * second. At 8 places a year's milliseconds times 10^8 pass Number.MAX_SAFE_INTEGER, one reason
 * the fraction is worked out in BigInt.
 */
export const AGE_DECIMALS = 8;

/**
 * Age in whole years on `date`, counted in UTC calendar days: it goes up at 00:00 UTC on March 24.
 *
 * Call it when rendering rather than storing the result at module load. A server process outlives
 * a birthday, and a value captured when it started would disagree with the browser's (a
 * hydration mismatch) until the next restart.
 *
 * @example
 *   ageOn(new Date('2026-03-23T23:59:59Z')); // 21
 *   ageOn(new Date('2026-03-24T00:00:00Z')); // 22
 */
export const ageOn = (date: Date): number => {
  const years = date.getUTCFullYear() - BIRTH_DATE.getUTCFullYear();
  const month = date.getUTCMonth();
  const birthMonth = BIRTH_DATE.getUTCMonth();
  const hasHadBirthday =
    month > birthMonth || (month === birthMonth && date.getUTCDate() >= BIRTH_DATE.getUTCDate());
  return hasHadBirthday ? years : years - 1;
};

/** The birthday in `year`, at 00:00 UTC, in epoch milliseconds. */
const birthdayIn = (year: number): number =>
  Date.UTC(year, BIRTH_DATE.getUTCMonth(), BIRTH_DATE.getUTCDate());

/** An exact age split for display: whole years, and the digits after the point. */
export interface ExactAge {
  /** Whole years, always equal to ageOn: '22'. */
  readonly whole: string;
  /** The share of the current birthday year gone by, truncated to the decimals asked for: '65753424'. */
  readonly fraction: string;
}

/**
 * Age on `date` to `decimals` places: whole years (ageOn) plus the share of the year since the last
 * birthday, measured against that year's real length (366 days when it holds a February 29), so the
 * figure reads exactly 22.00000000 at 00:00 UTC on the birthday. Null for an invalid date.
 *
 * The fraction is truncated, never rounded, so the whole years never turn over before the birthday
 * (rounding to eight places shows 22.00000000 for the last 157 ms of 21). It is worked out in
 * integers (BigInt milliseconds), so no decimal is ever off by one from floating-point error.
 *
 * Not the first site's `(now - new Date('March 24, 2004')) / 365.25 days`: that parsed the birth
 * date in the visitor's local time and drifted by up to three quarters of a day against the
 * calendar, so the whole years and the birthday disagreed.
 *
 * @example
 *   exactAgeParts(new Date('2026-11-19T00:00:00Z')); // { whole: '22', fraction: '65753424' }
 */
export function exactAgeParts(date: Date, decimals: number = AGE_DECIMALS): ExactAge | null {
  const time = date.getTime();
  if (!Number.isFinite(time)) return null;
  const years = ageOn(date);
  const lastBirthday = birthdayIn(BIRTH_DATE.getUTCFullYear() + years);
  const nextBirthday = birthdayIn(BIRTH_DATE.getUTCFullYear() + years + 1);
  const places = Math.max(0, Math.trunc(decimals));
  // Both operands are whole and the elapsed time is never negative, so BigInt division truncates.
  const steps =
    (BigInt(time - lastBirthday) * 10n ** BigInt(places)) / BigInt(nextBirthday - lastBirthday);
  return {
    whole: String(years),
    fraction: places === 0 ? '' : String(steps).padStart(places, '0'),
  };
}

/**
 * The exact age as one string, '22.65753424' ('22' with no decimals). Null for an invalid date.
 *
 * @example
 *   formatExactAge(new Date('2026-03-24T00:00:00Z')); // '22.00000000'
 */
export function formatExactAge(date: Date, decimals: number = AGE_DECIMALS): string | null {
  const parts = exactAgeParts(date, decimals);
  if (!parts) return null;
  return parts.fraction === '' ? parts.whole : `${parts.whole}.${parts.fraction}`;
}
