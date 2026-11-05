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
 * @file The /projects filter island. The server passes every project; the search, category and
 * technology filters live in the URL (?q, ?category, ?tech), so a filtered view can be shared,
 * survives a reload and renders the same on the server as after hydration. Every matching project
 * renders at once: no pagination, so crawlers see every link and Back lands on the same card.
 */

import { Code2, FolderGit2, Search } from 'lucide-react';
import { parseAsString, throttle, useQueryStates } from 'nuqs';
import { type JSX, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { validateUserInput } from '@/utils';
import { PROJECT_GRID_CLASS, ProjectCard, type ProjectCardData } from './project-card';

/** The filter value that matches every project. */
export const ALL_FILTER = 'all';

/** The longest search the filter reads; longer input is cut. */
const SEARCH_MAX_LENGTH = 100;

/** At most one URL write per this many ms while typing; the list itself filters on every key. */
const SEARCH_URL_THROTTLE_MS = 300;

/** ?q, ?category and ?tech. A default value leaves its key out of the URL. */
const filterParsers = {
  q: parseAsString.withDefault(''),
  category: parseAsString.withDefault(ALL_FILTER),
  tech: parseAsString.withDefault(ALL_FILTER),
};

export interface ProjectFilters {
  readonly query: string;
  readonly category: string;
  readonly tech: string;
}

export interface ProjectFilterOptions {
  readonly categories: readonly string[];
  readonly technologies: readonly string[];
}

export interface ProjectsExplorerProps {
  projects: readonly ProjectCardData[];
}

const sortedUnique = (values: Iterable<string>): readonly string[] =>
  Array.from(new Set(values)).sort();

/** The categories and technologies the projects use, each sorted, for the filter menus. */
export function projectFilterOptions(projects: readonly ProjectCardData[]): ProjectFilterOptions {
  return {
    categories: sortedUnique(projects.map((project) => project.category)),
    technologies: sortedUnique(projects.flatMap((project) => project.technologies.filter(Boolean))),
  };
}

/** `value` when it is one of `options`; anything else, from a stale or edited URL, means all. */
const knownOrAll = (value: string, options: readonly string[]): string =>
  options.includes(value) ? value : ALL_FILTER;

/**
 * The projects that match every filter: the search (sanitised, case-insensitive) in the title or
 * description, the exact category, and the technology among the project's technologies.
 */
export function filterProjects(
  projects: readonly ProjectCardData[],
  { query, category, tech }: ProjectFilters,
): readonly ProjectCardData[] {
  const search = validateUserInput(query, SEARCH_MAX_LENGTH).toLowerCase();
  return projects.filter(
    (project) =>
      (category === ALL_FILTER || project.category === category) &&
      (tech === ALL_FILTER || project.technologies.includes(tech)) &&
      (search === '' ||
        project.title.toLowerCase().includes(search) ||
        project.description.toLowerCase().includes(search)),
  );
}

/** Shown in the grid's place when nothing matches, or when there are no projects at all. */
const ProjectsEmptyState = ({
  hasActiveFilters,
  onClear,
}: {
  hasActiveFilters: boolean;
  onClear: () => void;
}): JSX.Element => (
  <div className="flex flex-col items-center justify-center py-32 text-center">
    <div className="w-24 h-24 rounded-3xl bg-muted/10 flex items-center justify-center mb-6 animate-pulse">
      <Search aria-hidden="true" className="h-10 w-10 text-muted-foreground/50" />
    </div>
    <h3 className="text-xl font-semibold text-foreground mb-2">
      {hasActiveFilters ? 'No matches found' : 'No projects yet'}
    </h3>
    <p className="text-muted-foreground max-w-xs mx-auto">
      {hasActiveFilters
        ? 'Try adjusting your search or filters to find what you looking for.'
        : 'Check back soon for new projects!'}
    </p>
    {hasActiveFilters && (
      <Button
        variant="outline"
        onClick={onClear}
        className="mt-8 rounded-xl border-white/10 hover:bg-white/5"
      >
        Clear all filters
      </Button>
    )}
  </div>
);

/** The filter bar and every project that matches it. */
export function ProjectsExplorer({ projects }: ProjectsExplorerProps): JSX.Element {
  const [params, setParams] = useQueryStates(filterParsers, { history: 'replace', shallow: true });
  const options = useMemo(() => projectFilterOptions(projects), [projects]);

  const filters: ProjectFilters = {
    query: params.q,
    category: knownOrAll(params.category, options.categories),
    tech: knownOrAll(params.tech, options.technologies),
  };
  const filtered = filterProjects(projects, filters);
  const hasActiveFilters =
    filters.query !== '' || filters.category !== ALL_FILTER || filters.tech !== ALL_FILTER;

  const setSearch = (q: string) =>
    void setParams({ q }, { limitUrlUpdates: throttle(SEARCH_URL_THROTTLE_MS) });
  const setCategory = (category: string) => void setParams({ category });
  const setTech = (tech: string) => void setParams({ tech });
  const clearFilters = () => void setParams({ q: null, category: null, tech: null });

  return (
    <div className="space-y-16">
      <FilterBar
        searchQuery={filters.query}
        onSearchChange={setSearch}
        searchPlaceholder="Search projects..."
        filters={[
          {
            value: filters.category,
            onChange: setCategory,
            options: [...options.categories],
            placeholder: 'All Categories',
            icon: <FolderGit2 className="h-4 w-4" />,
          },
          {
            value: filters.tech,
            onChange: setTech,
            options: [...options.technologies],
            placeholder: 'All Technologies',
            icon: <Code2 className="h-4 w-4" />,
          },
        ]}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
        resultsCount={filtered.length}
        totalCount={projects.length}
        entityName="projects"
      />

      {filtered.length > 0 ? (
        <div className={PROJECT_GRID_CLASS}>
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <ProjectsEmptyState hasActiveFilters={hasActiveFilters} onClear={clearFilters} />
      )}
    </div>
  );
}
