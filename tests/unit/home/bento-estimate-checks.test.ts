/**
 * Copyright 2025 Mike Odnis
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
 * @file The home bento's browser checks of the server's estimates (e2e/journeys/home-bento.spec.ts),
 * run on made-up measures of the page with and without JavaScript: which slots they compare, which
 * they leave out and why, and which misses they accept (bento-layout.ts's BENTO_ESTIMATE_GAPS).
 */

import { describe, expect, it } from 'vitest';

import type {
  BentoMeasure,
  GridMeasure,
  SlotMeasure,
  SlotState,
} from '../../../e2e/fixtures/home-bento';
import {
  compareEstimates,
  compareFirstPaint,
  spansEveryLane,
} from '../../../e2e/fixtures/home-bento-estimates';

const ROW_PX = 2;

/** Two lanes at 1.3 : 1 in a 560 px bento (sm-wide, a 600 px phone). */
const NARROW_WIDE: GridMeasure = {
  display: 'grid',
  top: 0,
  left: 0,
  width: 560,
  autoRows: 'minmax(2px, auto)',
  rowUnit: ROW_PX,
  rowGap: 0,
  lanes: [309.7, 238.3],
  columnGap: 12,
};

/** Two equal lanes in a 646 px bento (md, a 700 px desktop window). */
const MEDIUM: GridMeasure = { ...NARROW_WIDE, width: 646, lanes: [315, 315], columnGap: 16 };

/** Three lanes at 1.3 : 1 : 1 in the 1136 px bento (lg). */
const WIDE: GridMeasure = {
  ...NARROW_WIDE,
  width: 1136,
  lanes: [435, 334.6, 334.6],
  columnGap: 16,
};

interface SlotSpec {
  /** Its top, from the grid's top. */
  readonly y: number;
  /** The height it needs: its tile and the gap below it. */
  readonly natural: number;
  readonly width: number;
  /** The rows its span asks for (the estimate's, without JavaScript). */
  readonly rows?: number;
  readonly columns?: number;
  readonly state?: SlotState;
}

function slotOf(area: string, spec: SlotSpec): SlotMeasure {
  const { y, natural, width, columns = 1, state = 'reference' } = spec;
  return {
    area,
    slot: { x: 0, y, width, height: natural },
    tile: { x: 0, y, width, height: natural - 12 },
    slack: 0,
    natural,
    rows: spec.rows ?? Math.ceil(natural / ROW_PX),
    columns,
    state,
  };
}

const measureOf = (grid: GridMeasure, slots: Readonly<Record<string, SlotSpec>>): BentoMeasure => ({
  grid,
  slots: Object.entries(slots).map(([area, spec]) => slotOf(area, spec)),
});

