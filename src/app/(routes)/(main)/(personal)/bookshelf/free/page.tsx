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

import type { ReactElement } from 'react';
import {
  buildFreeProgrammingBooksCatalog,
  loadFreeProgrammingBooks,
} from '@/lib/books/free-programming-books';
import { constructMetadata } from '@/utils/seo/meta';
import { FreeBooksExplorer } from './_components/free-books-explorer';

export const revalidate = 86_400;

export const metadata = constructMetadata({
  title: 'Free Programming Books',
  description:
    'Searchable index of 2,400+ open-access programming books by language and subject, synced live from EbookFoundation/free-programming-books.',
  path: '/bookshelf/free',
});

export default async function FreeProgrammingBooksPage(): Promise<ReactElement> {
  const catalog = await loadFreeProgrammingBooks().catch(() =>
    buildFreeProgrammingBooksCatalog([], []),
  );
  return <FreeBooksExplorer catalog={catalog} />;
}
