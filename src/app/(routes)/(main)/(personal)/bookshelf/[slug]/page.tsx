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
import type { ReactElement } from 'react';
import { NOT_FOUND_METADATA } from '@/app/(routes)/not-found';
import { constructMetadata } from '@/utils/seo/meta';
import { BookDetailView } from '../_components/book-detail-view';
import { BOOK_SLUGS } from '../_lib/books';
import { loadCatalogBookBySlug } from '../_lib/load-bookshelf';

export interface BookDetailPageProps {
  readonly params: Promise<{ readonly slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return BOOK_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: BookDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const hit = await loadCatalogBookBySlug(slug);
  if (!hit) return NOT_FOUND_METADATA;

  return constructMetadata({
    title: `${hit.book.title} (Stage ${hit.book.stageLabel})`,
    description: hit.book.summary,
    path: `/bookshelf/${hit.book.slug}`,
  });
}

/**
 * Dedicated route for each book on the shelf (`/bookshelf/[slug]`).
 */
export default async function BookDetailPage({
  params,
}: BookDetailPageProps): Promise<ReactElement> {
  const { slug } = await params;
  const hit = await loadCatalogBookBySlug(slug);
  if (!hit) notFound();

  return <BookDetailView book={hit.book} books={hit.catalog.books} shelves={hit.catalog.shelves} />;
}
