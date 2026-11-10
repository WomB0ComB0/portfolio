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
 * @file The photo wall's lattice, as pure maths: card sizes for a phone and a wide window, the
 * pool of cards a little larger than the window, odd columns half a row lower, which photo each
 * cell shows (never NaN, null with no photos), and the pan that centres a cell.
 */

import { describe, expect, it } from 'vitest';

import {
  centreCell,
  colFor,
  geometryFor,
  panToCentre,
  photoAt,
  poolSize,
  rowFor,
  stagger,
} from '@/app/(routes)/(main)/(personal)/places/photos/_lib/wall-geometry';

describe('geometryFor', () => {
  it('uses 152 x 114 cards with a 10 px gap below 640 px', () => {
    const g = geometryFor(390, 600, 100);

    expect([g.cardW, g.cardH, g.cellW, g.cellH]).toEqual([152, 114, 162, 124]);
  });

  it('uses 240 x 180 cards with a 16 px gap from 640 px', () => {
    const g = geometryFor(1200, 700, 100);

    expect([g.cardW, g.cardH, g.cellW, g.cellH]).toEqual([240, 180, 256, 196]);
  });

  it('pools two more columns and three more rows than fit', () => {
    const g = geometryFor(1200, 700, 100);

    expect(g.cols).toBe(Math.ceil(1200 / 256) + 2);
    expect(g.rows).toBe(Math.ceil(700 / 196) + 3);
    expect(poolSize(g)).toBe(g.cols * g.rows);
  });

  it('strides rows by more than the pool is wide, so a row never repeats on screen', () => {
    const g = geometryFor(1200, 700, 12);

    expect(g.sheetC).toBeGreaterThan(g.cols);
  });
});

describe('the lattice', () => {
  const g = geometryFor(1200, 700, 266);

  it('drops odd columns half a row', () => {
    expect(stagger(0, g)).toBe(0);
    expect(stagger(1, g)).toBe(g.cellH / 2);
    expect(stagger(-1, g)).toBe(g.cellH / 2);
  });

  it('gives every pool slot a distinct column at any pan', () => {
    for (const px of [0, -1000, 1234.5, -77]) {
      const cols = Array.from({ length: g.cols }, (_, i) => colFor(i, px, g));
      expect(new Set(cols).size).toBe(g.cols);
    }
  });

  it('gives every pool slot in a column a distinct row at any pan', () => {
    for (const py of [0, -900, 456.7]) {
      const rows = Array.from({ length: g.rows }, (_, j) => rowFor(j, 3, py, g));
      expect(new Set(rows).size).toBe(g.rows);
    }
  });

  it('shows a photo index in range for any cell, negative ones included', () => {
    for (const cell of [
      { c: 0, r: 0 },
      { c: -5, r: 9 },
      { c: 400, r: -300 },
    ]) {
      const index = photoAt(cell, g, 266);
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(266);
    }
  });

  it('is null, never NaN, with no photos', () => {
    expect(photoAt({ c: 2, r: 3 }, g, 0)).toBeNull();
  });

  it('shows neighbours different photos when there are enough', () => {
    const at = (c: number, r: number) => photoAt({ c, r }, g, 266);

    expect(at(0, 0)).not.toBe(at(1, 0));
    expect(at(0, 0)).not.toBe(at(0, 1));
    expect(at(0, 0)).not.toBe(at(-1, 0));
  });
});

describe('centring', () => {
  const g = geometryFor(1000, 600, 266);

  it('puts a cell in the middle, and reads it back as the centre cell', () => {
    for (const cell of [
      { c: 0, r: 0 },
      { c: 3, r: -2 },
      { c: -7, r: 5 },
    ]) {
      const pan = panToCentre(cell, g);
      expect(centreCell(pan.x, pan.y, g)).toEqual(cell);
    }
  });

  it("centres cell 0:0's card exactly", () => {
    const pan = panToCentre({ c: 0, r: 0 }, g);

    expect(pan.x + g.cardW / 2).toBe(g.width / 2);
    expect(pan.y + g.cardH / 2).toBe(g.height / 2);
  });
});
