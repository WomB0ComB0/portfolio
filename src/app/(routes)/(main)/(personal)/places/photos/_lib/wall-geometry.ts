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
 * @file The endless photo wall's lattice, as pure maths (the infinite-card-grid pattern, our own
 * rewrite from the lab). The wall is a logical sheet of photos repeated forever in both
 * directions, odd columns half a row lower. Only a pool of cards a little larger than the window
 * is in the page; each pool slot shows the cell its pan wraps it to, so a card leaving one edge
 * comes back at the other as the next cell.
 */

/** Below this width (the wall's own box) the cards are phone-sized. */
const COMPACT_WIDTH = 640;
const COMPACT_CARD_WIDTH = 152;
const WIDE_CARD_WIDTH = 240;
const COMPACT_GAP = 10;
const WIDE_GAP = 16;
/** Cards are 4:3. */
const CARD_ASPECT = 3 / 4;
/** The pool covers the window plus this many columns and rows, so no edge shows while panning. */
const EXTRA_COLS = 2;
const EXTRA_ROWS = 3;

export interface Geometry {
  readonly width: number;
  readonly height: number;
  readonly cardW: number;
  readonly cardH: number;
  readonly cellW: number;
  readonly cellH: number;
  /** The pool: cards across and down. */
  readonly cols: number;
  readonly rows: number;
  /** The lattice's row stride: the photo one row down is this many further along the list. */
  readonly sheetC: number;
}

export interface Cell {
  readonly c: number;
  readonly r: number;
}

/** `n` modulo `m`, never negative. */
export const mod = (n: number, m: number): number => ((n % m) + m) % m;

/**
 * The wall's geometry for a box of `width` x `height` showing `count` photos.
 *
 * @example
 * geometryFor(1200, 700, 266).cardW // 240
 */
export function geometryFor(width: number, height: number, count: number): Geometry {
  const compact = width < COMPACT_WIDTH;
  const cardW = compact ? COMPACT_CARD_WIDTH : WIDE_CARD_WIDTH;
  const cardH = cardW * CARD_ASPECT;
  const gap = compact ? COMPACT_GAP : WIDE_GAP;
  const cellW = cardW + gap;
  const cellH = cardH + gap;
  const cols = Math.ceil(width / cellW) + EXTRA_COLS;
  const rows = Math.ceil(height / cellH) + EXTRA_ROWS;
  const sheetC = Math.max(cols + 1, Math.ceil(Math.sqrt((count * cellH) / cellW)));
  return { width, height, cardW, cardH, cellW, cellH, cols, rows, sheetC };
}

/** How many cards the pool holds. */
export const poolSize = (g: Geometry): number => g.cols * g.rows;

/** How far column `c` sits below the rows: odd columns half a row. */
export const stagger = (c: number, g: Geometry): number => (mod(c, 2) === 1 ? g.cellH / 2 : 0);

/** The logical column pool slot `i` shows at pan `px`. */
export function colFor(i: number, px: number, g: Geometry): number {
  const first = Math.floor(-px / g.cellW) - 1;
  return first + mod(i - first, g.cols);
}

/** The logical row pool slot `j` shows in column `c` at pan `py`. */
export function rowFor(j: number, c: number, py: number, g: Geometry): number {
  const first = Math.floor(-(py + stagger(c, g)) / g.cellH) - 1;
  return first + mod(j - first, g.rows);
}

/** The cell pool slot (i, j) shows at pan (px, py). */
export function cellFor(i: number, j: number, px: number, py: number, g: Geometry): Cell {
  const c = colFor(i, px, g);
  return { c, r: rowFor(j, c, py, g) };
}

/**
 * Which photo a cell shows: a lattice over the list, `c + sheetC * r` modulo its length, so each
 * photo's nearest repeat is at least sheetC columns or a sheet's height away. Null with none.
 */
export function photoAt(cell: Cell, g: Geometry, count: number): number | null {
  if (count <= 0) return null;
  return mod(cell.c + g.sheetC * cell.r, count);
}

/** The pan that puts `cell`'s card in the middle of the box. */
export function panToCentre(cell: Cell, g: Geometry): { x: number; y: number } {
  return {
    x: g.width / 2 - g.cardW / 2 - cell.c * g.cellW,
    y: g.height / 2 - g.cardH / 2 - cell.r * g.cellH - stagger(cell.c, g),
  };
}

/** The cell nearest the middle of the box at pan (px, py). */
export function centreCell(px: number, py: number, g: Geometry): Cell {
  const c = Math.round((g.width / 2 - g.cardW / 2 - px) / g.cellW);
  const r = Math.round((g.height / 2 - g.cardH / 2 - py - stagger(c, g)) / g.cellH);
  return { c, r };
}

/** Whether two cells are the same (a null first cell never is). */
export const sameCell = (a: Cell | null, b: Cell): boolean =>
  a !== null && a.c === b.c && a.r === b.r;
