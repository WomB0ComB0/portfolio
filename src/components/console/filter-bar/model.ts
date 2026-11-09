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
 * @file The FilterModel: everything the FilterBar parts read, and nothing else. Any source can
 * fill it: useUrlFilters (nuqs) for /projects and /places, or the Ledger's own URL sync on
 * /certifications through its adapter. No directive; buildFilterModel is pure.
 */

import type { FacetOptions, FilterPatch, FilterSchema, FilterState, Noun } from '@/lib/filters';

/** A facet as the parts show it. */
export interface FilterFacetView {
  readonly key: string;
  /** "Issuer", "Technology". */
  readonly label: string;
  readonly multiple: boolean;
}

/** The setters a model's source supplies. Typing calls setQuery; the rest are discrete changes. */
export interface FilterActions<K extends string> {
  readonly setQuery: (q: string) => void;
  /** The search form's submit: write ?q now. */
  readonly submit: () => void;
  readonly choose: (key: K, slug: string | null) => void;
  readonly toggle: (key: K, slug: string) => void;
  readonly clearAll: () => void;
}

export interface FilterModel {
  readonly path: string;
  readonly noun: Noun;
  readonly maxLength: number;
  readonly facets: readonly FilterFacetView[];
  /** What the controls show: the search as typed. */
  readonly draft: FilterState<string>;
  /** What filters the list: the search normalised (and deferred while typing). */
  readonly active: FilterState<string>;
  /** Per facet: its options with disjunctive counts, and the All count. */
  readonly options: Readonly<Record<string, FacetOptions>>;
  readonly shown: number;
  readonly total: number;
  /** Whether any filter narrows the list. */
  readonly filtered: boolean;
  /** The status line: quiet on a first load, then the count. */
  readonly status: string;
  /** What the empty state says removed everything. */
  readonly emptySentence: string;
  readonly setQuery: (q: string) => void;
  readonly submit: () => void;
  readonly choose: (key: string, slug: string | null) => void;
  readonly toggle: (key: string, slug: string) => void;
  readonly clearAll: () => void;
  /** The page's URL with these changes on the current filters. */
  readonly hrefFor: (patch: FilterPatch<string>) => string;
}

export interface BuildFilterModelInput<T, K extends string> {
  readonly schema: FilterSchema<T, K>;
  readonly items: readonly T[];
  readonly draft: FilterState<K>;
  readonly active: FilterState<K>;
  /** Whether the visitor changed a filter on this page. */
  readonly touched: boolean;
  readonly actions: FilterActions<K>;
  /** How links are written, where a page keeps its own URL format; the schema's by default. */
  readonly hrefFor?: (patch: FilterPatch<K>) => string;
}

export interface BuiltFilterModel<T> {
  readonly model: FilterModel;
  /** The items the active filters keep, in their order. */
  readonly results: T[];
}

/** A model, and the items it keeps, from a schema, its items and its state. */
export function buildFilterModel<T, K extends string>({
  schema,
  items,
  draft,
  active,
  touched,
  actions,
  hrefFor,
}: BuildFilterModelInput<T, K>): BuiltFilterModel<T> {
  const results = schema.filter(items, active);
  const linkState = { ...draft, q: active.q };
  const model: FilterModel = {
    path: schema.path,
    noun: schema.noun,
    maxLength: schema.maxLength,
    facets: schema.keys.map((key) => ({
      key,
      label: schema.facets[key].label,
      multiple: schema.facets[key].multiple === true,
    })),
    draft,
    active,
    options: schema.options(items, active),
    shown: results.length,
    total: items.length,
    filtered: schema.isFiltered(active),
    status: schema.statusText({
      state: active,
      shown: results.length,
      total: items.length,
      touched,
    }),
    emptySentence: schema.noMatchSentence(active),
    setQuery: actions.setQuery,
    submit: actions.submit,
    choose: (key, slug) => actions.choose(key as K, slug),
    toggle: (key, slug) => actions.toggle(key as K, slug),
    clearAll: actions.clearAll,
    hrefFor: (patch) =>
      hrefFor
        ? hrefFor(patch as FilterPatch<K>)
        : schema.hrefFor(linkState, patch as FilterPatch<K>),
  };
  return { model, results };
}

/** The facet view for a key, or a clear error naming the facets a model has. */
export function facetOf(model: FilterModel, key: string): FilterFacetView {
  const facet = model.facets.find((each) => each.key === key);
  if (!facet) {
    const known = model.facets.map((each) => each.key).join(', ');
    throw new Error(`FilterBar: no facet "${key}" (this model has: ${known})`);
  }
  return facet;
}

/** How many facet values are chosen: the Filters button's count. */
export const chosenCount = (model: FilterModel): number =>
  model.facets.reduce((sum, facet) => sum + (model.draft[facet.key]?.length ?? 0), 0);
