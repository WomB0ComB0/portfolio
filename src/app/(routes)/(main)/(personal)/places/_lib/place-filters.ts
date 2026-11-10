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
 * @file /places on the shared filter schema (src/lib/filters), pure and server-safe:
 * - ?category: one of the six categories at a time, as chips, always all six in a fixed A to Z
 *   order (a category with no place keeps its chip at 0). New links write the kebab slug
 *   (?category=tech-office); every old shared link still reads: the Studio label in any case
 *   (?category=Tech%20Office, Tech+Office, HACKATHON) and the slug. 'all', a blank or unknown
 *   value and anything over 100 characters show every place, as an unknown value always has.
 *   Like every value the kit reads (and ?q), it is read without the blanks around it, so the
 *   100 characters are counted after trimming: padding is never part of a value.
 * - ?q over each place's name and description (not its category: the chips do that), matched as
 *   a substring ignoring case, at most 100 characters.
 * The URL carries nothing else. /places/photos reads the very same URL (placePhotoFilters, built
 * from the same input on its own path), so the photos follow the same chips and search and the
 * "Places | Photos" links carry them both ways. The schemas are module constants: the client
 * islands import them and they never cross the server/client boundary (they hold functions).
 */

import {
  defineFilters,
  type FilterSchema,
  type FilterSchemaInput,
  type FilterState,
} from '@/lib/filters';
import {
  PLACE_CATEGORY_SLUGS,
  placeCategoryLabel,
  placeCategorySlug,
} from '@/lib/places/categories';
import type { PhotoPlace, PlaceItem } from '@/types/places';

export type PlaceFacet = 'category';
export type PlaceState = FilterState<PlaceFacet>;
export type PlaceSchema = FilterSchema<PlaceItem, PlaceFacet>;
export type PlacePhotoSchema = FilterSchema<PhotoPlace, PlaceFacet>;
/** What the filters read from a place: the same on /places and /places/photos. */
export type FilterablePlace = Pick<PlaceItem, 'id' | 'name' | 'description' | 'category'>;

export const PLACES_PATH = '/places';
/** The photos of the same past places, filtered by the same URL. */
export const PLACE_PHOTOS_PATH = '/places/photos';
/** The longest search read, as the old filter capped it. */
export const QUERY_MAX_LENGTH = 100;
/**
 * The longest ?category value read, once the kit has trimmed the blanks around it; the longest
 * label is 11 characters.
 */
export const FACET_VALUE_MAX_LENGTH = 100;
/** The old select's "every category" value. */
const ALL_CATEGORIES = 'all';

/**
 * ?category as a slug, from the value as the kit passes it (trimmed): a value over 100
 * characters, blank or 'all' is no filter; a category's label in any case, with spaces, plus
 * signs, underscores or hyphens, is its slug; anything else is null, which drops the value
 * (every place shows).
 *
 * @example
 * resolvePlaceCategory('Tech Office') // 'tech-office'
 * resolvePlaceCategory('Bogus') // null
 */
export function resolvePlaceCategory(raw: string): string | null {
  if (raw.length > FACET_VALUE_MAX_LENGTH) return null;
  const slug = placeCategorySlug(raw);
  if (slug === '' || slug === ALL_CATEGORIES) return null;
  return placeCategoryLabel(slug) === null ? null : slug;
}

/**
 * The places filter at `path`: ?q over the name and description, ?category as one of the six
 * chips. /places and /places/photos share it, so a link reads the same on either.
 */
export function placeFilterInput<T extends FilterablePlace>(
  path: string,
): FilterSchemaInput<T, PlaceFacet> {
  return {
    path,
    noun: { one: 'place', many: 'places' },
    search: {
      haystack: (place) => `${place.name} ${place.description}`,
      maxLength: QUERY_MAX_LENGTH,
    },
    facets: {
      category: {
        label: 'Category',
        valuesOf: (place) => [placeCategorySlug(place.category)],
        /** The Studio label for a slug; a slug no category has shows as it is. */
        labelOf: (slug) => placeCategoryLabel(slug) ?? slug,
        values: PLACE_CATEGORY_SLUGS,
        resolve: resolvePlaceCategory,
        scope: (labels) => `in ${labels.join(' or ')}`,
      },
    },
  };
}

/** What a link to either view reads from the FilterBar's model: the search and the category. */
interface ActiveFilters {
  readonly q: string;
  readonly category?: readonly string[];
}

/**
 * The places state out of the FilterBar's generic one, for a link to either view: the search
 * and the category, nothing else (a missing category is none chosen).
 *
 * @example
 * placeFilters.serialize(placeStateOf(model.active)) // '/places?category=hackathon&q=antler'
 */
export const placeStateOf = (active: ActiveFilters): PlaceState => ({
  q: active.q,
  category: active.category ?? [],
});

/** The /places filter schema. */
export const placeFilters: PlaceSchema = defineFilters(placeFilterInput<PlaceItem>(PLACES_PATH));

/** The /places/photos filter schema: the same URL, over the places that have photos. */
export const placePhotoFilters: PlacePhotoSchema = defineFilters(
  placeFilterInput<PhotoPlace>(PLACE_PHOTOS_PATH),
);
