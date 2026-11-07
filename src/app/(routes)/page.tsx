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

import type { Metadata } from 'next';
import type { JSX } from 'react';
import { HomePage } from '@/app/_components/home';
import { siteMetadata } from '@/lib/seo/site-metadata';

/**
 * The root layout's defaults (the site name and description) plus og:url for '/', and, while
 * Location in Studio names a place, that place as a keyword (the layout adds geo.placename). The
 * body is HomePage, the server-rendered bento, whose hero loads the settings this reads.
 */
export function generateMetadata(): Metadata {
  return siteMetadata({ path: '/' });
}

const Page = (): JSX.Element => <HomePage />;

Page.displayName = 'Page';
export default Page;
