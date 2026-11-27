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

/**
 * @file /api/og?title=…&description=…: a page's link-preview card in the Live Console look
 * (src/lib/og/cards.tsx), for every page without an image of its own (constructMetadata links
 * it). Without a title it draws the site card, as /opengraph-image does. The text is read and
 * clipped to the card by readPageCard; Satori draws it as text, never as markup.
 *
 * A drawn card goes out with PAGE_CARD_CACHE_CONTROL, so the CDN keeps it and answers every
 * later fetch of the same URL without running this function. The words are in the URL, so a
 * changed card is a new URL. The guard and the 500 stay `no-store`.
 *
 * Each distinct query is a fresh render, so the API guard runs first: the per-IP sliding window
 * and ban lists /api uses (src/lib/security/api-guard.ts), with its 429 and 403 answers
 * (_lib/og-guard.ts, shared with the book and shelf cards under /api/og/book and /api/og/shelf).
 * It runs only when the function does, on a CDN miss. The prerendered /opengraph-image and
 * /twitter-image do not pass through here.
 */

import { PageCard, SiteCard } from '@/lib/og/cards';
import { PAGE_CARD_CACHE_CONTROL } from '@/lib/og/constants';
import { renderOgCard } from '@/lib/og/render';
import { type PageCardText, readPageCard } from '@/lib/og/text';
import { logger } from '@/utils';
import { guardRefusal } from './_lib/og-guard';

// Explicit: the cards read their faces from disk.
export const runtime = 'nodejs';

/** The card for `page`, or the site card when the query names no page. */
const cardFor = (page: PageCardText | null) =>
  page ? <PageCard title={page.title} description={page.description} /> : <SiteCard />;

/**
 * The card the query asks for as a PNG the CDN may keep, a 403 or 429 from the guard, or a 500
 * if it cannot be drawn. Only the card is cacheable: a refusal or a failure is never kept.
 */
export async function GET(request: Request): Promise<Response> {
  const refusal = await guardRefusal(request);
  if (refusal) return refusal;
  const page = readPageCard(new URL(request.url).searchParams);
  try {
    return await renderOgCard(cardFor(page), {
      headers: { 'Cache-Control': PAGE_CARD_CACHE_CONTROL },
    });
  } catch (error) {
    logger.error(
      `Failed to generate OG image: ${error instanceof Error ? error.message : String(error)}`,
    );
    return new Response('Failed to generate the image', {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
