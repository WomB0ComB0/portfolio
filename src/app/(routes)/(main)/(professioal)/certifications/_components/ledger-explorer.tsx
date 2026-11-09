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
 * @file The Ledger's one client island, composed from the shared kits: the FilterBar (a sticky
 * <search> with the search and the issuer chips; on a phone the search and a Filters button, the
 * chips in a bottom sheet), the results header (the count, then the applied issuer and skill as
 * removable tokens), the status line, and the IndexTable year groups, or the empty state that
 * names what removed everything. The rows are server-rendered markup it only arranges.
 *
 * Its filters come from the URL through the Ledger's own sync (use-ledger-filters.ts) behind an
 * adapter (use-ledger-model.ts), so the server HTML of a shared link is already filtered, the
 * chips and tokens are links and the search is a GET form. The route has no loading.tsx (owner
 * decision), so without JavaScript the filtered rows show as they arrive, and the links and the
 * form still filter. With JavaScript a chip or a token filters in place (crossfading the results
 * where motion is welcome) and rewrites the URL with history.replaceState; typing filters at once.
 */

import { type ReactElement, useMemo } from 'react';

import { FILTER_SCOPE_CLASS, FilterBar, RESULTS_HEAD_CLASS } from '@/components/console/filter-bar';
import { IndexAnnouncer } from '@/components/console/index-table';
import { cn } from '@/lib/utils';
import type { LedgerFilters } from '../_lib/filters';
import type { IssuerChip, LedgerIndex } from '../_lib/ledger';
import { LIST_CLASS } from './ledger-classes';
import { type LedgerRowItem, YearTables } from './ledger-years';
import { useLedgerModel } from './use-ledger-model';

export type { LedgerRowItem } from './ledger-years';

export interface LedgerExplorerProps {
  /** Every certificate, newest first. */
  readonly rows: readonly LedgerRowItem[];
  readonly chips: readonly IssuerChip[];
  readonly other: IssuerChip | null;
  /** The lookups the URL's filters resolve against: families, raw issuers, skills. */
  readonly index: LedgerIndex;
  /** The server's reading of the URL, for where no router reports search params. */
  readonly initial: LedgerFilters;
}

/** The bar, the results header, the status line and the year tables. */
export function LedgerExplorer({
  rows,
  chips,
  other,
  index,
  initial,
}: LedgerExplorerProps): ReactElement {
  const lookups = useMemo(() => ({ chips, other, index }), [chips, other, index]);
  const { model, results } = useLedgerModel(rows, lookups, initial);

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
        <div className={RESULTS_HEAD_CLASS}>
          <FilterBar.Count />
          <FilterBar.Applied />
        </div>
        <FilterBar.Status />
        <FilterBar.Results>
          {results.length > 0 ? <YearTables items={results} /> : <FilterBar.Empty />}
        </FilterBar.Results>
        <IndexAnnouncer />
      </FilterBar.Provider>
    </div>
  );
}
