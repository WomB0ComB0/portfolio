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
 * @file The Waterfall bento's numbers, shared by the server page, the masonry island and the
 * tests: the slots in priority order, the grid's row unit and gaps (which bento.module.css
 * repeats; tests/unit/home/bento-areas.test.ts keeps the two in step), and the first-paint
 * height estimates. Plain data with type-only imports, so the client island can load it.
 *
 * How the span masonry works: the grid has fine rows of BENTO_ROW_PX and no row gap. Each slot
 * carries the gap as its own bottom padding and spans rowsFor(its border-box height) rows, so
 * sparse auto-placement drops each slot into the first lane that frees up after the one before
 * it. Until the island has measured a slot, its span comes from the estimates below.
 */

import type { CSSProperties } from 'react';

/** The bento's slots in DOM order, which is the priority and reading order. */
export const BENTO_AREAS = [
  'hero',
  'now',
  'status',
  'leet',
  'type',
  'gh',
  'proj',
  'place',
  'role',
  'strip',
] as const;

export type BentoArea = (typeof BENTO_AREAS)[number];

/**
 * The estimate tiers, chosen by the bento container's width (never the viewport's). Each tier's
 * estimates hold across its whole range (see BENTO_TILE_HEIGHTS_PX), but for the project's at
 * medium (BENTO_ESTIMATE_GAPS); the bentos in brackets are
 * common windows' (a phone's; a desktop browser's is 10 px narrower below the shell's cap, its
 * scrollbar taking its share):
 * - `sm`, narrow, below 30rem (288 px at a 320 px window, 343 px at 375): two lanes at 1.3 : 1;
 * - `sm-wide`, the rest of narrow, 30rem to 40rem (560 px at a 600 px window): the same lanes,
 *   but now playing joins the live cluster, the hero's role line fits on one line, the project is
 *   a cover-left media object and GitHub's sparkline sits beside its figure, so it has estimates
 *   of its own;
 * - `md`, medium, 40rem to 50rem (711 px at a 768 px desktop window): two equal lanes, the hero
 *   spanning both;
 * - `md-wide`, the rest of medium, 50rem to 67.5rem (893 px at 1024 px): the same lanes, but wide
 *   enough that the project's 2 : 1 cover is taller, so it has estimates of its own;
 * - `lg`, wide, from 67.5rem (1136 px from a 1274 px window, the shell's cap): three lanes at
 *   1.3 : 1 : 1, the hero spanning the first two.
 */
export type BentoTier = 'sm' | 'sm-wide' | 'md' | 'md-wide' | 'lg';

export const BENTO_TIERS: readonly BentoTier[] = ['sm', 'sm-wide', 'md', 'md-wide', 'lg'];

/**
 * Where each tier starts, as a bento width in px: bento.module.css's container queries (30rem,
 * 40rem, 50rem and 67.5rem at 16 px; tests/unit/home/bento-areas.test.ts keeps the two in step).
 */
export const BENTO_TIER_FROM_PX: Readonly<Record<BentoTier, number>> = {
  sm: 0,
  'sm-wide': 480,
  md: 640,
  'md-wide': 800,
  lg: 1080,
};

/**
 * The tier of a bento this wide: its content box in px, fractional as the container queries see
 * it (a 683 px phone's bento is 639.69 px, still `sm-wide`).
 */
export const bentoTierAt = (bentoWidthPx: number): BentoTier =>
  BENTO_TIERS.reduce<BentoTier>(
    (found, tier) => (bentoWidthPx >= BENTO_TIER_FROM_PX[tier] ? tier : found),
    'sm',
  );

/** The grid's row unit in px: --bento-row in bento.module.css. */
export const BENTO_ROW_PX = 2;

/** The gap between tiles in px per tier: --bento-gap, 0.75rem and then 1rem from 40rem. */
export const BENTO_GAP_PX: Readonly<Record<BentoTier, number>> = {
  sm: 12,
  'sm-wide': 12,
  md: 16,
  'md-wide': 16,
  lg: 16,
};

/**
 * Rounding slack: a measured 104.00001 px is 52 rows of 2 px, not 53. A slot a hair taller than
 * its rows grows the shared auto rows by that hair; nothing overlaps.
 */
