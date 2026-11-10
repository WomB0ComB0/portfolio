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
 * @file The open view draws the card's own image (already decoded) until the whole photo loads.
 * The page's CSP allows images from 'self' only, never cdn.sanity.io, so that placeholder must be
 * a same-origin /_next/image URL; anything else is dropped. Pure.
 */

const OPTIMIZER_PATH = '/_next/image';

/**
 * `src` as a same-origin /_next/image path with its query, or '' for any other image.
 *
 * @example
 * sameOriginImage('http://localhost:3109/_next/image?url=x&w=640&q=75', 'http://localhost:3109')
 * // '/_next/image?url=x&w=640&q=75'
 */
export function sameOriginImage(src: string, origin: string): string {
  if (src === '') return '';
  try {
    const url = new URL(src, origin);
    return url.origin === new URL(origin).origin && url.pathname === OPTIMIZER_PATH
      ? `${url.pathname}${url.search}`
      : '';
  } catch {
    return '';
  }
}

/** The placeholder for a card: its image's current source, if it is a /_next/image URL. */
export function placeholderOf(card: Element): string {
  const img = card.querySelector('img');
  if (!img) return '';
  return sameOriginImage(img.currentSrc || img.getAttribute('src') || '', window.location.origin);
}
