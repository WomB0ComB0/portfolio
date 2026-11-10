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
 */

import { PageCard, SiteCard } from '@/lib/og/cards';
import { renderOgCard } from '@/lib/og/render';
import { type PageCardText, readPageCard } from '@/lib/og/text';
import { logger } from '@/utils';

// Explicit: the cards read their faces from disk.
export const runtime = 'nodejs';

/** The card for `page`, or the site card when the query names no page. */
const cardFor = (page: PageCardText | null) =>
  page ? <PageCard title={page.title} description={page.description} /> : <SiteCard />;

/** The card the query asks for as a PNG, or a 500 if it cannot be drawn. */
export async function GET(request: Request): Promise<Response> {
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