const ROW_EPSILON = 0.01;

/** The rows a slot of this border-box block size (its tile plus the gap below it) spans. */
export function rowsFor(blockSizePx: number): number {
  return Math.ceil(blockSizePx / BENTO_ROW_PX - ROW_EPSILON);
}

/**
 * THE ESTIMATES TABLE: each tile's height in px (its border box, without the gap), per tier. The
 * server renders them as each slot's --rows-sm, --rows-sm-wide, --rows-md, --rows-md-wide and
 * --rows-lg, so the HTML paints the packed layout before any script runs; the island then
 * overrides them with the measured --rows-js. The rows are minmax(row, auto), so a wrong estimate
 * costs a shift after hydration, never an overlap; near a lane decision it can also send later
 * tiles to other lanes.
 *
 * The rule (D1), per tier, over every bento width in it:
 * - A slot that spans every lane gets the SMALLEST height it takes anywhere in the tier. No other
 *   slot shares its rows, so where it is taller its own rows grow (an underestimate is absorbed:
 *   the first paint is exact and hydration moves nothing), while an overestimate would leave a
 *   hole and shift everything below once the island runs. Which slots span every lane comes from
 *   bento.module.css: below 40rem all but status, LeetCode and typing (and now playing from
 *   30rem); at medium only the hero; at wide none (the hero spans two of three lanes).
 * - A slot in one lane gets the height that minimises its largest error across the tier: the
 *   middle of its range, so it is within half the range of every height it takes there. The range
 *   is its widths': the tiles below keep one height per width whatever their content (the
 *   place's name, the project's title and description, the roles' last line, a one-digit site
 *   count and GitHub's unit; each tile's file says how), and the content that still changes a
 *   height is listed below. One exception, below 30rem: status and
 *   typing stack in one lane of the live cluster, right before GitHub spans both lanes, so their
 *   errors add up in GitHub's top (the middles put it 18 px low at 390 and 412 px phones). There
 *   each takes the lowest height still within 16 px of every height it takes in the tier (62 and
 *   130 px; GitHub is then 8 px low at most, and where they are taller their rows grow).
 *
 * Measured 2026-11-06 on the standalone production build in Chromium (Geist, refined type; live
 * data: an idle Spotify, every monitor up, 'Fraud Guard' as the featured project, 'Corgi NYC' as
 * the place), JavaScript on, once nothing in main was aria-busy and the masonry had settled: every
 * 8 px from 320 to 1920 px and 1 px either side of each bento breakpoint, a phone (overlay
 * scrollbar) below 768 px and a desktop browser from there. Only tiles showing their reference
 * content counted (tile-states.tsx's state contract). Other content was measured apart on
 * 2026-11-07, rendering the real tiles with the same build's CSS at every 2 px from 280 to 1140
 * px of bento, with hinted and unhinted glyphs: 8 other projects of the 22 (with no description
 * in the title, a two-line title, a two-line description), three long place names, two to four
 * current roles, one-digit site counts and GitHub totals of 8, 100, 777, 999, 1,777, 2,424, 7,777
 * and 9,999 (with hinted glyphs 7 is the widest digit, 2 and 4 the narrowest; GitHub every 0.25 px).
 * Each gave its tile today's height at every width, but for what is listed last. Lane slots whose
 * range is wide:
 * - the project at medium: 271.2 to 310.9 px (bentos 641 to 800), so up to 21 px off; at md-wide
 *   311.1 to 380.8 px (bentos 801 to 1079), up to 35 px off. Its 2 : 1 cover grows with its lane,
 *   so no one value is within 16 px of both ends: these are BENTO_ESTIMATE_GAPS (below);
 * - GitHub at medium, 244 or 268 px (its unit takes its own line in a tile narrower than
 *   18.61rem: a lane below about 340 px, a 640 to 695 px bento);
 * - the site index at medium, 117 px, or 136 px in a 640 to 641 px bento, where 'certifications'
 *   wraps under its figure;
 * - status, LeetCode and typing below 30rem, one line taller each in a 288 px bento.
 * Content that still changes a height, so the table holds for today's: exactly one role beside
 * the hero's (a role, 56 px, shorter stacked), a site count of three digits ('certifications'
 * wraps under it in more cells: 19 px), a site count of exactly one (its singular name, one
 * letter shorter than the skeleton's plural, can stay beside the figure where the plural wraps:
 * 19 px shorter), a GitHub total of five digits, LeetCode's legend and the
 * typing line by their digits, the status line by its words, and the hero by its tagline.
 * Re-measure when a tile's markup changes, then run e2e/journeys/home-bento.spec.ts -g masonry
 * against a server with every API key: it fails when a one-lane tile reserves more than 16 px
 * more or less than its height, or a tile across every lane more than 16 px above it, at any of
 * its widths (375, 390, 412, 500, 600, 700, 720, 768, 820, 900, 1024, 1440), or when a slot's top
 * moves more than 16 px once JavaScript runs. Tiles not showing their reference content are left
 * out, and so is a lane tile that one of them sent to a lane of another width. A gap
 * (BENTO_ESTIMATE_GAPS) is held to its measured range instead, and the slots after it to 41 px
 * (at 700 px, a 646 px bento, the project reserves about 20 px too much and roles moves about
 * 30 px: both are reported as annotations, not failures).
 */
