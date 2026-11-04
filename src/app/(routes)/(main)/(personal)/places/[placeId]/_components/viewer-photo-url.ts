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

import { urlFor } from '@/lib/sanity/client';

/** Sanity image asset ids end in `-<width>x<height>-<format>`. */
const ASSET_DIMENSIONS = /-(\d+)x(\d+)-[a-z0-9]+$/;

interface ImageAssetRef {
  _ref: string;
  _type?: string;
}

/**
 * The photo viewer's image URL: the whole photo, scaled to fit within `maxWidth` × `maxHeight`
 * and never enlarged.
 *
 * It sizes by one side only. Given both a width and a height, @sanity/image-url crops to that
 * aspect ratio (it adds `rect=`), which cut the top and bottom off portrait photos.
 */
export function viewerPhotoUrl(asset: ImageAssetRef, maxWidth: number, maxHeight: number): string {
  const builder = urlFor(asset).fit('max');
  const match = ASSET_DIMENSIONS.exec(asset._ref);
  if (!match) return builder.width(maxWidth).url();

  const aspectRatio = Number(match[1]) / Number(match[2]);
  const sized =
    aspectRatio >= maxWidth / maxHeight ? builder.width(maxWidth) : builder.height(maxHeight);
  return sized.url();
}
