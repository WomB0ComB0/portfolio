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

import 'server-only';

/**
 * @file A book cover for a link-preview card, as a data URI the card can draw. The card routes
 * pass the cover URL the catalog built (load-bookshelf.ts), never one from a request, and this
 * module fetches it only when it is a public image on Sanity's CDN (isSanityImageUrl), so the
 * routes are no proxy for any other address. The cover is fetched resized at the CDN to the size
 * the card draws it, as a JPEG (Satori draws no WebP, which `auto=format` may answer), with a
 * time limit, no redirects and a byte limit, and kept only when its bytes start like a JPEG or
 * PNG. Anything else gives null and one warning, and the route draws its text card instead.
 *
 * The cover goes to Satori as a data URI rather than a URL: Satori fetches a URL itself, with
 * none of these limits.
 */

import { coverAt } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/book-covers';
import { isSanityImageUrl } from '@/lib/images/cdn-loader';
import { logger } from '@/utils';

/** How long a cover may take, start to last byte. Sanity's CDN answers in tens of ms. */
const COVER_FETCH_TIMEOUT_MS = 3_000;

/** The most bytes a cover may have: a 340x445 JPEG is about 20 KB. */
export const COVER_MAX_BYTES = 1_048_576;

/** The image types a card draws, with the bytes each starts with. */
const SIGNATURES = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
} as const;

type CoverType = keyof typeof SIGNATURES;

type CoverFetch =
  | { readonly ok: true; readonly type: CoverType; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly reason: string };

const isCoverType = (type: string): type is CoverType => Object.hasOwn(SIGNATURES, type);

/**
 * The URL a card fetches `src` from: resized at Sanity's CDN to `width` (the 520x680 crop kept)
 * as a JPEG. Null for anything that is not a public Sanity image URL.
 */
export function coverFetchUrl(src: string, width: number): string | null {
  if (!isSanityImageUrl(src)) return null;
  const url = new URL(coverAt(src, width));
  url.searchParams.delete('auto');
  url.searchParams.set('fm', 'jpg');
  return url.href;
}

/** The body of `response`, or null once it passes `max` bytes (the rest is not read). */
async function readCapped(response: Response, max: number): Promise<Uint8Array | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(chunks);
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
}

/** Whether `bytes` start with `type`'s signature. */
const startsLike = (bytes: Uint8Array, type: CoverType): boolean =>
  SIGNATURES[type].every((byte, index) => bytes[index] === byte);

/** Fetches `url` within the limits: the cover's bytes and type, or why it was refused. */
async function fetchCover(url: string): Promise<CoverFetch> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(COVER_FETCH_TIMEOUT_MS),
    redirect: 'error',
  });
  if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
  const type = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (!isCoverType(type)) return { ok: false, reason: `type ${type || 'missing'}` };
  if (Number(response.headers.get('content-length')) > COVER_MAX_BYTES) {
    return { ok: false, reason: 'declared size over the limit' };
  }
  const bytes = await readCapped(response, COVER_MAX_BYTES);
  if (!bytes) return { ok: false, reason: 'body over the limit' };
  if (!startsLike(bytes, type)) return { ok: false, reason: `bytes are not ${type}` };
  return { ok: true, type, bytes };
}

/**
 * The cover at `src` as a `width`-px data URI for a card, or null (with a warning) when it is not
 * a Sanity image, or cannot be fetched within the limits as a real JPEG or PNG.
 */
export async function loadCoverDataUri(src: string, width: number): Promise<string | null> {
  const url = coverFetchUrl(src, width);
  if (!url) {
    logger.warn('A preview card skipped a cover that is not a Sanity image', { src });
    return null;
  }
  try {
    const cover = await fetchCover(url);
    if (cover.ok) return `data:${cover.type};base64,${Buffer.from(cover.bytes).toString('base64')}`;
    logger.warn('A preview card could not use its cover; drawing the text card', {
      url,
      reason: cover.reason,
    });
  } catch (error) {
    logger.warn('A preview card could not fetch its cover; drawing the text card', {
      url,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  return null;
}
