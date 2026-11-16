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
 * @file A project's images as /projects reads them, pure and server-safe: its cover, then its
 * gallery, each with its shape (from the Sanity asset id, `image-<hash>-<w>x<h>-<format>`), its
 * focus (Studio's hotspot), its alt text tidied, and the URL of the whole image (the injected
 * builder; the page passes Sanity's, so this module never imports the client). An image whose
 * asset id can't be read is skipped, so one malformed image never takes the page down.
 */

import type { ImageFocus, ProjectImage } from './project-index';

/** A Sanity image asset id, with its size. */
const ASSET_ID = /^image-[A-Za-z0-9]+-(\d+)x(\d+)-[a-z0-9]+$/u;

/** What is read of an image: its asset, alt text and hotspot. */
export interface SourceImage {
  readonly asset?: { readonly _ref?: string | null } | null;
  readonly alt?: string | null;
  readonly hotspot?: { readonly x: number; readonly y: number } | null;
}

/** What is read of a project: its cover and gallery. */
export interface ImageSource {
  readonly image?: SourceImage | null;
  readonly images?: readonly SourceImage[] | null;
}

/** Builds the whole image's URL, at most `maxWidth` wide, from its asset id. */
export type ImageUrlBuilder = (assetRef: string, maxWidth: number) => string;

/** The widest image fetched from Sanity; next/image resizes it for every place it is drawn. */
export const IMAGE_MAX_WIDTH = 1600;

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

/** Alt text on one line, or null when there is none. */
const tidyAlt = (alt: string | null | undefined): string | null => {
  const text = (alt ?? '').replaceAll(/\s+/gu, ' ').trim();
  return text === '' ? null : text;
};

/** One image, or null when its asset id carries no size. */
function imageOf(image: SourceImage, urlOf: ImageUrlBuilder): ProjectImage | null {
  const ref = image.asset?._ref ?? '';
  const match = ASSET_ID.exec(ref);
  const width = Number(match?.[1] ?? 0);
  const height = Number(match?.[2] ?? 0);
  if (width <= 0 || height <= 0) return null;
  const focus: ImageFocus | null = image.hotspot
    ? { x: clampUnit(image.hotspot.x), y: clampUnit(image.hotspot.y) }
    : null;
  return {
    src: urlOf(ref, Math.min(width, IMAGE_MAX_WIDTH)),
    ratio: width / height,
    alt: tidyAlt(image.alt),
    focus,
  };
}

/** The project's cover, then its gallery, each once (by asset), skipping unreadable ones. */
export function projectImagesOf(project: ImageSource, urlOf: ImageUrlBuilder): ProjectImage[] {
  const seen = new Set<string>();
  const images: ProjectImage[] = [];
  for (const source of [project.image, ...(project.images ?? [])]) {
    const ref = source?.asset?._ref;
    if (!source || !ref || seen.has(ref)) continue;
    const image = imageOf(source, urlOf);
    if (!image) continue;
    seen.add(ref);
    images.push(image);
  }
  return images;
}