describe('the estimate check', () => {
  // Review finding WF2-e2e-2: at 600 px, a status tile showing 'Last known' (86 px, not 64) sent
  // LeetCode to the wider lane with JavaScript, where it is 152 px, not the 184 px its estimate
  // is for in the narrower lane, and the check failed a table that was right.
  it('leaves out a lane slot that a slot not in its reference state sent to a lane of another width', () => {
    const withScript = measureOf(NARROW_WIDE, {
      status: { y: 0, natural: 98, width: 309.7, state: 'stale' },
      leet: { y: 0, natural: 164, width: 238.3 },
      type: { y: 98, natural: 148, width: 309.7 },
    });
    const withoutScript = measureOf(NARROW_WIDE, {
      status: { y: 0, natural: 76, width: 309.7, rows: 38 },
      leet: { y: 76, natural: 164, width: 309.7, rows: 98 },
      type: { y: 0, natural: 148, width: 238.3, rows: 74 },
    });

    const { stale, skipped } = compareEstimates(withScript, withoutScript);

    expect(stale).toEqual([]);
    expect(skipped).toEqual([
      'status (stale)',
      'leet (a 238.3 px lane with JavaScript, 309.7 px without, after status (stale))',
      'type (a 309.7 px lane with JavaScript, 238.3 px without, after status (stale))',
    ]);
  });

  it('still compares a lane slot whose lane changed width when every slot before it is a reference', () => {
    const withScript = measureOf(NARROW_WIDE, {
      status: { y: 0, natural: 76, width: 309.7 },
      leet: { y: 0, natural: 164, width: 238.3 },
    });
    const withoutScript = measureOf(NARROW_WIDE, {
      status: { y: 0, natural: 76, width: 309.7, rows: 38 },
      leet: { y: 76, natural: 164, width: 309.7, rows: 98 },
    });

    expect(compareEstimates(withScript, withoutScript).stale).toEqual([
      'leet: reserves 196 px, needs 164 px, in a 238.3 px lane with JavaScript, 309.7 px without',
    ]);
  });

  it('still compares, after a slot not in its reference state, a slot across every lane and a lane slot in a lane of the same width', () => {
    const withScript = measureOf(MEDIUM, {
      status: { y: 0, natural: 98, width: 315, state: 'stale' },
      type: { y: 98, natural: 152, width: 315 },
      gh: { y: 250, natural: 284, width: 646, columns: 2 },
    });
    const withoutScript = measureOf(MEDIUM, {
      status: { y: 0, natural: 80, width: 315, rows: 40 },
      type: { y: 80, natural: 152, width: 315, rows: 96 },
      gh: { y: 272, natural: 284, width: 646, columns: 2, rows: 160 },
    });

    expect(compareEstimates(withScript, withoutScript).stale).toEqual([
      'type: reserves 192 px, needs 152 px',
      'gh: reserves 320 px, needs 284 px, across every lane',
    ]);
  });

  // Review finding WF2-e2e-2, the round-2 check's remainder: a slot in an error, empty or stale
  // state only in the load without JavaScript is taller than its estimate there, so it can send a
  // later lane slot to another lane, though it shows its reference content with JavaScript.
  it('leaves out a lane slot sent to another lane by a slot stale only without JavaScript', () => {
    const withScript = measureOf(NARROW_WIDE, {
      status: { y: 0, natural: 76, width: 309.7 },
      leet: { y: 0, natural: 164, width: 238.3 },
    });
    const withoutScript = measureOf(NARROW_WIDE, {
      status: { y: 0, natural: 98, width: 309.7, rows: 38, state: 'stale' },
      leet: { y: 98, natural: 196, width: 309.7, rows: 98 },
    });

    const { stale, skipped } = compareEstimates(withScript, withoutScript);

    // Status itself is compared: its estimate's rows against its height with JavaScript.
    expect(stale).toEqual([]);
    expect(skipped).toEqual([
      'leet (a 238.3 px lane with JavaScript, 309.7 px without, after status (stale without JavaScript))',
    ]);
  });

  it('does not count a skeleton without JavaScript as a cause: every streamed tile keeps one there', () => {
    const withScript = measureOf(NARROW_WIDE, {
      status: { y: 0, natural: 76, width: 309.7 },
      leet: { y: 0, natural: 164, width: 238.3 },
    });
    const withoutScript = measureOf(NARROW_WIDE, {
      status: { y: 0, natural: 76, width: 309.7, rows: 38, state: 'loading' },
      leet: { y: 76, natural: 164, width: 309.7, rows: 98 },
    });

    expect(compareEstimates(withScript, withoutScript)).toMatchObject({
      stale: [
        'leet: reserves 196 px, needs 164 px, in a 238.3 px lane with JavaScript, 309.7 px without',
      ],
      skipped: [],
    });
  });

  // Review findings WF2-e2e-1 and WF2-D8-700-red: the md project is 271.2 to 310.9 px (its 2:1
  // cover grows with its lane), so at a 646 px bento it reserves 308 px and needs 288.5 px (a
  // 272.5 px tile and the 16 px gap), on every run.
  it('accepts the project at medium as a known gap inside its measured range, reporting it', () => {
    const withScript = measureOf(MEDIUM, { proj: { y: 558, natural: 288.5, width: 315 } });
    const withoutScript = measureOf(MEDIUM, {
      proj: { y: 558, natural: 288.5, width: 315, rows: 154 },
    });

    const { stale, accepted } = compareEstimates(withScript, withoutScript);

    expect(stale).toEqual([]);
    expect(accepted).toEqual([
      'proj at md: reserves 308 px, needs 288.5 px (a 272.5 px tile, inside the measured 271.2 to 310.9 px)',
    ]);
  });

  // Review finding WF2-LAYOUT-2: the acceptance had no bound, so a project of any height at md
  // passed, and so would a regression of the md or md-wide project.
  it('fails the project at medium when its tile is outside the measured range: 420 px', () => {
    const withScript = measureOf(MEDIUM, { proj: { y: 558, natural: 436, width: 315 } });
    const withoutScript = measureOf(MEDIUM, {
      proj: { y: 558, natural: 436, width: 315, rows: 154 },
    });

    expect(compareEstimates(withScript, withoutScript)).toMatchObject({
      stale: [
        'proj at md: reserves 308 px, needs 436 px (a 420 px tile, outside the measured 271.2 to 310.9 px, ±2 px)',
      ],
      accepted: [],
    });
  });

  // Review finding R3-CHK-2: only the height the project needs was bounded, so a project whose
  // span broke at md (80 or 600 px reserved, say by a later rule on its slot) was accepted once
  // its tile was inside the range.
  it('fails the project at medium when what it reserves is outside the measured range', () => {
    const at = (rows: number): ReturnType<typeof compareEstimates> =>
      compareEstimates(
        measureOf(MEDIUM, { proj: { y: 558, natural: 317.3, width: 315 } }),
        measureOf(MEDIUM, { proj: { y: 558, natural: 317.3, width: 315, rows } }),
      );
    expect(at(40)).toMatchObject({
      stale: [
        'proj at md: reserves 80 px, needs 317.3 px (it reserves a 64 px tile, outside the measured 271.2 to 310.9 px, ±2 px)',
      ],
      accepted: [],
    });
    expect(at(300)).toMatchObject({
      stale: [expect.stringContaining('it reserves a 584 px tile, outside')],
      accepted: [],
    });
    // The estimate's own 154 rows (a 292 px tile) are inside, and so is a row past the range's
    // 2 px (a 314 px tile, for rounding up to whole rows); a 316 px tile is not.
    expect(at(154)).toMatchObject({ stale: [], accepted: [] });
    expect(at(165)).toMatchObject({ stale: [], accepted: [] });
    expect(at(166)).toMatchObject({ stale: [expect.stringContaining('316 px tile, outside')] });
  });

  it('allows 2 px either side of the measured range, and no more', () => {
    const at = (natural: number): ReturnType<typeof compareEstimates> =>
      compareEstimates(
        measureOf(MEDIUM, { proj: { y: 558, natural, width: 315 } }),
        measureOf(MEDIUM, { proj: { y: 558, natural, width: 315, rows: 154 } }),
      );
    // Tiles of 310.9 + 2 px and 271.2 - 2 px (and the 16 px gap), then just past each.
    expect(at(328.9)).toMatchObject({ stale: [], accepted: [expect.stringContaining('inside')] });
    expect(at(329.5)).toMatchObject({ stale: [expect.stringContaining('outside')], accepted: [] });
    expect(at(285.2)).toMatchObject({ stale: [], accepted: [expect.stringContaining('inside')] });
    expect(at(284.5)).toMatchObject({ stale: [expect.stringContaining('outside')], accepted: [] });
    // Within 16 px of the 308 px it reserves: it fits, and nothing is reported.
    expect(at(300)).toMatchObject({ stale: [], accepted: [] });
  });

  it('accepts a gap only in the tiers it names, and reports none where the estimate holds', () => {
    const wideWith = measureOf(WIDE, { proj: { y: 292, natural: 260, width: 435 } });
    const wideWithout = measureOf(WIDE, { proj: { y: 292, natural: 260, width: 435, rows: 147 } });
    expect(compareEstimates(wideWith, wideWithout)).toMatchObject({
      stale: ['proj: reserves 294 px, needs 260 px'],
      accepted: [],
    });

    const closeWith = measureOf(MEDIUM, { proj: { y: 558, natural: 304, width: 315 } });
    const closeWithout = measureOf(MEDIUM, {
      proj: { y: 558, natural: 304, width: 315, rows: 154 },
    });
    expect(compareEstimates(closeWith, closeWithout)).toMatchObject({ stale: [], accepted: [] });
  });

  it('counts a slot across every lane by its span, against every lane of the grid', () => {
    const [hero] = measureOf(MEDIUM, {
      hero: { y: 0, natural: 292, width: 646, columns: 2 },
    }).slots;
    const [now] = measureOf(MEDIUM, { now: { y: 292, natural: 114, width: 315 } }).slots;
    expect(hero && spansEveryLane(MEDIUM, hero)).toBe(true);
    expect(now && spansEveryLane(MEDIUM, now)).toBe(false);
    expect(hero && spansEveryLane(WIDE, hero)).toBe(false);
  });
});

