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
 * @file The /projects filter schema on the shared filter schema (src/lib/filters): the part of
 * the filters the browser runs, pure and server-safe.
 * - ?category, the Kind: one at a time, as chips. The chips are the kinds the server chose
 *   (project-filters.ts) and the rest fold under Other (the /certifications recipe); a folded
 *   kind from a link shows in Other's place. It still reads every old shared link: a kind's
 *   slug, its label in any case, or a whole old free-text category, even one no project has any
 *   more (its first kind that is still known).
 * - ?tech, the Technology: several at once (OR within the facet, AND with the Kind), as
 *   repeated keys, so an old single ?tech=Python still parses; spellings fold by techKey.
 * - ?q over each project's search text.
 * A facet value longer than any real spelling is dropped before any pattern reads it.
 *
 * The client island imports this module, so it holds nothing only the server needs: the lookups
 * (and the chip-width estimate that picks the chips) are built in project-filters.ts and arrive
 * here as plain JSON. The schema holds functions, so it never crosses that boundary itself.
 */

import { defineFilters, type FilterSchema, ownValue } from '@/lib/filters';
import { kindSlug, kindsOf, PROJECT_NOUN, techKey } from './project-text';

export type ProjectFacet = 'category' | 'tech';
export type ProjectSchema<T extends ProjectFilterItem = ProjectFilterItem> = FilterSchema<
  T,
  ProjectFacet
>;

export const PROJECTS_PATH = '/projects';
const QUERY_MAX_LENGTH = 100;
/**
 * The longest ?category or ?tech value read; a longer one is dropped unread. The live data's
 * longest technology is 58 characters and its longest category 49 (a GET snapshot).
 */
const FACET_VALUE_MAX_LENGTH = 100;
export const OTHER_KIND = 'other';
const ALL_KIND = 'all';

/** What the schema reads of a row. */
export interface ProjectFilterItem {
  readonly kindSlugs: readonly string[];
  readonly techKeys: readonly string[];
  readonly haystack: string;
}

/** What the schema is built from: plain JSON, built on the server (project-filters.ts). */
export interface ProjectLookups {
  /** Every kind's label, by slug. */
  readonly kinds: Readonly<Record<string, string>>;
  /** The kinds with a chip, most used first (ties A to Z). */
  readonly kindOrder: readonly string[];
  /** The kinds under Other. */
  readonly folded: readonly string[];
  /** Every technology's label (its most used spelling), by key. */
  readonly techs: Readonly<Record<string, string>>;
}

/**
 * ?category as a kind, first match wins: too long, blank or 'all' is no filter; a known kind's
 * slug or label (any case); 'other' while Other exists; a whole old free-text category's first
 * kind that is still known (so a link made before a category was re-spelt keeps its kind);
 * else null, which drops the value (every project shows, as an unknown value always has).
 */
function resolveKind(raw: string, { kinds, folded }: ProjectLookups): string | null {
  if (raw.length > FACET_VALUE_MAX_LENGTH) return null;
  const slug = kindSlug(raw);
  if (slug === '' || slug === ALL_KIND) return null;
  if (ownValue(kinds, slug) !== undefined) return slug;
  if (slug === OTHER_KIND && folded.length > 0) return OTHER_KIND;
  const known = kindsOf(raw)
    .map(kindSlug)
    .find((each) => ownValue(kinds, each) !== undefined);
  return known ?? null;
}

/** ?tech as a technology's key: any spelling a project has; too long or unknown is null. */
function resolveTech(raw: string, { techs }: ProjectLookups): string | null {
  if (raw.length > FACET_VALUE_MAX_LENGTH) return null;
  const key = techKey(raw);
  return ownValue(techs, key) === undefined ? null : key;
}

/** The filter schema on a view's path, keeping that view in chip links, search and Clear. */
export function projectFilters<T extends ProjectFilterItem = ProjectFilterItem>(
  lookups: ProjectLookups,
  path = PROJECTS_PATH,
): ProjectSchema<T> {
  const folded = new Set(lookups.folded);
  return defineFilters<T, ProjectFacet>({
    path,
    noun: PROJECT_NOUN,
    search: { haystack: (item) => item.haystack, maxLength: QUERY_MAX_LENGTH },
    facets: {
      category: {
        label: 'Kind',
        /** A project with a folded kind is that kind and Other, so ?category=other keeps it. */
        valuesOf: (item) =>
          item.kindSlugs.some((slug) => folded.has(slug))
            ? [...item.kindSlugs, OTHER_KIND]
            : item.kindSlugs,
        /** 'Other', a kind's label, or the slug. */
        labelOf: (slug) =>
          slug === OTHER_KIND ? 'Other' : (ownValue(lookups.kinds, slug) ?? slug),
        values: [...lookups.kindOrder, ...(folded.size > 0 ? [OTHER_KIND] : [])],
        /** A folded kind from a link shows in Other's place, under its own name. */
        groupOf: (slug) => (folded.has(slug) ? OTHER_KIND : null),
        resolve: (raw) => resolveKind(raw, lookups),
        scope: (labels) => `in ${labels.join(' or ')}`,
      },
      tech: {
        label: 'Technology',
        multiple: true,
        valuesOf: (item) => item.techKeys,
        labelOf: (key) => ownValue(lookups.techs, key) ?? key,
        resolve: (raw) => resolveTech(raw, lookups),
        scope: (labels) => `with ${labels.join(' or ')}`,
      },
    },
  });
}
