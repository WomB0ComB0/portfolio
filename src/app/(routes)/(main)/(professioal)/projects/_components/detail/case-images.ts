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
 * @file A project's screen URLs, built on the server from Sanity. Every URL is the whole image
 * (fit max: sized by its width only and never enlarged, so nothing is cropped), in the best
 * format, at most as wide as the place that shows it needs at 2x; next/image then serves each
 * window its own width from it (the site's CSP lets images come only through /_next/image). The
 * viewer's thumbnails are small crops from the top, where a page's header is.
 */

import type { ViewerItem } from '@/components/console/photo/photo-viewer-step';
import { urlFor } from '@/lib/sanity/client';
import type { Screen } from './case-screens';

/** The widest each place needs: the hero frame, a sheet tile, the open view (and no-JS link). */
const HERO_WIDTH = 1600;
const TILE_WIDTH = 1200;
const FULL_WIDTH = 2400;
/** The viewer's thumbnails at 2x: 120 x 90. */
const THUMB_WIDTH = 240;
const THUMB_HEIGHT = 180;

/** The whole image, at most `width` wide (never wider than the image itself). */
const wholeUrl = (screen: Screen, width: number): string =>
  urlFor(screen.image).width(Math.min(width, screen.width)).fit('max').auto('format').url();

/** The cover's or the second screen's image in the hero. */
export const heroUrl = (screen: Screen): string => wholeUrl(screen, HERO_WIDTH);

/** A tile's image in the Screens section. */
export const tileUrl = (screen: Screen): string => wholeUrl(screen, TILE_WIDTH);

/** The whole image for the open view, and the link's address without JavaScript. */
export const fullUrl = (screen: Screen): string => wholeUrl(screen, FULL_WIDTH);

/** The viewer's thumbnail: a 4:3 crop from the top. */
const thumbUrl = (screen: Screen): string =>
  urlFor(screen.image)
    .width(THUMB_WIDTH)
    .height(THUMB_HEIGHT)
    .fit('crop')
    .crop('top')
    .auto('format')
    .url();

/** The screens as the viewer's items, in page order. */
export const viewerItems = (screens: readonly Screen[]): ViewerItem[] =>
  screens.map((screen) => ({
    key: screen.key,
    src: fullUrl(screen),
    thumb: thumbUrl(screen),
    width: screen.width,
    height: screen.height,
    words: screen.words,
  }));
