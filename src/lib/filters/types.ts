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
 * @file The shapes a filter page declares and gets back: facets, the filter state the URL
 * stands for, options with their counts, and patches for links. Types only; server-safe.
 */

import type { ParamValue } from './normalise';

/** What a page calls one of its items: 'certificate' and 'certificates'. */
export interface Noun {
  readonly one: string;
  readonly many: string;
}

/** One facet of a page's items: issuer, kind, technology, category. */
export interface FacetSpec<T> {
  /** The group's word: the picker's legend, an Applied token ("Kind: Tools"), the sheet. */
  readonly label: string;
  /** true: OR within the facet, repeated keys in the URL, checkboxes. false: one value, chips. */
  readonly multiple?: boolean;
  /** The slugs an item carries: one for a kind, several for technologies. */
  readonly valuesOf: (item: T) => readonly string[];
  /** Display text for a slug. */
  readonly labelOf: (slug: string) => string;
  /**
   * A URL value, as today's links or old shared ones write it, to today's slug, or null to drop
   * it. Without one, any non-blank value is taken as it is.
   */
  readonly resolve?: (raw: string) => string | null;
  /** The options in display order. Without one: every slug the items carry, most used first. */
  readonly values?: readonly string[];
  /**
   * The option a chosen slug shows under when it is not an option itself: a one-off issuer under
   * Other. That option then takes the chosen slug's name and count while it is chosen.
   */
  readonly groupOf?: (slug: string) => string | null;
  /** How the empty state names this facet's values: "from Google", "in Tools or Apps". */
  readonly scope?: (labels: readonly string[]) => string;
}

/** The filters a URL stands for: the search, then each facet's chosen slugs. */
export type FilterState<K extends string> = { readonly q: string } & {
  readonly [P in K]: readonly string[];
};

/** A URL's values before they are resolved: what the loader reads, or what Next passes. */
export type RawFilterValues<K extends string> = { readonly q?: ParamValue } & {
  readonly [P in K]?: ParamValue;
};

/** One option of a facet, counted with every other filter applied but this facet's own. */
export interface FacetOption {
  readonly slug: string;
  readonly label: string;
  readonly count: number;
  readonly current: boolean;
}

export interface FacetOptions {
  /** The "All" option's count: everything the other filters leave. */
  readonly all: number;
  readonly options: readonly FacetOption[];
}

/** A change to a link's filters: a value or list replaces, null clears. */
export type FilterPatch<K extends string> = {
  readonly [P in K | 'q']?: string | readonly string[] | null;
};

export interface StatusInput<K extends string> {
  /** What filters the list. */
  readonly state: FilterState<K>;
  readonly shown: number;
  readonly total: number;
  /** Whether the visitor changed a filter on this page (a first load stays quiet). */
  readonly touched: boolean;
}
