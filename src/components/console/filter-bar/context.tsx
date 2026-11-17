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
 * @file FilterBar.Provider: the one model every part reads, plus what the parts share and no
 * model holds: where the bar, the search, the chip lists, the tokens and the results are (for
 * focus and the crossfade), the sheet's id, and `change`, which runs a discrete change (a chip,
 * a token, a checkbox, Clear) synchronously inside the guarded view transition and then hands
 * focus to whatever the part asks for. Typing never goes through `change`.
 *
 * It also knows whether the bar shows the filters: not on a phone (the Filters button shows, the
 * chips are in the sheet) and not for a filter whose control the bar does not hold. There a change
 * lands on the results header (view-transition.ts), and focus with nowhere to go takes the Filters
 * button rather than the search.
 */

import {
  createContext,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { flushSync } from 'react-dom';

import { focusInPlace } from '@/lib/dom/steady-focus';
import type { FilterModel } from './model';
import { runFilterChange } from './view-transition';

/** Where the parts are, written by their refs. */
export interface FilterBarRegistry {
  bar: HTMLElement | null;
  search: HTMLInputElement | null;
  results: HTMLElement | null;
  applied: HTMLElement | null;
  /** The phone's Filters button (FilterBar.Facets): shown only while the chips are in the sheet. */
  filtersButton: HTMLElement | null;
  /** The facets whose controls the bar holds from 48rem (FilterBar.Facets' `facets`), or all. */
  barFacets: readonly string[] | 'all';
  readonly chipLists: Map<string, HTMLElement>;
}

/** Picks the element to focus once a change has rendered; nothing keeps focus where it was. */
export type FocusPick = () => HTMLElement | null | undefined;

/** What a part may say about a change it makes. */
export interface ChangeOptions {
  /**
   * The change turns on a filter the bar has no control for (a series link on /media), so it
   * lands on the results header, which alone shows that filter.
   */
  readonly head?: boolean;
}

/**
 * A discrete change, given the model as it is when the change applies. A view transition applies
 * it a frame after the click, and the visitor may have typed in between: the click's own render
 * would put the old search back.
 */
export type FilterChange = (latest: FilterModel) => void;

export interface FilterBarContextValue {
  readonly model: FilterModel;
  readonly registry: RefObject<FilterBarRegistry>;
  /** The phone sheet's id, for the Filters button. */
  readonly sheetId: string;
  readonly change: (update: FilterChange, focus?: FocusPick, options?: ChangeOptions) => void;
}

const FilterBarContext = createContext<FilterBarContextValue | null>(null);

/** The parts' shared state; throws outside a Provider, naming it. */
export function useFilterBar(): FilterBarContextValue {
  const value = useContext(FilterBarContext);
  if (!value) throw new Error('FilterBar parts render inside <FilterBar.Provider model={...}>');
  return value;
}

/**
 * Whether a box shows: false inside a closed sheet (display: none) or a hidden ancestor. Where the
 * browser has no checkVisibility, by each box's own display, up to the root.
 */
export function shows(element: Element): boolean {
  if (typeof element.checkVisibility === 'function') return element.checkVisibility();
  const view = element.ownerDocument.defaultView;
  for (let box: Element | null = element; box; box = box.parentElement) {
    if (view?.getComputedStyle(box).display === 'none') return false;
  }
  return true;
}

/** The current chip of the first chip set that shows. */
function currentChipOf(registry: FilterBarRegistry): HTMLElement | null {
  for (const list of registry.chipLists.values()) {
    const chip = list.querySelector<HTMLElement>('a[aria-current="true"]');
    if (chip?.isConnected && shows(chip)) return chip;
  }
  return null;
}

/** The Filters button while it shows (a phone: the chips are in the closed sheet); else null. */
export const shownFiltersButton = (registry: FilterBarRegistry): HTMLElement | null => {
  const button = registry.filtersButton;
  return button?.isConnected && shows(button) ? button : null;
};

/**
 * Where focus goes when the element a visitor acted on is gone: the current chip, else the
 * Filters button (a phone, whose chips are in the closed sheet: never the search, whose focus
 * opens the on-screen keyboard), else the search.
 */
export const fallbackFocus = (registry: FilterBarRegistry): HTMLElement | null =>
  currentChipOf(registry) ?? shownFiltersButton(registry) ?? registry.search;

/** Whether a filter is on whose control the bar does not hold (a series link's, on /media). */
function offBarFilterOn(registry: FilterBarRegistry, model: FilterModel): boolean {
  const held = registry.barFacets;
  if (held === 'all') return false;
  return model.facets.some(
    (facet) => (model.draft[facet.key]?.length ?? 0) > 0 && !held.includes(facet.key),
  );
}

/**
 * Whether the results header must show for the bar to say which filters are on: the chips are in
 * the sheet (a phone), or a filter is on that the bar has no control for.
 */
const headerSpeaks = (registry: FilterBarRegistry, model: FilterModel): boolean =>
  shownFiltersButton(registry) !== null || offBarFilterOn(registry, model);

export interface FilterBarProviderProps {
  readonly model: FilterModel;
  readonly children: ReactNode;
}

/** Shares one FilterModel with the parts inside it. Renders no element of its own. */
export function FilterBarProvider({ model, children }: FilterBarProviderProps): ReactElement {
  const registry = useRef<FilterBarRegistry>({
    bar: null,
    search: null,
    results: null,
    applied: null,
    filtersButton: null,
    barFacets: [],
    chipLists: new Map(),
  });
  const sheetId = useId();
  // The model of the last commit: what a change deferred by a view transition must act on.
  const latest = useRef(model);
  useLayoutEffect(() => {
    latest.current = model;
  }, [model]);
  const value = useMemo<FilterBarContextValue>(
    () => ({
      model,
      registry,
      sheetId,
      change: (update, focus, options) =>
        runFilterChange(
          () => {
            flushSync(() => update(latest.current));
            // The targets (the next token, a chip or the search in the stuck bar) are on screen;
            // a plain focus() would scroll the page to them past html's scroll-padding.
            focusInPlace(focus?.());
          },
          {
            results: registry.current.results,
            bar: registry.current.bar,
            // A filter the bar does not show now is one the change most likely keeps.
            toHead: options?.head === true || headerSpeaks(registry.current, latest.current),
            headMustShow: () => headerSpeaks(registry.current, latest.current),
          },
        ),
    }),
    [model, sheetId],
  );
  return <FilterBarContext.Provider value={value}>{children}</FilterBarContext.Provider>;
}
