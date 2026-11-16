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
 * @file The phone's Filters sheet as the sheet tests need it, drawn in jsdom, which has no
 * popovers and no layout: the sheet answers :popover-open from a flag, hidePopover is a spy that
 * clears it (and hides the sheet, as a closed popover is), its toggle event is dispatched by hand,
 * and ResizeObserver is a stand-in the test runs. Not a test file.
 */

import { render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';

import { FullBar } from './harness';
import { hideFiltersButton, wideLayout } from './wide-layout';

/** The ResizeObservers the kit made, with what each watches. */
const observers: { callback: ResizeObserverCallback; targets: Element[] }[] = [];

class StandInResizeObserver {
  private readonly entry: { callback: ResizeObserverCallback; targets: Element[] };
  constructor(callback: ResizeObserverCallback) {
    this.entry = { callback, targets: [] };
    observers.push(this.entry);
  }
  observe(target: Element): void {
    this.entry.targets.push(target);
  }
  unobserve(): void {}
  disconnect(): void {
    this.entry.targets = [];
  }
}

/**
 * Puts the stand-in ResizeObserver in place (the setup file's is writable but not configurable,
 * so it is swapped, not stubbed). Returns the undo.
 */
export function standInResizeObservers(): () => void {
  observers.length = 0;
  const saved = globalThis.ResizeObserver;
  globalThis.ResizeObserver = StandInResizeObserver as unknown as typeof ResizeObserver;
  return () => {
    globalThis.ResizeObserver = saved;
  };
}

/** Runs every stand-in observer that watches `target`, as a resize would. */
export function resize(target: Element): void {
  for (const { callback, targets } of observers) {
    if (targets.includes(target)) callback([], {} as ResizeObserver);
  }
}

/** Undo steps for what a test drew; the test file runs them after each test. */
export const undo: (() => void)[] = [];

/** Runs and forgets every undo step. */
export function undoAll(): void {
  for (const step of undo.splice(0)) step();
}

/**
 * Draws the open sheet as a browser does on a phone (jsdom's UA rule keeps every popover
 * display: none, and it focuses nothing inside one). Returns the undo.
 */
export function sheetShows(): () => void {
  const style = document.createElement('style');
  style.textContent = '[data-filter-part="sheet"]{display:flex!important}';
  document.head.append(style);
  return () => style.remove();
}

/**
 * Steps the page across 48rem: `wide` lays the facets out in the bar and hides the Filters
 * button; `phone` takes both away (the closed sheet hides its chips, the button shows). Returns
 * the undo.
 */
export function stepTo(layout: 'wide' | 'phone'): () => void {
  for (const style of document.head.querySelectorAll('style[data-test-layout]')) style.remove();
  if (layout === 'phone') return () => undefined;
  const steps = [wideLayout(), hideFiltersButton()];
  return () => {
    for (const step of steps) step();
  };
}

export interface OpenSheet {
  readonly sheet: HTMLElement;
  readonly button: HTMLElement;
  readonly link: HTMLElement;
  readonly hide: ReturnType<typeof vi.fn>;
  setOpen(next: boolean): void;
}

export interface RenderSheetOptions {
  /** As from a 48rem page: the sheet laid out in the bar, no Filters button. */
  readonly wide?: boolean;
  /** Whether the sheet starts open (the flag :popover-open answers from). */
  readonly open?: boolean;
}

/**
 * The bar beside a link elsewhere on the page, its sheet open (a flag jsdom reads), or closed
 * with `open: false`: on a phone, or `wide`. On a phone the open sheet shows until hidePopover
 * closes it.
 */
export function renderOpenSheet({
  wide = false,
  open: initiallyOpen = true,
}: RenderSheetOptions = {}): OpenSheet {
  const drawn = !wide && initiallyOpen ? sheetShows() : () => undefined;
  undo.push(drawn, wide ? stepTo('wide') : () => undefined);
  render(<FullBar extra={<a href="/elsewhere">Elsewhere</a>} />);
  // Found by its part: from 48rem it is hidden, and a hidden button has no accessible name.
  const button = document.querySelector<HTMLElement>('[data-filter-part="filters"]');
  const sheet = document.getElementById(button?.getAttribute('popovertarget') ?? '');
  if (!button || !sheet) throw new Error('no Filters button or sheet');
  let open = initiallyOpen;
  const matches = sheet.matches.bind(sheet);
  vi.spyOn(sheet, 'matches').mockImplementation((selector) =>
    selector === ':popover-open' ? open : matches(selector),
  );
  const hide = vi.fn(() => {
    open = false;
    drawn();
  });
  Object.defineProperty(sheet, 'hidePopover', { configurable: true, value: hide });
  return {
    sheet,
    button,
    link: screen.getByRole('link', { name: 'Elsewhere' }),
    hide,
    setOpen: (next) => {
      open = next;
    },
  };
}

/** The browser's toggle event for a sheet that has just closed. */
export function closed(sheet: HTMLElement): void {
  const event = new Event('toggle');
  Object.defineProperty(event, 'oldState', { value: 'open' });
  Object.defineProperty(event, 'newState', { value: 'closed' });
  sheet.dispatchEvent(event);
}

/** A Kind chip in the sheet, which jsdom keeps display: none on a phone (it opens no popovers). */
export const kindChip = (sheet: HTMLElement, name: RegExp): HTMLElement =>
  within(sheet).getByRole('link', { name, hidden: true });
