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
 * @file Which of Spotify's images to draw. Spotify sends each album or artist at 640, 300 and
 * 64 px, and its CDN cannot resize them, so the site serves them as they are (no optimizer).
 * The smallest image at least twice the slot stays sharp on a 2x screen; Spotify's first, 640 px
 * image has about 4.5 times the pixels of its 300 px one and adds nothing in a 40 to 112 px slot.
 * Pure (no imports), so the API handlers, the /spotify chart and their tests share it.
 */

/** Spotify's image CDN, the only host art is taken from. */
const SPOTIFY_IMAGE_HOST = 'i.scdn.co';

/** Art is picked at twice its drawn size, so it stays sharp on a 2x screen. */
export const SPOTIFY_ART_SCALE = 2;

interface CdnImage {
  readonly url: string;
  /** Spotify's stated width; some answers leave it out (null). */
  readonly width?: number;
}

interface SizedImage {
  readonly url: string;
  readonly width: number;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `value` as an https URL on Spotify's image CDN, normalised, or undefined. */
function cdnUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === SPOTIFY_IMAGE_HOST ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** One raw image when it is on Spotify's CDN over https, with its width when stated. */
function cdnImage(image: unknown): CdnImage | undefined {
  if (!isRecord(image)) return undefined;
  const url = cdnUrl(image.url);
  if (!url) return undefined;
  const width = typeof image.width === 'number' && image.width > 0 ? image.width : undefined;
  return { url, width };
}

const isSized = (image: CdnImage): image is SizedImage => image.width !== undefined;

/**
 * The art to draw at `minPx`: the smallest image at least that wide; else the widest one; else,
 * when Spotify stated no sizes, the first. Only images on Spotify's CDN count.
 */
export function pickSpotifyImage(images: unknown, minPx: number): string | undefined {
  if (!Array.isArray(images)) return undefined;
  const usable = images.flatMap((image: unknown) => cdnImage(image) ?? []);
  const sized = usable.filter(isSized);
  if (sized.length === 0) return usable[0]?.url;
  const wideEnough = sized.filter((image) => image.width >= minPx);
  if (wideEnough.length > 0) {
    return wideEnough.reduce((best, image) => (image.width < best.width ? image : best)).url;
  }
  return sized.reduce((best, image) => (image.width > best.width ? image : best)).url;
}

/** The art for a slot drawn `drawnPx` wide: {@link pickSpotifyImage} at twice that. */
export const spotifyArtFor = (images: unknown, drawnPx: number): string | undefined =>
  pickSpotifyImage(images, drawnPx * SPOTIFY_ART_SCALE);
