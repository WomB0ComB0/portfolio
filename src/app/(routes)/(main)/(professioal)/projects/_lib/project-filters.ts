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
 * @file /projects filters, the server's side: buildProjectLookups turns the projects into the
 * plain-JSON lookups the filter schema reads (every kind and technology, labelled by its most
 * used spelling). It picks the Kind chips here: the most used kinds while they fit the bar's
 * widest row (kind-chip-budget.ts), the rest folded under Other. Pure and server-safe.
 *
 * Only the server imports this module (the page's index, project-index.ts), so the chip-width
 * estimate never reaches the browser. The client island imports the schema itself from
 * project-schema.ts, which this module re-exports for its server importers.
 */

import { kindChipCount } from './kind-chip-budget';
import { OTHER_KIND, type ProjectLookups } from './project-schema';
import { kindSlug, kindsOf, techKey } from './project-text';

export {
  OTHER_KIND,
  type ProjectFilterItem,
  type ProjectLookups,
  projectFilters,
} from './project-schema';

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
  const otherKind = Object.hasOwn(kinds, OTHER_KIND);
  const ranked = Object.keys(kinds)
    .filter((slug) => slug !== OTHER_KIND)
    .sort(
      (a, b) =>
        uses(kindTally.get(b)) - uses(kindTally.get(a)) ||
        (kinds[a] ?? a).localeCompare(kinds[b] ?? b),
    );
  // As many of the most used as fit the bar's widest row beside All and Other (every project
  // counted once under All, so its count is the number of projects).
  const chips = kindChipCount(
    ranked.map((slug) => ({ label: kinds[slug] ?? slug, uses: uses(kindTally.get(slug)) })),
    sources.length,
    otherKind,
  );
  return {
    kinds,
    kindOrder: ranked.slice(0, chips),
    folded: [...ranked.slice(chips), ...(otherKind ? [OTHER_KIND] : [])],
    techs: Object.fromEntries([...techTally].map(([key, tally]) => [key, mostUsed(tally)])),
  };
}
