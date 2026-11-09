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
 * @file A FilterBar provider over the synthetic projects schema, with its state in React (no
 * URL), for the parts' tests: every change goes through the schema's pure transitions, as
 * useUrlFilters and the Ledger's adapter do. Not a test file itself.
 */

import { type ReactNode, useState } from 'react';

import { buildFilterModel, FilterBar } from '@/components/console/filter-bar';
import type { FilterState } from '@/lib/filters';
import { PROJECTS, type Project, projects } from '../../filters/filters-fixture';

type State = FilterState<'category' | 'tech'>;

export interface HarnessProps {
  /** The URL the page starts from, e.g. '?category=tools'. */
  readonly initial?: string;
  /** What is filtered: the fixture's five projects unless a test needs other counts. */
  readonly items?: readonly Project[];
  readonly children: (results: readonly Project[]) => ReactNode;
}

/** Holds the filters in React state and provides the model built from them to its children. */
export function Harness({ initial = '', items = PROJECTS, children }: HarnessProps): ReactNode {
  const [state, setState] = useState<State>(() => projects.parse(initial));
  const [touched, setTouched] = useState(false);
  const change = (next: State): void => {
    setTouched(true);
    setState(next);
  };
  const active = { ...state, q: state.q.replaceAll(/\s+/g, ' ').trim() };
  const { model, results } = buildFilterModel({
    schema: projects,
    items,
    draft: state,
    active,
    touched,
    actions: {
      setQuery: (q) => change({ ...state, q }),
      submit: () => setTouched(true),
      choose: (key, slug) => change(projects.choose(state, key, slug)),
      toggle: (key, slug) => change(projects.toggle(state, key, slug)),
      clearAll: () => change(projects.empty()),
    },
  });
  return <FilterBar.Provider model={model}>{children(results)}</FilterBar.Provider>;
}

/** The results as a plain list, for reading what the filters kept. */
export function ResultList({ results }: { readonly results: readonly Project[] }): ReactNode {
  return (
    <FilterBar.Results>
      {results.length > 0 ? (
        <ul aria-label="Results">
          {results.map((project) => (
            <li key={project.id}>{project.title}</li>
          ))}
        </ul>
      ) : (
        <FilterBar.Empty />
      )}
    </FilterBar.Results>
  );
}

export interface FullBarProps {
  /** The URL the page starts from, e.g. '?category=tools'. */
  readonly initial?: string;
  /** How many Technology options show before Show all; the Picker's own default when unset. */
  readonly pickerLimit?: number;
}

/** The whole family, composed as /projects will compose it. */
export function FullBar({ initial = '', pickerLimit }: FullBarProps): ReactNode {
  return (
    <Harness initial={initial}>
      {(results) => (
        <>
          <FilterBar.Root sticky>
            <FilterBar.Search />
            <FilterBar.Facets>
              <FilterBar.Chips facet="category" />
              <FilterBar.Picker
                facet="tech"
                searchLabel="Filter technologies"
                limit={pickerLimit}
              />
            </FilterBar.Facets>
          </FilterBar.Root>
          <div>
            <FilterBar.Count />
            <FilterBar.Applied />
          </div>
          <FilterBar.Status />
          <ResultList results={results} />
        </>
      )}
    </Harness>
  );
}
