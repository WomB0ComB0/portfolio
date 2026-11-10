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
 * @file The bar itself: FilterBar.Root (a labelled <search> landmark around a GET form, so the
 * search works without JavaScript and keeps the other filters as hidden fields), FilterBar.Search
 * and FilterBar.Facets (the phone's Filters button and the sheet it opens, laid out inline from a
 * 48rem page).
 *
 * Sticky, the bar holds the top edge above the edge haze and writes its height to the nearest
 * `[data-filter-scope]` as --filter-bar-h, which the sticky year bars below it stick under. Focus
 * moving into it never scrolls the page (src/lib/dom/steady-focus.ts). On a phone only the search
 * field and the Filters button stick; the facets open as a bottom sheet (a native popover, so it
 * opens without JavaScript too).
 */

import {
  type ReactElement,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';

import { focusInPlace, holdScrollOnFocus } from '@/lib/dom/steady-focus';
import { cn } from '@/lib/utils';
import { fallbackFocus, useFilterBar } from './context';
import {
  BAR_CLASS,
  BUTTON_COUNT_CLASS,
  FILTERS_BUTTON_CLASS,
  FORM_ROW_CLASS,
  FORM_TILE_CLASS,
  SEARCH_FIELD_CLASS,
  SEARCH_INPUT_CLASS,
  SEARCH_SLOT_CLASS,
  SHEET_CLASS,
  SHEET_DONE_CLASS,
  SHEET_FOOT_CLASS,
  stickyClassFor,
} from './filter-bar-classes';
import { ChevronIcon, SearchIcon } from './icons';
import { chosenCount } from './model';

/** The bar's layout: one row of parts (/certifications, /projects), or a surface tile (/places). */
export type FilterBarDensity = 'row' | 'bar';

export interface FilterBarRootProps {
  /** The landmark's name; needed only when a page has two search landmarks. */
  readonly label?: string;
  /** Holds the top edge while the list scrolls under it. */
  readonly sticky?: boolean;
  readonly density?: FilterBarDensity;
  readonly className?: string;
  readonly children: ReactNode;
}

/** Writes the sticky bar's height to its scope, for the sticky year bars below it. */
function useStickyHeight(bar: RefObject<HTMLElement | null>, sticky: boolean): void {
  useLayoutEffect(() => {
    const element = bar.current;
    if (!element || !sticky) return;
    const scope = element.closest<HTMLElement>('[data-filter-scope]') ?? document.documentElement;
    const write = (): void =>
      scope.style.setProperty('--filter-bar-h', `${element.getBoundingClientRect().height}px`);
    write();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(write) : null;
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      scope.style.removeProperty('--filter-bar-h');
    };
  }, [bar, sticky]);
}

/** Keeps the page still when focus moves into the stuck bar (see steady-focus.ts). */
function useHoldScroll(bar: RefObject<HTMLElement | null>, sticky: boolean): void {
  useEffect(() => {
    const element = bar.current;
    return element && sticky ? holdScrollOnFocus(element) : undefined;
  }, [bar, sticky]);
}

/**
 * The landmark and the GET form every part sits in. Sticky, it holds the top edge in its
 * density's band: the row's, or the slimmer one around the `bar` tile (stickyClassFor).
 */
export function FilterBarRoot({
  label,
  sticky = false,
  density = 'row',
  className,
  children,
}: FilterBarRootProps): ReactElement {
  const { model, registry } = useFilterBar();
  const barRef = useRef<HTMLElement>(null);
  useStickyHeight(barRef, sticky);
  useHoldScroll(barRef, sticky);
  // Chips are links and a single facet has no form control, so its value rides along hidden; a
  // multi-select facet submits through its own checkboxes.
  const hidden = model.facets
    .filter((facet) => !facet.multiple)
    .flatMap((facet) =>
      (model.draft[facet.key] ?? []).map((value) => (
        <input key={`${facet.key}:${value}`} type="hidden" name={facet.key} value={value} />
      )),
    );
  return (
    <search
      ref={(element) => {
        barRef.current = element;
        registry.current.bar = element;
      }}
      aria-label={label}
      data-filter-part="bar"
      data-density={density}
      data-sticky={sticky ? '' : undefined}
      className={cn(BAR_CLASS, sticky && stickyClassFor(density), className)}
    >
      <form
        action={model.path}
        method="get"
        className={density === 'bar' ? FORM_TILE_CLASS : FORM_ROW_CLASS}
        onSubmit={(event) => {
          event.preventDefault();
          model.submit();
        }}
      >
        {children}
        {hidden}
      </form>
    </search>
  );
}

