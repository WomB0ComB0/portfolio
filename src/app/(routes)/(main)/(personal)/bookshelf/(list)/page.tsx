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
 * @file /bookshelf, rendered on the server from the Sanity catalog: the 3D shelf island with every
 * book and shelf as props, or, with no books published, the EmptyState (decided here, since the
 * island's hooks need at least one book). When Sanity fails with nothing cached the load rejects,
 * and src/app/(routes)/error.tsx shows the error inside the shell.
 *
 * No Suspense boundary round the island: nothing inside suspends (the data comes as props, and
 * the root layout renders every request dynamically, so nuqs' useSearchParams needs none), and
 * one with an empty fallback let React stream the stage after the footer, which then jumped down.
 */

import type { ReactElement } from 'react';
import { EmptyState } from '@/components/console/empty-state';
import { PageShell } from '@/components/console/page-shell';
import { SectionBoundary } from '@/components/data/section-boundary';
import { constructMetadata } from '@/utils/seo/meta';
import { BookshelfStage } from '../_components/bookshelf-stage';
import { hasBooks, loadBookshelfCatalog } from '../_lib/load-bookshelf';

// Subject-free on purpose: the shelves are edited in Studio, so a list of subjects here would
// drift from them. The page itself names the current shelves.
export const metadata = constructMetadata({
  title: 'Bookshelf',
  description:
    'An interactive 3D bookshelf of the books I have read, am reading and plan to read, shelf by shelf, with numbered topics.',
  path: '/bookshelf',
});

interface BookshelfPageProps {
  readonly searchParams?: Promise<{ readonly book?: string | string[] }>;
}

/** /bookshelf: the 3D shelf and its shelf cards, or the empty state when no book is published. */
export default async function BookshelfPage({
  searchParams,
}: BookshelfPageProps): Promise<ReactElement> {
  const [params, catalog] = await Promise.all([
    searchParams ? searchParams : Promise.resolve(undefined),
    loadBookshelfCatalog(),
  ]);

  if (!hasBooks(catalog.books)) {
    return (
      <PageShell sizing="container" eyebrow="Reading" title="Bookshelf" className="pb-16">
        <EmptyState
          title="No books yet"
          action={{ href: '/bookshelf/free', label: 'Browse the free library' }}
        >
          Books show up here as they go on a shelf.
        </EmptyState>
      </PageShell>
    );
  }

  const rawBook = params?.book;
  const initialSlug = typeof rawBook === 'string' ? rawBook : undefined;

  return (
    <SectionBoundary label="bookshelf">
      <BookshelfStage initialSlug={initialSlug} books={catalog.books} shelves={catalog.shelves} />
    </SectionBoundary>
  );
}
