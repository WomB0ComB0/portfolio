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
 * @file The FilterBar family: small parts that share one FilterModel, composed per page.
 *
 * @example
 * const { model, results } = useUrlFilters(projectFilters, rows);
 * <FilterBar.Provider model={model}>
 *   <FilterBar.Root sticky>
 *     <FilterBar.Search />
 *     <FilterBar.Facets>
 *       <FilterBar.Chips facet="category" />
 *       <FilterBar.Picker facet="tech" searchLabel="Filter technologies" />
 *     </FilterBar.Facets>
 *   </FilterBar.Root>
 *   <div className={RESULTS_HEAD_CLASS}><FilterBar.Count /><FilterBar.Applied /></div>
 *   <FilterBar.Status />
 *   <FilterBar.Results>{results.length ? <Rows rows={results} /> : <FilterBar.Empty />}</FilterBar.Results>
 * </FilterBar.Provider>
 *
 * No directive: the class module, the model and the skeleton are server-safe, and the client
 * parts carry their own 'use client'.
 */

import { FilterBarFacets, FilterBarRoot, FilterBarSearch } from './bar';
import { FilterBarChips } from './chips';
import { FilterBarProvider } from './context';
import { FilterBarPicker } from './picker';
import {
  FilterBarApplied,
  FilterBarCount,
  FilterBarEmpty,
  FilterBarResults,
  FilterBarStatus,
} from './results';
import { FilterBarSkeleton } from './skeleton';

export const FilterBar = {
  Provider: FilterBarProvider,
  Root: FilterBarRoot,
  Search: FilterBarSearch,
  Facets: FilterBarFacets,
  Chips: FilterBarChips,
  Picker: FilterBarPicker,
  Applied: FilterBarApplied,
  Count: FilterBarCount,
  Status: FilterBarStatus,
  Empty: FilterBarEmpty,
  Results: FilterBarResults,
  Skeleton: FilterBarSkeleton,
} as const;

export type { FilterBarDensity, FilterBarRootProps, FilterBarSearchProps } from './bar';
export type { ChipsLayout, FilterBarChipsProps } from './chips';
export { FILTER_SCOPE_CLASS, RESULTS_HEAD_CLASS } from './filter-bar-classes';
export {
  type BuildFilterModelInput,
  type BuiltFilterModel,
  buildFilterModel,
  type FilterActions,
  type FilterFacetView,
  type FilterModel,
} from './model';
export type { FilterBarPickerProps } from './picker';
export type { FilterBarAppliedProps, FilterBarEmptyProps } from './results';
export type { FilterBarSkeletonProps } from './skeleton';
export { useUrlFilters } from './use-url-filters';
