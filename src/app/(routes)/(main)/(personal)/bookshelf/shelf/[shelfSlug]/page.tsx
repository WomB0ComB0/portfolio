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
 * @file /bookshelf/shelf/[shelfSlug], rendered on the server. The shelf is looked up in the Sanity
 * catalog before anything streams, so an unknown slug (or a shelf with no books) answers a real
 * 404 through notFound(), and a Sanity outage with nothing cached a real 500 through the (routes)
 * error view. The metadata and the page share one load: the catalog loader is React-cache()d.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';
import { NOT_FOUND_METADATA } from '@/app/(routes)/not-found';
import { SectionBoundary } from '@/components/data/section-boundary';
import { reportApiFailure } from '@/lib/observability/report';
import { logger } from '@/utils/logging';
import { constructMetadata } from '@/utils/seo/meta';
import { BookshelfStage } from '../../_components/bookshelf-stage';
import { hasBooks, loadCatalogShelfBySlug } from '../../_lib/load-bookshelf';

/** Groups this page's metadata fallbacks in Sentry (one event per cooldown window). */
const METADATA_REPORT_CONTEXT = 'build bookshelf shelf page metadata';

interface ShelfDetailPageProps {
  readonly params: Promise<{ readonly shelfSlug: string }>;
}

// No generateStaticParams: the root layout is force-dynamic (the CSP nonce is per request), so
// every shelf renders on request anyway, and a build-time slug list only made `next build` try
// and fail to prerender each one.

/**
 * The shelf's title, description and og:url. An unknown slug gets "Not Found" and no og:url; when
 * Sanity fails, whether the shelf exists is unknown, so the page's defaults (with their og:url)
 * are kept and the failure is reported as a warning.
 */
export async function generateMetadata({ params }: ShelfDetailPageProps): Promise<Metadata> {
  const { shelfSlug } = await params;
  const path = `/bookshelf/shelf/${encodeURIComponent(shelfSlug)}`;

  try {
    const hit = await loadCatalogShelfBySlug(shelfSlug);
    if (!hit) return NOT_FOUND_METADATA;
    return constructMetadata({
      title: `${hit.shelf.title} Shelf`,
      description: hit.shelf.description,
      path,
    });
  } catch (error) {
    logger.warn('Bookshelf shelf metadata fell back to the defaults', { error });
    reportApiFailure(error, { context: METADATA_REPORT_CONTEXT, level: 'warning' });
    return constructMetadata({ title: 'Shelf', description: 'A shelf on the bookshelf', path });
  }
}

/**
 * Focused single-shelf 3D view (`/bookshelf/shelf/[shelfSlug]`), displaying only the books in
 * that shelf with rounded spines and finite browsing. An unknown slug is a 404.
 *
 * The island gets this shelf alone: the page never shows the shelf cards, and the reading map
 * then counts this shelf's books across one shelf. No Suspense boundary: nothing inside suspends
 * (the data comes as props, and the root layout renders every request dynamically), and one
 * with an empty fallback let React stream the stage after the footer, which then jumped down.
 */
export default async function ShelfDetailPage({
  params,
}: ShelfDetailPageProps): Promise<ReactElement> {
  const { shelfSlug } = await params;
  const hit = await loadCatalogShelfBySlug(shelfSlug);
  if (!hit || !hasBooks(hit.books)) notFound();

  return (
    <SectionBoundary label={`${hit.shelf.title} shelf`}>
      <BookshelfStage books={hit.books} shelves={[hit.shelf]} activeShelf={hit.shelf} />
    </SectionBoundary>
  );
}
