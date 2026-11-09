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
 * @file FilterBar.Chips: a single-select facet as links. Each chip is a link (it works without
 * JavaScript) with its disjunctive count and noun ("Google 20 certificates"); exactly one carries
 * aria-current. A chip at 0 stays where it is, quieter, and still works. A plain click filters in
 * place inside the guarded view transition; a modified click (a new tab) is the browser's.
 *
 * Once it has measured, one aria-hidden pill draws the current chip's fill and slides to the next
 * current chip on clip-path (--motion-spring-in, --ease-spring); before that, without JavaScript
 * and in forced colours, the current chip draws its own. In `scroll` layout the row scrolls
 * sideways inside itself and keeps the current chip in view.
 */

import { type ReactElement, type RefObject, useLayoutEffect, useRef, useState } from 'react';

import { onPlainClick } from '@/lib/dom/plain-click';
import { revealInScroller } from '@/lib/dom/reveal-in-scroller';
import { cn } from '@/lib/utils';
import { useFilterBar } from './context';
import {
  CHIP_CLASS,
  CHIP_COUNT_CLASS,
  CHIP_CURRENT_FILL_CLASS,
  CHIP_LABEL_CLASS,
  CHIP_LIST_CLASS,
  CHIP_LIST_SCROLL_CLASS,
  CHIP_PILL_MODE_CLASS,
  CHIPS_SLOT_CLASS,
  PILL_CLASS,
  SHEET_LABEL_CLASS,
} from './filter-bar-classes';
import { facetOf } from './model';

/** `wrap`: the chips wrap (the sheet, the bar from 48rem). `scroll`: one line that scrolls. */
export type ChipsLayout = 'wrap' | 'scroll';

export interface FilterBarChipsProps {
  /** The facet's key in the schema. */
  readonly facet: string;
  /** The chip that clears the facet. */
  readonly allLabel?: string;
  readonly layout?: ChipsLayout;
}

interface ChipItem {
  readonly slug: string | null;
  readonly label: string;
  readonly count: number;
  readonly current: boolean;
}

/** The pill's clip as the custom properties it reads, each with its value. */
type PillClip = ReadonlyArray<readonly [property: string, value: string]>;

/** The clip that draws the pill over `chip`, measured now. */
function clipFor(list: HTMLElement, pill: HTMLElement, chip: HTMLElement): PillClip {
  const track = list.scrollWidth;
  const height = pill.offsetHeight || list.clientHeight;
  return [
    ['--pill-track', `${track}px`],
    ['--pill-t', `${chip.offsetTop}px`],
    ['--pill-l', `${chip.offsetLeft}px`],
    ['--pill-r', `${Math.max(0, track - chip.offsetLeft - chip.offsetWidth)}px`],
    ['--pill-b', `${Math.max(0, height - chip.offsetTop - chip.offsetHeight)}px`],
  ];
}

/** Whether the pill already holds this clip: it sits there, or is sliding there. */
const holds = (pill: HTMLElement, clip: PillClip): boolean =>
  clip.every(([property, value]) => pill.style.getPropertyValue(property) === value);

/** Writes the pill's clip; `instant` places it without sliding. */
function writeClip(pill: HTMLElement, clip: PillClip, instant: boolean): void {
  if (instant) pill.dataset.instant = '';
  for (const [property, value] of clip) pill.style.setProperty(property, value);
  pill.dataset.on = '';
  if (!instant) return;
  // Commit the instant position before transitions come back on, or it would slide from 0.
  void getComputedStyle(pill).clipPath;
  void getComputedStyle(pill, '::before').clipPath;
  delete pill.dataset.instant;
}

/**
 * After a resize, puts the pill on the chip that is current now, at once, if its box moved. A
 * box that did not move is left alone: placing it at once turns transitions off, which would
 * cancel a slide to that chip (an observer reports every target on its first frame, and a
 * removed chip as resized to nothing).
 */
function followResize(list: HTMLElement, pill: HTMLElement): void {
  const chip = list.querySelector<HTMLElement>('a[aria-current="true"]');
  if (!chip) return;
  const clip = clipFor(list, pill, chip);
  if (!holds(pill, clip)) writeClip(pill, clip, true);
}

/**
 * Keeps the pill on the current chip: placed at once the first time, slid when the current chip
 * changes, and placed at once on a resize of the row or a chip that moves the current chip's box
 * (a count narrows a chip, a late font swaps in, the row wraps differently, the sheet opens).
 * `chips` names the chips in order; a new set (a stand-in in its group's place) is observed
 * afresh. True once placed.
 */
