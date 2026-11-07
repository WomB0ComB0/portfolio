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
 * @file The Ledger island's filter state, with the URL as its source of truth. It starts from the
 * address bar's search params (on a first visit the same URL the server rendered, so hydration
 * matches; after Back, the URL even when Next restores a page rendered for other filters). A chip
 * or a keystroke applies at once and writes the URL with history.replaceState, which Next reports
 * back through useSearchParams. Any other change to the URL (Back, Forward, a link or
 * router.push, even to the URL the island first rendered) resets the filters from it.
 */

import { useSearchParams } from 'next/navigation';
import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';

import {
  CERTIFICATIONS_PATH,
  type FilterValues,
  filtersFromSearch,
  filtersHref,
  filtersQuery,
  type LedgerFilters,
  normaliseQuery,
} from '../_lib/filters';
import type { Ledger } from '../_lib/ledger';

/** ?q is written this long after the last keystroke; the list itself filters at once. */
const SEARCH_DEBOUNCE_MS = 300;

/** The chips' part of the filters: issuer and skill. */
export type LedgerChoices = Omit<LedgerFilters, 'q'>;
/** What the URL's filters resolve against. */
export type LedgerLookups = Pick<Ledger, 'index' | 'other'>;

export interface LedgerFilterState {
  readonly choices: LedgerChoices;
  /** The search field's text, as typed. */
  readonly query: string;
  /** What filters the list: the choices and the normalised search, deferred while typing. */
  readonly active: LedgerFilters;
  /** Whether the visitor changed a filter here; the status line speaks only then. */
  readonly touched: boolean;
  readonly choose: (next: LedgerChoices) => void;
  readonly search: (value: string) => void;
  /** The search form's submit: writes ?q now instead of after the pause. */
  readonly submit: () => void;
  readonly clearAll: () => void;
}

interface Timer {
  readonly schedule: (run: () => void, ms: number) => void;
  readonly cancel: () => void;
}

/** One pending timeout, replaced by the next and cleared on unmount. The object is stable. */
function useTimer(): Timer {
  const id = useRef<number | undefined>(undefined);
  const [timer] = useState<Timer>(() => ({
    schedule: (run, ms) => {
      window.clearTimeout(id.current);
      id.current = window.setTimeout(run, ms);
    },
    cancel: () => window.clearTimeout(id.current),
  }));
  useEffect(() => timer.cancel, [timer]);
  return timer;
}

/** The address bar's search params, as URLSearchParams writes them. */
const currentQuery = (): string => new URLSearchParams(window.location.search).toString();

/** Calls `onEntry` whenever the history entry changes, where the browser has the Navigation API. */
function useHistoryEntries(onEntry: () => void): void {
  useEffect(() => {
    const navigation: Navigation | undefined = window.navigation;
    if (!navigation) return;
    navigation.addEventListener('currententrychange', onEntry);
    return () => navigation.removeEventListener('currententrychange', onEntry);
  }, [onEntry]);
}

/**
 * Writes the island's URLs and tells them apart from everyone else's. It checks the URL the
 * router reports against the one the island's filters stand for whenever the report changes,
 * whenever the server renders the page again (`rendered`, a new object per server render), and
 * whenever the history entry changes (the Navigation API, where the browser has it): a quick
 * navigation to the URL the island first rendered can reach it with the search params reading as
 * before, when React folds the router's report of a chip's write into the navigation.
 * `onMoved` gets every URL the island did not write; its own writes, even reported late, are
 * recognised and skipped.
 */
function useUrlSync(
  reported: string | null,
  rendered: object,
  onMoved: (search: string) => void,
): (values: FilterValues) => void {
  /** The search string the island's filters stand for. */
  const expected = useRef(reported);
  /** Search strings written here that the router has not reported yet, oldest first. */
  const pending = useRef<readonly string[]>([]);
  const adopt = useCallback(
    (search: string): void => {
      pending.current = [];
      expected.current = search;
      onMoved(search);
    },
    [onMoved],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: `rendered` is the trigger, not an input: a server render (a navigation, even to the same URL) must re-check the reported URL.
  useEffect(() => {
    if (reported === null || reported === expected.current) {
      pending.current = [];
      return;
    }
    const own = pending.current.indexOf(reported);
    if (own >= 0) pending.current = pending.current.slice(own + 1);
    else adopt(reported);
  }, [reported, rendered, adopt]);

  // A navigation in the same tick as a chip's write (a script's router.push) can reach the page
  // with neither a router report nor a server render: Next folds the two and serves the page from
  // its cache. Only the history entry changes.
  useHistoryEntries(
    useCallback(() => {
      if (window.location.pathname.replace(/\/$/, '') !== CERTIFICATIONS_PATH) return;
      const search = currentQuery();
      if (search !== expected.current && !pending.current.includes(search)) adopt(search);
    }, [adopt]),
  );

  return (values) => {
    const next = filtersQuery(values);
    expected.current = next;
    if (next === currentQuery()) return;
    pending.current = [...pending.current, next];
    window.history.replaceState(null, '', filtersHref(values));
  };
}

/** The chips' choices and the search field's text, as typed. */
interface Draft extends LedgerChoices {
  readonly query: string;
}

const draftOf = ({ issuer, skill, q }: LedgerFilters): Draft => ({ issuer, skill, query: q });

/** A ref that always holds the latest `value`, for callbacks that must stay stable. */
function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

/**
 * Filters that follow the URL, with the setters the toolbar, skill line and empty state use.
 * `initial` is the server's reading of the URL: the start where no router reports search params,
 * and, as a new object per server render, the sign that a navigation reached the page.
 */
export function useLedgerFilters(
  lookups: LedgerLookups,
  initial: LedgerFilters,
): LedgerFilterState {
  const params = useSearchParams();
  const reported = params === null ? null : params.toString();
  const [draft, setDraft] = useState<Draft>(() =>
    draftOf(reported === null ? initial : filtersFromSearch(reported, lookups)),
  );
  const [touched, setTouched] = useState(false);
  const deferredQuery = useDeferredValue(draft.query);
  const timer = useTimer();
  const latest = useLatest(lookups);
  const onMoved = useCallback(
    (search: string) => {
      timer.cancel();
      setDraft(draftOf(filtersFromSearch(search, latest.current)));
    },
    [timer, latest],
  );
  const write = useUrlSync(reported, initial, onMoved);
  const { issuer, skill, query } = draft;
  const writeFor = (next: LedgerChoices, text: string): void =>
    write({ issuer: next.issuer?.slug, skill: next.skill, q: normaliseQuery(text) });
  const choose = (next: LedgerChoices, text = query): void => {
    timer.cancel();
    setTouched(true);
    setDraft({ issuer: next.issuer, skill: next.skill, query: text });
    writeFor(next, text);
  };

  return {
    choices: { issuer, skill },
    query,
    active: { issuer, skill, q: normaliseQuery(deferredQuery) },
    touched,
    choose: (next) => choose(next),
    search: (value) => {
      setTouched(true);
      setDraft((current) => ({ ...current, query: value }));
      timer.schedule(() => writeFor({ issuer, skill }, value), SEARCH_DEBOUNCE_MS);
    },
    submit: () => choose({ issuer, skill }),
    clearAll: () => choose({ issuer: null, skill: null }, ''),
  };
}
