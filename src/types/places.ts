/**
 * Copyright 2025 Mike Odnis
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

/** A past place as the /places list's client island takes it, its URLs built on the server. */
export interface PlaceItem {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  category: string;
  startDate?: string | null;
  endDate?: string | null;
  /** How many of its photos the site can show. */
  photoCount: number;
  /** Up to three 96 x 64 crops for the card's folder (its first usable photos). */
  slivers: readonly string[];
}

/**
 * A past place with photos, as /places/photos takes it: what its filters and captions read, once
 * per place. Never its coordinates.
 */
export interface PhotoPlace {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly photoCount: number;
}

/** Where a photo's subject sits, as fractions of its width and height (Studio's hotspot). */
export interface PhotoFocus {
  readonly x: number;
  readonly y: number;
}

/** One photo on /places/photos' wall and grid. Its place's name and dates live on PhotoPlace. */
export interface WallPhoto {
  /** `${placeId}:${index}`. */
  readonly key: string;
  readonly placeId: string;
  /** 1-based, among its place's photos. */
  readonly index: number;
  readonly caption: string | null;
  /** Width over height. */
  readonly ratio: number;
  readonly focus: PhotoFocus | null;
  /** The whole photo, its short side covering a 480 x 360 card: the wall's and the grid's. */
  readonly thumb: string;
  /** The whole photo at the place viewer's size (1600 x 1200 at most): the open view's. */
  readonly full: string;
}
