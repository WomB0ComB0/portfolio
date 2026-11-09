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
 * @file defineFilters: a filter page's whole URL contract in one pure, server-safe object.
 *
 * A page declares its search haystack and its facets; it gets back nuqs parsers (repeated keys
 * for every facet, so `?tech=react&tech=go` is exactly what a GET form without JavaScript sends
 * for checkboxes that share a name), a loader and a serialiser (so a link, a form submit and an
 * in-place change write the same URL), resolution of today's and old shared links, matching (AND
 * across facets, OR within one), disjunctive option counts (each facet counted with every other
 * filter applied but its own, as Algolia and TanStack facet), pure state changes and the
 * sentences. The server page and the client island call the same object, so the server HTML of a
 * shared link is already filtered.
 */

import {
  createLoader,
  createSerializer,
  type LoaderInput,
  parseAsNativeArrayOf,
  parseAsString,
} from 'nuqs/server';

import { allOf, DEFAULT_QUERY_MAX_LENGTH, normaliseQuery } from './normalise';
import { defaultScope, noMatchSentence, statusSentence } from './sentences';
import type {
  FacetOption,
  FacetOptions,
  FacetSpec,
  FilterPatch,
  FilterState,
  Noun,
  RawFilterValues,
  StatusInput,
} from './types';

const queryParser = parseAsString.withDefault('');
const facetParser = parseAsNativeArrayOf(parseAsString);

/** The nuqs parsers: each facet as repeated keys, then ?q, in the order links write them. */
export type FilterParsers<K extends string> = { readonly q: typeof queryParser } & {
  readonly [P in K]: typeof facetParser;
};

export interface FilterSchemaInput<T, K extends string> {
  /** The page's path: the GET form's action and the base of every href. */
  readonly path: string;
  readonly noun: Noun;
  /** What ?q searches, matched as a substring ignoring case. */
  readonly search: { readonly haystack: (item: T) => string; readonly maxLength?: number };
  readonly facets: { readonly [P in K]: FacetSpec<T> };
}

export interface FilterSchema<T, K extends string> {
  readonly path: string;
  readonly noun: Noun;
  /** The facets in declaration order. */
  readonly keys: readonly K[];
  readonly facets: { readonly [P in K]: FacetSpec<T> };
  readonly maxLength: number;
  readonly parsers: FilterParsers<K>;
  /** The URL's values as nuqs reads them; resolve() turns them into a FilterState. */
  readonly load: (input: LoaderInput) => RawFilterValues<K>;
  /** Today's slugs from a URL's values: aliases resolved, unknowns dropped, ?q normalised. */
  readonly resolve: (raw: RawFilterValues<K>) => FilterState<K>;
  /** resolve(), from a search string, URLSearchParams or Next's searchParams record. */
  readonly parse: (input: LoaderInput | RawFilterValues<K>) => FilterState<K>;
  readonly empty: () => FilterState<K>;
  readonly match: (item: T, state: FilterState<K>, except?: K) => boolean;
  readonly filter: (items: readonly T[], state: FilterState<K>) => T[];
  readonly options: (
    items: readonly T[],
    state: FilterState<K>,
  ) => { readonly [P in K]: FacetOptions };
  readonly isFiltered: (state: FilterState<K>) => boolean;
  readonly serialize: (state: FilterState<K>) => string;
  readonly hrefFor: (state: FilterState<K>, patch: FilterPatch<K>) => string;
  readonly choose: (state: FilterState<K>, key: K, slug: string | null) => FilterState<K>;
  readonly toggle: (state: FilterState<K>, key: K, slug: string) => FilterState<K>;
  readonly patch: (state: FilterState<K>, patch: FilterPatch<K>) => FilterState<K>;
  readonly noMatchSentence: (state: FilterState<K>) => string;
  readonly statusText: (input: StatusInput<K>) => string;
}

/**
 * Whether parse() was given a URL source for the nuqs loader (a search string, URLSearchParams,
 * a URL, or a Request where the runtime has one) rather than values already read.
 */
const isLoaderInput = (input: unknown): input is LoaderInput =>
  typeof input === 'string' ||
  input instanceof URLSearchParams ||
  input instanceof URL ||
  (typeof Request !== 'undefined' && input instanceof Request);

