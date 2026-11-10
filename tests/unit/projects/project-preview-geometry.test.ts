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
 * @file Where the /projects hover preview's 288 x 162 card goes (variant A, "under the row"):
 * 8px under the hovered row and 24px right of the pointer, flipping left near the right edge,
 * over the row near the bottom edge, never above the stuck filter bar and never closer than
 * 16px to the window's edges; pinned for the keyboard in the right gutter when there is room,
 * else under the row's right end. Where it fits neither under nor over the row clear of the bar
 * (a zoomed or short window), or the window is narrower than the card, there is no spot and the
 * card stays hidden, so it never covers the row or its focused link (WCAG 2.4.11). The card's
 * state changes are immutable.
 */

import { describe, expect, it } from 'vitest';

import {
  type Box,
  besideRowTop,
  CARD_H,
  CARD_W,
  EDGE_MARGIN,
  EMPTY_CARD,
  hideCard,
  pointerSpot,
  ROW_GAP,
  rowSpot,
  type Spot,
  showRow,
  type Viewport,
} from '@/app/(routes)/(main)/(professioal)/projects/_components/project-preview-geometry';

/** A 64px row from x=96 to x=right whose top is at `top`. */
const row = (top: number, right = 1408): Box => ({
  top,
  bottom: top + 64,
  left: 96,
  right,
  height: 64,
});
const WIDE = { width: 1440, height: 900 };
const NO_BAR = 0;
/** The phone bar's 3.5rem, stuck to the top: what a page under 48rem wide keeps clear. */
const STUCK_PHONE_BAR = 56;

/** Whether the card at `spot` overlaps `box`. */
const covers = ([left, top]: Spot, box: Box): boolean =>
  left < box.right && left + CARD_W > box.left && top < box.bottom && top + CARD_H > box.top;

/**
 * Every 60px phone row from just under the bar to the window's bottom edge, 4px apart, at
 * `viewport` (a desktop window zoomed in: 400% of 1440x900 is 360x225, 200% is 720x450).
 */
const rowsDown = (viewport: Viewport): Box[] =>
  Array.from({ length: Math.ceil((viewport.height - STUCK_PHONE_BAR) / 4) }, (_, step) => {
    const top = STUCK_PHONE_BAR - 30 + step * 4;
    return { top, bottom: top + 60, left: 0, right: viewport.width - 16, height: 60 };
  });

/** Each spot the card would take beside each of `rows`, or null where it has none. */
const spotsBeside = (rows: readonly Box[], viewport: Viewport) =>
  rows.flatMap((box) => [
    { box, spot: rowSpot(box, viewport, STUCK_PHONE_BAR) },
    { box, spot: pointerSpot(box.left + 40, box, viewport, STUCK_PHONE_BAR) },
  ]);

describe('the card', () => {
  it('is 288 by 162 (16:9)', () => {
    expect([CARD_W, CARD_H]).toEqual([288, 162]);
  });
});

describe('pointerSpot (variant A)', () => {
  it('hangs 8px under the row, 24px right of the pointer', () => {
    expect(pointerSpot(400, row(300), WIDE, NO_BAR)).toEqual([424, 372]);
  });

  it('flips to the pointer’s left before it would cross the right edge', () => {
    expect(pointerSpot(1300, row(300), WIDE, NO_BAR)).toEqual([1300 - 24 - 288, 372]);
  });

  it('stays 16px inside a window just wide enough for the card', () => {
    const narrow = { width: CARD_W + EDGE_MARGIN * 2, height: 900 };

    expect(pointerSpot(100, row(300, 280), narrow, NO_BAR)?.[0]).toBe(16);
  });

  it('has no spot in a window narrower than the card and its margins', () => {
    const tooNarrow = { width: CARD_W + EDGE_MARGIN * 2 - 1, height: 900 };

    expect(pointerSpot(100, row(300, 280), tooNarrow, NO_BAR)).toBeNull();
  });
});

describe('besideRowTop', () => {
  it('goes over the row when under it would cross the bottom edge', () => {
    expect(besideRowTop(row(786), 900, NO_BAR)).toBe(786 - 8 - 162);
  });

  it('keeps the card under the stuck filter bar when the row slides under it', () => {
    // A row 44px above the window's top: under it would be 28, 40px above the bar's bottom (68).
    const hidden: Box = { top: -44, bottom: 20, left: 96, right: 1315, height: 64 };

    expect(besideRowTop(hidden, 900, 68)).toBe(68 + ROW_GAP);
  });

  it('is null when the card fits neither under nor over the row clear of the bar', () => {
    expect(besideRowTop(row(150), 300, 120)).toBeNull();
  });

  it('is null rather than hanging over the window’s bottom edge', () => {
    // A row below the window: over it would still end past the bottom edge.
    expect(besideRowTop(row(950), 900, NO_BAR)).toBeNull();
  });
});

