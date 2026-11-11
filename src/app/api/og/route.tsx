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
 * Each distinct query is a fresh render, so the API guard runs first: the per-IP sliding window
 * and ban lists /api uses (src/lib/security/api-guard.ts), with its 429 and 403 answers. The
 * prerendered /opengraph-image and /twitter-image do not pass through here.
 */

import { apiGuardHook } from '@/app/api/_elysia/shared/guard';
import { PageCard, SiteCard } from '@/lib/og/cards';
import { renderOgCard } from '@/lib/og/render';
import { type PageCardText, readPageCard } from '@/lib/og/text';
import { logger } from '@/utils';

// Explicit: the cards read their faces from disk.
export const runtime = 'nodejs';

/** The card for `page`, or the site card when the query names no page. */
const cardFor = (page: PageCardText | null) =>
  page ? <PageCard title={page.title} description={page.description} /> : <SiteCard />;

/**
 * The API guard's refusal of `request`, or null to draw the card. The guard answers 403 to a
 * banned client and 429 with Retry-After to one over its limit, both `no-store` so the CDN never
 * serves them to anyone else. It fails open: the guard itself allows when Upstash is unset, slow
 * or failing, and anything it throws here draws the card too.
 */
async function guardRefusal(request: Request): Promise<Response | null> {
  const set: { status?: number; headers: Record<string, string | number> } = { headers: {} };
  try {
    const body = await apiGuardHook({ request, set });
    if (body === undefined) return null;
    const headers = Object.fromEntries(
      Object.entries(set.headers).map(([name, value]) => [name, String(value)]),
    );
    return Response.json(body, { status: set.status, headers });
  } catch (error) {
    logger.warn('The OG guard failed; drawing the card', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** The card the query asks for as a PNG, a 403 or 429 from the guard, or a 500 if it cannot be drawn. */
export async function GET(request: Request): Promise<Response> {
  const refusal = await guardRefusal(request);
  if (refusal) return refusal;
  const page = readPageCard(new URL(request.url).searchParams);
  try {
    return await renderOgCard(cardFor(page));
  } catch (error) {
    logger.error(
      `Failed to generate OG image: ${error instanceof Error ? error.message : String(error)}`,
    );
    return new Response('Failed to generate the image', { status: 500 });
  }
}
