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
 * @file useShownPlaces: what the map is given. The filter builds a new results array on every
 * render (twice per keystroke: urgent, then deferred), and the map rebuilds its markers whenever
 * its input's identity changes, so the hook keeps one array until the set of results changes.
 * It is the results picked from the places, in the places' order.
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useShownPlaces } from '@/app/(routes)/(main)/(personal)/places/_components/use-shown-places';
import type { PlaceItem } from '@/types/places';

const place = (id: string): PlaceItem => ({
  id,
  name: `Venue ${id}`,
  description: '',
  latitude: 40.7,
  longitude: -74,
  category: 'Event',
  photos: [],
});

const PLACES = [place('a'), place('b'), place('c'), place('d')];

describe('useShownPlaces', () => {
  it('returns the same array for a new results array with the same places', () => {
    const { result, rerender } = renderHook(
      ({ results }: { results: readonly PlaceItem[] }) => useShownPlaces(PLACES, results),
      { initialProps: { results: PLACES.filter((each) => each.id !== 'b') } },
    );
    const first = result.current;

    rerender({ results: PLACES.filter((each) => each.id !== 'b') });

    expect(result.current).toBe(first);
    expect(result.current.map((each) => each.id)).toEqual(['a', 'c', 'd']);
  });

  it('returns a new array, in the places’ order, when the results change', () => {
    const { result, rerender } = renderHook(
      ({ results }: { results: readonly PlaceItem[] }) => useShownPlaces(PLACES, results),
      { initialProps: { results: PLACES } },
    );
    const first = result.current;

    rerender({ results: [PLACES[3], PLACES[0]] as PlaceItem[] });

    expect(result.current).not.toBe(first);
    expect(result.current.map((each) => each.id)).toEqual(['a', 'd']);
    expect(result.current[0]).toBe(PLACES[0]);
  });

  it('returns nothing for no results, and keeps that array', () => {
    const { result, rerender } = renderHook(
      ({ results }: { results: readonly PlaceItem[] }) => useShownPlaces(PLACES, results),
      { initialProps: { results: [] as readonly PlaceItem[] } },
    );
    const first = result.current;

    rerender({ results: [] });

    expect(result.current).toEqual([]);
    expect(result.current).toBe(first);
  });
});
