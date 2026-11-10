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
 * @file The photos view's words, pure and server-safe: plurals that read right at one, each grid
 * link's unique name, the wall's spoken sentence and the open photo's alt. Captions are plain
 * text, only ever rendered by React as text or attributes.
 */

import type { PhotoPlace, WallPhoto } from '@/types/places';
import { formatDateRange } from '@/utils/date';

/** The visual range separator formatDateRange writes, and what a screen reader hears instead. */
const RANGE_SEPARATOR = ' – ';
const SPOKEN_SEPARATOR = ' to ';
const INVALID_DATE = 'Invalid date';

/** "1 photo", "266 photos". */
export const photoCountLabel = (count: number): string =>
  `${count} ${count === 1 ? 'photo' : 'photos'}`;

/** "1 past visit", "51 past visits". */
export const visitCountLabel = (count: number): string =>
  `${count} past ${count === 1 ? 'visit' : 'visits'}`;

/** "266 photos from 51 past visits". */
export const photosFromVisits = (photos: number, visits: number): string =>
  `${photoCountLabel(photos)} from ${visitCountLabel(visits)}`;

/**
 * A visit's dates as heard ("May 19 to 20, 2026"); null for an undated or unreadable visit.
 *
 * @example
 * spokenDates('2026-05-19', '2026-05-20') // 'May 19 to 20, 2026'
 */
export function spokenDates(startDate: string | null, endDate: string | null): string | null {
  const shown = formatDateRange(startDate, endDate);
  if (shown === '' || shown === INVALID_DATE) return null;
  return shown.replace(RANGE_SEPARATOR, SPOKEN_SEPARATOR);
}

/** ", photo 3 of 5" with ": <caption>" when it has one. */
const numbered = (photo: WallPhoto, place: PhotoPlace): string =>
  `photo ${photo.index} of ${place.photoCount}${photo.caption ? `: ${photo.caption}` : ''}`;

/**
 * The hidden end of a grid link's name, after the place, category and dates it shows: every
 * photo of one place then has a name of its own.
 */
export const gridLinkSuffix = (photo: WallPhoto, place: PhotoPlace): string =>
  `, ${numbered(photo, place)}`;

/**
 * What the wall's live region says for a photo: "Antler NYC, photo 3 of 5: Opening night.
 * Hackathon, May 19 to 20, 2026".
 */
export function wallAnnouncement(photo: WallPhoto, place: PhotoPlace): string {
  const dates = spokenDates(place.startDate, place.endDate);
  const meta = dates ? `${place.category}, ${dates}` : place.category;
  return `${place.name}, ${numbered(photo, place)}. ${meta}`;
}

/** The open photo's alt: its caption, else "Photo 2 of 5 at Antler NYC". */
export const photoAlt = (photo: WallPhoto, place: PhotoPlace): string =>
  photo.caption ?? `Photo ${photo.index} of ${place.photoCount} at ${place.name}`;

/** A photo's focus as an object-position ("30% 70%"); centred without one. */
export const focusPosition = (photo: WallPhoto): string =>
  photo.focus ? `${photo.focus.x * 100}% ${photo.focus.y * 100}%` : '50% 50%';

/** Where the wall is: in the page (a mouse or trackpad) or in a touch screen's full-screen sheet. */
export type WallMode = 'page' | 'sheet';

/** The line under the wall, which the wall points to with aria-describedby. */
export const WALL_HINTS: Readonly<Record<WallMode, string>> = {
  page: 'Drag in any direction, or use the arrow keys once it has focus; Enter opens a photo.',
  sheet: 'Drag to explore; tap a photo to open it.',
};
