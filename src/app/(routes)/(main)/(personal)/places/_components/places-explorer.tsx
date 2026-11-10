'use client';

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
 * @file The /places list's one client island, composed from the shared FilterBar kit: a sticky
 * <search> in 'bar' density (the search and the six category chips on a tile; on a phone the
 * search and a Filters button, the chips in a bottom sheet), the results header (the count, then
 * the chosen category as a removable token), the status line, the map, and every matching
 * place's card or the empty state that names what removed everything.
 *
 * Its filters live in the URL (?q, ?category) through useUrlFilters (nuqs: history replace,
 * shallow, no scroll), so the server HTML of a shared link is already filtered, the chips and
 * the token are links and the search is a GET form. The route has no loading.tsx, so without
 * JavaScript every place is in the first HTML. With JavaScript typing filters the cards and the
 * map at once (no debounce). The map sits outside the results' box: a chip crossfades only the
 * cards, the map updates at once. Both are given one array per set of results (useShownPlaces),
 * and the grid is memoised on it, so a keystroke's urgent render (the search as typed, the list
 * not yet) re-renders no card, and neither does typing that matches the same places.
 */

import { type JSX, memo } from 'react';

import {
  FILTER_SCOPE_CLASS,
  FilterBar,
  RESULTS_HEAD_CLASS,
  useUrlFilters,
} from '@/components/console/filter-bar';
import { cn } from '@/lib/utils';
import type { PlaceItem } from '@/types/places';
import { placeFilters } from '../_lib/place-filters';
import { GoogleMaps } from './map';
import { PlaceCard } from './place-card';
import { useShownPlaces } from './use-shown-places';

/** The island's root: the bar, the results header, the map, then the cards. */
const LIST_CLASS = 'mx-auto flex w-full max-w-7xl flex-col gap-6';
/**
 * The map's tile, which sets its height (the map fills it). A surface tile like the bar's, so
 * the two read as one set of controls over the cards.
 */
const MAP_TILE_CLASS =
  'relative h-[400px] overflow-hidden rounded-tile border border-hairline bg-surface-1 shadow-tile md:h-[500px]';
/** Without JavaScript the map is an empty box; this line says why, over it. */
const NO_SCRIPT_NOTE_CLASS =
  'absolute inset-0 z-[1] flex items-center justify-center p-6 text-center tile-sub text-muted-foreground';
/**
 * The cards fill the column the bar and the map tiles share, edge to edge with them: as many
 * columns of at least 16rem as fit (one at 390, two at 768, three at 1024, four at 1440), each
 * stretched to share the width; a column narrower than 16rem takes the whole width.
 */
const PLACE_GRID_CLASS =
  'grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] @min-[48rem]/page:gap-5';
/** A dataset with no places at all: no bar and no map, only this. */
const NO_PLACES_CLASS =
  'mx-auto w-full max-w-7xl rounded-tile border border-dashed border-hairline-strong px-5 py-8 tile-sub text-muted-foreground';

interface PlacesExplorerProps {
  /** Every past place, in the server's order, with photo URLs built on the server. */
  readonly places: readonly PlaceItem[];
}

/** The map's tile: the map, given exactly the places the cards show. */
function MapTile({ places }: { readonly places: PlaceItem[] }): JSX.Element {
  return (
    <div data-places-part="map" className={MAP_TILE_CLASS}>
      <noscript>
        <p className={NO_SCRIPT_NOTE_CLASS}>
          The map needs JavaScript. Every place is listed below.
        </p>
      </noscript>
      <GoogleMaps placesToDisplay={places} />
    </div>
  );
}

/**
 * Every matching place's card, in the server's order. Memoised on its array (useShownPlaces
 * keeps one per set of results), so a render that leaves the set alone re-renders no card.
 */
const PlaceGrid = memo(function PlaceGrid({
  places,
}: {
  readonly places: readonly PlaceItem[];
}): JSX.Element {
  return (
    <ul aria-label="Places" className={PLACE_GRID_CLASS}>
      {places.map((place) => (
        <li key={place.id} data-place-card="" className="h-full w-full">
          <PlaceCard place={place} />
        </li>
      ))}
    </ul>
  );
});

/**
 * The places list's interactive part: the filters, the map and the matching cards. With no
 * places at all it says so, with no bar and no map.
 */
export function PlacesExplorer({ places }: PlacesExplorerProps): JSX.Element {
  const { model, results } = useUrlFilters(placeFilters, places);
  const shown = useShownPlaces(places, results);

  if (places.length === 0) return <p className={NO_PLACES_CLASS}>No places found</p>;

  return (
    <div
      data-filter-scope=""
      data-places-part="list"
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
        </div>
        <FilterBar.Status />
        <MapTile places={shown} />
        <FilterBar.Results>
          {shown.length > 0 ? <PlaceGrid places={shown} /> : <FilterBar.Empty />}
        </FilterBar.Results>
      </FilterBar.Provider>
    </div>
  );
}

PlacesExplorer.displayName = 'PlacesExplorer';
export default PlacesExplorer;
