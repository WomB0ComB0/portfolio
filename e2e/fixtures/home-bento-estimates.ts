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
 * @file The home bento's estimate and first paint comparisons: pure functions of the page measured
 * with JavaScript and the same page measured without it (fixtures/home-bento.ts's measureBento),
 * with no browser and no Playwright import, so tests/unit/home/bento-estimate-checks.test.ts runs
 * them on made-up measures. e2e/journeys/home-bento.spec.ts reports what they find. Also the settle
 * wait's test of one slot's span (isSpanSettled), for the same reason.
 */

import {
  BENTO_ESTIMATE_GAPS,
  BENTO_GAP_PX,
  BENTO_ROW_PX,
  type BentoTier,
  bentoTierAt,
  type HeightRange,
  rowsFor,
} from '@/app/_components/home/bento-layout';

import type { BentoMeasure, GridMeasure, SlotMeasure, SlotState } from './home-bento';

/**
 * How far the height a slot reserves without JavaScript may be from its height with it: either way
 * for a slot in one lane, and only above it for a slot across every lane.
 */
export const ESTIMATE_TOLERANCE_PX = 16;

/** How far a slot's top without JavaScript may be from its top with it. */
export const TOP_TOLERANCE_PX = 16;

/**
 * How far outside its measured range (BENTO_ESTIMATE_GAPS) an accepted gap's tile may be: the
 * sub-pixel rounding between one browser, device pixel ratio or bento width and another.
 */
export const GAP_RANGE_SLACK_PX = 2;

/**
 * How far a slot after an accepted gap, in DOM order, may move once JavaScript runs, in the gap's
 * tier: the worst move measured across md and md-wide, and a margin of about 7 px, so a regression
 * of the project or anything after it shows. Measured with every bento width from 640 to 1079 px
 * on the build's CSS (each slot's top on the server's estimates, then on its measured rows), the
 * worst is 40.8 px: the site index at a 799 px bento (about 849 to 859 px windows). There GitHub
 * reserves 12 px more than it needs, which moves the place below it; the project needs 19 px more
 * than it reserves, which grows the rows beside it by about 16 px and the place's by 3; and the
 * place's two-line hedge reserves 10 px more than a one-line name needs. Before that hedge, round
 * 2 measured 34 px (roles, at an 862 px window).
 * bento-layout.ts's BENTO_ESTIMATE_GAPS says where these moves come from.
 */
export const FIRST_PAINT_GAP_MOVE_MAX_PX = 48;

/** Sub-pixel rounding allowed between a lane's width with and without JavaScript. */
const LANE_TOLERANCE_PX = 1;

/** Native grid lanes pack by height, with no grid-row spans and no masonry script. */
export const isNativeLanes = (grid: GridMeasure): boolean => grid.display.endsWith('grid-lanes');

/** A slot's border-box height and the span the masonry wrote on it ('' before it has). */
export interface WrittenSpan {
  readonly height: number;
  readonly rowsJs: string;
}

/**
 * Whether the masonry has nothing left to write on this slot, with JavaScript on: the slot is
 * hidden (the island keeps a hidden slot's last span), or the span it wrote is the one the slot's
 * height needs now. A shown slot with no span written is settled only where the browser packs the
 * lanes itself (`nativeLanes`, CSS.supports('display', 'grid-lanes'), the island's own test), since
 * the island writes none there; anywhere else the island has not measured it yet (it runs only
 * after hydration), so the slot still has the server's estimate.
 */
export const isSpanSettled = (
  { height, rowsJs }: WrittenSpan,
  { nativeLanes }: { readonly nativeLanes: boolean },
): boolean => height === 0 || (rowsJs === '' ? nativeLanes : Number(rowsJs) === rowsFor(height));

/** Whether the slot's grid-column span covers every lane of the grid. */
export const spansEveryLane = (grid: GridMeasure, slot: SlotMeasure): boolean =>
  slot.columns !== null && grid.lanes.length > 0 && slot.columns >= grid.lanes.length;

const round = (value: number): number => Math.round(value * 10) / 10;

/** The height a span of `rows` rows covers. */
const rowsHeight = (grid: GridMeasure, rowUnit: number, rows: number): number =>
  rows * rowUnit + Math.max(0, rows - 1) * grid.rowGap;

/** The message for a grid that has no fixed row for spans to count in. */
const noRowUnit = (grid: GridMeasure): string =>
  `the bento has no fixed row to span (grid-auto-rows: ${grid.autoRows})`;

/** The range a slot's tile is measured to take in a tier where it is an accepted gap, if it is. */
const gapRange = (area: string, tier: BentoTier): HeightRange | undefined =>
  (
    BENTO_ESTIMATE_GAPS as Readonly<
      Record<string, Readonly<Partial<Record<BentoTier, HeightRange>>> | undefined>
    >
  )[area]?.[tier];

/**
 * The states that make a slot, without JavaScript, taller or shorter than its estimate for its
 * reference content. Not 'loading': every tile that streams keeps its skeleton there, and a
 * skeleton has its tile's footprint. The one 'loading' box that is not a skeleton, the hero's
 * tagline reserved before a server has loaded the settings, is taller than the hero's reference;
 * this check does not tell it apart. Against one local server it never shows (the settings are
 * cached before the first measure), only against a target with several server instances.
 */
const OFF_FOOTPRINT_STATES: ReadonlySet<SlotState> = new Set(['error', 'empty', 'stale']);

/**
 * What the estimate check makes of one slot, in DOM order: it fits, it is stale (a failure), it
 * is left out, or it is an accepted gap that is off here, within its range. `cause` is set on a
 * slot that can send the lane slots after it to other lanes: one showing another state with
 * JavaScript or (an error, empty or stale one) without it, or a gap that is off.
 */
interface Verdict {
  readonly area: string;
  readonly kind: 'fits' | 'stale' | 'skipped' | 'accepted';
  readonly note: string;
  readonly cause?: string;
}

interface VerdictContext {
  readonly grid: GridMeasure;
  readonly rowUnit: number;
  readonly tier: BentoTier;
  /** The first slot before this one that set a cause, as 'status (stale)'. */
  readonly after: string | undefined;
}

/** A slot's verdict once it is compared: its reserved and needed heights are known. */
interface Comparison {
  readonly area: string;
  readonly tier: BentoTier;
  readonly reserved: number;
  /** The slot's height with JavaScript: its tile and the gap below it. */
  readonly needed: number;
  readonly isAcross: boolean;
  /** Its lanes with and without JavaScript, when they differ in width. */
  readonly otherLane: string | undefined;
}

/**
 * An accepted gap's verdict: outside its measured range (with GAP_RANGE_SLACK_PX either side) it
 * fails, naming the range, and so does a reservation outside it (with a row more above, for the
 * estimate's rounding up to whole rows), such as a span that a later rule on the slot broke;
 * inside it, it fits, or is off and accepted.
 */
function gapVerdict(
  { area, tier, reserved, needed }: Comparison,
  [min, max]: HeightRange,
  misses: string,
): Verdict {
  const tile = round(needed - BENTO_GAP_PX[tier]);
  const reservedTile = round(reserved - BENTO_GAP_PX[tier]);
  const measured = `the measured ${min} to ${max} px`;
  const outside = `outside ${measured}, ±${GAP_RANGE_SLACK_PX} px`;
  if (tile < min - GAP_RANGE_SLACK_PX || tile > max + GAP_RANGE_SLACK_PX) {
    return {
      area,
      kind: 'stale',
      note: `${area} at ${tier}: ${misses} (a ${tile} px tile, ${outside})`,
    };
  }
  if (
    reservedTile < min - GAP_RANGE_SLACK_PX ||
    reservedTile > max + GAP_RANGE_SLACK_PX + BENTO_ROW_PX
  ) {
    const note = `${area} at ${tier}: ${misses} (it reserves a ${reservedTile} px tile, ${outside})`;
    return { area, kind: 'stale', note };
  }
  if (Math.abs(reserved - needed) <= ESTIMATE_TOLERANCE_PX) {
    return { area, kind: 'fits', note: '' };
  }
  const note = `${area} at ${tier}: ${misses} (a ${tile} px tile, inside ${measured})`;
  return { area, kind: 'accepted', note, cause: `${area} (off at ${tier})` };
}

/** A compared slot's verdict: within the tolerance, an accepted gap, or stale. */
function comparedVerdict(comparison: Comparison): Verdict {
  const { area, tier, reserved, needed, isAcross, otherLane } = comparison;
  const misses = `reserves ${round(reserved)} px, needs ${round(needed)} px`;
  const range = isAcross ? undefined : gapRange(area, tier);
  if (range !== undefined) return gapVerdict(comparison, range, misses);
  const over = reserved - needed;
  const fits = isAcross ? over <= ESTIMATE_TOLERANCE_PX : Math.abs(over) <= ESTIMATE_TOLERANCE_PX;
  if (fits) return { area, kind: 'fits', note: '' };
  const where = isAcross ? ', across every lane' : otherLane ? `, in ${otherLane}` : '';
  return { area, kind: 'stale', note: `${area}: ${misses}${where}` };
}

/**
 * One slot's verdict. A slot whose tile shows another state with JavaScript is left out: the
 * table is not for that height. A lane slot in a lane of another width with JavaScript than
 * without, after such a slot, is left out too: the slot before it changed the lanes, and its
 * estimate is for the lane it has without JavaScript. With no such slot before it, a lane change
 * is the estimates' own doing, and it is compared (the message names both lanes). A slot in an
 * error, empty or stale state only without JavaScript is compared (its rows are the estimate's
 * whatever it shows), and it is a cause for the slots after it: its height there is not its
 * reference height, so it can change their lanes.
 */
function verdictOf(
  slot: SlotMeasure,
  withJs: SlotMeasure | undefined,
  { grid, rowUnit, tier, after }: VerdictContext,
): Verdict {
  const { area, rows } = slot;
  if (rows === null) return { area, kind: 'stale', note: `${area}: reserves no rows` };
  if (withJs === undefined)
    return { area, kind: 'stale', note: `${area}: missing with JavaScript` };
  if (withJs.state !== 'reference') {
    const note = `${area} (${withJs.state})`;
    return { area, kind: 'skipped', note, cause: note };
  }
  const isAcross = spansEveryLane(grid, slot);
  const lanes = `a ${round(withJs.slot.width)} px lane with JavaScript, ${round(slot.slot.width)} px without`;
  const isOtherLane =
    !isAcross && Math.abs(withJs.slot.width - slot.slot.width) > LANE_TOLERANCE_PX;
  if (isOtherLane && after !== undefined) {
    return { area, kind: 'skipped', note: `${area} (${lanes}, after ${after})` };
  }
  const verdict = comparedVerdict({
    area,
    tier,
    reserved: rowsHeight(grid, rowUnit, rows),
    needed: withJs.natural,
    isAcross,
    otherLane: isOtherLane ? lanes : undefined,
  });
  const offFootprint = OFF_FOOTPRINT_STATES.has(slot.state)
    ? `${area} (${slot.state} without JavaScript)`
    : undefined;
  const cause = verdict.cause ?? offFootprint;
  return cause === undefined ? verdict : { ...verdict, cause };
}

/** Every slot's verdict without JavaScript, in DOM order (the masonry's placing order). */
function estimateVerdicts(
  withScript: BentoMeasure,
  withoutScript: BentoMeasure,
  rowUnit: number,
): readonly Verdict[] {
  const { grid } = withoutScript;
  const tier = bentoTierAt(grid.width);
  const measured = new Map(withScript.slots.map((slot) => [slot.area, slot]));
  return withoutScript.slots.reduce<{ readonly verdicts: readonly Verdict[]; after?: string }>(
    ({ verdicts, after }, slot) => {
      const verdict = verdictOf(slot, measured.get(slot.area), { grid, rowUnit, tier, after });
      return { verdicts: [...verdicts, verdict], after: after ?? verdict.cause };
    },
    { verdicts: [] },
  ).verdicts;
}

const notesOf = (verdicts: readonly Verdict[], kind: Verdict['kind']): string[] =>
  verdicts.filter((verdict) => verdict.kind === kind).map(({ note }) => note);

export interface EstimateReport {
  /**
   * Each compared slot whose reservation is off, as 'area: reserved, needed', or an accepted gap
   * whose tile is outside its measured range, as 'area at tier: …, outside …': failures.
   */
  readonly stale: readonly string[];
  /**
   * Each slot left out, as 'area (state)' (its tile showed another state with JavaScript), or a
   * lane slot such a slot sent to a lane of another width, as 'area (its lanes, after …)'.
   */
  readonly skipped: readonly string[];
  /**
   * Each accepted gap (BENTO_ESTIMATE_GAPS) that is off at this width but inside its measured
   * range, as 'area at tier: …, inside …'.
   */
  readonly accepted: readonly string[];
}

/**
 * Compares the height each slot reserves without JavaScript (the rows the server's estimate gives
 * it, whatever it shows: its skeleton, when its tile streams) with its height with JavaScript.
 * Only slots whose tile shows its reference content with JavaScript are compared: an error,
 * empty, stale or loading state has a height the table is not for (and the lane slots it, or a
 * slot in an error, empty or stale state without JavaScript, sends to lanes of other widths are
 * left out too). A slot in one lane must reserve within the tolerance of its height. A slot
 * across every lane (by its grid-column span) must not reserve more than the tolerance above it,
 * but may reserve less: no other slot shares its rows, so an underestimate grows them, as the
 * measured span would, and moves nothing. A lane slot in one of BENTO_ESTIMATE_GAPS's tiers is
 * held to its measured range instead (GAP_RANGE_SLACK_PX either side): outside it, it fails;
 * inside it and off by more than the tolerance, it is accepted, since no value can hold there.
 */
export function compareEstimates(
  withScript: BentoMeasure,
  withoutScript: BentoMeasure,
): EstimateReport {
  const { grid } = withoutScript;
  if (grid.rowUnit === null) {
    const skipped = withScript.slots
      .filter(({ state }) => state !== 'reference')
      .map(({ area, state }) => `${area} (${state})`);
    return { stale: [noRowUnit(grid)], skipped, accepted: [] };
  }
  const verdicts = estimateVerdicts(withScript, withoutScript, grid.rowUnit);
  return {
    stale: notesOf(verdicts, 'stale'),
    skipped: notesOf(verdicts, 'skipped'),
    accepted: notesOf(verdicts, 'accepted'),
  };
}

/**
 * The slots that keep the first paint check from running, as 'area (state, with or without
 * JavaScript)'. With JavaScript, each one not showing its reference content. Without it, each one
 * in an error, empty or stale state; a skeleton is fine there, since every tile that streams keeps
 * its skeleton without JavaScript, and a skeleton has its tile's footprint.
 */
const firstPaintBlockers = (withScript: BentoMeasure, withoutScript: BentoMeasure): string[] => [
  ...withScript.slots
    .filter(({ state }) => state !== 'reference')
    .map(({ area, state }) => `${area} (${state}, with JavaScript)`),
  ...withoutScript.slots
    .filter(({ state }) => state !== 'reference' && state !== 'loading')
    .map(({ area, state }) => `${area} (${state}, without JavaScript)`),
];

/** A slot's top, from the top of the grid's content box. */
const topInGrid = ({ grid }: BentoMeasure, { slot }: SlotMeasure): number => slot.y - grid.top;

interface TopMove {
  /** The slot's place in DOM order. */
  readonly index: number;
  /** How far its top moved, in px (infinite when it is missing with JavaScript). */
  readonly distance: number;
  readonly note: string;
}

/**
 * Every slot whose top without JavaScript is more than the tolerance from its top with it: the
 * first paint is not the final layout, and the slot moves when the masonry script runs.
 */
function movedTops(withScript: BentoMeasure, withoutScript: BentoMeasure): TopMove[] {
  const finalTops = new Map(
    withScript.slots.map((slot) => [slot.area, topInGrid(withScript, slot)] as const),
  );
  return withoutScript.slots.flatMap((slot, index) => {
    const final = finalTops.get(slot.area);
    if (final === undefined) {
      return [
        {
          index,
          distance: Number.POSITIVE_INFINITY,
          note: `${slot.area}: missing with JavaScript`,
        },
      ];
    }
    const first = topInGrid(withoutScript, slot);
    const distance = Math.abs(first - final);
    if (distance <= TOP_TOLERANCE_PX) return [];
    const note = `${slot.area}: top ${round(first)} px without JavaScript, ${round(final)} px with it`;
    return [{ index, distance, note }];
  });
}

export interface FirstPaintReport {
  /** The slots that kept the check from running; with any, nothing was compared. */
  readonly blockers: readonly string[];
  /** Each slot whose top moved more than it may once JavaScript ran: failures. */
  readonly moved: readonly string[];
  /**
   * Each slot after an accepted gap that moved more than the tolerance but no more than
   * FIRST_PAINT_GAP_MOVE_MAX_PX, in the gap's tier, as 'move (after area, a gap at tier)'.
   */
  readonly excused: readonly string[];
}

/**
 * Whether each slot's top without JavaScript is within the tolerance of its top with it, so the
 * first paint is the final layout. It runs only when every slot shows its reference content (see
 * firstPaintBlockers). The masonry places slots in DOM order, so a slot's top depends only on the
 * slots before it. In a tier with an accepted gap (BENTO_ESTIMATE_GAPS), the slots after the gap
 * slot may move by its miss plus the others' (GitHub's, through the rows they share) even where
 * the gap itself is within the tolerance, so their moves up to FIRST_PAINT_GAP_MOVE_MAX_PX are
 * reported (excused), and a larger one fails. The slots up to and including it are held to the
 * tolerance.
 */
export function compareFirstPaint(
  withScript: BentoMeasure,
  withoutScript: BentoMeasure,
): FirstPaintReport {
  const blockers = firstPaintBlockers(withScript, withoutScript);
  if (blockers.length > 0) return { blockers, moved: [], excused: [] };
  const tier = bentoTierAt(withoutScript.grid.width);
  const gapIndex = withoutScript.slots.findIndex(({ area }) => gapRange(area, tier) !== undefined);
  const gap = withoutScript.slots[gapIndex];
  const moves = movedTops(withScript, withoutScript);
  if (gap === undefined) return { blockers, moved: moves.map(({ note }) => note), excused: [] };
  const isAfterGap = ({ index }: TopMove): boolean => index > gapIndex;
  const isExcused = (move: TopMove): boolean =>
    isAfterGap(move) && move.distance <= FIRST_PAINT_GAP_MOVE_MAX_PX;
  const beyondBound = `more than the ${FIRST_PAINT_GAP_MOVE_MAX_PX} px a slot after ${gap.area} may move at ${tier}`;
  return {
    blockers,
    moved: moves
      .filter((move) => !isExcused(move))
      .map((move) => (isAfterGap(move) ? `${move.note}, ${beyondBound}` : move.note)),
    excused: moves
      .filter(isExcused)
      .map(({ note }) => `${note} (after ${gap.area}, a gap at ${tier})`),
  };
}