export interface FilterBarSearchProps {
  /** The field's name for screen readers; "Search {noun}" by default. */
  readonly label?: string;
  readonly placeholder?: string;
}

/** The search: a labelled type=search field named q. Typing filters at once and never animates. */
export function FilterBarSearch({
  label,
  placeholder = 'Search',
}: FilterBarSearchProps): ReactElement {
  const { model, registry } = useFilterBar();
  return (
    <div className={SEARCH_SLOT_CLASS}>
      <label className={SEARCH_FIELD_CLASS}>
        <SearchIcon />
        <span className="sr-only">{label ?? `Search ${model.noun.many}`}</span>
        <input
          ref={(element) => {
            registry.current.search = element;
          }}
          type="search"
          name="q"
          value={model.draft.q}
          onChange={(event) => model.setQuery(event.target.value)}
          placeholder={placeholder}
          maxLength={model.maxLength}
          autoComplete="off"
          enterKeyHint="search"
          spellCheck={false}
          data-filter-part="field"
          className={SEARCH_INPUT_CLASS}
        />
      </label>
    </div>
  );
}

export interface FilterBarFacetsProps {
  /** The phone button's word. */
  readonly label?: string;
  readonly children: ReactNode;
}

/** When the sheet opens, focus moves into it: to the current chip, or its first control. */
function useFocusOnOpen(sheet: RefObject<HTMLDivElement | null>): void {
  const { registry } = useFilterBar();
  useEffect(() => {
    const element = sheet.current;
    if (!element) return;
    /**
     * Fires on close too, so it acts only on open: the current chip, else the sheet's first link
     * or control, else the bar's fallback takes focus in place (no scroll while it is on screen).
     */
    const onToggle = (event: Event): void => {
      if ((event as ToggleEvent).newState !== 'open') return;
      const target =
        element.querySelector<HTMLElement>('a[aria-current="true"]') ??
        element.querySelector<HTMLElement>('a[href], input, button');
      focusInPlace(target ?? fallbackFocus(registry.current));
    };
    element.addEventListener('toggle', onToggle);
    return () => element.removeEventListener('toggle', onToggle);
  }, [sheet, registry]);
}

/**
 * The facets: on a phone, a Filters button (counting the values in use) and the bottom sheet it
 * opens, which ends with a button showing how many results there are; from a 48rem page the
 * sheet's children sit in the bar and the button is gone.
 */
export function FilterBarFacets({
  label = 'Filters',
  children,
}: FilterBarFacetsProps): ReactElement {
  const { model, sheetId } = useFilterBar();
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusOnOpen(sheetRef);
  const chosen = chosenCount(model);
  const noun = model.shown === 1 ? model.noun.one : model.noun.many;
  return (
    <>
      <button
        type="button"
        popoverTarget={sheetId}
        data-active={chosen > 0 ? '' : undefined}
        className={FILTERS_BUTTON_CLASS}
      >
        {label}
        {chosen > 0 && (
          <>
            {' '}
            <span className={BUTTON_COUNT_CLASS}>{chosen}</span>{' '}
            <span className="sr-only">applied</span>
          </>
        )}
        <ChevronIcon />
      </button>
      <div
        ref={sheetRef}
        id={sheetId}
        popover="auto"
        data-filter-part="sheet"
        className={SHEET_CLASS}
      >
        {children}
        <div className={SHEET_FOOT_CLASS}>
          <button
            type="button"
            popoverTarget={sheetId}
            popoverTargetAction="hide"
            className={SHEET_DONE_CLASS}
          >
            Show {model.shown} {noun}
          </button>
        </div>
      </div>
    </>
  );
}