export const BENTO_TILE_HEIGHTS_PX: Readonly<
  Record<BentoArea, Readonly<Record<BentoTier, number>>>
> = {
  // Across both lanes below 40rem: at sm 330 px at its smallest (354 to 452 px bentos; 390 px
  // below 354, 414 px below 304), at sm-wide 268 px (521 to 552 px; 346 px at 480).
  hero: { sm: 330, 'sm-wide': 268, md: 276, 'md-wide': 276, lg: 276 },
  // 16 px of padding below a 28rem bento, 20 px from there.
  now: { sm: 90, 'sm-wide': 98, md: 98, 'md-wide': 98, lg: 98 },
  // Below 30rem 56 to 78 px: the words take a second line in a bento below 328 px. 62, not the
  // middle (67): it shares a lane with typing (see the exception above).
  status: { sm: 62, 'sm-wide': 64, md: 64, 'md-wide': 64, lg: 64 },
  // In a narrow 1fr lane the legend stacks (188 to 212 px at sm) or wraps (174 to 196 px).
  leet: { sm: 200, 'sm-wide': 184, md: 152, 'md-wide': 152, lg: 152 },
  // '60 s best · 93% accuracy' on one line in a 188 px lane or wider (128 px), else two (146 px).
  // 130, not the middle (137): it shares a lane with status (see the exception above).
  type: { sm: 130, 'sm-wide': 136, md: 136, 'md-wide': 136, lg: 136 },
  // The sparkline sits beside the figure in a 30 to 40rem bento. Stacked, the unit takes its own
  // line in a tile narrower than 18.61rem, by rule and for any total up to four digits
  // (github-tile.tsx's TEXT_COLUMN_CLASS): at sm 260 px below a 332 px bento, 236 from there to a
  // 28rem bento, 244 from 28rem; at md 268
  // px in a lane below about 340 px (a 640 to 695 px bento), else 244. In a wide bento it always
  // takes its own line, so 268 px on every platform.
  gh: { sm: 236, 'sm-wide': 172, md: 256, 'md-wide': 244, lg: 268 },
  // A 2 : 1 cover, so the tile grows with its lane: stacked below a 30rem bento (251 px at its
  // smallest, 355 px at 479 px), cover-left from 30rem to 40rem (121.6 to 161.4 px). The same for
  // any project: its title and its description are one line each, and it always has both.
  proj: { sm: 251, 'sm-wide': 121.6, md: 291, 'md-wide': 346, lg: 278 },
  // Across both lanes below 40rem: 98 px below a 28rem bento, 106 px from there. In a lane from
  // 40rem, 106 px in every lane and for every place: the name is one line, cut with an ellipsis
  // (place-tile.tsx). md used to hedge at 115 px, a long name wrapping to 124 px in an md lane.
  place: { sm: 98, 'sm-wide': 106, md: 106, 'md-wide': 106, lg: 106 },
  // Two roles side by side from a 554 px bento to 40rem: 154 px there, 202 or 210 px stacked. The
  // same with any number of current roles from three: the last line is '+N more' or, with none
  // unnamed, 'All experience'. With two (one listed) it is a role shorter stacked, 56 px.
  role: { sm: 202, 'sm-wide': 154, md: 210, 'md-wide': 210, lg: 210 },
  // 2 x 2 everywhere: 117 px, or 136 px where 'certifications' wraps (bentos below 320 px, and
  // 640 to 641 px). A one-digit count holds the skeleton's '00' room, so it wraps where the
  // skeleton does. With hinted glyphs (Linux) '00' is 1 px wider than '64', so the skeleton and a
  // one-digit count also wrap at a 314 and a 642 to 644 px bento, where '64' does not.
  strip: { sm: 117, 'sm-wide': 117, md: 126, 'md-wide': 117, lg: 117 },
};

