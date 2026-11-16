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
 * Every discrete change lands on the new results' top: if they start above the bar's bottom (the
 * visitor had scrolled into them), the page is brought back under the bar first, at once (never
 * animated). With a transition this lines the old and new results up; without one the scroll and
 * the change paint together, so reduced motion and older browsers land in the same place as
 * everyone else. While the change applies the page is held where that left it: without a
 * transition the browser's scroll anchoring would otherwise move it on its own (on /media from
 * 174 to 260; on /certifications, All after scrolling into the list, to the very top).
 *
 * Where the bar does not show the filters (a phone, whose chips live in the sheet; a filter the
 * bar has no control for, such as a series on /media), the results header is the only thing on
 * screen that says which filter is on and lets the visitor take it off: there the change lands
 * on the header instead, brought under the bar in that same first move (`toHead`). A header far
 * above its results (the map sits between them on /places) is never chased.
 *
 * The change itself can move things again: on a phone the applied filters take a line of their
 * own in the results header, so a change that adds it pushes the results down, and a change that
 * takes it away pulls the results' top under the bar. So once the change has applied, the page is
 * settled once more, in the same frame: the results' top is brought back under the bar, and a
 * header the bar's edge cuts is shown whole, as is one wholly behind the bar where the bar does
 * not show the filters (`headMustShow`). A wide page's one-line header wholly behind a bar that
 * shows its filter, or a header wholly in view, is left where it is. Where the results' top was
 * the landing (the visitor was at or past it, and no header took its place: the header far above
 * the map on /places), results the change pushed down are brought back up too; results still
 * below the bar (a visitor near the top) never move.
 */

import { prefersReducedMotion } from '@/lib/design/motion';

/** The results' view-transition-name while a change crossfades them. */
export const RESULTS_TRANSITION_NAME = 'filter-results';
/** Set on <html> while a filter change's transition runs. */
const ROOT_FLAG = 'data-filter-transition';
/** The clip insets, read by ::view-transition-group(filter-results). */
const CLIP_TOP = '--filter-vt-top';
const CLIP_BOTTOM = '--filter-vt-bottom';
/** The gap kept between the bar and whatever is brought back under it. */
const ALIGN_GAP_PX = 8;
/**
 * How far the bar's edge must reach into the header, and the header past the edge, before it
 * counts as cut: boxes sit on fractions of a pixel, and a sliver is not a cut line.
 */
const CUT_SLACK_PX = 1;
/** The island's root (FILTER_SCOPE_CLASS), which holds the bar, the results and their header. */
const SCOPE = '[data-filter-scope]';
/** The results header's parts: FilterBar.Count and FilterBar.Applied. */
const HEAD_PARTS = '[data-filter-part="count"], [data-filter-part="applied"]';
const COUNT_PART = '[data-filter-part="count"]';

type StartViewTransition = (
  update: () => void,
) => { readonly finished?: Promise<unknown> } | undefined;

