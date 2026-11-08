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
 * @file The guestbook's dates and header figures. A row shows the month only ("Oct 2025"): most
 * messages share one import timestamp, so a time of day would be noise. Dates are read in UTC, so
 * the server and the browser always print the same month.
 */

import { describe, expect, it } from 'vitest';
import {
  dayOf,
  guestbookStats,
  monthOf,
} from '@/app/(routes)/(main)/(personal)/guestbook/_lib/format';
import type { GuestbookMessage } from '@/lib/guestbook/types';

const at = (id: string, createdAt: string): GuestbookMessage => ({
  id,
  authorName: 'Jane Example',
  message: 'Hi',
  createdAt,
});

describe('monthOf and dayOf', () => {
  it('prints the month and year, in UTC', () => {
    expect(monthOf('2025-10-27T09:19:00.000Z')).toBe('Oct 2025');
    // 23:30 on Oct 31 in New York is already November in UTC.
    expect(monthOf('2025-10-31T23:30:00-04:00')).toBe('Nov 2025');
  });

  it('gives the UTC day for the time element', () => {
    expect(dayOf('2025-10-27T09:19:00.000Z')).toBe('2025-10-27');
  });

  it('answers null for a date it cannot read', () => {
    expect(monthOf('not a date')).toBeNull();
    expect(dayOf('')).toBeNull();
  });
});

describe('guestbookStats', () => {
  it('counts every message and names the month of the earliest one', () => {
    const stats = guestbookStats(
      [
        at('c', '2025-11-18T18:33:00.000Z'),
        at('b', '2025-10-27T09:19:00.000Z'),
        at('a', '2025-10-27T09:19:00.000Z'),
      ],
      false,
    );

    expect(stats).toEqual({ count: 3, firstMonth: 'Oct 2025' });
  });

  it('marks the count with a plus when the list was cut at the cap', () => {
    expect(guestbookStats([at('a', '2025-10-27T09:19:00.000Z')], true).count).toBe('1+');
  });

  it('has no first month for an empty guestbook or unreadable dates', () => {
    expect(guestbookStats([], false)).toEqual({ count: 0, firstMonth: null });
    expect(guestbookStats([at('a', 'bad')], false).firstMonth).toBeNull();
  });
});
