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
 * @file The six place categories, from one source: the Effect PlaceSchema decodes exactly these,
 * and the /places chips list them. The Studio schema (src/sanity/schemaTypes/place.ts) keeps its
 * own copy, because changing it needs a Studio deploy; tests/unit/places/place-categories.test.ts
 * checks the two match. Each category has a kebab slug for the URL (?category=tech-office). Pure
 * and server-safe: the server schema and the client island both import it.
 */

/** The categories as Studio stores them, in Studio's order. */
export const PLACE_CATEGORIES = [
  'Hackathon',
  'Conference',
  'Research',
  'Tech Office',
  'Mentorship',
  'Event',
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

/**
 * A category's URL slug: lower case, each run of spaces, plus signs, underscores or hyphens one
 * hyphen, none at either end. Old links fold to the same slug whatever form they took.
 *
 * @example
 * placeCategorySlug('Tech Office') // 'tech-office'
 * placeCategorySlug('Tech+Office') // 'tech-office'
 */
export const placeCategorySlug = (label: string): string =>
  label
    .toLowerCase()
    .replaceAll(/[\s+_-]+/gu, '-')
    .replaceAll(/^-+|-+$/gu, '');

/** Each category's label by its slug. A Map, so a URL value never reads Object.prototype. */
const LABEL_BY_SLUG: ReadonlyMap<string, PlaceCategory> = new Map(
  PLACE_CATEGORIES.map((label) => [placeCategorySlug(label), label] as const),
);

/** The slugs A to Z by label: the chips' fixed order, which never drifts with the counts. */
export const PLACE_CATEGORY_SLUGS: readonly string[] = [...PLACE_CATEGORIES]
  .sort((a, b) => a.localeCompare(b, 'en'))
  .map(placeCategorySlug);

/** The category a slug names, or null for any other value. */
export const placeCategoryLabel = (slug: string): PlaceCategory | null =>
  LABEL_BY_SLUG.get(slug) ?? null;
