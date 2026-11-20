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
 * @file The owner's age, whole and to five decimals (the /stats header strip). It goes up at 00:00
 * UTC on March 24 whatever the time zone of the process computing it, so the server (UTC) and a
 * visitor's browser agree on it at every instant and the strip hydrates without a mismatch. The
 * decimals are the share of the birthday year gone by, against that year's real length, truncated.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { AGE_DECIMALS, ageOn, exactAgeParts, formatExactAge } from '@/constants/age';

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe('ageOn', () => {
  it('goes up at 00:00 UTC on March 24', () => {
    expect(ageOn(new Date('2026-03-23T23:59:59.999Z'))).toBe(21);
    expect(ageOn(new Date('2026-03-24T00:00:00.000Z'))).toBe(22);
  });

  it('counts whole years across the rest of the calendar', () => {
    expect(ageOn(new Date('2004-03-24T00:00:00Z'))).toBe(0);
    expect(ageOn(new Date('2005-03-23T12:00:00Z'))).toBe(0);
    expect(ageOn(new Date('2026-01-01T00:00:00Z'))).toBe(21);
    expect(ageOn(new Date('2026-03-01T00:00:00Z'))).toBe(21);
    expect(ageOn(new Date('2026-04-01T00:00:00Z'))).toBe(22);
    expect(ageOn(new Date('2026-12-31T23:59:59Z'))).toBe(22);
    // A leap day is still before the birthday.
    expect(ageOn(new Date('2028-02-29T12:00:00Z'))).toBe(23);
  });

  it.each([
    ['America/New_York', 23],
    ['Asia/Tokyo', 24],
    ['UTC', 24],
  ])(
    'gives the same age in %s, where the local date differs around the rollover',
    (zone, localDay) => {
      process.env.TZ = zone;
      const justAfter = new Date('2026-03-24T02:00:00Z');
      const justBefore = new Date('2026-03-23T23:00:00Z');
      // The zone took effect: 02:00 UTC is still March 23 in New York, March 24 in Tokyo.
      expect(justAfter.getDate()).toBe(localDay);

      expect(ageOn(justBefore)).toBe(21);
      expect(ageOn(justAfter)).toBe(22);
    },
  );
});

/** One step of the fifth decimal in a 365-day birthday year: 1e-5 of 365 days, in milliseconds. */
const STEP_365_MS = 315_360;
/** The same in a 366-day birthday year (one that holds a February 29). */
const STEP_366_MS = 316_224;

const at = (iso: string, offsetMs = 0): Date => new Date(Date.parse(iso) + offsetMs);

describe('formatExactAge', () => {
  it('shows five decimals by default', () => {
    expect(AGE_DECIMALS).toBe(5);
    // 240 of the 365 days from March 24, 2026 to March 24, 2027.
    expect(formatExactAge(new Date('2026-11-19T00:00:00Z'))).toBe('22.65753');
  });

  it('reads exactly 22.00000 at 00:00 UTC on the birthday, and 21.99999 a millisecond before', () => {
    // Rounding (the first site's toFixed) would show 22.00000 before the birthday.
    expect(formatExactAge(new Date('2026-03-23T23:59:59.999Z'))).toBe('21.99999');
    expect(formatExactAge(new Date('2026-03-24T00:00:00.000Z'))).toBe('22.00000');
  });

  it('keeps leading zeros and moves the fifth decimal one step at a time, never early', () => {
    const birthday = '2026-03-24T00:00:00Z';
    expect(formatExactAge(at(birthday, STEP_365_MS - 1))).toBe('22.00000');
    expect(formatExactAge(at(birthday, STEP_365_MS))).toBe('22.00001');
    expect(formatExactAge(at(birthday, 10 * STEP_365_MS))).toBe('22.00010');
  });

  it('measures each year by its real length: 365 days, or 366 with a February 29', () => {
    // Halfway through a 365-day year (182.5 days) and a 366-day one (183 days).
    expect(formatExactAge(new Date('2026-09-22T12:00:00Z'))).toBe('22.50000');
    expect(formatExactAge(new Date('2027-09-23T00:00:00Z'))).toBe('23.50000');
    // In the leap year one step of the fifth decimal is longer.
    const leapBirthday = '2027-03-24T00:00:00Z';
    expect(formatExactAge(at(leapBirthday, STEP_366_MS - 1))).toBe('23.00000');
    expect(formatExactAge(at(leapBirthday, STEP_366_MS))).toBe('23.00001');
    // The leap day itself: 342.5 of 366 days.
    expect(formatExactAge(new Date('2028-02-29T12:00:00Z'))).toBe('23.93579');
    expect(formatExactAge(new Date('2028-03-24T00:00:00Z'))).toBe('24.00000');
  });

  it('always agrees with the whole years', () => {
    const samples = [
      '2004-03-24T00:00:00Z',
      '2026-03-23T23:59:59.999Z',
      '2026-03-24T00:00:00Z',
      '2026-11-19T15:42:07.123Z',
      '2028-02-29T23:59:59.999Z',
      '2100-03-23T23:59:59.999Z',
    ];
    for (const iso of samples) {
      const date = new Date(iso);
      expect(exactAgeParts(date)?.whole, iso).toBe(String(ageOn(date)));
    }
  });

  it.each(['America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Kiritimati', 'UTC'])(
    'gives the same digits in %s',
    (zone) => {
      process.env.TZ = zone;
      expect(formatExactAge(new Date('2026-03-24T00:00:00Z'))).toBe('22.00000');
      expect(formatExactAge(new Date('2026-11-19T00:00:00Z'))).toBe('22.65753');
    },
  );

  it('takes other precisions and has no point without decimals', () => {
    const date = new Date('2026-11-19T00:00:00Z');
    expect(formatExactAge(date, 0)).toBe('22');
    expect(formatExactAge(date, 2)).toBe('22.65');
    // Beyond what a double holds exactly: 240/365 = 0.657534246575...
    expect(formatExactAge(date, 12)).toBe('22.657534246575');
    expect(exactAgeParts(date)).toEqual({ whole: '22', fraction: '65753' });
  });

  it('gives null for an invalid date', () => {
    expect(formatExactAge(new Date(Number.NaN))).toBeNull();
    expect(exactAgeParts(new Date('not a date'))).toBeNull();
  });
});

describe('the age module', () => {
  it('imports nothing, so the LiveAge island adds no site constants to the browser bundle', () => {
    const source = readFileSync(join(process.cwd(), 'src/constants/age.ts'), 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
