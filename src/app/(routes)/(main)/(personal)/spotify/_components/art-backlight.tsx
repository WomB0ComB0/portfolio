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
 *
 * ---------------------------------------------------------------------------------------------
 *
 * Adapted from Magic UI's Backlight (https://magicui.design/docs/components/backlight), under
 * the MIT License:
 *
 * MIT License
 *
 * Copyright (c) Magic UI
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * @file The now-playing hero's optional album-art glow (the lab's `spotify-art=glow`), and the
 * art modes the hero takes. Server-safe (no directive, no hooks).
 *
 * Magic UI's Backlight blurs an image through an SVG filter, saturates it 4x and lays the sharp
 * image back on top, so the picture seems lit from behind. Ours keeps the idea and tames it to
 * stay a backlight, not a colour block on the page:
 * - a second, small copy of the art (64px: the blur hides the detail), behind the content, not a
 *   filter on the sharp art, so the art itself is never altered;
 * - CSS filters (blur 24px, saturate 1.1) instead of the SVG filter, at 35% opacity, centred
 *   behind the art, faded out in a circle and clipped to the tile's rounded box;
 * - static: nothing moves, so there is no motion for reduced motion to stop; it is dropped
 *   entirely under prefers-reduced-transparency and in forced colours;
 * - decorative: hidden from assistive tech, with an empty alt.
 */

import type { ReactElement } from 'react';
import Image from '@/components/ui/cdn-image';

/** How the hero treats album-art colour: images only, or a faint glow from the art too. */
export const ART_MODES = ['plain', 'glow'] as const;
export type ArtMode = (typeof ART_MODES)[number];
/** The owner's palette rule: colour stays inside the images unless he picks the glow. */
export const DEFAULT_ART_MODE: ArtMode = 'plain';

/** `value` when it names an art mode; anything else (a stale link, nothing) is the default. */
export function parseArtMode(value: string | undefined): ArtMode {
  return ART_MODES.find((mode) => mode === value) ?? DEFAULT_ART_MODE;
}

/** The glow's source size: tiny on purpose, the blur leaves no detail to see. */
const GLOW_SOURCE_PX = 64;

/** The clip box: the whole tile, behind its content (the tile's `isolate` holds the -z). */
const CLIP_CLASS =
  'pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit] forced-colors:hidden [@media(prefers-reduced-transparency:reduce)]:hidden';
/**
 * Where the light sits: a square 1.8x the tile's height, centred on the row's art (which starts
 * one padding in from the tile's leading edge, so a quarter of the square hangs off that edge),
 * faded to nothing in a circle. The whole cover, not a strip of it, so the light carries the
 * cover's own colours rather than a smear of one band of it.
 */
const HALO_CLASS =
  'absolute top-1/2 left-0 aspect-square h-[180%] -translate-x-1/4 -translate-y-1/2 [mask-image:radial-gradient(closest-side,#000_30%,transparent)]';
/** The light itself: the cover, blurred 24px, barely saturated, at 35%. */
const GLOW_CLASS = 'object-cover opacity-35 blur-xl saturate-[1.1]';

export interface ArtBacklightProps {
  /** The album art, already checked to be on Spotify's CDN. */
  readonly src: string;
}

/**
 * A faint light from the album art behind the tile's content. Put it first inside a Tile (which
 * is `relative isolate`); it fills the tile and stays clipped to it.
 *
 * @example
 * <Tile variant="linked">
 *   {art === 'glow' && track.imageURL && <ArtBacklight src={track.imageURL} />}
 *   ...
 * </Tile>
 */
export function ArtBacklight({ src }: ArtBacklightProps): ReactElement {
  return (
    <span aria-hidden="true" data-backlight="" className={CLIP_CLASS}>
      <span className={HALO_CLASS}>
        <Image src={src} alt="" fill sizes={`${GLOW_SOURCE_PX}px`} className={GLOW_CLASS} />
      </span>
    </span>
  );
}
