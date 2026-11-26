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
 * @file The stage's slot maths: where each book slot sits from the centre, the pool of slots the
 * stage keeps in the page and the book each one shows, the pool's size for a stage's box, and the
 * shorter way to a book round the circular shelf. However many books there are, the circular
 * shelf renders 2 x halfWindow + 1 slots; each shows the book its position wraps to, so a slot
 * leaving one side comes back at the other as the next book. A shelf's page (or a short shelf)
 * lines every book up instead. The stage (bookshelf-stage.tsx) and its motion hook
 * (use-shelf-motion.ts) read it. Pure and isomorphic; guarded by
 * tests/unit/bookshelf/slim-shapes.test.ts and tests/unit/bookshelf/scale-budgets.test.ts.
 */

import type { BookItem } from './books';

/** A shelf of fewer books than this lines them up end to end instead of looping them. */
export const MIN_CIRCULAR_BOOKS = 9;
/** Slots either side of the active book before the stage is first measured. */
export const INITIAL_HALF_WINDOW = 5;
/**
 * The book height drags and the jump fade move by until the first measurement. It is never
 * painted: the stage's CSS sizes the books (--book-h on .shelf-shell, the same formula as
 * measureShelf), so the server's HTML is laid out as the browser's.
 */
export const DEFAULT_BOOK_HEIGHT = 360;
/** The stage's height when it reports none (jsdom has no layout). */
export const STAGE_FALLBACK_HEIGHT = 390;
/** The book height's floor in px, as --book-h has it. */
const BOOK_HEIGHT_MIN = 220;
/** The book height's cap in px, as --book-h has it. */
const BOOK_HEIGHT_MAX = 410;
/** The pool never holds fewer than this many slots either side of the active book. */
const MIN_HALF_WINDOW = 3;
/** Slots kept off screen on each side, so a step never shows an empty edge. */
const OFF_SCREEN_SLOTS = 2;

/**
 * Where the first book either side of the active one sits from the stage's centre, and the pitch
 * between the books after it, in book heights. A shelf's page spaces its books a little wider.
 */
export const SLOT_GEOMETRY = {
  circular: { first: 0.515, pitch: 0.19 },
  finite: { first: 0.53, pitch: 0.205 },
} as const;

/** `a` modulo `n`, never negative: a position on the circular shelf as a book index. */
export const wrapIndex = (a: number, n: number): number => ((a % n) + n) % n;

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * A slot's horizontal place as a factor of the book height: 0 for the active book, negative to
 * its left. The slot renders it as calc(var(--book-h) * factor), so the server's HTML puts every
 * book where the browser will, and a lazy cover off the stage stays unloaded.
 */
export function slotOffsetFactor(offset: number, finite: boolean): number {
  if (offset === 0) return 0;
  const { first, pitch } = finite ? SLOT_GEOMETRY.finite : SLOT_GEOMETRY.circular;
  return Math.sign(offset) * (first + (Math.abs(offset) - 1) * pitch);
}

/** The stage's measured book height and pool half-width. */
export interface ShelfMeasure {
  /** In px; drags and the jump fade move by it. */
  readonly bookHeight: number;
  /** Slots either side of the active book: the circular pool is 2 x halfWindow + 1. */
  readonly halfWindow: number;
}

/**
 * The book height and pool half-width for a stage `width` x `height` px. The height is --book-h
 * (bookshelf.module.css .shelf-shell) rounded, so change the two together. The half-width
 * fills half the stage at a 0.5 first offset and a 0.18 pitch, both a little under
 * SLOT_GEOMETRY.circular's, so it errs a slot wide; matching them would change the pool size.
 */
export function measureShelf(width: number, height: number): ShelfMeasure {
  const bookHeight = Math.round(
    Math.max(BOOK_HEIGHT_MIN, Math.min(height * 0.84, BOOK_HEIGHT_MAX, width * 0.88)),
  );
  const x1 = bookHeight * 0.5;
  const pitch = bookHeight * 0.18;
  const halfWindow = Math.max(
    MIN_HALF_WINDOW,
    Math.ceil((width / 2 - x1) / pitch) + OFF_SCREEN_SLOTS,
  );
  return { bookHeight, halfWindow };
}

export interface PoolSlot {
  readonly poolIndex: number;
  readonly slotPosition: number;
  readonly offset: number;
  readonly book: BookItem;
}

export interface PoolSlotsInput {
  readonly books: readonly BookItem[];
  /** The active book's position (unwrapped on the circular shelf). */
  readonly pos: number;
  readonly halfWindow: number;
  /** A shelf's page or a short shelf: every book, in order. */
  readonly finite: boolean;
  /** The book at a position, wrapped or clamped as the shelf is. */
  readonly bookAt: (index: number) => BookItem;
}

/**
 * The slots the stage renders, in a fixed ascending poolIndex order (0 to size - 1) so React never
 * reorders the DOM during a transition: every book on a finite shelf; on the circular shelf,
 * 2 x halfWindow + 1 slots around `pos`, each showing the book at its position.
 */
export function buildPoolSlots({
  books,
  pos,
  halfWindow,
  finite,
  bookAt,
}: PoolSlotsInput): readonly PoolSlot[] {
  if (finite) {
    return books.map((book, index) => ({
      poolIndex: index,
      slotPosition: index,
      offset: index - pos,
      book,
    }));
  }
  const poolSize = 2 * halfWindow + 1;
  const base = pos - halfWindow;
  const baseMod = wrapIndex(base, poolSize);
  const slots: PoolSlot[] = [];
  for (let poolIndex = 0; poolIndex < poolSize; poolIndex += 1) {
    const shift = wrapIndex(poolIndex - baseMod, poolSize);
    const slotPosition = base + shift;
    slots.push({
      poolIndex,
      slotPosition,
      offset: slotPosition - pos,
      book: bookAt(slotPosition),
    });
  }
  return slots;
}

/**
 * How far the stage moves from `pos` to the book at `target`: to the clamped index on a finite
 * shelf; on the circular shelf, the shorter way round, so a jump never passes more than half the
 * books.
 */
export function jumpDelta(target: number, pos: number, bookCount: number, finite: boolean): number {
  if (finite) return clamp(target, 0, bookCount - 1) - pos;
  const delta = wrapIndex(target - wrapIndex(pos, bookCount), bookCount);
  return delta > bookCount / 2 ? delta - bookCount : delta;
}