/** A measured height range in px, smallest and largest: a tile's border box, without the gap. */
export type HeightRange = readonly [min: number, max: number];

/**
 * The accepted estimate gaps: lane slots whose height across a tier spans more than twice the
 * 16 px the estimates are held to, so no value in the table can hold everywhere in it and D1
 * allows no further tier. Each comes with the range the sweep above measured in that tier. The
 * project, whose 2 : 1 cover grows with its lane: at medium 271.2 to 310.9 px (bentos 641 to 800,
 * windows of about 683 to 860 px), at md-wide 311.1 to 380.8 px (bentos 801 to 1079, windows to
 * about 1217 px).
 *
 * The ranges are the width's alone: the project's title and description are one line each and
 * always both there, so every project gives the same heights (measured with 8 others of the 22,
 * among them ones with no description in the title and two-line copy).
 *
 * The cost: its estimate can be off by up to about 21 px at medium and 35 px at md-wide. One
 * more miss adds to it at medium: GitHub's estimate is 12 px off either way (under its tile below
 * about a 696 px bento, over it above), which moves the slot below GitHub in its lane, while the
 * project's miss grows the rows it shares with GitHub's lane. So the slots after the project
 * (place, roles, the site index) can move once the island runs: up to 34 px (roles at an 800 px
 * bento, about 850 to 860 px windows, where the project reserves 35 px more than it needs; at md
 * 32 px, roles at a 640 px bento), and roles and the site index swap lanes in about 1086 to 1210
 * px windows. Below the fold, with no overlap. Narrowing it is the owner's call: a cover of fixed
 * height per tier would make its span independent of the width.
 *
 * What the browser checks (e2e/fixtures/home-bento-estimates.ts) make of it: in a gap's tier,
 * the slot's height and what it reserves must lie within its range (2 px either side for
 * rounding, and a row more above for what it reserves), or the check fails naming the range;
 * inside it, a miss of more than 16 px is reported as an annotation instead. The
 * moves of the slots after it in the DOM are reported too, whether or not it is off at that width,
 * up to FIRST_PAINT_GAP_MOVE_MAX_PX (41 px); a larger move fails, and the slots up to it are held
 * to 16 px. tests/unit/home/bento-areas.test.ts keeps each estimate inside its range, each range
 * wider than twice the tolerance, and the list to lane slots.
 */
export const BENTO_ESTIMATE_GAPS: Readonly<
  Partial<Record<BentoArea, Readonly<Partial<Record<BentoTier, HeightRange>>>>>
> = {
  proj: { md: [271.2, 310.9], 'md-wide': [311.1, 380.8] },
};

/** The custom property that holds a slot's estimated span for a tier. */
export const estimateProperty = (tier: BentoTier): `--rows-${BentoTier}` => `--rows-${tier}`;

/** The custom property the island writes with a slot's measured span. */
export const MEASURED_ROWS_PROPERTY = '--rows-js';

/** A slot's estimated span per tier, as the inline custom properties bento.module.css reads. */
export function slotEstimateStyle(area: BentoArea): CSSProperties {
  const heights = BENTO_TILE_HEIGHTS_PX[area];
  const entries = BENTO_TIERS.map((tier) => [
    estimateProperty(tier),
    String(rowsFor(heights[tier] + BENTO_GAP_PX[tier])),
  ]);
  return Object.fromEntries(entries) as CSSProperties;
}
