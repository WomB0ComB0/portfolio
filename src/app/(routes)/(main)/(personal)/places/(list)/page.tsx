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

import type { JSX } from 'react';
import {
  Places,
  toPlaceItem,
} from '@/app/(routes)/(main)/(personal)/places/_interface/places/places';
import { loadPlaces } from '@/lib/sanity/loaders';
import { constructMetadata } from '@/utils/seo/meta';

export const metadata = constructMetadata({
  title: 'Places',
  description: 'Explore the locations I have visited, including hackathons, tech events, and more',
  path: '/places',
});

/**
 * Every place, rendered on the server. When Sanity fails with nothing cached, loadPlaces rejects
 * and the shell's error boundary takes over the page.
 */
export default async function PlacesPage(): Promise<JSX.Element> {
  return <Places places={(await loadPlaces()).map(toPlaceItem)} />;
}
