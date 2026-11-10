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
 * The URL carries nothing else. The schema is a module constant: the client island imports it
 * and it never crosses the server/client boundary (it holds functions).
 */

import { defineFilters, type FilterSchema, type FilterState } from '@/lib/filters';
import {
  PLACE_CATEGORY_SLUGS,
  placeCategoryLabel,
  placeCategorySlug,
} from '@/lib/places/categories';
import type { PlaceItem } from '@/types/places';

export type PlaceFacet = 'category';
export type PlaceState = FilterState<PlaceFacet>;
export type PlaceSchema = FilterSchema<PlaceItem, PlaceFacet>;

export const PLACES_PATH = '/places';
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

/** The /places filter schema. */
export const placeFilters: PlaceSchema = defineFilters<PlaceItem, PlaceFacet>({
  path: PLACES_PATH,
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
});
