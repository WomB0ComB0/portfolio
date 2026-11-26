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
 * @file Cover sizes and sources: every cover's source size, and a smaller copy at the width it is
 * drawn. The catalog loader (load-bookshelf.ts) builds each cover's source URL at COVER_WIDTH x
 * COVER_HEIGHT; the book slot, the cover frame and the shelf cards draw smaller copies with
 * coverAt, through the site's CDN loader rather than next/image. Pure and isomorphic; guarded by
 * tests/unit/bookshelf/slim-shapes.test.ts.
 */

import { cdnImageLoader } from '@/lib/images/cdn-loader';

/** A resized cover's quality: the CDN loader's own default. */
const COVER_QUALITY = 75;

/** Every cover's source size: the catalog crops each cover to 520 x 680 (load-bookshelf.ts). */
export const COVER_WIDTH = 520;
/** Every cover's source height (see COVER_WIDTH). */
export const COVER_HEIGHT = 680;

/**
 * The cover `width` px wide, through the site's Sanity CDN loader: it keeps the crop window, so
 * the 520 x 680 shape, and never goes past the source width. At the source width or wider the
 * source URL comes back as it is, so the URL the stage has already loaded stays the cached one.
 */
export function coverAt(src: string, width: number): string {
  if (width >= COVER_WIDTH) return src;
  return cdnImageLoader({ src, width: Math.max(1, Math.round(width)), quality: COVER_QUALITY });
}
