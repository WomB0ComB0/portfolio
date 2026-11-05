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
 * @file The age the /stats Dev Stats card shows. It goes up at 00:00 UTC on March 24 whatever
 * the time zone of the process computing it, so the server (UTC) and a visitor's browser agree
 * on it at every instant and the card hydrates without a mismatch.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// t3-env validates on import (through '@/utils'); this module needs no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import { ageOn } from '@/constants/app';

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
