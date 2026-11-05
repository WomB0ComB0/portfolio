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

import type { ReactElement } from 'react';

import { constructMetadata } from '@/utils';

import { Sponsor } from './_interface/sponsor';

/**
 * Metadata configuration for the Sponsor page.
 * This object is used by Next.js to provide SEO information, define the browser title,
 * and set the page description for search engines and social media shares.
 *
 * @type {import("next").Metadata}
 * @readonly
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link https://nextjs.org/docs/app/building-your-application/optimizing/metadata}
 */
export const metadata = constructMetadata({
  title: 'Sponsor',
  description:
    'Support my work through sponsorship. See my current sponsors and ways to contribute.',
  path: '/sponsor',
});

/**
 * /sponsor. Not async on purpose: the header, benefits, platforms and contact card render at
 * once, and only the sponsors block waits on GitHub, behind its own Suspense boundary and within
 * a deadline (see Sponsors). The block has its own skeleton, so the route needs no loading.tsx.
 */
export default function SponsorPage(): ReactElement {
  return <Sponsor />;
}