/** How many items carry each slug (an item counts once per slug). */
function countSlugs<T>(items: readonly T[], spec: FacetSpec<T>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const slug of new Set(spec.valuesOf(item))) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return counts;
}

/** Every slug the items carry, most used first, then by label. */
function usageOrder<T>(items: readonly T[], spec: FacetSpec<T>): string[] {
  return [...countSlugs(items, spec)]
    .sort(([a, useA], [b, useB]) => useB - useA || spec.labelOf(a).localeCompare(spec.labelOf(b)))
    .map(([slug]) => slug);
}

/**
 * The options in display order with their counts. A chosen slug that is no option itself takes
 * the place of the option it shows under (groupOf), once; otherwise it is added at the end.
 */
function facetOptions<T>(
  spec: FacetSpec<T>,
  base: readonly T[],
  universe: readonly string[],
  chosen: readonly string[],
): FacetOptions {
  const counts = countSlugs(base, spec);
  /** A slug as an option: its label, its count in `base` (0 if none carry it), whether chosen. */
  const optionOf = (slug: string): FacetOption => ({
    slug,
    label: spec.labelOf(slug),
    count: counts.get(slug) ?? 0,
    current: chosen.includes(slug),
  });
  const extra = chosen.filter((slug) => !universe.includes(slug));
  const standIns = new Map<string, string>();
  for (const slug of extra) {
    const group = spec.groupOf?.(slug) ?? null;
    if (group !== null && universe.includes(group) && !standIns.has(group)) {
      standIns.set(group, slug);
    }
  }
  const placed = new Set(standIns.values());
  const options = [
    ...universe.map((slug) => optionOf(standIns.get(slug) ?? slug)),
    ...extra.filter((slug) => !placed.has(slug)).map(optionOf),
  ];
  return { all: base.length, options };
}

