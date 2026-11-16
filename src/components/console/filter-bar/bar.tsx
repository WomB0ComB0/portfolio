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
 * opens without JavaScript too). A tap on the dimmed page around it only closes it, and focus
 * comes back to the Filters button. Turning the phone so the page reaches 48rem closes it, and
 * another layer taking focus (the command palette) closes it first. Focus on a control that a
 * step across 48rem hides moves to its counterpart: a chip to the Filters button, and back.
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
import {
  type FilterBarRegistry,
  fallbackFocus,
  shownFiltersButton,
  shows,
  useFilterBar,
} from './context';
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
import { closeForOtherLayer } from './layers';
import { chosenCount } from './model';
import { closeOnlyOnOutsidePress, hideIfOpen, isElement, isPopoverOpen } from './outside-press';

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

/**
 * Where focus goes once the sheet has closed, if the close left it on the page body or inside
 * the sheet. A light dismiss (a tap or click on the dimmed page) restores no focus, and a chip
 * focused in the sheet hides with it once its slide ends, so focus would fall to the body and the
 * next Tab would start from the top. On a phone it takes the Filters button, as Escape and Show N
 * leave it. From 48rem (the page grew with the sheet open, afterLayoutStep) the chips sit in the
 * bar: a chip it was on keeps it, and focus nowhere or on a part hidden there takes the bar's
 * fallback, the current chip. Focus the visitor put anywhere else stays there.
 */
function focusAfterClose(sheet: HTMLElement, registry: FilterBarRegistry): void {
  const page = sheet.ownerDocument;
  const active = page.activeElement;
  const nowhere = active === null || active === page.body;
  const button = shownFiltersButton(registry);
  if (button) {
    if (nowhere || sheet.contains(active)) focusInPlace(button);
    return;
  }
  if (nowhere || (active && sheet.contains(active) && !shows(active))) {
    focusInPlace(fallbackFocus(registry));
  }
}

/**
 * When the sheet opens, focus moves into it: to the current chip, else its first link or
 * control, else the bar's fallback, in place (no scroll while it is on screen). When it closes,
 * focus it left behind comes back to the bar (focusAfterClose).
 */
function useFocusOnToggle(sheet: RefObject<HTMLDivElement | null>): void {
  const { registry } = useFilterBar();
  useEffect(() => {
    const element = sheet.current;
    if (!element) return;
    const onToggle = (event: Event): void => {
      if ((event as ToggleEvent).newState !== 'open') {
        focusAfterClose(element, registry.current);
        return;
      }
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
 * What a step across 48rem needs, run once the page has laid itself out again. `was` is the
 * control focus is on, or the one the step hid from under it (useLayoutStep).
 * - Grown to 48rem with the sheet open (a phone turned on its side), the sheet closes: that layout
 *   has no Filters button and no Show N to close it with (focus then follows focusAfterClose).
 *   Focus on the Filters button, hidden there, goes to the current chip in the bar.
 * - Shrunk under 48rem, focus on a chip or anything else in the closed sheet goes to the Filters
 *   button. The sheet hides them as its display slides to none (0.3s), and Chromium drops their
 *   focus to the page body at once, while they still show.
 * Focus anywhere else stays where it is.
 */
function afterLayoutStep(
  sheet: HTMLElement,
  registry: FilterBarRegistry,
  was: Element | null,
): void {
  const button = shownFiltersButton(registry);
  if (button === null) {
    hideIfOpen(sheet);
    if (was !== null && was === registry.filtersButton) focusInPlace(fallbackFocus(registry));
    return;
  }
  if (was !== null && !isPopoverOpen(sheet) && sheet.contains(was)) focusInPlace(button);
}

/**
 * Whether the bar's layout has just taken `element` from under focus: it no longer shows, or it
 * is in the closed sheet under 48rem (which is hiding it).
 */
function hidByLayout(element: Element, sheet: HTMLElement, registry: FilterBarRegistry): boolean {
  if (!shows(element)) return true;
  return sheet.contains(element) && !isPopoverOpen(sheet) && shownFiltersButton(registry) !== null;
}

/**
 * Follows the page across 48rem (afterLayoutStep). The Filters button shows or hides at exactly
 * that width (its own container query), so an observer on its box sees each step without a
 * second copy of the breakpoint; a resize that stays on one side of it runs nothing. Chromium
 * drops focus from a box the step hides only after the observers have run, so the box is still
 * the active element then. A browser that drops it first leaves the body focused, so the box the
 * layout took from under focus is remembered until focus lands anywhere.
 */
function useLayoutStep(sheet: RefObject<HTMLDivElement | null>): void {
  const { registry } = useFilterBar();
  useEffect(() => {
    const element = sheet.current;
    const button = registry.current.filtersButton;
    if (!element || !button || typeof ResizeObserver !== 'function') return;
    const page = element.ownerDocument;
    let hidUnderFocus: Element | null = null;
    const focusout = (event: FocusEvent): void => {
      const { target, relatedTarget } = event;
      const hid =
        relatedTarget === null &&
        isElement(target) &&
        hidByLayout(target, element, registry.current);
      hidUnderFocus = hid ? target : null;
    };
    const focusin = (): void => {
      hidUnderFocus = null;
    };
    const observer = new ResizeObserver(() => {
      const active = page.activeElement;
      const was = active === null || active === page.body ? hidUnderFocus : active;
      hidUnderFocus = null;
      afterLayoutStep(element, registry.current, was);
    });
    observer.observe(button);
    page.addEventListener('focusout', focusout, true);
    page.addEventListener('focusin', focusin, true);
    return () => {
      observer.disconnect();
      page.removeEventListener('focusout', focusout, true);
      page.removeEventListener('focusin', focusin, true);
    };
  }, [sheet, registry]);
}

/**
 * Where focus a layer let go of comes back to: the Filters button while it shows, else the bar's
 * fallback. Not the current chip first, as fallbackFocus has it: for the 0.3s the closed sheet
 * slides out, its chips still show but can no longer take focus.
 */
const layerHome = (registry: FilterBarRegistry): HTMLElement | null =>
  shownFiltersButton(registry) ?? fallbackFocus(registry);

/**
 * Another layer taking focus over the open sheet (the command palette, a dialog) closes the sheet
 * first; focus that layer drops as it goes comes back to the bar (layers.ts).
 */
function useOtherLayerCloses(sheet: RefObject<HTMLDivElement | null>): void {
  const { registry } = useFilterBar();
  useEffect(() => {
    const element = sheet.current;
    return element ? closeForOtherLayer(element, () => layerHome(registry.current)) : undefined;
  }, [sheet, registry]);
}

/**
 * A tap on the dimmed page around the open sheet only closes it: the link under the finger never
 * gets the click (outside-press.ts).
 */
function useOutsidePressCloses(sheet: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const element = sheet.current;
    return element ? closeOnlyOnOutsidePress(element) : undefined;
  }, [sheet]);
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
  const { model, registry, sheetId } = useFilterBar();
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusOnToggle(sheetRef);
  useOutsidePressCloses(sheetRef);
  useOtherLayerCloses(sheetRef);
  useLayoutStep(sheetRef);
  const chosen = chosenCount(model);
  const noun = model.shown === 1 ? model.noun.one : model.noun.many;
  return (
    <>
      <button
        ref={(element) => {
          // While it shows, the chips are in the sheet (shownFiltersButton).
          registry.current.filtersButton = element;
        }}
        type="button"
        popoverTarget={sheetId}
        data-filter-part="filters"
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
