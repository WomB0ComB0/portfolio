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
 * link's unique name (one string, the same in every browser), the wall's spoken sentence and the
 * open photo's alt. Captions are plain text, only ever rendered by React as text or attributes.
 *
 * A grid link's name starts with the card's own words, dates as shown, dash and all ('Apr 20 –
 * 21, 2024'): WCAG 2.5.3 (Label in Name) needs a name to hold the words its link shows, and
 * checkers compare words, so 'Apr 20 to 21' (#726) failed it. Words that name no control (the
 * wall's live sentence, the open photo's description) still read a range's dash as 'to'.
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
 * A visit's dates as a card shows them ("May 19 – 20, 2026"); null for an undated or unreadable
 * visit, which shows none.
 *
 * @example
 * shownDates('2026-05-19', '2026-05-20') // 'May 19 – 20, 2026'
 */
export function shownDates(startDate: string | null, endDate: string | null): string | null {
  const shown = formatDateRange(startDate, endDate);
  return shown === '' || shown === INVALID_DATE ? null : shown;
}

/**
 * A visit's dates as heard ("May 19 to 20, 2026"); null for an undated or unreadable visit. Only
 * for words that name no control: a link's name says the dates as shown (placeMetaShown).
 *
 * @example
 * spokenDates('2026-05-19', '2026-05-20') // 'May 19 to 20, 2026'
 */
export function spokenDates(startDate: string | null, endDate: string | null): string | null {
  return shownDates(startDate, endDate)?.replace(RANGE_SEPARATOR, SPOKEN_SEPARATOR) ?? null;
}

/** What the photo shows in words: its alt text, else its caption; null with neither. */
const describedBy = (photo: WallPhoto): string | null => photo.alt ?? photo.caption;

/** ", photo 3 of 5" with ": <alt text or caption>" when it has one. */
const numbered = (photo: WallPhoto, place: PhotoPlace): string => {
  const words = describedBy(photo);
  return `photo ${photo.index} of ${place.photoCount}${words ? `: ${words}` : ''}`;
};

/**
 * The end of a grid link's name, after the place, category and dates it shows: every photo of
 * one place then has a name of its own.
 */
export const gridLinkSuffix = (photo: WallPhoto, place: PhotoPlace): string =>
  `, ${numbered(photo, place)}`;

/**
 * The line under a place's name as its card shows it: its category, then its dates when it is
 * dated (['Hackathon', 'May 19 – 20, 2026']). A grid link's name says these after the name.
 */
export function placeMetaShown(place: PhotoPlace): readonly string[] {
  const dates = shownDates(place.startDate, place.endDate);
  return dates ? [place.category, dates] : [place.category];
}

/**
 * The line under a place's name in words, for the wall's live sentence: its category, then its
 * dates as heard when it is dated (['Hackathon', 'May 19 to 20, 2026']).
 */
export function placeMetaWords(place: PhotoPlace): readonly string[] {
  const dates = spokenDates(place.startDate, place.endDate);
  return dates ? [place.category, dates] : [place.category];
}

/** The parts of a grid link's name, in the order the card shows them. */
export interface GridLinkWords {
  /** The number a run's later card shows in place of the name ('Fig. 2'); else null. */
  readonly fig: number | null;
  readonly name: string;
  /** The line under the name, as parts, each as the card shows it. */
  readonly meta: readonly string[];
  /** The rest, which the card does not show (', photo 3 of 5: Opening night'). */
  readonly suffix: string;
}

/**
 * A grid link's whole name as one string, each part after a comma: "Antler NYC, Hackathon, May
 * 19 – 20, 2026, photo 3 of 5: Opening night". Built from the card's own text nodes, Chromium ran
 * the category into the dates and put a space before the comma, so the link carries this as its
 * aria-label. It starts with what the card shows, word for word and in order (WCAG
 * 2.5.3): the figure number on a run's later card, else the name, then the line under it with
 * only the dot between its parts, which is no word, made a comma.
 */
export function gridLinkName({ fig, name, meta, suffix }: GridLinkWords): string {
  const shown = [fig === null ? '' : `Fig. ${fig}`, name, ...meta]
    .map((part) => part.trim())
    .filter((part) => part !== '');
  return `${shown.join(', ')}${suffix}`;
}

/**
 * What the wall's live region says for a photo: "Antler NYC, photo 3 of 5: Opening night.
 * Hackathon, May 19 to 20, 2026".
 */
export function wallAnnouncement(photo: WallPhoto, place: PhotoPlace): string {
  return `${place.name}, ${numbered(photo, place)}. ${placeMetaWords(place).join(', ')}`;
}

/** The open photo's alt: its alt text, else its caption, else "Photo 2 of 5 at Antler NYC". */
export const photoAlt = (photo: WallPhoto, place: PhotoPlace): string =>
  describedBy(photo) ?? `Photo ${photo.index} of ${place.photoCount} at ${place.name}`;

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
