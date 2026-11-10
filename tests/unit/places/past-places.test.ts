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
 * @file /places shows past visits only (the owner's opsec rule): a visit counts once its last
 * day is strictly before the cutoff (placeCutoffDay: New York's today from noon ET, else its
 * yesterday), so a visit today, a range still running and anything still to come never show.
 * An undated place, or one whose last day is not a calendar day (the v1 route reads Sanity's raw
 * documents), may still be on, so it never shows either. The filter keeps the server's order.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { placeCutoffDay } from '@/app/_components/home/data/selectors';
import {
  isPastPlace,
  pastPlacesOnly,
} from '@/app/(routes)/(main)/(personal)/places/_lib/past-places';

interface Visit {
  readonly id: string;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
}

const ids = (visits: readonly Visit[]): string[] => visits.map((visit) => visit.id);

afterEach(() => {
  vi.useRealTimers();
});

describe('pastPlacesOnly', () => {
  const CUTOFF = '2026-11-09';

  it('keeps a visit that ended before the cutoff and drops one on it or after it', () => {
    const visits: Visit[] = [
      { id: 'yesterday', startDate: '2026-11-08' },
      { id: 'cutoff-day', startDate: '2026-11-09' },
      { id: 'tomorrow', startDate: '2026-11-10' },
    ];

    expect(ids(pastPlacesOnly(visits, CUTOFF))).toEqual(['yesterday']);
  });

  it('drops a range still running on the cutoff and keeps one that ended before it', () => {
    const visits: Visit[] = [
      { id: 'running', startDate: '2026-11-01', endDate: '2026-11-09' },
      { id: 'future-range', startDate: '2026-12-01', endDate: '2026-12-03' },
      { id: 'over', startDate: '2026-11-01', endDate: '2026-11-08' },
    ];

    expect(ids(pastPlacesOnly(visits, CUTOFF))).toEqual(['over']);
  });

  it('drops an undated place: with no day it may still be on', () => {
    const visits: Visit[] = [
      { id: 'no-dates' },
      { id: 'null-dates', startDate: null },
      { id: 'end-only', endDate: '2026-11-01' },
      { id: 'over', startDate: '2026-11-01' },
    ];

    expect(ids(pastPlacesOnly(visits, CUTOFF))).toEqual(['over']);
  });

  it('drops a place whose last day is not a calendar day (raw Sanity data)', () => {
    const visits: Visit[] = [
      { id: 'month-only', startDate: '2026-10' },
      { id: 'words', startDate: 'last week' },
      { id: 'blank', startDate: '' },
      { id: 'timestamp', startDate: '2026-10-01T09:00:00Z' },
    ];

    // A timestamp is read by its leading day, as everywhere else on the site.
    expect(ids(pastPlacesOnly(visits, CUTOFF))).toEqual(['timestamp']);
  });

  it('answers one place at a time with isPastPlace', () => {
    expect(isPastPlace({ startDate: '2026-11-08' }, CUTOFF)).toBe(true);
    expect(isPastPlace({ startDate: '2026-11-09' }, CUTOFF)).toBe(false);
    expect(isPastPlace({ startDate: null }, CUTOFF)).toBe(false);
  });

  it('keeps the input order and returns a new array', () => {
    const visits: Visit[] = [
      { id: 'b', startDate: '2026-08-11' },
      { id: 'a', startDate: '2026-08-11' },
      { id: 'c', startDate: '2026-06-02' },
    ];

    const kept = pastPlacesOnly(visits, CUTOFF);
    expect(ids(kept)).toEqual(['b', 'a', 'c']);
    expect(kept).not.toBe(visits);
  });

  it('counts yesterday as over only from noon ET', () => {
    const yesterday: Visit[] = [{ id: 'yesterday', startDate: '2026-11-09' }];

    // 11:59 ET on Nov 10 (EST, UTC-5): Nov 9 may still be going on.
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 10, 16, 59) });
    expect(ids(pastPlacesOnly(yesterday, placeCutoffDay(Date.now())))).toEqual([]);

    // 12:00 ET: it is over.
    vi.setSystemTime(Date.UTC(2026, 10, 10, 17, 0));
    expect(ids(pastPlacesOnly(yesterday, placeCutoffDay(Date.now())))).toEqual(['yesterday']);
  });
});