export interface FilterChangeTargets {
  /** The results' box (FilterBar.Results). */
  readonly results: HTMLElement | null;
  /** The bar (FilterBar.Root), whose bottom edge the results stay under. */
  readonly bar: HTMLElement | null;
  /**
   * Read before the change: it lands on the results header rather than the results' top, because
   * the bar will not show the filters it leaves on (see the file comment).
   */
  readonly toHead?: boolean;
  /**
   * Read once the change has applied: whether the bar leaves a filter unshown, so the header must
   * show even when it ended wholly behind the bar.
   */
  readonly headMustShow?: () => boolean;
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

/** Scrolls the page, at once, so that what is at `top` on screen sits just under `limit`. */
const bringUnder = (top: number, limit: number): void =>
  window.scrollTo({ top: window.scrollY + top - limit - ALIGN_GAP_PX, behavior: 'instant' });

/**
 * Brings the results' top back under the bar when the change pulled it above the bar's edge, or,
 * with `held` (the visitor was at or past their top before the change), when the change pushed it
 * down: something above grew, such as the header over the map on /places.
 */
function alignUnderBar(results: HTMLElement, bar: HTMLElement | null, held: boolean): void {
  const top = results.getBoundingClientRect().top;
  const limit = coverTop(bar);
  const pushedDown = held && top > limit + ALIGN_GAP_PX + CUT_SLACK_PX;
  if (top < limit || pushedDown) bringUnder(top, limit);
}

/**
 * The row that holds the results header (RESULTS_HEAD_CLASS around FilterBar.Count and
 * FilterBar.Applied, on every page): its top never moves with a change, while the count, centred
 * on a one-line row, rises when the applied filters join it. Null when the count has no row of its
 * own.
 */
function headRow(scope: Element | null, results: HTMLElement): Element | null {
  const row = scope?.querySelector(COUNT_PART)?.parentElement ?? null;
  return row && row !== scope && !row.contains(results) ? row : null;
}

/** The top and bottom edges, on screen, of the results header that shows; null for none. */
function headEdges(results: HTMLElement): { readonly top: number; readonly bottom: number } | null {
  const scope = results.closest(SCOPE) ?? results.parentElement;
  const row = headRow(scope, results)?.getBoundingClientRect();
  if (row && row.height > 0) return { top: row.top, bottom: row.bottom };
  const boxes = Array.from(scope?.querySelectorAll(HEAD_PARTS) ?? [], (part) =>
    part.getBoundingClientRect(),
  ).filter((box) => box.height > 0);
  if (boxes.length === 0) return null;
  return {
    top: Math.min(...boxes.map((box) => box.top)),
    bottom: Math.max(...boxes.map((box) => box.bottom)),
  };
}

/**
 * Whether a header from `top` to `bottom` on screen is (partly) behind the bar's bottom edge at
 * `limit`: it starts above that edge and some of it is still on screen. One wholly above the
 * screen has scrolled away with whatever sits between it and its results.
 */
const behindBar = (top: number, bottom: number, limit: number): boolean =>
  top < limit - CUT_SLACK_PX && bottom > 0;

/**
 * Before a change: brings the results' top back under the bar when the visitor had scrolled
 * into them. With `toHead`, a header that would then sit behind the bar is brought under it
 * instead, so the page moves once, straight to where the change will settle. Says whether the
 * results' top is the change's landing (the visitor was at or past it, and no header took its
 * place), which the change must keep under the bar however the page around it moves.
 */
function alignBeforeChange(
  results: HTMLElement,
  bar: HTMLElement | null,
  toHead: boolean,
): boolean {
  const limit = coverTop(bar);
  const top = results.getBoundingClientRect().top;
  const shift = top < limit ? top - limit - ALIGN_GAP_PX : 0;
  const head = toHead ? headEdges(results) : null;
  if (head && behindBar(head.top - shift, head.bottom - shift, limit)) {
    bringUnder(head.top, limit);
    return false;
  }
  if (shift !== 0) window.scrollTo({ top: window.scrollY + shift, behavior: 'instant' });
  return top <= limit + ALIGN_GAP_PX + CUT_SLACK_PX;
}

/**
 * Shows the results header whole, under the bar, when the bar's bottom edge cuts it, or, with
 * `mustShow`, when it is wholly behind the bar.
 */
function showHeader(results: HTMLElement, bar: HTMLElement | null, mustShow: boolean): void {
  const head = headEdges(results);
  if (!head) return;
  const limit = coverTop(bar);
  const cut = head.top <= limit - CUT_SLACK_PX && head.bottom >= limit + CUT_SLACK_PX;
  if (cut || (mustShow && behindBar(head.top, head.bottom, limit))) bringUnder(head.top, limit);
}

/**
 * Settles the page once a change has applied: the results' top back under the bar if the change
 * pulled it above the bar's edge (or, `held`, pushed it down), then the results header whole if
 * that edge cuts it (or it is behind the bar and must show).
 */
function settleUnderBar(
  results: HTMLElement,
  bar: HTMLElement | null,
  headMustShow: (() => boolean) | undefined,
  held: boolean,
): void {
  alignUnderBar(results, bar, held);
  showHeader(results, bar, headMustShow?.() ?? false);
}

/**
 * Applies the change with the page held where it is. Laying the changed page out is when the
 * browser's scroll anchoring moves it (and focus moving into the stuck bar may put it back where
 * the last scroll event left it, before the alignment): either would make a change without a
 * transition land elsewhere than one with it.
 */
function applyInPlace(apply: () => void, results: HTMLElement): void {
  const at = window.scrollY;
  apply();
  void results.getBoundingClientRect();
  if (window.scrollY !== at) window.scrollTo({ top: at, behavior: 'instant' });
}

/** Clips the crossfade to the band of the results that nothing covers. */
function clipToClearBand(results: HTMLElement, bar: HTMLElement | null): void {
  const box = results.getBoundingClientRect();
  const root = document.documentElement.style;
  root.setProperty(CLIP_TOP, `${Math.max(0, coverTop(bar) - box.top)}px`);
  root.setProperty(CLIP_BOTTOM, `${Math.max(0, box.bottom - coverBottom())}px`);
}

/** Takes the results' name, the root's flag and the clip insets off again. */
function release(results: HTMLElement): void {
  results.style.viewTransitionName = '';
  const root = document.documentElement;
  root.removeAttribute(ROOT_FLAG);
  root.style.removeProperty(CLIP_TOP);
  root.style.removeProperty(CLIP_BOTTOM);
}

/** One filter change's transition, by the results it named. */
interface TransitionOwner {
  readonly results: HTMLElement;
}

/** The latest filter change's transition: only its end may release the root's flag and clip. */
let latestOwner: TransitionOwner | null = null;

/**
 * Releases a transition's name, flag and clip, unless a later change's transition owns them now:
 * starting one skips the one before, whose end must not strip the newer one before it captures.
 * A skipped change on another bar still takes the name off its own results, or the next capture
 * would find the name twice and be skipped.
 */
function releaseIfLatest(owner: TransitionOwner): void {
  if (owner === latestOwner) {
    latestOwner = null;
    release(owner.results);
    return;
  }
  if (owner.results !== latestOwner?.results) owner.results.style.viewTransitionName = '';
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
export function runFilterChange(
  apply: () => void,
  { results, bar, toHead = false, headMustShow }: FilterChangeTargets,
): void {
  if (!results) {
    apply();
    return;
  }
  const held = alignBeforeChange(results, bar, toHead);
  const start = startOf();
  if (!start || prefersReducedMotion() || document.hidden || popoverOpen()) {
    applyInPlace(apply, results);
    settleUnderBar(results, bar, headMustShow, held);
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
  const owner: TransitionOwner = { results };
  latestOwner = owner;
  results.style.viewTransitionName = RESULTS_TRANSITION_NAME;
  document.documentElement.setAttribute(ROOT_FLAG, '');
  try {
    const transition = start(() => {
      applyInPlace(applyOnce, results);
      settleUnderBar(results, bar, headMustShow, held);
      clipToClearBand(results, bar);
    });
    // `finished` settles however the transition ends (it runs, the browser skips it because a
    // newer one starts or the tab hides): the change has applied either way, so each outcome only
    // releases, and a skipped one leaves the newer one's name and flag in place for its capture
    // (releaseIfLatest).
    Promise.resolve(transition?.finished)
      .catch(() => undefined)
      .finally(() => releaseIfLatest(owner));
  } catch {
    releaseIfLatest(owner);
    applyInPlace(applyOnce, results);
    settleUnderBar(results, bar, headMustShow, held);
  }
}