/** A page's filter schema. Facets may not be named 'q', which the search owns. */
export function defineFilters<T, K extends string>(
  input: FilterSchemaInput<T, K>,
): FilterSchema<T, K> {
  const keys = Object.keys(input.facets) as K[];
  if ((keys as string[]).includes('q')) {
    throw new Error("defineFilters: 'q' is the search's key; give the facet another name");
  }
  const { path, noun, facets } = input;
  const maxLength = input.search.maxLength ?? DEFAULT_QUERY_MAX_LENGTH;
  const parsers = Object.fromEntries([
    ...keys.map((key) => [key, facetParser] as const),
    ['q', queryParser] as const,
  ]) as unknown as FilterParsers<K>;
  const loader = createLoader(parsers);
  const serializeUrl = createSerializer(parsers);

  const build = (q: string, valuesFor: (key: K) => readonly string[]): FilterState<K> =>
    ({ q, ...Object.fromEntries(keys.map((key) => [key, valuesFor(key)])) }) as FilterState<K>;

  /**
   * A facet's slugs from its URL values, blanks dropped. A single-select facet reads its first
   * value only, as every page always has: a link with two issuers means the first.
   */
  const resolveFacet = (key: K, raw: RawFilterValues<K>[K]): string[] => {
    const spec = facets[key];
    const values = allOf(raw)
      .map((value) => value.trim())
      .filter((value) => value !== '');
    const slugs: string[] = [];
    for (const value of spec.multiple ? values : values.slice(0, 1)) {
      const slug = spec.resolve ? spec.resolve(value) : value;
      if (slug && !slugs.includes(slug)) slugs.push(slug);
    }
    return slugs;
  };

  const resolve = (raw: RawFilterValues<K>): FilterState<K> =>
    build(normaliseQuery(raw.q, maxLength), (key) => resolveFacet(key, raw[key]));

  const haystacks = new WeakMap<object, string>();
  /**
   * An item's search text in lower case, worked out once per object item (the WeakMap lets it go
   * with the item); a primitive item cannot key a WeakMap, so it is lowered on every call.
   */
  const haystackOf = (item: T): string => {
    if (typeof item !== 'object' || item === null) return input.search.haystack(item).toLowerCase();
    const known = haystacks.get(item);
    if (known !== undefined) return known;
    const text = input.search.haystack(item).toLowerCase();
    haystacks.set(item, text);
    return text;
  };

  /**
   * Whether an item passes the search and every facet (AND across facets, OR within one). The
   * facet named by `except` is skipped, which is how its own options are counted disjunctively.
   */
  const match = (item: T, state: FilterState<K>, except?: K): boolean =>
    (state.q === '' || haystackOf(item).includes(state.q.toLowerCase())) &&
    keys.every((key) => {
      const chosen = state[key];
      return (
        key === except ||
        chosen.length === 0 ||
        facets[key].valuesOf(item).some((slug) => chosen.includes(slug))
      );
    });

  /**
   * A new state with the patch's keys replaced: a string is one value, null or undefined clears,
   * and a key the patch does not name keeps its values. ?q takes the first value given.
   */
  const patch = (state: FilterState<K>, change: FilterPatch<K>): FilterState<K> => {
    /** The values the patch gives a key, or undefined when it leaves the key alone. */
    const changedValues = (key: K | 'q'): readonly string[] | undefined => {
      if (!Object.hasOwn(change, key)) return undefined;
      const next = change[key];
      return next === null || next === undefined ? [] : typeof next === 'string' ? [next] : next;
    };
    const q = changedValues('q');
    return build(
      q === undefined ? state.q : (q[0] ?? ''),
      (key) => changedValues(key) ?? state[key],
    );
  };

  /** A state as the serialiser's values: empty ones null, so they leave the URL. */
  const urlValues = (state: FilterState<K>): Parameters<typeof serializeUrl>[1] =>
    ({
      q: state.q === '' ? null : state.q,
      ...Object.fromEntries(
        keys.map((key) => [key, state[key].length === 0 ? null : [...state[key]]]),
      ),
    }) as unknown as Parameters<typeof serializeUrl>[1];

  const serialize = (state: FilterState<K>): string => serializeUrl(path, urlValues(state));

  /** A one-key patch. */
  const only = (key: K, value: string | readonly string[] | null): FilterPatch<K> =>
    ({ [key]: value }) as unknown as FilterPatch<K>;

  /** Whether the search or any facet narrows the items. */
  const isFiltered = (state: FilterState<K>): boolean =>
    state.q !== '' || keys.some((key) => state[key].length > 0);

  /** How the empty state names a facet's chosen values: its own scope(), else "in A or B". */
  const scopeOf = (state: FilterState<K>, key: K): string => {
    const spec = facets[key];
    return (spec.scope ?? defaultScope)(state[key].map((slug) => spec.labelOf(slug)));
  };

  return {
    path,
    noun,
    keys,
    facets,
    maxLength,
    parsers,
    load: (source) => loader(source) as RawFilterValues<K>,
    resolve,
    /** A URL source goes through the loader first; values already read go straight to resolve(). */
    parse: (source) =>
      resolve(isLoaderInput(source) ? (loader(source) as RawFilterValues<K>) : source),
    empty: () => build('', () => []),
    match,
    filter: (items, state) => items.filter((item) => match(item, state)),
    options: (items, state) =>
      Object.fromEntries(
        keys.map((key) => {
          const spec = facets[key];
          const base = items.filter((item) => match(item, state, key));
          const universe = spec.values ?? usageOrder(items, spec);
          return [key, facetOptions(spec, base, universe, state[key])];
        }),
      ) as { readonly [P in K]: FacetOptions },
    isFiltered,
    serialize,
    hrefFor: (state, change) => serialize(patch(state, change)),
    choose: (state, key, slug) => patch(state, only(key, slug)),
    /**
     * A chosen slug is removed; any other is added to a multi-select facet's values, or replaces
     * a single-select facet's one.
     */
    toggle: (state, key, slug) => {
      const chosen = state[key];
      const next = chosen.includes(slug)
        ? chosen.filter((each) => each !== slug)
        : facets[key].multiple
          ? [...chosen, slug]
          : [slug];
      return patch(state, only(key, next));
    },
    patch,
    noMatchSentence: (state) =>
      noMatchSentence(
        noun,
        state.q,
        keys.filter((key) => state[key].length > 0).map((key) => scopeOf(state, key)),
      ),
    statusText: ({ state, shown, total, touched }) =>
      statusSentence({ noun, filtered: isFiltered(state), shown, total, touched }),
  };
}
