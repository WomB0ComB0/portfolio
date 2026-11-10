import 'server-only';

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
import { FiMapPin } from 'react-icons/fi';
import { PlacesExplorer } from '@/app/(routes)/(main)/(personal)/places/_components/places-explorer';
import { PageHeader } from '@/components/custom/page-header';
import type { Place } from '@/hooks/sanity/schemas';
import type { PlaceItem } from '@/types/places';
import { sliverUrl, usablePhotos } from '../../_lib/place-photo-urls';

/** The page's h1. */
const PLACES_TITLE = "Places I've Visited";
/** The card's folder holds this many slivers at most. */
const SLIVERS_SHOWN = 3;

/**
 * A Sanity place as the list's client island takes it: its usable photos counted, and the first
 * three as the folder's 96 x 64 slivers, built here on the server. No other photo URL is sent.
 */
export function toPlaceItem(place: Place): PlaceItem {
  const photos = usablePhotos(place);

  return {
    id: place._id,
    name: place.name,
    description: place.description,
    latitude: place.latitude,
    longitude: place.longitude,
    category: place.category,
    startDate: place.startDate,
    endDate: place.endDate,
    photoCount: photos.length,
    slivers: photos.slice(0, SLIVERS_SHOWN).map(sliverUrl),
  };
}

/** "1 location visited", "57 locations visited". */
const locationCount = (count: number): string =>
  `${count} ${count === 1 ? 'location' : 'locations'} visited`;

interface PlacesProps {
  /**
   * Every past place (the page leaves out any visit that may still be on), in the order
   * placesQuery returns them: dated newest first, then by `order`.
   */
  places: readonly PlaceItem[];
}

/**
 * The places page: header, filters, map and every place's card. The header counts every place it
 * is given, whatever the filters show.
 */
export function Places({ places }: PlacesProps): JSX.Element {
  return (
    <div className="w-full min-h-screen p-4 sm:p-6 md:p-12 space-y-8">
      <div className="w-full max-w-7xl mx-auto">
        <PageHeader
          title={PLACES_TITLE}
          description={locationCount(places.length)}
          icon={<FiMapPin />}
        />
      </div>
      <PlacesExplorer places={places} />
    </div>
  );
}

Places.displayName = 'Places';
export default Places;
