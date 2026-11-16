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
 * @file The page's one client island, composed from the shared kits: the FilterBar (a sticky
 * <search> with the search and the issuer chips; on a phone the search and a Filters button, the
 * chips in a bottom sheet), the results head once a filter narrows the list (the count, then the
 * applied issuer and skill as removable tokens; unfiltered, the header's byline is the one
 * count), the status line, and the results: the year jumps and the Folio record of the
 * certificates the filters keep (record-years.tsx), or the empty state that names what removed
 * everything. The record is drawn from the certificates' data with server-safe parts, so the
 * server HTML holds every certificate.
 *
 * Its filters come from the URL through the Ledger's own sync (use-ledger-filters.ts) behind an
 * adapter (use-ledger-model.ts), so the server HTML of a shared link is already filtered, the
 * chips and tokens are links and the search is a GET form. The route has no loading.tsx (owner
 * decision), so without JavaScript the filtered record shows as it arrives, and the links and the
 * form still filter. With JavaScript a chip or a token filters in place (crossfading the results
 * where motion is welcome) and rewrites the URL with history.replaceState; typing filters at once.
 * A filter regroups what it keeps: a busy year it thins to four or fewer is set large.
 */

import { type ReactElement, useMemo } from 'react';

import { FILTER_SCOPE_CLASS, FilterBar, RESULTS_HEAD_CLASS } from '@/components/console/filter-bar';
import { ChapterJumps } from '@/components/console/folio';
import { IndexAnnouncer } from '@/components/console/index-table';
import { cn } from '@/lib/utils';
import { CERTIFICATION_NOUN } from '../_lib/certification-filters';
import type { LedgerFilters } from '../_lib/filters';
import type { IssuerChip, LedgerEntry, LedgerIndex } from '../_lib/ledger';
import { buildRecord } from '../_lib/record';
import { leadSkillFirst } from '../_lib/skills';
import { JUMPS_UNDER_COUNT_CLASS, LIST_CLASS, RECORD_CLASS } from './record-classes';
import { RecordYears } from './record-years';
import { useLedgerModel } from './use-ledger-model';

/**
 * The kept certificates with the ?skill filter's skill first in each one's list, so the skills
 * line (three at most) always shows why a certificate is there. New objects; the rows are
 * untouched.
 */
function withSkillFirst(
  entries: readonly LedgerEntry[],
  skill: string | null,
): readonly LedgerEntry[] {
  if (!skill) return entries;
  return entries.map((entry) => ({ ...entry, skills: leadSkillFirst(entry.skills, skill) }));
}

export interface LedgerExplorerProps {
  /** Every certificate, newest first. */
  readonly rows: readonly LedgerEntry[];
  readonly chips: readonly IssuerChip[];
  readonly other: IssuerChip | null;
  /** The lookups the URL's filters resolve against: families, raw issuers, skills. */
  readonly index: LedgerIndex;
  /** The server's reading of the URL, for where no router reports search params. */
  readonly initial: LedgerFilters;
  /** A chapter (Featured) already opens the page above the bar, so the first year steps down. */
  readonly leadTaken?: boolean;
}

/** The bar, the results head, the status line and the record. */
export function LedgerExplorer({
  rows,
  chips,
  other,
  index,
  initial,
  leadTaken = false,
}: LedgerExplorerProps): ReactElement {
  const lookups = useMemo(() => ({ chips, other, index }), [chips, other, index]);
  const { model, results } = useLedgerModel(rows, lookups, initial);
  const chapters = buildRecord(withSkillFirst(results, model.active.skill?.[0] ?? null));

  return (
    <div
      data-filter-scope=""
      data-ledger-part="list"
      className={cn(LIST_CLASS, FILTER_SCOPE_CLASS)}
    >
      <FilterBar.Provider model={model}>
        <FilterBar.Root sticky>
          <FilterBar.Search />
          <FilterBar.Facets>
            <FilterBar.Chips facet="issuer" />
          </FilterBar.Facets>
        </FilterBar.Root>
        {/* The header's byline already counts every certificate: say it again only once a filter narrows them. */}
        {model.filtered ? (
          <div className={RESULTS_HEAD_CLASS}>
            <FilterBar.Count />
            <FilterBar.Applied />
          </div>
        ) : null}
        <FilterBar.Status />
        <FilterBar.Results>
          {results.length > 0 ? (
            <>
              {/* With the results, so they change with them (a crossfade under a chip). */}
              <ChapterJumps
                label="By year"
                noun={CERTIFICATION_NOUN}
                className={model.filtered ? JUMPS_UNDER_COUNT_CLASS : undefined}
                chapters={chapters.map(({ id, year, count }) => ({ id, label: year, count }))}
              />
              <div data-record="" className={RECORD_CLASS}>
                <RecordYears chapters={chapters} offset={leadTaken ? 1 : 0} />
              </div>
            </>
          ) : (
            <FilterBar.Empty />
          )}
        </FilterBar.Results>
        <IndexAnnouncer />
      </FilterBar.Provider>
    </div>
  );
}
