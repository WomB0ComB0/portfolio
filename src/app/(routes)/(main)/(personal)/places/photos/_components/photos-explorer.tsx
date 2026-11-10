'use client';

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
 * @file /places/photos' one client island, composed from the shared FilterBar kit exactly as the
 * /places list is: a sticky <search> in 'bar' density (the search and the six category chips),
 * the results header (the count, the chosen category, then the "Places | Photos" links), the
 * status line, and the photos of every matching place, or the empty state. The filters are the
 * same URL as /places (?q, ?category; placePhotoFilters), so the server HTML of a shared link is
 * already filtered and the photos follow the same chips and search. The photos are given one
 * array per set of results, so typing that matches the same places leaves the wall alone. The
 * filters run over the places with photos only, so the empty state says "No photos match" and
 * points to the places list, the same filters carried, where a place without photos still is.
 */

import Link from 'next/link';
import { type JSX, useMemo } from 'react';

import {
  FILTER_SCOPE_CLASS,
  FilterBar,
  RESULTS_HEAD_CLASS,
  useUrlFilters,
} from '@/components/console/filter-bar';
import { cn } from '@/lib/utils';
import type { PhotoPlace, WallPhoto } from '@/types/places';
import { PlacesViewNav } from '../../_components/places-view-nav';
import { useShownPlaces } from '../../_components/use-shown-places';
import { placeFilters, placePhotoFilters, placeStateOf } from '../../_lib/place-filters';
import { PhotosView } from './photos-view';

/** The island's root: the bar, the results header, then the photos. */
const LIST_CLASS = 'mx-auto flex w-full max-w-7xl flex-col gap-6';
/** The empty state's link to the places list: the kit's own link look. */
const PLACES_LINK_CLASS = 'text-brand-ink underline underline-offset-4';
/** No past place has a photo: no bar, only this. */
const NO_PHOTOS_CLASS =
  'mx-auto w-full max-w-7xl rounded-tile border border-dashed border-hairline-strong px-5 py-8 tile-sub text-muted-foreground';

interface PhotosExplorerProps {
  /** Every past place with a photo, in the server's order. */
  readonly places: readonly PhotoPlace[];
  /** Their photos, in the fixed shuffle, URLs built on the server. */
  readonly photos: readonly WallPhoto[];
}

/** The photos view's interactive part: the filters and the photos of the matching places. */
export function PhotosExplorer({ places, photos }: PhotosExplorerProps): JSX.Element {
  const { model, results } = useUrlFilters(placePhotoFilters, places);
  const shown = useShownPlaces(places, results);
  const byId = useMemo(() => new Map(places.map((place) => [place.id, place])), [places]);
  const shownPhotos = useMemo(() => {
    const ids = new Set(shown.map((place) => place.id));
    return photos.filter((photo) => ids.has(photo.placeId));
  }, [photos, shown]);
  const resetKey = useMemo(() => shown.map((place) => place.id).join('\n'), [shown]);

  if (places.length === 0) return <p className={NO_PHOTOS_CLASS}>No photos yet</p>;

  return (
    <div
      data-filter-scope=""
      data-places-part="photos"
      className={cn(LIST_CLASS, FILTER_SCOPE_CLASS)}
    >
      <FilterBar.Provider model={model}>
        <FilterBar.Root sticky density="bar">
          <FilterBar.Search placeholder="Search places" />
          <FilterBar.Facets>
            <FilterBar.Chips facet="category" layout="scroll" />
          </FilterBar.Facets>
        </FilterBar.Root>
        <div className={RESULTS_HEAD_CLASS}>
          <FilterBar.Count />
          <FilterBar.Applied />
          <PlacesViewNav current="photos" />
        </div>
        <FilterBar.Status />
        <FilterBar.Results>
          {shownPhotos.length > 0 ? (
            <PhotosView
              photos={shownPhotos}
              places={byId}
              placeCount={shown.length}
              resetKey={resetKey}
            />
          ) : (
            <FilterBar.Empty title="No photos match">
              {' '}
              Places without photos are in{' '}
              <Link
                href={placeFilters.serialize(placeStateOf(model.active))}
                className={PLACES_LINK_CLASS}
              >
                the places list
              </Link>
              .
            </FilterBar.Empty>
          )}
        </FilterBar.Results>
      </FilterBar.Provider>
    </div>
  );
}