function usePill(
  list: RefObject<HTMLUListElement | null>,
  current: string,
  chips: string,
  layout: ChipsLayout,
): boolean {
  const [ready, setReady] = useState(false);
  const placed = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `current` is the trigger: the pill moves when the current chip does, and the effect reads the chip from the DOM.
  useLayoutEffect(() => {
    const element = list.current;
    const pill = element?.querySelector<HTMLElement>('[data-filter-part="pill"]');
    const chip = element?.querySelector<HTMLElement>('a[aria-current="true"]');
    if (!element || !pill || !chip) return;
    writeClip(pill, clipFor(element, pill, chip), !placed.current);
    placed.current = true;
    setReady(true);
    if (layout === 'scroll') revealInScroller(element, chip);
  }, [list, current, layout]);
  // Its own effect, so a change of current chip makes no new observer whose first report would
  // land in the slide's first frame.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `chips` is the trigger: a new chip set must be observed, and the effect reads the chips from the DOM.
  useLayoutEffect(() => {
    const element = list.current;
    const pill = element?.querySelector<HTMLElement>('[data-filter-part="pill"]');
    if (!element || !pill || typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(() => followResize(element, pill));
    observer.observe(element);
    // A count can change a chip's width, and so the current chip's box, without resizing the row.
    for (const each of element.querySelectorAll<HTMLElement>('[data-filter-part="chip"]')) {
      observer.observe(each);
    }
    return () => observer.disconnect();
  }, [list, chips]);
  return ready;
}

/** One facet's chips: All, then each option. */
export function FilterBarChips({
  facet,
  allLabel = 'All',
  layout = 'wrap',
}: FilterBarChipsProps): ReactElement {
  const { model, registry, change } = useFilterBar();
  const view = facetOf(model, facet);
  const { all, options } = model.options[facet] ?? { all: 0, options: [] };
  const chosen = model.draft[facet] ?? [];
  const items: ChipItem[] = [
    { slug: null, label: allLabel, count: all, current: chosen.length === 0 },
    ...options.map((option) => ({ ...option, current: chosen.includes(option.slug) })),
  ];
  const current = items.find((item) => item.current)?.slug ?? '';
  const chipSet = items.map((item) => item.slug ?? '').join(' ');
  const listRef = useRef<HTMLUListElement>(null);
  const pillReady = usePill(listRef, current, chipSet, layout);
  /** The noun a screen reader hears after a chip's count: "1 certificate", "20 certificates". */
  const nounOf = (count: number): string => (count === 1 ? model.noun.one : model.noun.many);

  return (
    <div className={CHIPS_SLOT_CLASS}>
      <p aria-hidden="true" className={SHEET_LABEL_CLASS}>
        {view.label}
      </p>
      <ul
        ref={(element) => {
          listRef.current = element;
          if (element) registry.current.chipLists.set(facet, element);
          else registry.current.chipLists.delete(facet);
        }}
        aria-label={`Filter by ${view.label.toLowerCase()}`}
        data-filter-part="chips"
        data-pill={pillReady ? 'on' : undefined}
        className={layout === 'scroll' ? CHIP_LIST_SCROLL_CLASS : CHIP_LIST_CLASS}
      >
        {items.map((item) => (
          <li key={item.slug ?? ''}>
            <a
              href={model.hrefFor({ [facet]: item.slug })}
              data-chip={item.slug ?? 'all'}
              data-filter-part="chip"
              data-zero={item.count === 0 && !item.current ? '' : undefined}
              aria-current={item.current ? 'true' : undefined}
              className={cn(CHIP_CLASS, pillReady ? CHIP_PILL_MODE_CLASS : CHIP_CURRENT_FILL_CLASS)}
              onClick={onPlainClick(() => change((latest) => latest.choose(facet, item.slug)))}
            >
              <span className={CHIP_LABEL_CLASS}>{item.label}</span>{' '}
              <span className={CHIP_COUNT_CLASS}>{item.count}</span>{' '}
              {/* The space stays outside: some name engines trim one inside a hidden span. */}
              <span className="sr-only">{nounOf(item.count)}</span>
            </a>
          </li>
        ))}
        <li aria-hidden="true" data-filter-part="pill" className={PILL_CLASS} />
      </ul>
    </div>
  );
}
