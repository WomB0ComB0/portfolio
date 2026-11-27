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
 * @file /api/og/shelf/<shelfSlug>?v=<version>: a shelf's link-preview card
 * (_lib/shelf-card.tsx), the og:image and twitter:image of /bookshelf/shelf/<shelfSlug>
 * (_lib/shelf-preview.ts names it).
 *
 * The slug is the only input, as for a book's card (../../book/[slug]/route.tsx): the shelf is
 * looked up in the catalog and the covers of its first few books are fetched, together, each
 * within a time and byte limit (_lib/cover-image.ts). Nothing in the query names an image.
 *
 * - The API guard runs first (_lib/og-guard.ts).
 * - A shelf the catalog does not have (or one with no books) answers 404, uncached.
 * - With every cover, the shelf card: a year at the CDN at its own version, an hour at any other.
 * - With some, the shelf card with those, uncached; with none, the shelf's text card, uncached,
 *   so the next fetch tries the covers again.
 * - With Sanity down and nothing cached, the generic shelf card the page's metadata falls back
 *   to, uncached, and one warning.
 */

import {
  type CatalogShelfHit,
  loadCatalogShelfBySlug,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/load-bookshelf';
import { reportApiFailure } from '@/lib/observability/report';
import { logger } from '@/utils';
import { cardVersion } from '../../_lib/card-version';
import { loadCoverDataUri } from '../../_lib/cover-image';
import {
  cardFailure,
  drawCard,
  NO_STORE,
  notFoundCard,
  pageCardFor,
  versionedCacheControl,
} from '../../_lib/draw-card';
import { guardRefusal } from '../../_lib/og-guard';
import { SHELF_CARD_COVER, ShelfCard } from '../../_lib/shelf-card';
import { shelfPreviewOf } from '../../_lib/shelf-preview';

// Explicit: the cards read their faces from disk.
export const runtime = 'nodejs';

/** Groups this route's Sanity failures in Sentry (one event per cooldown window). */
const REPORT_CONTEXT = 'draw shelf preview card';

interface ShelfCardContext {
  readonly params: Promise<{ readonly shelfSlug: string }>;
}

/** The shelf with `slug` and its books, null when none has it, or 'unavailable' if Sanity failed. */
async function findShelf(slug: string): Promise<CatalogShelfHit | null | 'unavailable'> {
  try {
    const hit = await loadCatalogShelfBySlug(slug);
    return hit && hit.books.length > 0 ? hit : null;
  } catch (error) {
    logger.warn('A shelf card fell back to the generic card', { error });
    reportApiFailure(error, { context: REPORT_CONTEXT, level: 'warning' });
    return 'unavailable';
  }
}

/** The shelf card with the covers that loaded, or null when none did or it cannot be drawn. */
async function drawWithCovers(
  hit: CatalogShelfHit,
  requested: string | null,
): Promise<Response | null> {
  const preview = shelfPreviewOf(hit.shelf, hit.books);
  const loaded = await Promise.all(
    preview.covers.map((cover) => loadCoverDataUri(cover.coverSrc, SHELF_CARD_COVER.width)),
  );
  const covers = loaded.filter((cover): cover is string => cover !== null);
  if (covers.length === 0) return null;
  const complete = covers.length === preview.covers.length;
  const cacheControl = complete ? versionedCacheControl(cardVersion(preview), requested) : NO_STORE;
  return drawCard(<ShelfCard preview={preview} covers={covers} />, cacheControl);
}

/** The card a request for `shelfSlug` gets: the shelf card, a text card, or the 404. */
export async function GET(request: Request, { params }: ShelfCardContext): Promise<Response> {
  const refusal = await guardRefusal(request);
  if (refusal) return refusal;

  const { shelfSlug } = await params;
  const hit = await findShelf(shelfSlug);
  if (hit === null) return notFoundCard('shelf');
  if (hit === 'unavailable') {
    const generic = pageCardFor('Shelf', 'A shelf on the bookshelf');
    return (await drawCard(generic, NO_STORE)) ?? cardFailure();
  }

  const requested = new URL(request.url).searchParams.get('v');
  const withCovers = await drawWithCovers(hit, requested);
  if (withCovers) return withCovers;
  const text = pageCardFor(`${hit.shelf.title} Shelf`, hit.shelf.description);
  return (await drawCard(text, NO_STORE)) ?? cardFailure();
}
