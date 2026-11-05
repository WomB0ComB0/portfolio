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

import { Building2 } from 'lucide-react';
import { parseAsString, throttle, useQueryStates } from 'nuqs';
import { type JSX, useMemo } from 'react';
import { FiMapPin } from 'react-icons/fi';
import { MagicCard } from '@/components/magicui/magic-card';
import { Card, CardContent } from '@/components/ui/card';
import { FilterBar } from '@/components/ui/filter-bar';
import { useDebounce } from '@/hooks/use-debounce';
import type { PlaceItem } from '@/types/places';
import { validateUserInput } from '@/utils/security/xss';
import { GoogleMaps } from './map';
import { PlaceCard } from './place-card';

/** The category select's "every category" value, which leaves the URL without `category`. */
const ALL_CATEGORIES = 'all';
/** How long typing settles before the list and map filter, and the longest the URL lags behind. */
const SEARCH_SETTLE_MS = 300;
/** The longest search the filter reads. */
const MAX_QUERY_LENGTH = 100;
/** Same classes as PlacesPageSkeleton's grid, so the cards land where the skeleton's were. */
const PLACE_GRID_CLASS =
  'grid gap-6 justify-center grid-cols-[repeat(auto-fit,minmax(220px,280px))]';

/**
 * The filters, in the URL so a filtered list can be shared and Back returns to it. Each change
 * replaces the history entry, and stays shallow: the server already sent every place.
 */
const FILTER_PARSERS = {
  q: parseAsString.withDefault(''),
  category: parseAsString.withDefault(ALL_CATEGORIES),
};
const FILTER_OPTIONS = { history: 'replace', shallow: true } as const;
const SEARCH_UPDATE_OPTIONS = { limitUrlUpdates: throttle(SEARCH_SETTLE_MS) } as const;

/** Each category once, sorted. */
const categoriesOf = (places: readonly PlaceItem[]): string[] =>
  Array.from(new Set(places.map((place) => place.category))).sort();

/** The places in `category` (or all) whose name or description contains `query`. */
function filterPlaces(places: readonly PlaceItem[], category: string, query: string): PlaceItem[] {
  const sanitizedQuery = validateUserInput(query, MAX_QUERY_LENGTH).toLowerCase();
  return places.filter((place) => {
    const matchesCategory = category === ALL_CATEGORIES || place.category === category;
    const matchesSearch =
      sanitizedQuery === '' ||
      place.name.toLowerCase().includes(sanitizedQuery) ||
      place.description.toLowerCase().includes(sanitizedQuery);
    return matchesCategory && matchesSearch;
  });
}

/** Stands in for the grid when no place matches (or there are none). */
const NoPlaces = (): JSX.Element => (
  <MagicCard className="backdrop-blur-sm border-border/50">
    <CardContent className="py-20">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-muted/50">
          <FiMapPin className="text-3xl text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <p className="text-foreground font-medium">No places found</p>
          <p className="text-muted-foreground text-sm">
            There are currently no locations to display.
          </p>
        </div>
      </div>
    </CardContent>
  </MagicCard>
);

interface PlacesExplorerProps {
  /** Every place, with photo URLs built on the server. */
  places: readonly PlaceItem[];
}

/**
 * The places list's interactive part: the search and category filters (kept in the URL as `q`
 * and `category`), the map, and every matching place's card. A category that no place has counts
 * as all of them.
 */
export function PlacesExplorer({ places }: PlacesExplorerProps): JSX.Element {
  const [{ q, category }, setFilters] = useQueryStates(FILTER_PARSERS, FILTER_OPTIONS);
  const debouncedQuery = useDebounce(q, SEARCH_SETTLE_MS);

  const categories = useMemo(() => categoriesOf(places), [places]);
  const activeCategory = categories.includes(category) ? category : ALL_CATEGORIES;

  const filteredPlaces = useMemo(
    () => filterPlaces(places, activeCategory, debouncedQuery),
    [places, activeCategory, debouncedQuery],
  );

  const hasActiveFilters = q !== '' || activeCategory !== ALL_CATEGORIES;

  return (
    <>
      <div className="w-full max-w-7xl mx-auto">
        <FilterBar
          searchQuery={q}
          onSearchChange={(value) => void setFilters({ q: value }, SEARCH_UPDATE_OPTIONS)}
          searchPlaceholder="Search places..."
          filters={[
            {
              value: activeCategory,
              onChange: (value) => void setFilters({ category: value }),
              options: categories,
              placeholder: 'All Categories',
              icon: <Building2 className="h-4 w-4" />,
            },
          ]}
          onClear={() => void setFilters({ q: null, category: null })}
          hasActiveFilters={hasActiveFilters}
          resultsCount={filteredPlaces.length}
          totalCount={places.length}
          entityName="places"
        />
      </div>

      <div className="w-full max-w-7xl mx-auto">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 overflow-hidden shadow-xl rounded-2xl">
          <CardContent className="p-0">
            <div className="w-full h-[400px] md:h-[500px] relative">
              <GoogleMaps placesToDisplay={filteredPlaces} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="w-full max-w-7xl mx-auto">
        {filteredPlaces.length > 0 ? (
          <div className={PLACE_GRID_CLASS}>
            {filteredPlaces.map((place) => (
              <div key={place.id} className="h-full w-full">
                <PlaceCard place={place} />
              </div>
            ))}
          </div>
        ) : (
          <NoPlaces />
        )}
      </div>
    </>
  );
}

PlacesExplorer.displayName = 'PlacesExplorer';
export default PlacesExplorer;