describe('rowSpot (keyboard and reduced motion)', () => {
  it('uses the right gutter, centred on the row, when there is room (1900 wide)', () => {
    expect(rowSpot(row(400, 1500), { width: 1900, height: 900 }, NO_BAR)).toEqual([
      1516,
      400 + 32 - 81,
    ]);
  });

  it('goes under the row’s right end when the gutter is narrow (1440 wide)', () => {
    expect(rowSpot(row(400), WIDE, NO_BAR)).toEqual([1408 - 288, 472]);
  });

  it('never covers the row it is pinned to', () => {
    const box = row(400);
    const spot = rowSpot(box, WIDE, NO_BAR);

    expect(spot).not.toBeNull();
    expect(covers(spot as Spot, box)).toBe(false);
  });

  it('has no spot once a pinned row has slid under the stuck bar (a scroll after a pin)', () => {
    const underBar: Box = { top: -44, bottom: 20, left: 96, right: 1315, height: 64 };
    const atBarEdge: Box = { top: 4, bottom: 68, left: 96, right: 1315, height: 64 };

    expect(rowSpot(underBar, WIDE, 68)).toBeNull();
    expect(rowSpot(atBarEdge, WIDE, 68)).toBeNull();
    expect(rowSpot(underBar, { width: 1900, height: 900 }, 68)).toBeNull();
  });

  it('keeps the under-the-row spot below the stuck bar while the row is still partly shown', () => {
    const partly: Box = { top: 30, bottom: 94, left: 96, right: 1315, height: 64 };
    const spot = rowSpot(partly, WIDE, 68);

    expect(spot?.[1]).toBeGreaterThanOrEqual(68 + ROW_GAP);
  });

  it('has no spot in the gutter of a window too short for the card under the bar', () => {
    expect(rowSpot(row(100, 1500), { width: 1900, height: 200 }, 68)).toBeNull();
  });

  it('has no spot in a window narrower than the card and its margins', () => {
    expect(rowSpot(row(100, 300), { width: 319, height: 900 }, NO_BAR)).toBeNull();
  });
});

describe('a zoomed desktop window (WCAG 1.4.10 reflow, 2.4.11 focus not obscured)', () => {
  it('at 400% (360x225) shows no card at all: it fits nowhere clear of a row', () => {
    const viewport = { width: 360, height: 225 };

    for (const { spot } of spotsBeside(rowsDown(viewport), viewport)) expect(spot).toBeNull();
  });

  it('at 200% (720x450) never covers the row, the bar or the window’s edges', () => {
    const viewport = { width: 720, height: 450 };
    const placed = spotsBeside(rowsDown(viewport), viewport).filter(({ spot }) => spot !== null);

    expect(placed.length).toBeGreaterThan(0);
    for (const { box, spot } of placed) {
      const [left, top] = spot as Spot;
      expect(covers(spot as Spot, box)).toBe(false);
      expect(top).toBeGreaterThanOrEqual(STUCK_PHONE_BAR + ROW_GAP);
      expect(top + CARD_H).toBeLessThanOrEqual(viewport.height - EDGE_MARGIN);
      expect(left).toBeGreaterThanOrEqual(EDGE_MARGIN);
      expect(left + CARD_W).toBeLessThanOrEqual(viewport.width - EDGE_MARGIN);
    }
  });

  it('at 1440x900 never covers a row anywhere down the window', () => {
    for (const { box, spot } of spotsBeside(rowsDown(WIDE), WIDE)) {
      if (spot) expect(covers(spot, box)).toBe(false);
    }
  });
});

describe('the card state', () => {
  it('shows a row, remembering the one before it and every row seen, without mutating', () => {
    const first = showRow(EMPTY_CARD, 'a');
    const second = showRow(first, 'b');

    expect(EMPTY_CARD).toEqual({ shown: null, previous: null, seen: [] });
    expect(first).toEqual({ shown: 'a', previous: null, seen: ['a'] });
    expect(second).toEqual({ shown: 'b', previous: 'a', seen: ['a', 'b'] });
    expect(showRow(second, 'a').seen).toEqual(['a', 'b']);
    expect(showRow(second, 'b')).toBe(second);
  });

  it('hides, keeping what was seen (its covers stay loaded)', () => {
    const shown = showRow(showRow(EMPTY_CARD, 'a'), 'b');
    const hidden = hideCard(shown);

    expect(hidden).toEqual({ shown: null, previous: null, seen: ['a', 'b'] });
    expect(shown.shown).toBe('b');
    expect(hideCard(hidden)).toBe(hidden);
  });
});
