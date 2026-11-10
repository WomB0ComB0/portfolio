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
 * @file Where the /projects hover preview's card goes, and what it shows, as pure functions
 * (the owner's pick: variant A, "under the row", with no lean). The window's size and the
 * bottom of the stuck filter bar come in as arguments, so the maths is testable and the card
 * never covers the bar:
 * - following a pointer: 8px under the hovered row (over it near the window's bottom), its left
 *   edge 24px right of the pointer (flipped to the pointer's left near the right edge), so the
 *   row being read is never covered;
 * - pinned to a row (keyboard focus, reduced motion): in the right gutter when the window has
 *   room, else under the row's right end; no spot once the row has slid under the stuck bar or
 *   off the window (a scroll after the pin);
 * - never closer than 16px to the window's edges.
 * Where the card fits neither under nor over the row clear of the bar (a short or zoomed window:
 * 200% to 400% of a desktop one), or the window is narrower than the card and its margins, there
 * is no spot (null) and the card stays hidden: it never covers the row or its focused link.
 */

export const CARD_W = 288;
export const CARD_H = 162;
/** The gap between the pointer and the card's near edge. */
export const POINTER_GAP = 24;
/** The card never comes closer than this to the window's edges. */
export const EDGE_MARGIN = 16;
/** The gap between a row (or the stuck bar) and the card beside it. */
export const ROW_GAP = 8;

/** A row's box, as getBoundingClientRect() gives it. */
export interface Box {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly height: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** The card's top-left corner, in window coordinates. */
export type Spot = readonly [left: number, top: number];

/** What the card shows. */
export interface CardState {
  /** The row shown, or null while hidden. */
  readonly shown: string | null;
  /** The row shown before it, kept whole underneath while the new one fades in. */
  readonly previous: string | null;
  /** Every row hovered or focused so far: only their covers are ever fetched. */
  readonly seen: readonly string[];
}

export const EMPTY_CARD: CardState = { shown: null, previous: null, seen: [] };

/** `value` within [min, max]; min wins when the range is empty. */
const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** The highest the card's top may go: clear of the window's edge and of the stuck bar. */
const topFloor = (topLimit: number): number => Math.max(EDGE_MARGIN, topLimit + ROW_GAP);

/** The lowest the card's top may go: its bottom edge 16px inside the window's. */
const topCeiling = (viewportHeight: number): number => viewportHeight - EDGE_MARGIN - CARD_H;

/** Whether the window is wide enough for the card and its margins on both sides. */
const fitsAcross = (viewport: Viewport): boolean => viewport.width >= CARD_W + EDGE_MARGIN * 2;

/**
 * The card's top beside a row, clear of it: under it (never above the stuck bar, `topLimit`, the
 * bar's bottom in window coordinates) when that fits above the window's bottom edge, else over
 * it when that fits under the bar, else null (it fits neither: a short or zoomed window).
 */
export function besideRowTop(box: Box, viewportHeight: number, topLimit: number): number | null {
  const floor = topFloor(topLimit);
  const ceiling = topCeiling(viewportHeight);
  const under = Math.max(floor, box.bottom + ROW_GAP);
  if (under <= ceiling) return under;
  const over = box.top - ROW_GAP - CARD_H;
  return over >= floor && over <= ceiling ? over : null;
}

/**
 * The card's spot for a pointer at x `pointerX` over a row: right of the pointer, or left of it
 * when the right would cross the window's edge, then kept inside the window; null where the
 * window has no room for it clear of the row.
 */
export function pointerSpot(
  pointerX: number,
  box: Box,
  viewport: Viewport,
  topLimit: number,
): Spot | null {
  if (!fitsAcross(viewport)) return null;
  const top = besideRowTop(box, viewport.height, topLimit);
  if (top === null) return null;
  const right = pointerX + POINTER_GAP;
  const left =
    right + CARD_W > viewport.width - EDGE_MARGIN ? pointerX - POINTER_GAP - CARD_W : right;
  return [clamp(left, EDGE_MARGIN, viewport.width - CARD_W - EDGE_MARGIN), top];
}

/**
 * The card's spot pinned to a row, never over it: in the right gutter, centred on the row, when
 * the window has room for the card and its margins there; else under the row's right end (over
 * it near the bottom edge). Null once the row is hidden under the stuck bar or below the window,
 * and wherever the card has no room clear of the row.
 */
export function rowSpot(box: Box, viewport: Viewport, topLimit: number): Spot | null {
  if (box.bottom <= topLimit || box.top >= viewport.height || !fitsAcross(viewport)) return null;
  if (viewport.width - box.right >= CARD_W + EDGE_MARGIN * 2) {
    const floor = topFloor(topLimit);
    const ceiling = topCeiling(viewport.height);
    if (ceiling < floor) return null;
    return [box.right + EDGE_MARGIN, clamp(box.top + box.height / 2 - CARD_H / 2, floor, ceiling)];
  }
  const top = besideRowTop(box, viewport.height, topLimit);
  if (top === null) return null;
  return [clamp(box.right - CARD_W, EDGE_MARGIN, viewport.width - CARD_W - EDGE_MARGIN), top];
}

/** The card showing row `id`: the same state when it already is, else a new one. */
export function showRow(state: CardState, id: string): CardState {
  if (state.shown === id) return state;
  return {
    shown: id,
    previous: state.shown,
    seen: state.seen.includes(id) ? state.seen : [...state.seen, id],
  };
}

/** The card hidden, keeping every row seen (their covers stay loaded); the same state if hidden. */
export function hideCard(state: CardState): CardState {
  if (state.shown === null && state.previous === null) return state;
  return { ...state, shown: null, previous: null };
}
