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
 * @file /bookshelf/free, the Free Library: EbookFoundation's free programming books as a
 * searchable table. The server loads the catalog (src/lib/free-books/loader.ts) and sends only the
 * default first page with the category and stat summaries; the explorer island fetches every other
 * page, filter and sort from `GET /api/v1/books/free`. A catalog that cannot load is reported and
 * shows as an empty library.
 */

import { type ReactElement, Suspense } from 'react';
import { SectionBoundary } from '@/components/data/section-boundary';
import {
  buildFreeBooksPageResponse,
  buildFreeProgrammingBooksCatalog,
} from '@/lib/free-books/catalog';
import { loadFreeProgrammingBooks } from '@/lib/free-books/loader';
import { FREE_BOOKS_DEFAULT_PAGE_SIZE } from '@/lib/free-books/types';
import { reportApiFailure } from '@/lib/observability/report';
import { constructMetadata } from '@/utils/seo/meta';
import { FreeBooksExplorer } from './_components/free-books-explorer';
import { FreeBooksSkeleton } from './_components/free-books-skeleton';

/** Rebuilt at most hourly, the same hour the loader caches the catalog and its GitHub fetches. */
export const revalidate = 3_600;

/** Groups a failed catalog load in Sentry (one event per cooldown window). */
const FREE_BOOKS_REPORT_CONTEXT = 'free programming books catalog';

export const metadata = constructMetadata({
  title: 'Free Programming Books',
  description:
    'Searchable index of 2,400+ open-access programming books by language and subject, synced live from EbookFoundation/free-programming-books.',
  path: '/bookshelf/free',
});

export default async function FreeProgrammingBooksPage(): Promise<ReactElement> {
  const catalog = await loadFreeProgrammingBooks().catch((error: unknown) => {
    reportApiFailure(error, { context: FREE_BOOKS_REPORT_CONTEXT, level: 'warning' });
    return buildFreeProgrammingBooksCatalog([], []);
  });
  // Send only page 1 (50 rows) + category/stat summaries in the initial RSC payload;
  // subsequent pages, filters, and sorts fetch incrementally via TanStack Query + /api/v1/books/free.
  const initialPage = buildFreeBooksPageResponse(catalog, {
    hideArchived: true,
    hideUnavailable: true,
    sort: 'title',
    dir: 'asc',
    limit: FREE_BOOKS_DEFAULT_PAGE_SIZE,
    offset: 0,
  });

  // The explorer reads its URL state through nuqs (useSearchParams), which a statically rendered
  // page must wrap in Suspense; the skeleton stands in until the client has it.
  return (
    <SectionBoundary label="free programming books" queryKeys={[['books', 'free']]}>
      <Suspense fallback={<FreeBooksSkeleton />}>
        <FreeBooksExplorer initialPage={initialPage} />
      </Suspense>
    </SectionBoundary>
  );
}
