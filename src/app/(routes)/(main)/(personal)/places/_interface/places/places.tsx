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
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Place } from '@/hooks/sanity/schemas';
import { urlFor } from '@/lib/sanity/client';
import type { PhotoItem, PlaceItem } from '@/types/places';

/** The page's h1, shared with its loading skeleton so the title never changes as the page loads. */
const PLACES_TITLE = "Places I've Visited";
/** The list card's photo size. The cards show only the count; the place page has its own URLs. */
const CARD_PHOTO_WIDTH = 800;
const CARD_PHOTO_HEIGHT = 600;
/** The loading skeleton's cards (two rows on a wide screen), each with a stable key. */
const SKELETON_CARD_KEYS = Array.from({ length: 6 }, (_, n) => `place-skeleton-${n}`);
/**
 * PlacesExplorer's card grid. A string constant cannot be imported from a 'use client' module into
 * a server one (it arrives as a client reference), so it is repeated there; places-page.test.tsx
 * checks the two match.
 */
const PLACE_GRID_CLASS =
  'grid gap-6 justify-center grid-cols-[repeat(auto-fit,minmax(220px,280px))]';

/** A Sanity place as the list's client island takes it, with its photo URLs already built. */
export function toPlaceItem(place: Place): PlaceItem {
  const photos: PhotoItem[] = (place.photos ?? []).map((photo) => ({
    url: urlFor(photo).width(CARD_PHOTO_WIDTH).height(CARD_PHOTO_HEIGHT).url(),
    caption: photo.caption,
  }));

  return {
    id: place._id,
    name: place.name,
    description: place.description,
    latitude: place.latitude,
    longitude: place.longitude,
    category: place.category,
    startDate: place.startDate,
    endDate: place.endDate,
    photos,
  };
}

const locationCount = (count: number): string =>
  `${count} ${count === 1 ? 'location' : 'locations'} visited`;

interface PlacesProps {
  /** Every place, in the order placesQuery returns them (dated newest first, then by `order`). */
  places: readonly PlaceItem[];
}

/**
 * The places page: header, filters, map and every place's card. The header counts every place,
 * whatever the filters show.
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

/** A PlaceCard's shape: title, two description lines, the category pill and the page link. */
const PlaceCardSkeleton = (): JSX.Element => (
  <Card className="h-full w-full bg-card/50 backdrop-blur-sm border-border/50">
    <div className="flex flex-col h-full">
      <CardHeader className="pb-4 grow">
        <Skeleton className="h-7 w-3/4 mb-2" />
        <div className="space-y-1.5 mb-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-[26px] w-24 rounded-full" />
      </CardHeader>
      <CardContent className="pt-0 pb-5 px-6 mt-auto">
        <Skeleton className="h-[42px] w-full rounded-xl" />
      </CardContent>
    </div>
  </Card>
);

/**
 * The places page while it loads, box for box: the real header (its h1 is on screen from the first
 * flush, even with JavaScript off), then the filter bar (two rows below lg), the map's frame and
 * the card grid. Only what needs the data is a placeholder: the count line and everything below.
 */
export function PlacesPageSkeleton(): JSX.Element {
  return (
    <div className="w-full min-h-screen p-4 sm:p-6 md:p-12 space-y-8">
      <div className="w-full max-w-7xl mx-auto">
        <PageHeader title={PLACES_TITLE} icon={<FiMapPin />} />
        {/*
          The count line. PageHeader draws its description above its bottom padding
          (page-header.css: pb-4); with no description that padding ends the header. So the bar
          is one description line tall (text-sm, md:text-base) and is lifted by that padding with
          relative positioning, which moves it without moving the boxes after it: it sits where
          "N locations visited" will, and nothing below shifts when the page arrives.
        */}
        <Skeleton className="relative -top-4 mx-auto h-5 w-40 md:h-6" />
      </div>
      <div role="status" aria-label="Loading places" className="space-y-8">
        <div className="w-full max-w-7xl mx-auto">
          <Skeleton className="h-[115px] w-full rounded-2xl lg:h-[58px]" />
        </div>
        <div className="w-full max-w-7xl mx-auto">
          <Skeleton className="w-full h-[400px] md:h-[500px] rounded-2xl" />
        </div>
        <div className="w-full max-w-7xl mx-auto">
          <div className={PLACE_GRID_CLASS}>
            {SKELETON_CARD_KEYS.map((key) => (
              <PlaceCardSkeleton key={key} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Places.displayName = 'Places';
export default Places;
