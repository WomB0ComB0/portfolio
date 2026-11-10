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
 * @file /places. There is no loading.tsx (owner: "Drop it on both"), so every place is in the
 * first HTML and shows without JavaScript. The page stays in the (list) route group so list-only
 * files never wrap /places/[placeId], whose notFound() must still answer 404. The URL's filters
 * (?q, ?category) are read by the island through nuqs, which the dynamic root layout gives the
 * search params during the server render.
 */

import type { JSX } from 'react';
import {
  Places,
  toPlaceItem,
} from '@/app/(routes)/(main)/(personal)/places/_interface/places/places';
import { loadPastPlaces } from '@/app/(routes)/(main)/(personal)/places/_lib/past-place-loaders';
import { constructMetadata } from '@/utils/seo/meta';

export const metadata = constructMetadata({
  title: 'Places',
  description: 'Explore the locations I have visited, including hackathons, tech events, and more',
  path: '/places',
});

/**
 * Every past place, rendered on the server (loadPastPlaces): a visit that may still be on (its
 * last day is placeCutoffDay or later, or it has no day) or is still to come never reaches the
 * page, so the cards, the map and every count leave it out. When Sanity fails with nothing
 * cached, the loader rejects and the shell's error boundary takes over the page.
 */
export default async function PlacesPage(): Promise<JSX.Element> {
  const places = await loadPastPlaces();
  return <Places places={places.map(toPlaceItem)} />;
}
