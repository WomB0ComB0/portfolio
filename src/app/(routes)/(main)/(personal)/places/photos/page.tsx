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

/**
 * @file /places/photos: every photo of every past visit, as the wall (a mouse or trackpad) or the
 * grid (touch, and without JavaScript). A static segment, so it wins over /places/[placeId],
 * whose 404s stay as they were. Like /places it has no loading.tsx, so the grid is in the first
 * HTML, and it reads only the past-only loader: a visit that may still be on, or one whose photos
 * were cleared, adds no photo, count or chip. Its filters are /places' own (?q, ?category), read
 * by the island through nuqs during the server render.
 */

import type { JSX } from 'react';
import { FiImage } from 'react-icons/fi';
import { PageHeader } from '@/components/custom/page-header';
import { constructMetadata } from '@/utils/seo/meta';
import { loadPastPlaces } from '../_lib/past-place-loaders';
import { PLACE_PHOTOS_PATH } from '../_lib/place-filters';
import { PhotosExplorer } from './_components/photos-explorer';
import { buildPhotoIndex } from './_lib/photo-index';
import { photosFromVisits } from './_lib/photo-labels';

/** The h1 /places has too: the title, the subtitle and the nav's aria-current tell them apart. */
const PLACES_TITLE = "Places I've Visited";

export const metadata = constructMetadata({
  title: 'Place Photos',
  description: 'Photos from the hackathons, conferences, offices and events I have visited',
  path: PLACE_PHOTOS_PATH,
});

/**
 * Every photo of every past place, rendered on the server. When Sanity fails with nothing
 * cached, the loader rejects and the shell's error boundary takes over the page.
 */
export default async function PlacePhotosPage(): Promise<JSX.Element> {
  const { places, photos } = buildPhotoIndex(await loadPastPlaces());
  return (
    <div className="w-full min-h-screen p-4 sm:p-6 md:p-12 space-y-8">
      <div className="w-full max-w-7xl mx-auto">
        <PageHeader
          title={PLACES_TITLE}
          description={photosFromVisits(photos.length, places.length)}
          icon={<FiImage />}
        />
      </div>
      <PhotosExplorer places={places} photos={photos} />
    </div>
  );
}
