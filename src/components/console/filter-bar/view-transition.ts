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
 * @file The guarded view transition for a discrete filter change (a chip, a token, a checkbox,
 * Clear): the results crossfade inside their new box (globals.css: `filter-results`), clipped to
 * the clear band between the sticky bar and the bottom edge haze, so the snapshot never paints
 * over the bar, the haze or the phone's bottom bar. Typing never comes here: a view transition
 * holds input while it runs.
 *
 * Nothing animates, and the change applies at once, under reduced motion, in a hidden tab, while
 * a popover (the phone sheet, the picker) is open over the results, or where the browser has no
 * view transitions or refuses one. The results carry their name only for the transition, and
 * the root's own crossfade is turned off for it (`data-filter-transition` on <html>).
 *
 * If the results start above the bar's bottom (the visitor had scrolled into them), they are
 * brought back under the bar first, at once, so the old and new results line up.
 */

import { prefersReducedMotion } from '@/lib/design/motion';

/** The results' view-transition-name while a change crossfades them. */
export const RESULTS_TRANSITION_NAME = 'filter-results';
/** Set on <html> while a filter change's transition runs. */
const ROOT_FLAG = 'data-filter-transition';
/** The clip insets, read by ::view-transition-group(filter-results). */
const CLIP_TOP = '--filter-vt-top';
const CLIP_BOTTOM = '--filter-vt-bottom';
/** The gap kept between the bar and the results when they are brought back under it. */
const ALIGN_GAP_PX = 8;

type StartViewTransition = (
  update: () => void,
) => { readonly finished?: Promise<unknown> } | undefined;

export interface FilterChangeTargets {
  /** The results' box (FilterBar.Results). */
  readonly results: HTMLElement | null;
  /** The bar (FilterBar.Root), whose bottom edge the results stay under. */
  readonly bar: HTMLElement | null;
}

/** Whether a popover is open: CSS `:popover-open`, where the browser knows it. */
function popoverOpen(): boolean {
  try {
    return document.querySelector(':popover-open') !== null;
  } catch {
    return false;
  }
}

/** Where the results are covered from above: the bar's bottom edge, or the screen's top. */
const coverTop = (bar: HTMLElement | null): number => bar?.getBoundingClientRect().bottom ?? 0;

/**
 * Where they are covered from below: the bottom edge haze's band (the layout's EdgeHaze, which
 * sits above the phone's bottom bar), or the screen's bottom.
 */
const coverBottom = (): number =>
  document.querySelector('.edge-haze > .b')?.getBoundingClientRect().top ?? window.innerHeight;

/** Brings the results' top back under the bar when the visitor had scrolled into them. */
function alignUnderBar(results: HTMLElement, bar: HTMLElement | null): void {
  const top = results.getBoundingClientRect().top;
  const limit = coverTop(bar);
  if (top >= limit) return;
  window.scrollTo({ top: window.scrollY + top - limit - ALIGN_GAP_PX, behavior: 'instant' });
}

/** Clips the crossfade to the band of the results that nothing covers. */
function clipToClearBand(results: HTMLElement, bar: HTMLElement | null): void {
  const box = results.getBoundingClientRect();
  const root = document.documentElement.style;
  root.setProperty(CLIP_TOP, `${Math.max(0, coverTop(bar) - box.top)}px`);
  root.setProperty(CLIP_BOTTOM, `${Math.max(0, box.bottom - coverBottom())}px`);
}

function release(results: HTMLElement): void {
  results.style.viewTransitionName = '';
  const root = document.documentElement;
  root.removeAttribute(ROOT_FLAG);
  root.style.removeProperty(CLIP_TOP);
  root.style.removeProperty(CLIP_BOTTOM);
}

/** document.startViewTransition, bound to the document, or null where the browser has none. */
const startOf = (): StartViewTransition | null => {
  const start = (document as unknown as { startViewTransition?: StartViewTransition })
    .startViewTransition;
  return typeof start === 'function' ? start.bind(document) : null;
};

/**
 * Applies a discrete filter change: `apply` must update the DOM synchronously (flushSync), so the
 * new state is what the transition captures.
 */
export function runFilterChange(apply: () => void, { results, bar }: FilterChangeTargets): void {
  if (results) alignUnderBar(results, bar);
  const start = startOf();
  if (!results || !start || prefersReducedMotion() || document.hidden || popoverOpen()) {
    apply();
    return;
  }
  let applied = false;
  /**
   * Applies the change once whatever happens: a browser that refuses after calling back must not
   * apply it twice.
   */
  const applyOnce = (): void => {
    if (applied) return;
    applied = true;
    apply();
  };
  results.style.viewTransitionName = RESULTS_TRANSITION_NAME;
  document.documentElement.setAttribute(ROOT_FLAG, '');
  try {
    const transition = start(() => {
      applyOnce();
      clipToClearBand(results, bar);
    });
    // `finished` rejects when the browser skips the transition (another one starts, the tab
    // hides): the change has applied either way, so both outcomes only release the name.
    Promise.resolve(transition?.finished)
      .catch(() => undefined)
      .finally(() => release(results));
  } catch {
    release(results);
    applyOnce();
  }
}
