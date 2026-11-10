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
 * @file What the wall and the grid hand the open view when a photo is opened, shared by the view,
 * its lazily loaded parts and their tests. Types only.
 */

import type { PhotoPlace, WallPhoto } from '@/types/places';

/** A photo to open: where it flies from, what to show meanwhile, and where focus goes back. */
export interface OpenRequest {
  readonly photo: WallPhoto;
  readonly place: PhotoPlace;
  /** The card's photo box: the flight starts and ends on it. */
  readonly source: HTMLElement | null;
  /** The image the card already shows (a /_next/image URL), drawn until the full one loads. */
  readonly placeholder: string;
  /** Focus goes back here on close: the grid's link, or the wall. */
  readonly returnFocus: HTMLElement | null;
}

/** Opens a photo, minus its place, which the view looks up. */
export type OpenPhoto = (request: Omit<OpenRequest, 'place'>) => void;

/** The places shown, by id: each photo's name, category and dates. */
export type PlacesById = ReadonlyMap<string, PhotoPlace>;
