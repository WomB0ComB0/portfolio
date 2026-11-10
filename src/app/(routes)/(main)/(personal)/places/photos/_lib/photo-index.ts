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
 * @file /places/photos' data, from the places loadPastPlaces() answered and nothing else: a visit
 * that may still be on, or one whose photos were cleared, never adds a photo, a count or a chip.
 * Each place with a usable photo is sent once (name, description, category, dates: what the
 * filters and captions read); each photo carries only its place's id, its index there, its
 * caption, shape, focus and URLs. No coordinates anywhere.
 */

import type { Place } from '@/hooks/sanity/schemas';
import type { PhotoPlace, WallPhoto } from '@/types/places';
import {
  coverThumbUrl,
  normaliseCaption,
  photoFocus,
  photoRatio,
  usablePhotos,
} from '../../_lib/place-photo-urls';
import { viewerPhotoUrl } from '../../_lib/viewer-photo-url';
import { shuffled } from './photo-order';

/** The place viewer's frame: the open view uses its URL, so /_next/image shares one cache. */
const VIEWER_MAX_WIDTH = 1600;
const VIEWER_MAX_HEIGHT = 1200;

export interface PhotoIndex {
  /** Past places with at least one usable photo, in the server's order. */
  readonly places: readonly PhotoPlace[];
  /** Their photos, in the fixed shuffle. */
  readonly photos: readonly WallPhoto[];
}

/** A place's record, with its usable photos counted. */
const photoPlaceOf = (place: Place, photoCount: number): PhotoPlace => ({
  id: place._id,
  name: place.name,
  description: place.description,
  category: place.category,
  startDate: place.startDate ?? null,
  endDate: place.endDate ?? null,
  photoCount,
});

/** A place's photos as wall records, numbered from 1 among its usable photos. */
const wallPhotosOf = (place: Place): WallPhoto[] =>
  usablePhotos(place).map((photo, offset) => ({
    key: `${place._id}:${offset + 1}`,
    placeId: place._id,
    index: offset + 1,
    caption: normaliseCaption(photo.caption),
    ratio: photoRatio(photo.asset._ref),
    focus: photoFocus(photo.hotspot),
    thumb: coverThumbUrl(photo.asset),
    full: viewerPhotoUrl(photo.asset, VIEWER_MAX_WIDTH, VIEWER_MAX_HEIGHT),
  }));

/**
 * The photos view's places and photos, from the past places only (pass loadPastPlaces()'s answer).
 *
 * @example
 * const { places, photos } = buildPhotoIndex(await loadPastPlaces());
 */
export function buildPhotoIndex(pastPlaces: readonly Place[]): PhotoIndex {
  const perPlace = pastPlaces
    .map((place) => ({ place, photos: wallPhotosOf(place) }))
    .filter((entry) => entry.photos.length > 0);
  return {
    places: perPlace.map((entry) => photoPlaceOf(entry.place, entry.photos.length)),
    photos: shuffled(perPlace.flatMap((entry) => entry.photos)),
  };
}
