/**
 * Copyright 2025 Mike Odnis
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
 * @fileoverview The 404 page for unmatched URLs.
 *
 * Next renders this root file for any URL no route matches, inside the root layout but outside
 * route-group layouts, so the (routes) shell is not around it. It wraps the shell itself: a typo
 * URL still gets the nav, the skip link, the command palette and the footer. notFound() thrown by
 * a page under (routes) renders src/app/(routes)/not-found.tsx instead, inside that shell.
 */

import type { JSX } from 'react';
import { NotFoundView } from '@/app/_components/errors';
import { NOT_FOUND_METADATA } from '@/app/(routes)/not-found';
import { Layout } from '@/components/layout/layout';

export const metadata = NOT_FOUND_METADATA;

export default function NotFoundPage(): JSX.Element {
  return (
    <Layout>
      <NotFoundView />
    </Layout>
  );
}
