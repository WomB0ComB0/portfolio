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
 * @file /bookshelf/[slug], rendered on the server. The book is looked up in the Sanity catalog
 * before anything streams, so an unknown slug answers a real 404 through notFound(), and a Sanity
 * outage with nothing cached a real 500 through the (routes) error view. The metadata and the
 * page share one load: the catalog loader is React-cache()d per request.
 *
 * The client view gets the one book in full and nothing else whole: its Previous and Next books
 * as their link fields, and the catalog as slim reading-map entries plus the shelves. The whole
 * catalog was 109 KB of props at 69 books and 1.5 MB at 1000, fetched again on every Previous or
 * Next click (tests/unit/bookshelf/scale-budgets.test.ts holds the budget).
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';
import { NOT_FOUND_METADATA } from '@/app/(routes)/not-found';
import { reportApiFailure } from '@/lib/observability/report';
import { logger } from '@/utils/logging';
import { constructMetadata } from '@/utils/seo/meta';
import { BookDetailView } from '../_components/book-detail-view';
import { loadCatalogBookBySlug } from '../_lib/load-bookshelf';
import { toReadingMapEntry } from '../_lib/reading-map';

/** Groups this page's metadata fallbacks in Sentry (one event per cooldown window). */
const METADATA_REPORT_CONTEXT = 'build book page metadata';

interface BookDetailPageProps {
  readonly params: Promise<{ readonly slug: string }>;
}

// No generateStaticParams: the root layout is force-dynamic (the CSP nonce is per request), so
// every slug renders on request anyway, and a build-time slug list only made `next build` try and
// fail to prerender each one.

/**
 * The book's title, summary and og:url. No image is passed: constructMetadata's generated page
 * card reads better than a portrait cover cropped to a landscape preview. An unknown slug gets
 * "Not Found" and no og:url; when Sanity fails, whether the slug exists is unknown, so the page's
 * defaults (with their og:url) are kept and the failure is reported as a warning.
 */
export async function generateMetadata({ params }: BookDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const path = `/bookshelf/${encodeURIComponent(slug)}`;

  try {
    const hit = await loadCatalogBookBySlug(slug);
    if (!hit) return NOT_FOUND_METADATA;
    return constructMetadata({
      title: `${hit.book.title} (Stage ${hit.book.stageLabel})`,
      description: hit.book.summary,
      path,
    });
  } catch (error) {
    logger.warn('Book metadata fell back to the defaults', { error });
    reportApiFailure(error, { context: METADATA_REPORT_CONTEXT, level: 'warning' });
    return constructMetadata({ title: 'Book', description: 'A book on the shelf', path });
  }
}

/** A book on the shelf in full; an unknown slug is a 404. */
export default async function BookDetailPage({
  params,
}: BookDetailPageProps): Promise<ReactElement> {
  const { slug } = await params;
  const hit = await loadCatalogBookBySlug(slug);
  if (!hit) notFound();

  return (
    <BookDetailView
      book={hit.book}
      prev={hit.prev}
      next={hit.next}
      mapBooks={hit.catalog.books.map(toReadingMapEntry)}
      shelves={hit.catalog.shelves}
    />
  );
}
