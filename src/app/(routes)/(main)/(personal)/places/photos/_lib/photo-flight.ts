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
 * @file The open view's flight from its card, as pure FLIP maths. The card shows the whole photo
 * cropped by object-fit: cover around its focus point; the open frame shows the whole photo at
 * its real shape (the no-crop rule from #574). So the frame starts scaled uniformly until the
 * photo covers the card, placed so the card's part sits exactly on the card, and clipped with
 * clip-path inset (rounded like the card) to the card's box; then both spring to none. Only
 * transform and clip-path move, and the photo is never stretched.
 */

import type { PhotoFocus } from '@/types/places';

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A clip-path inset in the frame's own (unscaled) pixels, with its corner radius. */
export interface ClipInset {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
  readonly radius: number;
}

/** Where the frame starts: translate (x, y) and a uniform scale, origin top left, and its clip. */
export interface FlightStart {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly clip: ClipInset;
}

/** A photo with no hotspot is centred, as object-position's default. */
const CENTRE: PhotoFocus = { x: 0.5, y: 0.5 };

/** The frame at rest: no move, no scale, clipped only by its own rounded corners. */
export const identityFlight = (frameRadius: number): FlightStart => ({
  x: 0,
  y: 0,
  scale: 1,
  clip: { top: 0, right: 0, bottom: 0, left: 0, radius: frameRadius },
});

/**
 * The start of the flight from `card` (the card's photo box, cover-fit at `focus`) to `frame`
 * (the open frame's layout box, the whole photo). Equal boxes give the identity.
 *
 * @example
 * const start = flightFrom(card.getBoundingClientRect(), frameBox, photo.focus, 10, 8);
 */
export function flightFrom(
  card: Box,
  frame: Box,
  focus: PhotoFocus | null,
  cardRadius: number,
  frameRadius: number,
): FlightStart {
  if (frame.width <= 0 || frame.height <= 0) return identityFlight(frameRadius);
  const { x: fx, y: fy } = focus ?? CENTRE;
  const scale = Math.max(card.width / frame.width, card.height / frame.height);
  // How far the scaled photo reaches past the card on each axis, split around the focus point.
  const overX = frame.width * scale - card.width;
  const overY = frame.height * scale - card.height;
  const offsetX = overX * fx;
  const offsetY = overY * fy;
  const equal = Math.abs(scale - 1) < 1e-6 && card.left === frame.left && card.top === frame.top;
  return {
    x: card.left - offsetX - frame.left,
    y: card.top - offsetY - frame.top,
    scale,
    clip: {
      top: offsetY / scale,
      right: (overX - offsetX) / scale,
      bottom: (overY - offsetY) / scale,
      left: offsetX / scale,
      radius: equal ? frameRadius : cardRadius / scale,
    },
  };
}

/** Rounds to 1/100 px, so the inline styles stay short. */
const px = (value: number): string => `${Math.round(value * 100) / 100}px`;

/**
 * The CSS clip-path for an inset.
 *
 * @example
 * clipPathOf({ top: 0, right: 0, bottom: 0, left: 0, radius: 8 }) // 'inset(0px 0px 0px 0px round 8px)'
 */
export const clipPathOf = (clip: ClipInset): string =>
  `inset(${px(clip.top)} ${px(clip.right)} ${px(clip.bottom)} ${px(clip.left)} round ${px(clip.radius)})`;
