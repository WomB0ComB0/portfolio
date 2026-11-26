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

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { type ReactElement, Suspense } from 'react';
import { NOT_FOUND_METADATA } from '@/app/(routes)/not-found';
import { SectionBoundary } from '@/components/data/section-boundary';
import { constructMetadata } from '@/utils/seo/meta';
import { BookshelfStage } from '../../_components/bookshelf-stage';
import { DEFAULT_SHELF_SLUGS } from '../../_lib/books';
import { loadCatalogShelfBySlug } from '../../_lib/load-bookshelf';

export interface ShelfDetailPageProps {
  readonly params: Promise<{ readonly shelfSlug: string }>;
}

export function generateStaticParams(): Array<{ shelfSlug: string }> {
  return DEFAULT_SHELF_SLUGS.map((shelfSlug) => ({ shelfSlug }));
}

export async function generateMetadata({ params }: ShelfDetailPageProps): Promise<Metadata> {
  const { shelfSlug } = await params;
  const hit = await loadCatalogShelfBySlug(shelfSlug);
  if (!hit) return NOT_FOUND_METADATA;

  return constructMetadata({
    title: `${hit.shelf.title} Shelf`,
    description: hit.shelf.description,
    path: `/bookshelf/shelf/${hit.shelf.slug}`,
  });
}

/**
 * Focused single-shelf 3D view (`/bookshelf/shelf/[shelfSlug]`), displaying only the books in
 * that curated collection with rounded spines and finite browsing.
 */
export default async function ShelfDetailPage({
  params,
}: ShelfDetailPageProps): Promise<ReactElement> {
  const { shelfSlug } = await params;
  const hit = await loadCatalogShelfBySlug(shelfSlug);
  if (!hit || hit.books.length === 0) notFound();

  return (
    <SectionBoundary label={`${hit.shelf.title} shelf`}>
      <Suspense fallback={null}>
        <BookshelfStage books={hit.books} shelves={hit.catalog.shelves} activeShelf={hit.shelf} />
      </Suspense>
    </SectionBoundary>
  );
}
