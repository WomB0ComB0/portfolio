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
 * @file The one way the site reads places: past visits only, at the request's cutoff
 * (placeCutoffDay). The list page, the place page, the sitemap, the public v1 JSON and the home
 * counts all read through these loaders, so a visit that may still be on (today, a range still
 * running, one to come, or an undated one) is on none of them. Synthetic places.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Place } from '@/hooks/sanity/schemas';
import { makePlace } from '../../fixtures/sanity-docs';

const sanity = vi.hoisted(() => ({
  loadPlaces: vi.fn<() => Promise<readonly Place[]>>(),
  peekPlaces: vi.fn<() => { data: readonly Place[]; loadedAt: number } | undefined>(),
  loadPlaceById: vi.fn<(id: string) => Promise<Place | null>>(),
  readPlaces: vi.fn(),
}));

vi.mock('@/lib/sanity/loaders', () => sanity);

import {
  loadPastPlaceById,
  loadPastPlaces,
  peekPastPlaces,
  readPastPlaces,
} from '@/app/(routes)/(main)/(personal)/places/_lib/past-place-loaders';

// 13:00 ET on Nov 10, 2026: from noon, Nov 10 is the cutoff, so Nov 9 is over and Nov 10 is not.
const NOW = Date.UTC(2026, 10, 10, 18, 0);
const LOADED_AT = NOW - 60_000;

const PAST = makePlace({ name: 'Over', startDate: '2026-11-09' });
const OLDER = makePlace({ name: 'Older', startDate: '2026-06-02' });
const TODAY = makePlace({ name: 'Today', startDate: '2026-11-10' });
const RUNNING = makePlace({ name: 'Running', startDate: '2026-11-08', endDate: '2026-11-20' });
const TO_COME = makePlace({ name: 'To come', startDate: '2026-12-01', endDate: '2026-12-04' });
const UNDATED = makePlace({ name: 'Undated', startDate: null });
const ALL = [TODAY, PAST, RUNNING, TO_COME, UNDATED, OLDER];

const names = (places: readonly Place[]): string[] => places.map((place) => place.name);

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  for (const mock of Object.values(sanity)) mock.mockReset();
  sanity.loadPlaces.mockResolvedValue(ALL);
  sanity.loadPlaceById.mockImplementation(
    async (id) => ALL.find((place) => place._id === id) ?? null,
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loadPastPlaces', () => {
  it('keeps only the visits that are over, in the server order', async () => {
    await expect(loadPastPlaces().then(names)).resolves.toEqual(['Over', 'Older']);
  });

  it('lets a Sanity outage through, for the page’s error boundary', async () => {
    const outage = new Error('sanity is down');
    sanity.loadPlaces.mockRejectedValue(outage);

    await expect(loadPastPlaces()).rejects.toBe(outage);
  });
});

describe('peekPastPlaces', () => {
  it('filters the last cached list and keeps when it was loaded', () => {
    sanity.peekPlaces.mockReturnValue({ data: ALL, loadedAt: LOADED_AT });

    const peeked = peekPastPlaces();

    expect(peeked?.loadedAt).toBe(LOADED_AT);
    expect(names(peeked?.data ?? [])).toEqual(['Over', 'Older']);
  });

  it('answers nothing when nothing is cached', () => {
    sanity.peekPlaces.mockReturnValue(undefined);

    expect(peekPastPlaces()).toBeUndefined();
  });
});

describe('loadPastPlaceById', () => {
  it('finds a past place', async () => {
    await expect(loadPastPlaceById(PAST._id)).resolves.toBe(PAST);
  });

  it.each([
    ['a visit today', TODAY],
    ['a range still running', RUNNING],
    ['a visit to come', TO_COME],
    ['an undated place', UNDATED],
  ])('answers null for %s, as for an unknown id', async (_label, place) => {
    await expect(loadPastPlaceById(place._id)).resolves.toBeNull();
    await expect(loadPastPlaceById('__nope__')).resolves.toBeNull();
  });
});

describe('readPastPlaces (the v1 route’s reader)', () => {
  it('serves only past places, keeping a fresh answer fresh', async () => {
    sanity.readPlaces.mockResolvedValue({ stale: false, data: ALL, loadedAt: LOADED_AT });

    const result = await readPastPlaces();

    expect(result.stale).toBe(false);
    expect(names(result.data)).toEqual(['Over', 'Older']);
  });

  it('keeps a stale answer stale, with its error', async () => {
    const error = new Error('Sanity answered 502');
    sanity.readPlaces.mockResolvedValue({ stale: true, data: ALL, error, loadedAt: LOADED_AT });

    const result = await readPastPlaces();

    expect(result).toMatchObject({ stale: true, error, loadedAt: LOADED_AT });
    expect(names(result.data)).toEqual(['Over', 'Older']);
  });

  it('drops a raw document whose date is not a calendar day', async () => {
    const raw = [{ ...PAST, startDate: 'soon' }, OLDER];
    sanity.readPlaces.mockResolvedValue({ stale: false, data: raw, loadedAt: LOADED_AT });

    await expect(readPastPlaces().then((result) => names(result.data))).resolves.toEqual(['Older']);
  });
});
