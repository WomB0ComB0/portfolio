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
 * @fileoverview The 404 view for notFound() thrown by any page under (routes).
 *
 * It renders inside the (routes) layout, which already provides the shell, so it adds only the
 * view. Unmatched URLs never reach this file: Next renders src/app/not-found.tsx for them, outside
 * route-group layouts. Keep both, so a future catch-all page under (routes) still gets a 404 view.
 *
 * It owns the 404 metadata both files export. Next takes a 404's metadata from the deepest
 * not-found module, so without its own export this file would replace the root's "404" title with
 * the site's default. It lives here, not in the root file, which imports the whole shell.
 */

import type { Metadata } from 'next';
import type { JSX } from 'react';
import { NotFoundView } from '@/app/_components/errors';
import { constructMetadata } from '@/utils';

/** The title and description of every 404, kept out of search indexes. */
export const NOT_FOUND_METADATA: Metadata = constructMetadata({
  title: '404',
  description: 'This page does not exist',
  noIndex: true,
});

export const metadata = NOT_FOUND_METADATA;

export default function NotFound(): JSX.Element {
  return <NotFoundView />;
}
