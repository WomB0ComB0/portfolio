'use client';

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
 * @file The /projects Index's one client island, composed from the shared kits: the FilterBar
 * (a sticky <search> with the search, the Kind chips and the Technology picker; on a phone the
 * search and a Filters button, the rest in a bottom sheet), the results header (the count, then
 * the applied kind and technologies as removable tokens), the status line, and the IndexTable
 * groups inside the hover preview, or the empty state that names what removed everything. The
 * rows are server-rendered markup it only filters and arranges.
 *
 * Its filters live in the URL through useUrlFilters (nuqs: history replace, shallow, no
 * scroll), so the server HTML of a shared link is already filtered, the chips and tokens are
 * links and the search is a GET form. The route has no loading.tsx (owner: "Drop it on both"),
 * so without JavaScript every row is in the first HTML and the links and the form still filter.
 * With JavaScript a chip, a tick or a token filters in place and rewrites the URL; typing
 * filters at once. The schema is built here from plain lookups (it holds functions).
 */

import { type ReactElement, type ReactNode, useMemo } from 'react';

import {
  FILTER_SCOPE_CLASS,
  FilterBar,
  RESULTS_HEAD_CLASS,
  useUrlFilters,
} from '@/components/console/filter-bar';
import { cn } from '@/lib/utils';
import {
  type ProjectFilterItem,
  type ProjectLookups,
  projectFilters,
} from '../_lib/project-filters';
import type { PreviewItem } from '../_lib/project-index';
import { ProjectGroups } from './project-groups';
import { LIST_CLASS } from './project-index-classes';
import { ProjectPreview } from './project-preview';

/** What the island needs of a row to filter, group and preview it, plus the row itself. */
export interface ProjectRowItem extends ProjectFilterItem {
  readonly id: string;
  readonly group: string;
  readonly groupLabel: string;
  readonly preview: PreviewItem;
  /** The <tr>, rendered on the server. */
  readonly row: ReactNode;
}

export interface ProjectsIndexProps {
  /** Every project, in page order. */
  readonly rows: readonly ProjectRowItem[];
  /** What the URL's filters resolve against: kinds, old categories, technologies. */
  readonly lookups: ProjectLookups;
}

/** The bar, the results header, the status line and the groups. */
export function ProjectsIndex({ rows, lookups }: ProjectsIndexProps): ReactElement {
  const schema = useMemo(() => projectFilters<ProjectRowItem>(lookups), [lookups]);
  const { model, results } = useUrlFilters(schema, rows);
  const previews = useMemo(
    () => Object.fromEntries(rows.map((row) => [row.id, row.preview])),
    [rows],
  );
  // Any filter or URL change hides the preview's card, even one that keeps every row.
  const resetOn = `${model.hrefFor({})}\n${results.map((row) => row.id).join(' ')}`;

  return (
    <div
      data-filter-scope=""
      data-projects-part="list"
      className={cn(LIST_CLASS, FILTER_SCOPE_CLASS)}
    >
      <FilterBar.Provider model={model}>
        <FilterBar.Root sticky>
          <FilterBar.Search />
          <FilterBar.Facets>
            <FilterBar.Chips facet="category" layout="scroll" />
            <FilterBar.Picker facet="tech" searchLabel="Filter technologies" />
          </FilterBar.Facets>
        </FilterBar.Root>
        <div className={RESULTS_HEAD_CLASS}>
          <FilterBar.Count />
          <FilterBar.Applied />
        </div>
        <FilterBar.Status />
        <FilterBar.Results>
          {results.length > 0 ? (
            <ProjectPreview items={previews} resetOn={resetOn}>
              <ProjectGroups items={results} />
            </ProjectPreview>
          ) : (
            <FilterBar.Empty />
          )}
        </FilterBar.Results>
      </FilterBar.Provider>
    </div>
  );
}
