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

'use client';

/**
 * @file useUrlFilters: a FilterModel kept in the URL by nuqs, for /projects and /places (the
 * Ledger keeps its own URL sync behind an adapter). The URL is the source of truth through
 * useQueryStates with the schema's own parsers, so a link, a GET form and an in-place change
 * write the same URL; changes replace the history entry and stay shallow (the server already sent
 * every item).
 *
 * Typing is urgent and the list follows on useDeferredValue: no debounce on the list, and none on
 * the URL either (nuqs updates its state at once and only rate-limits the URL write). The server
 * renders these dynamic routes with the URL's search params, so the first HTML is already filtered
 * and hydration matches.
 */

import { useQueryStates } from 'nuqs';
import { useDeferredValue, useMemo, useState } from 'react';

import { type FilterSchema, type FilterState, normaliseQuery } from '@/lib/filters';
import { type BuiltFilterModel, buildFilterModel } from './model';

const URL_OPTIONS = { history: 'replace', shallow: true, scroll: false } as const;

/** The model and the items it keeps, from the URL. */
export function useUrlFilters<T, K extends string>(
  schema: FilterSchema<T, K>,
  items: readonly T[],
): BuiltFilterModel<T> {
  const [raw, setRaw] = useQueryStates(schema.parsers, URL_OPTIONS);
  const [touched, setTouched] = useState(false);
  /** The facets resolved (aliases, unknowns dropped); the search as typed, capped. */
  const draft = useMemo<FilterState<K>>(
    () => ({ ...schema.resolve(raw), q: (raw.q ?? '').slice(0, schema.maxLength) }),
    [schema, raw],
  );
  const deferredQuery = useDeferredValue(draft.q);
  const active = useMemo<FilterState<K>>(
    () => ({ ...draft, q: normaliseQuery(deferredQuery, schema.maxLength) }),
    [draft, deferredQuery, schema],
  );

  /**
   * Writes a state to the URL, empty values left out, and marks the page touched, so a list with
   * no filter left is announced ("Showing all 5 projects") rather than kept quiet. nuqs updates
   * its state at once; the URL write is not awaited.
   */
  const write = (next: FilterState<K>): void => {
    setTouched(true);
    void setRaw({
      q: next.q === '' ? null : next.q,
      ...Object.fromEntries(
        schema.keys.map((key) => [key, next[key].length === 0 ? null : [...next[key]]]),
      ),
    } as Parameters<typeof setRaw>[0]);
  };

  return buildFilterModel({
    schema,
    items,
    draft,
    active,
    touched,
    actions: {
      setQuery: (q) => write({ ...draft, q }),
      submit: () => setTouched(true),
      choose: (key, slug) => write(schema.choose(draft, key, slug)),
      toggle: (key, slug) => write(schema.toggle(draft, key, slug)),
      clearAll: () => write(schema.empty()),
    },
  });
}
