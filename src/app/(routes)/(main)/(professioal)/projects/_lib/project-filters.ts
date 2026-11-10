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
 * @file /projects on the shared filter schema (src/lib/filters), pure and server-safe:
 * - ?category, the Kind: one at a time, as chips. The most used kinds get a chip and the rest
 *   fold under Other (the /certifications recipe). It still reads every old shared link: a
 *   kind's slug, its label in any case, or a whole old free-text category, even one no project
 *   has any more (its first kind that is still known).
 * - ?tech, the Technology: several at once (OR within the facet, AND with the Kind), as
 *   repeated keys, so an old single ?tech=Python still parses; spellings fold by techKey.
 * - ?q over each project's search text.
 * A facet value longer than any real spelling is dropped before any pattern reads it.
 * The lookups are plain JSON built on the server from the projects; the client island builds
 * the schema from them (the schema holds functions, so it never crosses that boundary).
 */

import { defineFilters, type FilterSchema, type FilterState, ownValue } from '@/lib/filters';
import { kindSlug, kindsOf, PROJECT_NOUN, techKey } from './project-text';

export type ProjectFacet = 'category' | 'tech';
export type ProjectState = FilterState<ProjectFacet>;
export type ProjectSchema<T extends ProjectFilterItem = ProjectFilterItem> = FilterSchema<
  T,
  ProjectFacet
>;

export const PROJECTS_PATH = '/projects';
export const QUERY_MAX_LENGTH = 100;
/**
 * The longest ?category or ?tech value read; a longer one is dropped unread. The live data's
 * longest technology is 58 characters and its longest category 49 (a GET snapshot).
 */
export const FACET_VALUE_MAX_LENGTH = 100;
/**
 * Kinds with a chip of their own. Five, so every chip (Other, the biggest group, included)
 * fits the bar's one line at 1440 with the live kinds; the rest fold under Other.
 */
export const MAX_KIND_CHIPS = 5;
export const OTHER_KIND = 'other';
const ALL_KIND = 'all';

/** What the schema reads of a row. */
export interface ProjectFilterItem {
  readonly kindSlugs: readonly string[];
  readonly techKeys: readonly string[];
  readonly haystack: string;
}

/** What the schema is built from: plain JSON, built on the server. */
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

/** What the lookups are built from: each project's category and technologies. */
export interface LookupSource {
  readonly category: string;
  readonly technologies: readonly string[];
}

/** Adds one use of `label` under `key`. */
function countUse(tally: Map<string, Map<string, number>>, key: string, label: string): void {
  const spellings = tally.get(key) ?? new Map<string, number>();
  spellings.set(label, (spellings.get(label) ?? 0) + 1);
  tally.set(key, spellings);
}

/** The most used spelling; a tie goes to the capitalised one, then A to Z. */
const mostUsed = (spellings: ReadonlyMap<string, number>): string =>
  [...spellings]
    .sort(([a, useA], [b, useB]) => useB - useA || a.localeCompare(b, 'en', { caseFirst: 'upper' }))
    .map(([label]) => label)[0] ?? '';

const uses = (spellings: ReadonlyMap<string, number> | undefined): number =>
  [...(spellings?.values() ?? [])].reduce((sum, count) => sum + count, 0);

/** The lookups for these projects: kinds, the chips and Other, technologies. */
export function buildProjectLookups(sources: readonly LookupSource[]): ProjectLookups {
  const kindTally = new Map<string, Map<string, number>>();
  const techTally = new Map<string, Map<string, number>>();
  for (const { category, technologies } of sources) {
    for (const label of kindsOf(category)) countUse(kindTally, kindSlug(label), label);
    for (const tech of technologies) {
      const key = techKey(tech);
      if (key !== '') countUse(techTally, key, tech.trim());
    }
  }
  const kinds = Object.fromEntries([...kindTally].map(([slug, tally]) => [slug, mostUsed(tally)]));
  // A kind literally called "Other" is folded too, so it never stands beside the Other chip.
  const ranked = Object.keys(kinds)
    .filter((slug) => slug !== OTHER_KIND)
    .sort(
      (a, b) =>
        uses(kindTally.get(b)) - uses(kindTally.get(a)) ||
        (kinds[a] ?? a).localeCompare(kinds[b] ?? b),
    );
  return {
    kinds,
    kindOrder: ranked.slice(0, MAX_KIND_CHIPS),
    folded: [
      ...ranked.slice(MAX_KIND_CHIPS),
      ...(Object.hasOwn(kinds, OTHER_KIND) ? [OTHER_KIND] : []),
    ],
    techs: Object.fromEntries([...techTally].map(([key, tally]) => [key, mostUsed(tally)])),
  };
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

/** The /projects filter schema for these lookups, over any rows that carry a project's fields. */
export function projectFilters<T extends ProjectFilterItem = ProjectFilterItem>(
  lookups: ProjectLookups,
): ProjectSchema<T> {
  const folded = new Set(lookups.folded);
  return defineFilters<T, ProjectFacet>({
    path: PROJECTS_PATH,
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
