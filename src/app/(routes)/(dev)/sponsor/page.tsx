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

import { SponsorView } from './_components/sponsor-view';
import { loadSponsors } from './_lib/load-sponsors';
import { DEFAULT_SPONSOR_OPTIONS } from './_lib/options';

/**
 * The page's title, description and canonical path for search engines and shared links. The
 * description is true with or without a current sponsor: it promises the ways and the thanks.
 */
export const metadata = constructMetadata({
  title: 'Sponsor',
  description:
    'Ways to support my open-source work and educational content, with thanks to everyone who has sponsored it.',
  path: '/sponsor',
});

/**
 * /sponsor as "Ways first", rendered whole on the server like /certifications: the page awaits
 * its sponsors first (served from getGitHubSponsors' cache, or within SPONSORS_DEADLINE_MS), with
 * no Suspense boundary and no loading.tsx, so the ways and the thank-you row are in the first
 * HTML, readable with JS off and by crawlers. A GitHub failure costs only the thank-you row,
 * which says so in one line; the ways never depend on it. Ships the owner's open decisions at
 * their defaults (no benefits copy, no amounts).
 */
export default async function SponsorPage(): Promise<ReactElement> {
  return <SponsorView sponsors={await loadSponsors()} options={DEFAULT_SPONSOR_OPTIONS} />;
}
