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
 * @file How the book and shelf card routes answer: a card drawn in full before it is sent, with
 * the Cache-Control its URL earns; the page card (/api/og's text card) to fall back on; and the
 * 404 and 500 answers, never cached.
 *
 * ImageResponse draws lazily, as the body streams, so an image Satori cannot draw would surface
 * only after a 200 had gone out. Drawing in full first (about 100 KB of PNG) turns that into a
 * failure the route can still answer with the text card.
 *
 * Caching: the CDN keeps a card a year (PAGE_CARD_CACHE_CONTROL) only at the URL whose `?v=` is
 * the version of what it draws (card-version.ts), as /api/og's words are its query. Any other
 * `?v=` (an old share, or none) is kept an hour, so an edit reaches it soon. A card drawn without
 * its covers is kept nowhere, so the next fetch tries the covers again.
 */

import type { ReactElement } from 'react';
import { PageCard, SiteCard } from '@/lib/og/cards';
import { PAGE_CARD_CACHE_CONTROL } from '@/lib/og/constants';
import { renderOgCard } from '@/lib/og/render';
import { readPageCard } from '@/lib/og/text';
import { logger } from '@/utils';

/** For an answer no cache may keep: a fallback card, a 404, a 500. */
export const NO_STORE = 'no-store';

/** A card at a URL whose `?v=` is not the version of what it draws: an hour, here and at the CDN. */
export const RECHECKED_CARD_CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600';

/** How long a complete card may be kept: a year at its own version, an hour at any other. */
export const versionedCacheControl = (current: string, requested: string | null): string =>
  requested === current ? PAGE_CARD_CACHE_CONTROL : RECHECKED_CARD_CACHE_CONTROL;

/**
 * The text card /api/og draws for `title` and `description`, read and clipped the way it reads
 * them from its query: the preview a book or shelf page had before it had its own card.
 */
export function pageCardFor(title: string, description: string): ReactElement {
  const page = readPageCard(new URLSearchParams({ title, description }));
  return page ? <PageCard title={page.title} description={page.description} /> : <SiteCard />;
}

/** `card` drawn in full as a PNG response with `cacheControl`, or null (logged) if it cannot be. */
export async function drawCard(card: ReactElement, cacheControl: string): Promise<Response | null> {
  try {
    const image = await renderOgCard(card, { headers: { 'Cache-Control': cacheControl } });
    const png = await image.arrayBuffer();
    return new Response(png, { status: 200, headers: image.headers });
  } catch (error) {
    logger.error(
      `Failed to generate OG image: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/** The 500 for a card that could not be drawn at all, never cached. */
export const cardFailure = (): Response =>
  new Response('Failed to generate the image', {
    status: 500,
    headers: { 'Cache-Control': NO_STORE },
  });

/** The 404 for a slug the catalog does not have, never cached (the book may be published soon). */
export const notFoundCard = (what: string): Response =>
  new Response(`No such ${what}`, {
    status: 404,
    headers: { 'Cache-Control': NO_STORE, 'Content-Type': 'text/plain; charset=utf-8' },
  });
