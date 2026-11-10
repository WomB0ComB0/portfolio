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
 * @file The places /places shows: what the map and the card grid are given. The filter builds a
 * new results array on every render (twice per keystroke: the urgent render, then the deferred
 * one), the map's marker effect runs whenever its input's identity changes, and the memoised grid
 * re-renders whenever its input's does. So both get one array per set of results: the results
 * picked from the places, in the places' order, kept until the set changes. Typing that matches
 * the same places then moves no marker and re-renders no card. No storage and no effects.
 */

import { useMemo } from 'react';

/** Joins ids for the memo key; Sanity document ids never hold a line break. */
const ID_SEPARATOR = '\n';

/**
 * The results, as an array that keeps its identity while the result set stays the same.
 *
 * @example
 * const shown = useShownPlaces(places, results); // the same array until `results` changes set
 */
export function useShownPlaces<T extends { readonly id: string }>(
  places: readonly T[],
  results: readonly T[],
): T[] {
  const key = results.map((place) => place.id).join(ID_SEPARATOR);
  return useMemo(() => {
    const shown = new Set(key === '' ? [] : key.split(ID_SEPARATOR));
    return places.filter((place) => shown.has(place.id));
  }, [places, key]);
}
