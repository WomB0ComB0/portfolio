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
 * @file /places shows past visits only (the owner's rule: the site never tells where he is now).
 * The rule is the home tile's (lastDayIfOver, src/app/_components/home/data/selectors.ts): a
 * visit is over once its last day (a range's end, else its one day) is strictly before the
 * cutoff, which is placeCutoffDay (New York's today from noon ET, its yesterday before then). A
 * place with no day, or one whose day is not a calendar day (the v1 route reads Sanity's raw
 * documents), may still be on, so it is not past either. Pure and server-safe; every reader of
 * places goes through past-place-loaders.ts, which applies it before anything leaves the server.
 */

import type { DateSpan } from '@/app/_components/home/data/format';
import { lastDayIfOver } from '@/app/_components/home/data/selectors';

/** A calendar day as Sanity's date type stores it. */
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether the visit is over at `cutoff` (YYYY-MM-DD): its last day is a calendar day strictly
 * before it. A visit on the cutoff day or after it, a range still running on it, an undated
 * place and a malformed date are not.
 *
 * @example
 * isPastPlace({ startDate: '2026-11-08' }, '2026-11-09') // true
 * isPastPlace({ startDate: null }, '2026-11-09') // false
 */
export function isPastPlace(place: DateSpan, cutoff: string): boolean {
  const lastDay = lastDayIfOver(place, cutoff);
  return lastDay !== null && CALENDAR_DAY.test(lastDay);
}

/**
 * The places whose visit is over at `cutoff` (isPastPlace), in their order, as a new array.
 *
 * @example
 * pastPlacesOnly([{ startDate: '2026-11-08' }, { startDate: '2026-11-09' }], '2026-11-09')
 * // [{ startDate: '2026-11-08' }]
 */
export function pastPlacesOnly<T extends DateSpan>(places: readonly T[], cutoff: string): T[] {
  return places.filter((place) => isPastPlace(place, cutoff));
}
