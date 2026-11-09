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
  readonly chipLists: Map<string, HTMLElement>;
}

/** Picks the element to focus once a change has rendered; nothing keeps focus where it was. */
export type FocusPick = () => HTMLElement | null | undefined;

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
  readonly change: (update: FilterChange, focus?: FocusPick) => void;
}

const FilterBarContext = createContext<FilterBarContextValue | null>(null);

/** The parts' shared state; throws outside a Provider, naming it. */
export function useFilterBar(): FilterBarContextValue {
  const value = useContext(FilterBarContext);
  if (!value) throw new Error('FilterBar parts render inside <FilterBar.Provider model={...}>');
  return value;
}

/** Whether a box shows: false inside a closed sheet (display: none) or a hidden ancestor. */
const shows = (element: HTMLElement): boolean =>
  typeof element.checkVisibility === 'function' ? element.checkVisibility() : true;

/** The current chip of the first chip set that shows. */
export function currentChipOf(registry: FilterBarRegistry): HTMLElement | null {
  for (const list of registry.chipLists.values()) {
    const chip = list.querySelector<HTMLElement>('a[aria-current="true"]');
    if (chip?.isConnected && shows(chip)) return chip;
  }
  return null;
}

/** Where focus goes when the element a visitor acted on is gone: the current chip, else search. */
export const fallbackFocus = (registry: FilterBarRegistry): HTMLElement | null =>
  currentChipOf(registry) ?? registry.search;

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
      change: (update, focus) =>
        runFilterChange(
          () => {
            flushSync(() => update(latest.current));
            // The targets (the next token, a chip or the search in the stuck bar) are on screen;
            // a plain focus() would scroll the page to them past html's scroll-padding.
            focusInPlace(focus?.());
          },
          { results: registry.current.results, bar: registry.current.bar },
        ),
    }),
    [model, sheetId],
  );
  return <FilterBarContext.Provider value={value}>{children}</FilterBarContext.Provider>;
}
