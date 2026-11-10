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
 * @file The /places list's and /places/photos' image URLs, built on the server (Sanity's resizing
 * strips location metadata), plus what the photos view reads from each photo: its shape, its
 * focus point and its caption, tidied once. Not in the v1 route's import graph.
 */

import type { SanityImageSource } from '@sanity/image-url';
import type { Place } from '@/hooks/sanity/schemas';
import { urlFor } from '@/lib/sanity/client';
import type { PhotoFocus } from '@/types/places';

/** One photo of a place, as Sanity stores it. */
export type PlacePhoto = NonNullable<Place['photos']>[number];

/** A Sanity image asset id: `image-<hash>-<width>x<height>-<format>`. */
const ASSET_ID = /^image-[A-Za-z0-9]+-(\d+)x(\d+)-[a-z0-9]+$/;
/** The folder's slivers: 2x its 48 x 32 open size, a 3:2 crop around the hotspot. */
const SLIVER_WIDTH = 96;
const SLIVER_HEIGHT = 64;
/** The wall's and the grid's card at 2x: the thumbnail's short side covers 480 x 360. */
const CARD_WIDTH = 480;
const CARD_HEIGHT = 360;
/** The shape assumed for a photo whose asset id carries no size. */
const FALLBACK_RATIO = 4 / 3;

interface ImageAssetRef {
  readonly _ref: string;
  readonly _type?: string;
}

/**
 * Whether the photo has an asset id the URL builder can read. Every photo surface skips the rest,
 * so one malformed photo never takes a page down.
 *
 * @example
 * isUsablePhoto({ _type: 'image', asset: { _type: 'reference', _ref: 'image-a-800x600-jpg' } }) // true
 */
export function isUsablePhoto(photo: PlacePhoto | null | undefined): photo is PlacePhoto {
  const ref = photo?.asset?._ref;
  return typeof ref === 'string' && ASSET_ID.test(ref);
}

/** A place's photos the site can show, in Studio's order. */
export const usablePhotos = (place: Pick<Place, 'photos'>): readonly PlacePhoto[] =>
  (place.photos ?? []).filter(isUsablePhoto);

/** A card folder's sliver: a 96 x 64 crop around the hotspot, in the best format. */
export function sliverUrl(photo: SanityImageSource): string {
  return urlFor(photo).width(SLIVER_WIDTH).height(SLIVER_HEIGHT).fit('crop').auto('format').url();
}

/**
 * Width over height from an asset id's `-WxH-`; 4:3 when it has none (or a zero side).
 *
 * @example
 * photoRatio('image-a-3000x4000-jpg') // 0.75
 */
export function photoRatio(ref: string): number {
  const match = ASSET_ID.exec(ref);
  const width = Number(match?.[1] ?? 0);
  const height = Number(match?.[2] ?? 0);
  return width > 0 && height > 0 ? width / height : FALLBACK_RATIO;
}

/**
 * The wall's and the grid's thumbnail: the whole photo (fit max, so never enlarged), sized by one
 * side so its short side covers a 480 x 360 card. Never both sides: @sanity/image-url would then
 * crop to that shape (it adds `rect=`). The card crops it with object-fit and the focus point.
 */
export function coverThumbUrl(asset: ImageAssetRef): string {
  const builder = urlFor(asset).fit('max').auto('format');
  const sized =
    photoRatio(asset._ref) >= CARD_WIDTH / CARD_HEIGHT
      ? builder.height(CARD_HEIGHT)
      : builder.width(CARD_WIDTH);
  return sized.url();
}

/** A fraction kept inside the photo. */
const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * The hotspot's centre as fractions of the photo, or null when Studio set none (the card then
 * centres the photo).
 */
export function photoFocus(hotspot: PlacePhoto['hotspot']): PhotoFocus | null {
  if (!hotspot) return null;
  return { x: clampUnit(hotspot.x), y: clampUnit(hotspot.y) };
}

/**
 * A caption on one line without the blanks around it; null when there is no text. Captions are
 * public, already on the place page, and only ever rendered as React text or attributes.
 *
 * @example
 * normaliseCaption('  Demo   day ') // 'Demo day'
 */
export function normaliseCaption(caption: string | undefined): string | null {
  const text = (caption ?? '').replace(/\s+/g, ' ').trim();
  return text === '' ? null : text;
}
