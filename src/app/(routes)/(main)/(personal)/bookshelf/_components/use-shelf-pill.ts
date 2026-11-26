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
 * @file The shelf pill: the aria-hidden layer in the filters bar's chip row that marks where the
 * stage is, clipped to the current chip. The hook measures the chip, keeps it in view in a row
 * that scrolls (by scrolling the row alone, never the page), and lands the pill's first placement
 * without a slide. The stage (bookshelf-stage.tsx) calls it before its teleport layout effect, so
 * the pill's layout effect still runs first; bookshelf-filters-bar.tsx draws the pill. Guarded by
 * tests/unit/bookshelf/bookshelf.test.tsx and e2e/performance/bookshelf-budgets.spec.ts.
 */

import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * The shelf pill's clip, in px from each side of its track: the chip row's content width, so a
 * chip scrolled out of a row that scrolls is still covered.
 */
export interface ShelfPillClip {
  readonly track: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface ShelfPillState {
  /** Null until measured: the pill is then clipped away. */
  readonly clip: ShelfPillClip | null;
  /** False for the first placement, which must not slide in from the row's start. */
  readonly animate: boolean;
}

export interface ShelfPill {
  /** Each shelf chip by its slug, set by the filters bar. */
  readonly chipRefs: RefObject<Map<string, HTMLButtonElement>>;
  readonly shelfPill: ShelfPillState;
  /** Measures the pill onto the current chip and brings the chip into view. */
  readonly syncShelfPill: () => void;
  /** The latest syncShelfPill, for listeners set up once (resize, fonts). */
  readonly syncShelfPillRef: RefObject<() => void>;
}

/** The width of the fade over each end of a chip row that scrolls (.track-bar[data-overflow]). */
const TRACK_EDGE_FADE_REM = 1.5;
/** The root font size when the page reports none (jsdom). */
const DEFAULT_ROOT_PX = 16;
/** The shelf pill before its first measurement: no clip, so hidden, and placed without a slide. */
const UNMEASURED_PILL: ShelfPillState = { clip: null, animate: false };

/** {@link TRACK_EDGE_FADE_REM} in px at the page's root font size. */
function trackEdgeFadePx(bar: HTMLElement): number {
  const root = Number.parseFloat(getComputedStyle(bar.ownerDocument.documentElement).fontSize);
  return TRACK_EDGE_FADE_REM * (root > 0 ? root : DEFAULT_ROOT_PX);
}

/**
 * The clip that puts the pill over `chip` in `bar`, measured now. The track ends at the last
 * chip (and the bar's end padding), never past it, so the pill does not hold the row's scroll
 * width open after the chips narrow; a row that wraps is as wide as the bar.
 */
function measureShelfPill(bar: HTMLElement, chip: HTMLElement): ShelfPillClip {
  const last = bar.lastElementChild;
  const endPadding = Number.parseFloat(getComputedStyle(bar).paddingRight) || 0;
  const contentEnd =
    last instanceof HTMLElement ? last.offsetLeft + last.offsetWidth + endPadding : 0;
  const track = Math.max(bar.clientWidth, contentEnd);
  return {
    track,
    top: chip.offsetTop,
    left: chip.offsetLeft,
    right: Math.max(0, track - chip.offsetLeft - chip.offsetWidth),
    bottom: Math.max(0, bar.clientHeight - chip.offsetTop - chip.offsetHeight),
  };
}

/**
 * Scrolls the chip row, and only the row (never the page, as scrollIntoView would), so `chip`
 * shows clear of the fades over its ends: centred when it does not, which is where the row's
 * scroll-snap (centre) rests, so the browser does not snap it back under a fade. At once, so
 * there is no smooth scroll to sit through or to turn off for reduced motion. A no-op when the
 * chip already shows clear, or the row does not scroll.
 */
function revealShelfChip(bar: HTMLElement, chip: HTMLElement, fade: number): void {
  const max = bar.scrollWidth - bar.clientWidth;
  if (max <= 0) return;
  const view = bar.getBoundingClientRect();
  const box = chip.getBoundingClientRect();
  if (box.left >= view.left + fade && box.right <= view.right - fade) return;
  const offCentre = box.left + box.width / 2 - (view.left + view.width / 2);
  bar.scrollLeft = Math.min(max, Math.max(0, Math.round(bar.scrollLeft + offCentre)));
}

const sameShelfPillClip = (a: ShelfPillClip, b: ShelfPillClip): boolean =>
  a.track === b.track &&
  a.top === b.top &&
  a.right === b.right &&
  a.bottom === b.bottom &&
  a.left === b.left;

/** The pill over the chip of `locationShelfSlug`: the filtered shelf, else the book on stage's. */
export function useShelfPill(locationShelfSlug: string): ShelfPill {
  const [shelfPill, setShelfPill] = useState<ShelfPillState>(UNMEASURED_PILL);
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  /**
   * Clips the shelf pill to the current chip and keeps that chip in view in a chip row that
   * scrolls, by scrolling the row alone (revealShelfChip): never scrollIntoView, which would also
   * scroll the page when the reader is further down it.
   */
  const syncShelfPill = useCallback((): void => {
    const chip = chipRefs.current.get(locationShelfSlug);
    const bar = chip?.parentElement;
    if (!chip || !bar) return;
    const clip = measureShelfPill(bar, chip);
    setShelfPill((prev) =>
      prev.clip !== null && sameShelfPillClip(prev.clip, clip) ? prev : { ...prev, clip },
    );
    revealShelfChip(bar, chip, trackEdgeFadePx(bar));
  }, [locationShelfSlug]);

  const syncShelfPillRef = useRef<() => void>(syncShelfPill);
  syncShelfPillRef.current = syncShelfPill;

  // The pill's first placement lands at once (.no-anim): its clip is committed to style here,
  // before transitions come on, so it never slides in from the row's start. It slides after that.
  useLayoutEffect(() => {
    if (shelfPill.clip === null || shelfPill.animate) return;
    const pill = chipRefs.current.get(locationShelfSlug)?.parentElement?.firstElementChild;
    if (pill) void getComputedStyle(pill).clipPath;
    setShelfPill((prev) => (prev.animate ? prev : { ...prev, animate: true }));
  }, [shelfPill, locationShelfSlug]);

  return { chipRefs, shelfPill, syncShelfPill, syncShelfPillRef };
}