describe('the first paint check', () => {
  interface PackSpec {
    readonly projNatural?: number;
    readonly projRows?: number;
    readonly projTop?: number;
    readonly ghTop?: number;
    readonly roleTop: number;
  }
  /**
   * md at 646 px: GitHub 12 px under its height, the project in the lane beside it, then roles.
   * With JavaScript, roles sits at 848 px.
   */
  const pack = (
    grid: GridMeasure,
    { projNatural = 288.5, projRows, projTop = 558, ghTop = 540, roleTop }: PackSpec,
  ): BentoMeasure =>
    measureOf(grid, {
      gh: { y: ghTop, natural: 284, width: 315, rows: projRows === undefined ? undefined : 136 },
      proj: { y: projTop, natural: projNatural, width: 315, rows: projRows },
      role: {
        y: roleTop,
        natural: 226,
        width: 315,
        rows: projRows === undefined ? undefined : 113,
      },
    });
  const withScript = pack(MEDIUM, { roleTop: 848 });
  const withoutScript = (projRows: number, ghTop = 540, roleTop = 878): BentoMeasure =>
    pack(MEDIUM, { projRows, ghTop, roleTop });

  it('does not run while a slot shows another state, naming it', () => {
    const stale = measureOf(MEDIUM, { status: { y: 0, natural: 98, width: 315, state: 'stale' } });
    const loading = measureOf(MEDIUM, {
      status: { y: 0, natural: 80, width: 315, state: 'loading' },
    });
    expect(compareFirstPaint(stale, loading)).toEqual({
      blockers: ['status (stale, with JavaScript)'],
      moved: [],
      excused: [],
    });
  });

  it('reports, without failing, the moves of the slots after a gap that is off here', () => {
    expect(compareFirstPaint(withScript, withoutScript(154))).toEqual({
      blockers: [],
      moved: [],
      excused: ['role: top 878 px without JavaScript, 848 px with it (after proj, a gap at md)'],
    });
  });

  // Review finding WF2-D8-700-red: GitHub's 12 px md miss adds to the project's 11 to 15 px, so
  // the slots after the project move 16.5 to 27.5 px at 716 to 742 and 800 to 846 px windows,
  // where the project itself is within 16 px. The excuse used to need the project to be off.
  it('excuses the moves after a gap that holds here too: roles 26 px', () => {
    // 308 px reserved for a 304 px slot (a 288 px tile): within 16 px, so the project fits.
    const holds = pack(MEDIUM, { projNatural: 304, projRows: 154, roleTop: 878 });
    const settled = pack(MEDIUM, { projNatural: 304, roleTop: 852 });

    expect(compareEstimates(settled, holds)).toMatchObject({ stale: [], accepted: [] });
    expect(compareFirstPaint(settled, holds)).toEqual({
      blockers: [],
      moved: [],
      excused: ['role: top 878 px without JavaScript, 852 px with it (after proj, a gap at md)'],
    });
  });

  // Review finding WF2-LAYOUT-2: unbounded, the excuse let any move after the gap pass.
  it('fails a move after the gap larger than the bound: roles 60 px', () => {
    expect(compareFirstPaint(withScript, withoutScript(154, 540, 908))).toEqual({
      blockers: [],
      moved: [
        'role: top 908 px without JavaScript, 848 px with it, more than the 48 px a slot after proj may move at md',
      ],
      excused: [],
    });
  });

  // The worst move measured with this table: at a 799 px bento GitHub reserves 12 px more than it
  // needs, the project needs 326.8 px (a 310.8 px tile) against the 308 its estimate reserves, and
  // the place's two-line hedge reserves 10 px more than a one-line name needs, so the site index,
  // below the place, moves 40.8 px.
  it('excuses the worst move measured across md and md-wide: the site index 40.8 px at 799 px', () => {
    const topOfMedium: GridMeasure = { ...MEDIUM, width: 799, lanes: [391.5, 391.5] };
    const settled = measureOf(topOfMedium, {
      proj: { y: 558, natural: 326.8, width: 391.5 },
      place: { y: 800, natural: 122, width: 391.5 },
      strip: { y: 922, natural: 133, width: 391.5 },
    });
    const firstPaint = measureOf(topOfMedium, {
      proj: { y: 558, natural: 326.8, width: 391.5, rows: 154 },
      place: { y: 827.5, natural: 122, width: 391.5, rows: 66 },
      strip: { y: 962.8, natural: 133, width: 391.5, rows: 67 },
    });

    expect(compareFirstPaint(settled, firstPaint)).toEqual({
      blockers: [],
      moved: [],
      excused: [
        'place: top 827.5 px without JavaScript, 800 px with it (after proj, a gap at md)',
        'strip: top 962.8 px without JavaScript, 922 px with it (after proj, a gap at md)',
      ],
    });
  });

  it('holds the slots up to the gap to 16 px: GitHub moving 20 px fails', () => {
    expect(compareFirstPaint(withScript, withoutScript(154, 520))).toEqual({
      blockers: [],
      moved: ['gh: top 520 px without JavaScript, 540 px with it'],
      excused: ['role: top 878 px without JavaScript, 848 px with it (after proj, a gap at md)'],
    });
  });

  // Review finding R3-CHK-1: every case kept the project at 558 px with and without JavaScript,
  // so excusing the gap slot itself (its index, not only the ones after it) passed them all.
  it('holds the gap slot itself to 16 px: the project moving 20 px fails', () => {
    const projectMoved = pack(MEDIUM, { projRows: 154, projTop: 578, roleTop: 878 });
    expect(compareFirstPaint(withScript, projectMoved)).toEqual({
      blockers: [],
      moved: ['proj: top 578 px without JavaScript, 558 px with it'],
      excused: ['role: top 878 px without JavaScript, 848 px with it (after proj, a gap at md)'],
    });
  });

  it('holds every slot to 16 px in a tier without a gap', () => {
    const wide = pack(WIDE, { roleTop: 848 });
    expect(compareFirstPaint(wide, pack(WIDE, { projRows: 147, roleTop: 878 }))).toEqual({
      blockers: [],
      moved: ['role: top 878 px without JavaScript, 848 px with it'],
      excused: [],
    });
  });
});
