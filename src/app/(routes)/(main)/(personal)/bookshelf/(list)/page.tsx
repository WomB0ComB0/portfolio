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

import { type ReactElement, Suspense } from 'react';
import { constructMetadata } from '@/utils/seo/meta';
import { BookshelfStage } from '../_components/bookshelf-stage';
import { loadBookshelfCatalog } from '../_lib/load-bookshelf';

export const metadata = constructMetadata({
  title: 'Bookshelf',
  description:
    'An interactive 3D bookshelf spanning computer systems, backend architecture, AI, philosophy, psychology, society, economics, and political power.',
  path: '/bookshelf',
});

interface BookshelfPageProps {
  readonly searchParams?: Promise<{ readonly book?: string | string[] }>;
}

/**
 * /bookshelf: dynamic Sanity-backed 3D engineering shelf + separated fanned shelf collections.
 */
export default async function BookshelfPage({
  searchParams,
}: BookshelfPageProps): Promise<ReactElement> {
  const [params, catalog] = await Promise.all([
    searchParams ? searchParams : Promise.resolve(undefined),
    loadBookshelfCatalog(),
  ]);
  const rawBook = params?.book;
  const initialSlug = typeof rawBook === 'string' ? rawBook : undefined;

  return (
    <Suspense fallback={null}>
      <BookshelfStage initialSlug={initialSlug} books={catalog.books} shelves={catalog.shelves} />
    </Suspense>
  );
}
