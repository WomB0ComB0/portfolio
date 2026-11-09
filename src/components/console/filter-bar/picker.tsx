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
 * @file FilterBar.Picker: a multi-select facet (OR within it) as checkboxes named for the facet,
 * so a GET form without JavaScript sends `?tech=react&tech=go`. From a 48rem page a chip-shaped
 * button opens it as a popover under the button (native: it opens without JavaScript, and Escape
 * or a click outside closes it); in the phone sheet it is laid out inline.
 *
 * With JavaScript a box applies at once, the options can be narrowed by their own search (with a
 * polite line saying how many show), and the list starts at the most used: chosen ones first (as
 * they were when the picker opened, so nothing jumps while you pick), then by live count, then
 * Show all. Without JavaScript every option shows and an Apply button submits the form.
 */

import { type ReactElement, useEffect, useId, useMemo, useRef, useState } from 'react';

import { useIsServerHtmlRender } from '@/hooks/use-is-server-html-render';
import type { FacetOption } from '@/lib/filters';
import { useFilterBar } from './context';
import {
  BUTTON_COUNT_CLASS,
  OPTION_CLASS,
  OPTION_COUNT_CLASS,
  OPTION_INPUT_CLASS,
  PICKER_BUTTON_CLASS,
  PICKER_FIELD_CLASS,
  PICKER_FIELDSET_CLASS,
  PICKER_FOOT_CLASS,
  PICKER_LEGEND_CLASS,
  PICKER_OPTIONS_CLASS,
  PICKER_PANEL_CLASS,
  PICKER_SHOWN_CLASS,
  PICKER_TOOLS_CLASS,
  SHEET_DONE_CLASS,
  TEXT_BUTTON_CLASS,
} from './filter-bar-classes';
import { ChevronIcon, SearchIcon } from './icons';
import { facetOf } from './model';

/** How many options show before Show all. */
const DEFAULT_LIMIT = 12;
const PICKER_INPUT_CLASS =
  'min-w-0 flex-1 bg-transparent tile-sub text-foreground outline-none placeholder:text-faint';

export interface FilterBarPickerProps {
  readonly facet: string;
  /** The options' own search, for screen readers: "Filter technologies". */
  readonly searchLabel?: string;
  /** Options shown before Show all. */
  readonly limit?: number;
}

interface Shown {
  readonly option: FacetOption;
  readonly checked: boolean;
  readonly visible: boolean;
}

/** Chosen-at-open first, then by live count, then by label. */
const ordered = (options: readonly FacetOption[], pinned: readonly string[]): FacetOption[] =>
  [...options].sort(
    (a, b) =>
      Number(pinned.includes(b.slug)) - Number(pinned.includes(a.slug)) ||
      b.count - a.count ||
      a.label.localeCompare(b.label),
  );

interface VisibleInput {
  readonly options: readonly FacetOption[];
  readonly chosen: readonly string[];
  readonly query: string;
  /** Without JavaScript, and after Show all, every option shows. */
  readonly limited: boolean;
  readonly limit: number;
}

/** Which options show: those matching the search, or the chosen ones and the top live ones. */
function visibleOptions({ options, chosen, query, limited, limit }: VisibleInput): Shown[] {
  const needle = query.trim().toLowerCase();
  let rank = 0;
  return options.map((option) => {
    const checked = chosen.includes(option.slug);
    const live = option.count > 0;
    const visible = needle
      ? option.label.toLowerCase().includes(needle)
      : checked || !limited || (live && rank < limit);
    if (!checked && live) rank += 1;
    return { option, checked, visible };
  });
}

/** Notes the chosen values each time the panel opens, for the order. */
function usePinnedOnOpen(panelId: string, chosen: readonly string[]): readonly string[] {
  const [pinned, setPinned] = useState(chosen);
  const latest = useRef(chosen);
  useEffect(() => {
    latest.current = chosen;
  }, [chosen]);
  useEffect(() => {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const onToggle = (event: Event): void => {
      if ((event as ToggleEvent).newState === 'open') setPinned(latest.current);
    };
    panel.addEventListener('toggle', onToggle);
    return () => panel.removeEventListener('toggle', onToggle);
  }, [panelId]);
  return pinned;
}

/** A multi-select facet's checkboxes, behind a button from 48rem. */
export function FilterBarPicker({
  facet,
  searchLabel,
  limit = DEFAULT_LIMIT,
}: FilterBarPickerProps): ReactElement {
  const { model, change } = useFilterBar();
  const view = facetOf(model, facet);
  const panelId = useId();
  const hydrated = !useIsServerHtmlRender();
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const chosen = model.draft[facet] ?? [];
  const pinned = usePinnedOnOpen(panelId, chosen);
  const options = model.options[facet]?.options;
  const sorted = useMemo(() => ordered(options ?? [], pinned), [options, pinned]);
  const shown = visibleOptions({
    options: sorted,
    chosen,
    query,
    limited: hydrated && !showAll,
    limit,
  });
  const live = shown.filter(({ option, checked }) => option.count > 0 || checked).length;
  const showing = shown.filter(({ visible }) => visible).length;
  const word = view.label.toLowerCase();

  return (
    <>
      <button
        type="button"
        popoverTarget={panelId}
        data-active={chosen.length > 0 ? '' : undefined}
        className={PICKER_BUTTON_CLASS}
      >
        {view.label}
        {chosen.length > 0 && (
          <>
            {' '}
            <span className={BUTTON_COUNT_CLASS}>{chosen.length}</span>
          </>
        )}
        <ChevronIcon />
      </button>
      <div id={panelId} popover="auto" data-filter-part="picker" className={PICKER_PANEL_CLASS}>
        <fieldset className={PICKER_FIELDSET_CLASS}>
          <legend className={PICKER_LEGEND_CLASS}>{view.label}</legend>
          {hydrated && (
            <div className={PICKER_TOOLS_CLASS}>
              <label className={PICKER_FIELD_CLASS}>
                <SearchIcon />
                <span className="sr-only">{searchLabel ?? `Filter ${word} options`}</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Filter ${word}`}
                  autoComplete="off"
                  spellCheck={false}
                  className={PICKER_INPUT_CLASS}
                />
              </label>
              <p aria-live="polite" className={PICKER_SHOWN_CLASS}>
                {showing} of {live} shown
              </p>
            </div>
          )}
          <div className={PICKER_OPTIONS_CLASS}>
            {shown.map(({ option, checked, visible }) => (
              <label
                key={option.slug}
                hidden={!visible}
                data-zero={option.count === 0 && !checked ? '' : undefined}
                className={OPTION_CLASS}
              >
                <input
                  type="checkbox"
                  name={facet}
                  value={option.slug}
                  checked={checked}
                  onChange={() => change((latest) => latest.toggle(facet, option.slug))}
                  className={OPTION_INPUT_CLASS}
                />
                {option.label} <span className={OPTION_COUNT_CLASS}>{option.count}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className={PICKER_FOOT_CLASS}>
          {hydrated && !query && live > limit && (
            <button
              type="button"
              className={TEXT_BUTTON_CLASS}
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? `Show the top ${limit}` : `Show all ${live}`}
            </button>
          )}
          <noscript>
            <button type="submit" className={SHEET_DONE_CLASS}>
              Apply
            </button>
          </noscript>
        </div>
      </div>
    </>
  );
}
