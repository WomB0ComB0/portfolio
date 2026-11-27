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
 * @file /api/og/book/<slug>?v=<version>: a book's link-preview card (_lib/book-card.tsx), the
 * og:image and twitter:image of /bookshelf/<slug> (_lib/book-preview.ts names it).
 *
 * The slug is the only input: the book is looked up in the catalog and its own Sanity cover is
 * fetched within a time and byte limit (_lib/cover-image.ts). Nothing in the query names an image,
 * so the route cannot be pointed at any other address. `?v=` only decides how long the card is
 * kept (_lib/draw-card.tsx).
 *
 * - The API guard runs first, as on /api/og (_lib/og-guard.ts).
 * - A slug the catalog does not have answers 404, uncached, and nothing is fetched or drawn.
 * - With its cover, the book card: a year at the CDN at its own version, an hour at any other.
 * - Without it (the cover failed to load or draw), the text card the book page had before, from
 *   /api/og's page card, uncached so the next fetch tries the cover again.
 * - With Sanity down and nothing cached, the generic book card the page's metadata falls back
 *   to, uncached, and one warning.
 */

import type { BookItem } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import { loadCatalogBookBySlug } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/load-bookshelf';
import { reportApiFailure } from '@/lib/observability/report';
import { logger } from '@/utils';
import { BOOK_CARD_COVER, BookCard } from '../../_lib/book-card';
import { bookPreviewOf } from '../../_lib/book-preview';
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

// Explicit: the cards read their faces from disk.
export const runtime = 'nodejs';

/** Groups this route's Sanity failures in Sentry (one event per cooldown window). */
const REPORT_CONTEXT = 'draw book preview card';

interface BookCardContext {
  readonly params: Promise<{ readonly slug: string }>;
}

/** The book with `slug`, null when the catalog has none, or 'unavailable' when Sanity failed. */
async function findBook(slug: string): Promise<BookItem | null | 'unavailable'> {
  try {
    return (await loadCatalogBookBySlug(slug))?.book ?? null;
  } catch (error) {
    logger.warn('A book card fell back to the generic card', { error });
    reportApiFailure(error, { context: REPORT_CONTEXT, level: 'warning' });
    return 'unavailable';
  }
}

/** The book card with its cover, or null when the cover cannot be loaded or drawn. */
async function drawWithCover(book: BookItem, requested: string | null): Promise<Response | null> {
  const preview = bookPreviewOf(book);
  const cover = await loadCoverDataUri(preview.coverSrc, BOOK_CARD_COVER.width);
  if (!cover) return null;
  return drawCard(
    <BookCard preview={preview} cover={cover} />,
    versionedCacheControl(cardVersion(preview), requested),
  );
}

/** The card a request for `slug` gets: the book card, a text card, or the 404. */
export async function GET(request: Request, { params }: BookCardContext): Promise<Response> {
  const refusal = await guardRefusal(request);
  if (refusal) return refusal;

  const { slug } = await params;
  const book = await findBook(slug);
  if (book === null) return notFoundCard('book');
  if (book === 'unavailable') {
    return (await drawCard(pageCardFor('Book', 'A book on the shelf'), NO_STORE)) ?? cardFailure();
  }

  const requested = new URL(request.url).searchParams.get('v');
  const withCover = await drawWithCover(book, requested);
  if (withCover) return withCover;
  const text = pageCardFor(`${book.title} (Stage ${book.stageLabel})`, book.summary);
  return (await drawCard(text, NO_STORE)) ?? cardFailure();
}
