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
import { constructMetadata } from '@/utils/seo/meta';
import { BookshelfStage } from '../_components/bookshelf-stage';

export const metadata = constructMetadata({
  title: 'Bookshelf',
  description:
    'An interactive 3D engineering bookshelf covering computer systems, backend architecture, infrastructure, and AI.',
  path: '/bookshelf',
});

interface BookshelfPageProps {
  readonly searchParams?: Promise<{ readonly book?: string | string[] }>;
}

/**
 * /bookshelf: interactive 3D engineering shelf. Accepts `?book=<slug>` when returning from a
 * book detail route so the shelf opens directly on that stage.
 */
export default async function BookshelfPage({
  searchParams,
}: BookshelfPageProps): Promise<ReactElement> {
  const params = searchParams ? await searchParams : undefined;
  const rawBook = params?.book;
  const initialSlug = typeof rawBook === 'string' ? rawBook : undefined;

  return <BookshelfStage initialSlug={initialSlug} />;
}
