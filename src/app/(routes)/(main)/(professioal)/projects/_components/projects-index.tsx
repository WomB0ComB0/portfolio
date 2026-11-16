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
 * @file The /projects page's one client island, composed from the shared kits: the FilterBar
 * (unchanged: a sticky <search> with the search, the Kind chips and the Technology picker; on a
 * phone the search and a Filters button, the rest in a bottom sheet), the results header once a
 * filter narrows the list (the count, then the applied kind and technologies as removable
 * tokens; unfiltered, the header's byline already says the count), the 'In this issue' jump
 * links and the Stories | Index | Screens switch (on a phone the links on one row and the switch
 * under them, so the work starts on the first screen; Screens has no jump links, so its own
 * Wall / Grid row takes the switch at its end instead of a row of its own), the status line, and
 * the view the URL names:
 * - Stories (the default): Folio chapters with a lead story each (project-stories.tsx).
 * - Index (?view=index): a contents page in words, by year (project-contents.tsx).
 * - Screens (?view=screens): every project's images, in the /places photo parts
 *   (project-screens.tsx).
 * Or the empty state, which names what removed everything.
 *
 * Its filters live in the URL through useUrlFilters (nuqs: history replace, shallow, no
 * scroll), so the server HTML of a shared link is already filtered and laid out, and the filters
 * apply to every view. The view comes from the server (the page reads ?view=); the filter schema
 * is built on the view's own path, so a chip, a token or Clear keeps the view, and a hidden field
 * carries it through the search form without JavaScript. The view links are built here from the
 * bar's live state, so they carry the filters as they are now.
 */

import Link from 'next/link';
import { type ReactElement, type ReactNode, useMemo } from 'react';

import {
  FILTER_SCOPE_CLASS,
  FilterBar,
  RESULTS_HEAD_CLASS,
  useFilterBar,
  useUrlFilters,
} from '@/components/console/filter-bar';
import { ChapterJumps } from '@/components/console/folio/chapter-jumps';
import { viewHref, viewLinks } from '@/components/console/folio/view-href';
import { ViewSwitch } from '@/components/console/folio/view-switch';
import { cn } from '@/lib/utils';
import { storyChapters, yearChapters } from '../_lib/project-chapters';
import type { ProjectEntry } from '../_lib/project-index';
import { type ProjectLookups, projectFilters } from '../_lib/project-schema';
import { PROJECT_NOUN } from '../_lib/project-text';
import {
  DEFAULT_PROJECT_VIEW,
  PROJECT_VIEWS,
  type ProjectView,
  projectViewPath,
  VIEW_PARAM,
} from '../_lib/project-views';
import { ProjectContents } from './project-contents';
import { ProjectScreens } from './project-screens';
import { ProjectStories } from './project-stories';

/** The island's root: the bar, the results header, the views row, then the view. */
const LIST_CLASS = 'flex flex-col gap-4 @min-[48rem]/page:gap-5';
/**
 * The jump links and the switch: one row on a wide page; on a phone the links take one row of
 * their own (their 'In this issue' label, which the nav's name already says, gives way) and the
 * switch sits under them, so the work starts within the first screen.
 */
const VIEWS_ROW_CLASS = 'flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-2';
/**
 * On a phone the five chapter links fit one row at 375 and 390 (312px of the 343 a 375 phone
 * has): 4px of padding a side (the kit's underline, its ::before, follows it in) and a tighter
 * gap before each count, so a label sits closer to its count than to the next link; the list is
 * pulled out by the padding so the first label sits on the page's edge. They stay 44px tall
 * under a finger.
 */
const JUMPS_CLASS = [
  '@max-[40rem]/page:[&>span]:hidden @max-[40rem]/page:[&_ol]:-ms-1',
  '@max-[40rem]/page:[&_a]:gap-1 @max-[40rem]/page:[&_a]:px-1 @max-[40rem]/page:[&_a]:before:inset-x-1',
].join(' ');
/** At the row's end on a wide page; on a phone, under the links, on the same left edge. */
const SWITCH_CLASS = 'ms-auto @max-[40rem]/page:ms-0';
/**
 * The results start a long pause under the switch on a wide page, as the chapters are set wide.
 * Not on Screens with images: its own row (Wall / Grid, its count and the switch) opens them.
 */
const RESULTS_CLASS = '@min-[40rem]/page:mt-[clamp(1rem,0.5rem+2vw,2.5rem)]';
const EMPTY_LINK_CLASS = 'text-brand-ink underline underline-offset-4';
const VIEW_OPTIONS = { defaultView: DEFAULT_PROJECT_VIEW, param: VIEW_PARAM } as const;

export interface ProjectsIndexProps {
  /** Every project, in page order. */
  readonly entries: readonly ProjectEntry[];
  /** What the URL's filters resolve against: kinds, old categories, technologies. */
  readonly lookups: ProjectLookups;
  /** The view the URL names. */
  readonly view: ProjectView;
}

/** Whether the view is Screens with images to show, whose own row then carries the switch. */
const screensWithImages = (view: ProjectView, results: readonly ProjectEntry[]): boolean =>
  view === 'screens' && results.some((entry) => entry.images.length > 0);

/** The Stories | Index | Screens switch, its links built from the bar's live state. */
function ProjectViewSwitch({ view }: { readonly view: ProjectView }): ReactElement {
  const { model } = useFilterBar();
  const views = viewLinks(model.hrefFor({}), PROJECT_VIEWS, VIEW_OPTIONS);
  return <ViewSwitch label="Project views" current={view} views={views} className={SWITCH_CLASS} />;
}

/** The jump links (Stories and Index) and the view switch. */
function ViewsRow({
  view,
  results,
}: {
  readonly view: ProjectView;
  readonly results: readonly ProjectEntry[];
}): ReactElement {
  const chapters = view === 'index' ? yearChapters(results) : storyChapters(results);
  return (
    <div className={VIEWS_ROW_CLASS} data-projects-part="views">
      {view === 'screens' ? null : (
        <ChapterJumps
          chapters={chapters.map(({ id, label, items }) => ({ id, label, count: items.length }))}
          noun={PROJECT_NOUN}
          className={JUMPS_CLASS}
        />
      )}
      <ProjectViewSwitch view={view} />
    </div>
  );
}

/**
 * The results header, once a search or a filter narrows the list: the count ('8 of 32
 * projects', its figure live) and the applied filters. Unfiltered, the header's byline already
 * says how many projects there are, so the page says it once. FilterBar.Status, always present,
 * still announces every change.
 */
function ResultsHead(): ReactElement | null {
  const { model } = useFilterBar();
  if (!model.filtered) return null;
  return (
    <div className={RESULTS_HEAD_CLASS} data-projects-part="results-head">
      <FilterBar.Count />
      <FilterBar.Applied />
    </div>
  );
}

/** Screens with no image left: say so, and point to the same filters in Stories. */
function NoScreens(): ReactElement {
  const { model } = useFilterBar();
  return (
    <FilterBar.Empty title="No images match">
      {' '}
      Projects without images are in{' '}
      <Link
        href={viewHref(model.hrefFor({}), DEFAULT_PROJECT_VIEW, VIEW_OPTIONS)}
        className={EMPTY_LINK_CLASS}
      >
        the stories
      </Link>
      .
    </FilterBar.Empty>
  );
}

/** The view the URL names, over the projects the filters keep. */
function ProjectsView({
  view,
  results,
  switcher,
}: {
  readonly view: ProjectView;
  readonly results: readonly ProjectEntry[];
  /** The view switch, for Screens' own row. */
  readonly switcher: ReactNode;
}): ReactElement {
  if (results.length === 0) return <FilterBar.Empty />;
  if (view === 'index') return <ProjectContents entries={results} />;
  if (view === 'screens') {
    return screensWithImages(view, results) ? (
      <ProjectScreens entries={results} views={switcher} />
    ) : (
      <NoScreens />
    );
  }
  return <ProjectStories entries={results} />;
}

/** The bar, the results header, the views row, the status line and the view. */
export function ProjectsIndex({ entries, lookups, view }: ProjectsIndexProps): ReactElement {
  const path = projectViewPath(view);
  const schema = useMemo(() => projectFilters<ProjectEntry>(lookups, path), [lookups, path]);
  const { model, results } = useUrlFilters(schema, entries);
  const ownRow = screensWithImages(view, results);

  return (
    <div
      data-filter-scope=""
      data-projects-part="list"
      data-projects-view={view}
      className={cn(LIST_CLASS, FILTER_SCOPE_CLASS)}
    >
      <FilterBar.Provider model={model}>
        <FilterBar.Root sticky>
          <FilterBar.Search />
          <FilterBar.Facets>
            <FilterBar.Chips facet="category" layout="scroll" />
            <FilterBar.Picker facet="tech" searchLabel="Filter technologies" />
          </FilterBar.Facets>
          {view === DEFAULT_PROJECT_VIEW ? null : (
            <input type="hidden" name={VIEW_PARAM} value={view} />
          )}
        </FilterBar.Root>
        <ResultsHead />
        {ownRow ? null : <ViewsRow view={view} results={results} />}
        <FilterBar.Status />
        <FilterBar.Results className={ownRow ? undefined : RESULTS_CLASS}>
          <ProjectsView
            view={view}
            results={results}
            switcher={<ProjectViewSwitch view={view} />}
          />
        </FilterBar.Results>
      </FilterBar.Provider>
    </div>
  );
}
