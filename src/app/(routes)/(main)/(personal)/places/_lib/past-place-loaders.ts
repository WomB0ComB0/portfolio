import 'server-only';

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
 * @file The one way the site reads places: past visits only (pastPlacesOnly at the request's
 * placeCutoffDay), so the owner's rule holds everywhere a place can surface. The /places list,
 * a place's page (a visit still on answers 404, as an unknown id does), the sitemap, the public
 * /api/v1/sanity/places JSON and the home tiles all read through these. Each wraps the shared
 * Sanity cache and adds no request; places-opsec.test.ts refuses any other import of the raw
 * place readers.
 */

import { placeCutoffDay } from '@/app/_components/home/data/selectors';
import type { CachedValue, StaleCacheResult } from '@/lib/cache/stale-cache';
import {
  loadPlaceById,
  loadPlaces,
  type Place,
  peekPlaces,
  readPlaces,
} from '@/lib/sanity/loaders';
import { isPastPlace, pastPlacesOnly } from './past-places';

/** The day a visit must end before to count as over, now. */
const cutoffNow = (): string => placeCutoffDay(Date.now());

/** Every past place, in Sanity's order. Rejects as loadPlaces does (Sanity down, nothing cached). */
export async function loadPastPlaces(): Promise<readonly Place[]> {
  return pastPlacesOnly(await loadPlaces(), cutoffNow());
}

/** The past places in the list last cached, and when it was loaded; undefined when none is. */
export function peekPastPlaces(): CachedValue<readonly Place[]> | undefined {
  const cached = peekPlaces();
  return cached ? { ...cached, data: pastPlacesOnly(cached.data, cutoffNow()) } : undefined;
}

/** The place with `id` when its visit is over; null for an unknown id and for one still on. */
export async function loadPastPlaceById(id: string): Promise<Place | null> {
  const place = await loadPlaceById(id);
  return place && isPastPlace(place, cutoffNow()) ? place : null;
}

/**
 * The v1 route's reader: Sanity's raw place documents, past ones only, fresh or stale as the
 * shared cache answered them. Rejects as readPlaces does.
 */
export async function readPastPlaces(): Promise<StaleCacheResult<Place[]>> {
  const result = await readPlaces();
  return { ...result, data: pastPlacesOnly(result.data, cutoffNow()) };
}
