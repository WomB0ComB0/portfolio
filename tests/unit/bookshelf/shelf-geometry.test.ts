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
 * @file The stage's slot maths (shelf-geometry.ts), pure:
 * - measureShelf: the rounded book height and the pool's half-width for a stage's box, never
 *   under 3 slots a side;
 * - buildPoolSlots: every book on a finite shelf; on the circular shelf a fixed pool around the
 *   active book, of which one step recycles one slot;
 * - jumpDelta: a clamped move on a finite shelf, the shorter way round on the circular one.
 * slotOffsetFactor is covered in slim-shapes.test.ts.
 */

import { describe, expect, it } from 'vitest';
import type { BookItem } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import {
  buildPoolSlots,
  jumpDelta,
  measureShelf,
  wrapIndex,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/shelf-geometry';

/** Stand-in books: the maths only passes them through. */
const booksOf = (count: number): readonly BookItem[] =>
  Array.from({ length: count }, (_, index) => ({ slug: `book-${index}` }) as BookItem);

describe('measureShelf', () => {
  it('sizes the jsdom stage (1024 x 390) to a 328 px book and 8 slots a side', () => {
    expect(measureShelf(1024, 390)).toEqual({ bookHeight: 328, halfWindow: 8 });
  });

  it('caps the book at 410 px and floors it at 220 px', () => {
    expect(measureShelf(1568, 600).bookHeight).toBe(410);
    expect(measureShelf(200, 300).bookHeight).toBe(220);
  });

  it('keeps at least 3 slots either side of the active book', () => {
    expect(measureShelf(200, 300).halfWindow).toBe(3);
    expect(measureShelf(320, 300)).toEqual({ bookHeight: 252, halfWindow: 3 });
  });
});

describe('buildPoolSlots', () => {
  it('lines up every book of a finite shelf by its index', () => {
    const books = booksOf(4);
    const slots = buildPoolSlots({
      books,
      pos: 1,
      halfWindow: 8,
      finite: true,
      bookAt: (index) => books[index] as BookItem,
    });

    expect(slots.map((slot) => slot.offset)).toEqual([-1, 0, 1, 2]);
    expect(slots.map((slot) => slot.book)).toEqual(books);
  });

  it('keeps 2 x halfWindow + 1 slots round the circular shelf, one step recycling one slot', () => {
    const books = booksOf(20);
    const bookAt = (index: number): BookItem => books[wrapIndex(index, 20)] as BookItem;
    const at23 = buildPoolSlots({ books, pos: 23, halfWindow: 2, finite: false, bookAt });
    const at24 = buildPoolSlots({ books, pos: 24, halfWindow: 2, finite: false, bookAt });

    expect(at23.map((slot) => slot.poolIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(at23.map((slot) => slot.offset).sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
    expect(at23.find((slot) => slot.offset === 0)?.book.slug).toBe('book-3');
    const moved = at24.filter(
      (slot, index) => slot.slotPosition !== at23[index]?.slotPosition,
    ).length;
    expect(moved).toBe(1);
  });
});

describe('jumpDelta', () => {
  it('goes the shorter way round the circular shelf', () => {
    expect(jumpDelta(9, 12, 10, false)).toBe(-3);
    expect(jumpDelta(7, 12, 10, false)).toBe(5);
    expect(jumpDelta(2, 12, 10, false)).toBe(0);
  });

  it('clamps the target on a finite shelf', () => {
    expect(jumpDelta(20, 1, 5, true)).toBe(3);
    expect(jumpDelta(-3, 1, 5, true)).toBe(-1);
  });
});
