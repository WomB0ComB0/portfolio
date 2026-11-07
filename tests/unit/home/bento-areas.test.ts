// @vitest-environment node
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
 * @file The Waterfall bento's layout, read from bento.module.css and bento-layout.ts.
 *
 * - The structure: an inline-size container named bento that pads with the page gutter; queries
 *   on that container only (no viewport media query), mobile first, at 30rem, 40rem, 50rem (an
 *   estimate step only) and 67.5rem; fine rows with no row gap and slots that pad their own
 *   bottom; tiles that hug their content; no dense packing, order, reading-flow, grid areas or
 *   transitions.
 * - The lanes per tier: 1.3 : 1 below 40rem with only status, LeetCode and typing in one lane
 *   (and now playing too from 30rem); two equal lanes with the hero spanning both up to 67.5rem;
 *   then 1.3 : 1 : 1 with the hero spanning two.
 * - The native path: @supports (display: grid-lanes) with a real row gap, both tolerance names,
 *   natural heights and the same lanes.
 * - The estimates: every area has a span per tier, and the row unit and gaps match the CSS.
 * - The pack: a simulator of CSS grid's sparse auto-placement (which reproduces the lab's measured
 *   packs) places the estimated slots at one bento per tier and at every tier's edges, and the
 *   rules hold: a tile's top is never more than 2rem above the previous one's, no hole inside the
 *   pack is more than 2rem beyond the gap, and the hero is the largest tile.
 * - The project cover's `sizes`, against the cover drawn in the widest lane the tile can land in,
 *   on a phone and in a desktop browser (whose bento the page scrollbar's gutter narrows).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  BENTO_AREAS,
  BENTO_ESTIMATE_GAPS,
  BENTO_GAP_PX,
  BENTO_ROW_PX,
  BENTO_TIER_FROM_PX,
  BENTO_TIERS,
  BENTO_TILE_HEIGHTS_PX,
  type BentoArea,
  type BentoTier,
  bentoTierAt,
  rowsFor,
} from '@/app/_components/home/bento-layout';
import { ESTIMATE_TOLERANCE_PX } from '../../../e2e/fixtures/home-bento-estimates';

const SRC = path.resolve(__dirname, '../../../src');
const CSS_PATH = path.join(SRC, 'app/_components/home/bento.module.css');
const GLOBALS_PATH = path.join(SRC, 'styles/globals.css');
const LAYOUT_PATH = path.join(SRC, 'components/layout/layout.tsx');
const PROJECT_TILE_PATH = path.join(SRC, 'app/_components/home/tiles/project-tile.tsx');

const REM_PX = 16;
const remToPx = (value: string): number => Number.parseFloat(value) * REM_PX;

/** The reading-order and hole tolerance: 2rem. */
const TOLERANCE_PX = 2 * REM_PX;

// ---------------------------------------------------------------------------------------------
// Reading bento.module.css
// ---------------------------------------------------------------------------------------------

const stripComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '');

const css = stripComments(readFileSync(CSS_PATH, 'utf8'));

/** The text between the brace at `open` and its matching closing brace. */
function blockBody(source: string, open: number): string {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error('unbalanced braces in bento.module.css');
}

interface Block {
  readonly prelude: string;
  readonly body: string;
}

/** The blocks at the top level of `source`: each prelude (a selector or an at-rule) and body. */
function blocksOf(source: string): Block[] {
  const blocks: Block[] = [];
  let index = 0;
  for (;;) {
    const open = source.indexOf('{', index);
    if (open === -1) return blocks;
    const body = blockBody(source, open);
    blocks.push({ prelude: source.slice(index, open).trim(), body });
    index = open + body.length + 2;
  }
}

function declarationsOf(body: string): ReadonlyMap<string, string> {
  return new Map(
    body
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const colon = declaration.indexOf(':');
        return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()] as const;
      }),
  );
}

/** A style rule, with the at-rule it sits in (null at the top level). */
interface Rule {
  readonly condition: string | null;
  readonly selectors: readonly string[];
  readonly declarations: ReadonlyMap<string, string>;
}

const ruleOf = (condition: string | null, { prelude, body }: Block): Rule => ({
  condition,
  selectors: prelude.split(',').map((selector) => selector.trim()),
  declarations: declarationsOf(body),
});

/** Every style rule in source order. */
const RULES: readonly Rule[] = blocksOf(css).flatMap((block) =>
  block.prelude.startsWith('@')
    ? blocksOf(block.body).map((inner) => ruleOf(block.prelude.replace(/\s+/g, ' '), inner))
    : [ruleOf(null, block)],
);

const CONTAINER_QUERY = /^@container bento \(width >= ([\d.]+rem)\)$/;
const LANES_SUPPORTS = '@supports (display: grid-lanes)';

/** Whether a rule's at-rule applies to a bento this wide, with or without native grid-lanes. */
function applies(condition: string | null, bento: number, nativeLanes: boolean): boolean {
  if (condition === null) return true;
  if (condition === LANES_SUPPORTS) return nativeLanes;
  const min = CONTAINER_QUERY.exec(condition)?.[1];
  if (!min) throw new Error(`unexpected at-rule: ${condition}`);
  return bento >= remToPx(min);
}

/**
 * The declarations an element with these classes gets at this bento width. Every selector is one
 * class (checked below), so the rules weigh the same and the later one wins: source order.
 */
function computed(
  classes: readonly string[],
  bento: number,
  nativeLanes = false,
): ReadonlyMap<string, string> {
  const selectors = new Set(classes.map((name) => `.${name}`));
  const matching = RULES.filter(
    (rule) =>
      applies(rule.condition, bento, nativeLanes) &&
      rule.selectors.some((selector) => selectors.has(selector)),
  );
  return new Map(matching.flatMap((rule) => [...rule.declarations]));
}

const read = (declarations: ReadonlyMap<string, string>, property: string): string => {
  const value = declarations.get(property);
  if (value === undefined) throw new Error(`no ${property}`);
  return value;
};

/** The grid's lanes as fr weights, from minmax(0, Nfr) tracks and repeat(n, minmax(0, Nfr)). */
function lanesOf(columns: string): number[] {
  const expanded = columns.replace(/repeat\((\d+),\s*(minmax\(0,\s*[\d.]+fr\))\)/g, (_, n, track) =>
    Array.from({ length: Number(n) }, () => track).join(' '),
  );
  const tracks = /^(?:minmax\(0,\s*[\d.]+fr\)\s*)+$/.test(expanded.trim())
    ? [...expanded.matchAll(/minmax\(0,\s*([\d.]+)fr\)/g)]
    : [];
  if (tracks.length === 0) throw new Error(`not a list of minmax(0, Nfr) lanes: ${columns}`);
  return tracks.map((track) => Number(track[1]));
}

interface Layout {
  /** Each lane's fr weight. */
  readonly lanes: readonly number[];
  readonly gap: number;
  readonly tier: BentoTier;
  /** How many lanes each area spans. */
  readonly spans: Readonly<Record<BentoArea, number>>;
}

function layoutAt(bento: number, nativeLanes = false): Layout {
  const grid = computed(['grid'], bento, nativeLanes);
  const slotRows = read(computed(['slot'], bento, nativeLanes), '--bento-rows');
  const tier = /^var\(--rows-(sm|sm-wide|md|md-wide|lg)\)$/.exec(slotRows)?.[1] as
    | BentoTier
    | undefined;
  if (!tier) throw new Error(`--bento-rows is ${slotRows}`);
  const spans = Object.fromEntries(
    BENTO_AREAS.map((area) => [
      area,
      Number(read(computed(['slot', area], bento, nativeLanes), '--bento-lanes')),
    ]),
  ) as Record<BentoArea, number>;
  return {
    lanes: lanesOf(read(grid, 'grid-template-columns')),
    gap: remToPx(read(grid, '--bento-gap')),
    tier,
    spans,
  };
}

/** Each lane's width in px. */
function laneWidths(layout: Layout, bento: number): number[] {
  const total = layout.lanes.reduce((sum, weight) => sum + weight, 0);
  const free = bento - (layout.lanes.length - 1) * layout.gap;
  return layout.lanes.map((weight) => (free * weight) / total);
}

/** The width of `span` lanes from lane `start`, with the gaps between them. */
const spanWidth = (widths: readonly number[], start: number, span: number, gap: number): number =>
  widths.slice(start, start + span).reduce((sum, width) => sum + width, 0) + (span - 1) * gap;

// ---------------------------------------------------------------------------------------------
// The structure
// ---------------------------------------------------------------------------------------------

describe('bento.module.css structure', () => {
  it('is an inline-size container named bento that pads its sides with the page gutter', () => {
    const container = computed(['container'], 0);
    expect(container.get('container')).toBe('bento / inline-size');
    expect(container.get('padding-inline')).toBe('var(--page-gutter)');
  });

  it('queries the bento container only, mobile first, at 30rem, 40rem, 50rem and 67.5rem', () => {
    expect(css).not.toMatch(/@media/);
    const queries = [...new Set(RULES.map((rule) => rule.condition))].filter(
      (condition) => condition !== null && condition !== LANES_SUPPORTS,
    );
    expect(queries.map((query) => CONTAINER_QUERY.exec(query ?? '')?.[1])).toEqual([
      '30rem',
      '40rem',
      '50rem',
      '67.5rem',
    ]);
  });

  it('writes every selector as one class, so the lane rules cascade in source order', () => {
    for (const rule of RULES) {
      for (const selector of rule.selectors) expect(selector).toMatch(/^\.[a-z]+$/);
    }
  });

  it('lays the grid on fine rows of the row unit, with no row gap and slots that start at the top', () => {
    const grid = computed(['grid'], 0);
    expect(grid.get('display')).toBe('grid');
    expect(grid.get('--bento-row')).toBe(`${BENTO_ROW_PX}px`);
    expect(grid.get('grid-auto-rows')).toBe('minmax(var(--bento-row), auto)');
    expect(grid.get('gap')).toBe('0 var(--bento-gap)');
    // A slot is as tall as its tile, never its rows: the measurement cannot feed back.
    expect(grid.get('align-items')).toBe('start');
    // The last slot in each lane pads a gap below it, which the grid gives back.
    expect(grid.get('margin-block-end')).toBe('calc(-1 * var(--bento-gap))');
  });

  it('spans each slot over its lanes and its measured rows, else its tier’s estimate', () => {
    const slot = computed(['slot'], 0);
    expect(slot.get('min-width')).toBe('0');
    expect(slot.get('grid-column')).toBe('span var(--bento-lanes)');
    expect(slot.get('grid-row-end')).toBe('span var(--rows-js, var(--bento-rows))');
    expect(slot.get('padding-block-end')).toBe('var(--bento-gap)');
  });

  // From 30rem the narrow tiles change shape (one-line role, cover-left project, sparkline
  // beside GitHub's figure): one sm estimate was 88 px off for the hero at a 550 px bento.
  it.each([
    [0, 'sm'],
    [479, 'sm'],
    [480, 'sm-wide'],
    [639, 'sm-wide'],
    [640, 'md'],
    [799, 'md'],
    [800, 'md-wide'],
    [1079, 'md-wide'],
    [1080, 'lg'],
    [1500, 'lg'],
  ] as const)('uses the %s px bento’s estimate tier %s and its gap', (bento, tier) => {
    const layout = layoutAt(bento);
    expect(layout.tier).toBe(tier);
    expect(layout.gap).toBe(BENTO_GAP_PX[tier]);
  });

  it('lets tiles hug their content: nothing sets a height or reaches into a slot', () => {
    for (const rule of RULES) {
      for (const property of rule.declarations.keys()) {
        expect(property).not.toMatch(/^(?:min-|max-)?(?:height|block-size)$/);
      }
      // One class per selector: no `.slot > *` stretching the tile to its rows.
      for (const selector of rule.selectors) expect(selector).not.toMatch(/[\s>*]/);
    }
  });

  it('keeps the DOM order: no dense packing, order, reading-flow or grid areas', () => {
    expect(css).not.toMatch(/dense/);
    expect(css).not.toMatch(/(?:^|[\s;{])order\s*:/);
    expect(css).not.toMatch(/reading-(?:flow|order)/);
    expect(css).not.toMatch(/grid-(?:template-)?areas?\s*:/);
  });

  it('never animates a reflow', () => {
    expect(css).not.toMatch(/transition|animation|view-transition/);
  });
});

// ---------------------------------------------------------------------------------------------
// The lanes per tier
// ---------------------------------------------------------------------------------------------

const ALL_TWO = Object.fromEntries(BENTO_AREAS.map((area) => [area, 2])) as Record<
  BentoArea,
  number
>;
const ALL_ONE = Object.fromEntries(BENTO_AREAS.map((area) => [area, 1])) as Record<
  BentoArea,
  number
>;

const NARROW_SPANS = { ...ALL_TWO, status: 1, leet: 1, type: 1 };
const NARROW_WIDE_SPANS = { ...NARROW_SPANS, now: 1 };
const MEDIUM_SPANS = { ...ALL_ONE, hero: 2 };

/** The narrowest lane a tile may get: room for a 36 px figure inside 16 px of padding. */
const MIN_LANE_PX = 120;

describe.each([
  // The 320 and 375 px viewports' bentos, and the edges of each tier.
  { bento: 288, lanes: [1.3, 1], spans: NARROW_SPANS },
  { bento: 343, lanes: [1.3, 1], spans: NARROW_SPANS },
  { bento: 479, lanes: [1.3, 1], spans: NARROW_SPANS },
  { bento: 480, lanes: [1.3, 1], spans: NARROW_WIDE_SPANS },
  { bento: 639, lanes: [1.3, 1], spans: NARROW_WIDE_SPANS },
  { bento: 640, lanes: [1, 1], spans: MEDIUM_SPANS },
  { bento: 799, lanes: [1, 1], spans: MEDIUM_SPANS },
  { bento: 800, lanes: [1, 1], spans: MEDIUM_SPANS },
  { bento: 893, lanes: [1, 1], spans: MEDIUM_SPANS },
  { bento: 1079, lanes: [1, 1], spans: MEDIUM_SPANS },
  { bento: 1080, lanes: [1.3, 1, 1], spans: MEDIUM_SPANS },
  { bento: 1136, lanes: [1.3, 1, 1], spans: MEDIUM_SPANS },
])('the lanes of a $bento px bento', ({ bento, lanes, spans }) => {
  it(`are ${lanes.join(' : ')}`, () => {
    expect(layoutAt(bento).lanes).toEqual(lanes);
  });

  it('give each area its span, the hero spanning two lanes', () => {
    expect(layoutAt(bento).spans).toEqual(spans);
    expect(layoutAt(bento).spans.hero).toBe(2);
  });

  it('are the same where the browser lays out grid-lanes natively', () => {
    const native = layoutAt(bento, true);
    expect(native.lanes).toEqual(lanes);
    expect(native.spans).toEqual(spans);
  });

  it(`never squeeze a lane below ${MIN_LANE_PX} px`, () => {
    const layout = layoutAt(bento);
    for (const width of laneWidths(layout, bento)) {
      expect(width).toBeGreaterThanOrEqual(MIN_LANE_PX);
    }
  });
});

describe('the native grid-lanes path', () => {
  const grid = (bento: number) => computed(['grid'], bento, true);
  const slot = (bento: number) => computed(['slot'], bento, true);

  it.each([343, 711, 1136])('at %s px uses natural heights and a real row gap', (bento) => {
    expect(grid(bento).get('display')).toBe('grid-lanes');
    expect(grid(bento).get('row-gap')).toBe('var(--bento-gap)');
    expect(grid(bento).get('margin-block-end')).toBe('0');
    expect(slot(bento).get('grid-row-end')).toBe('auto');
    expect(slot(bento).get('padding-block-end')).toBe('0');
  });

  it('sets the 2rem tolerance under both its names (Safari 26.4 and 27.2)', () => {
    expect(grid(0).get('flow-tolerance')).toBe('2rem');
    expect(grid(0).get('fit-tolerance')).toBe('2rem');
  });
});

// ---------------------------------------------------------------------------------------------
// The estimates
// ---------------------------------------------------------------------------------------------

describe('the estimates table', () => {
  it('has a positive height for every area at every tier', () => {
    expect(Object.keys(BENTO_TILE_HEIGHTS_PX).sort()).toEqual([...BENTO_AREAS].sort());
    for (const area of BENTO_AREAS) {
      for (const tier of BENTO_TIERS) {
        const height = BENTO_TILE_HEIGHTS_PX[area][tier];
        expect(Number.isFinite(height) && height > 0, `${area} ${tier}`).toBe(true);
      }
    }
  });

  it('counts whole rows of the row unit, rounding up past float noise', () => {
    expect(rowsFor(292)).toBe(146);
    expect(rowsFor(117.4)).toBe(59);
    expect(rowsFor(104.000_01)).toBe(52);
    expect(rowsFor(1)).toBe(1);
  });

  // The browser checks pick the tier of the bento they measure, which is fractional (a 683 px
  // phone's is 639.69 px, still narrow), as the container queries see it.
  it('names the tier bento.module.css picks at every width, each tier from its query', () => {
    for (const tier of BENTO_TIERS) {
      const from = BENTO_TIER_FROM_PX[tier];
      expect(layoutAt(from).tier, `${tier} from ${from} px`).toBe(tier);
      if (from > 0) expect(layoutAt(from - 0.01).tier, `below ${from} px`).not.toBe(tier);
    }
    const widths = [
      ...Array.from({ length: 151 }, (_, index) => index * 10),
      ...[479.99, 480, 639.69, 640, 799.99, 800, 1079.5, 1080],
    ];
    for (const bento of widths)
      expect(bentoTierAt(bento), `${bento} px`).toBe(layoutAt(bento).tier);
  });

  // The project's 2:1 cover grows with its lane at medium, so its height there spans more than
  // twice the checks' 16 px: no one estimate holds (the PR's accepted notes). Review findings
  // WF2-D8-700-red and WF2-LAYOUT-2: the list named only tiers, so any miss there was excused,
  // however large. Each gap now carries the range the 2026-11-06 sweep measured, and the checks
  // accept a miss only inside it.
  it('gives each accepted gap the border-box range measured across its tier', () => {
    expect(BENTO_ESTIMATE_GAPS).toEqual({
      proj: { md: [271.2, 310.9], 'md-wide': [311.1, 380.8] },
    });
  });

  it('keeps each gap’s estimate inside its measured range', () => {
    for (const [area, tier, [min, max]] of gapEntries()) {
      const estimate = BENTO_TILE_HEIGHTS_PX[area][tier];
      expect(estimate, `${area} at ${tier}`).toBeGreaterThanOrEqual(min);
      expect(estimate, `${area} at ${tier}`).toBeLessThanOrEqual(max);
    }
  });

  // Narrower, one value (its middle) would hold within 16 px everywhere: not a gap but a miss.
  it('lists only ranges wider than twice the checks’ tolerance', () => {
    for (const [area, tier, [min, max]] of gapEntries()) {
      expect(max - min, `${area} at ${tier}`).toBeGreaterThan(2 * ESTIMATE_TOLERANCE_PX);
    }
  });

  // A slot across every lane takes its smallest height and never misses (D1).
  it('names only a slot in one lane, in each tier it lists', () => {
    expect(gapEntries().length).toBeGreaterThan(0);
    for (const [area, tier] of gapEntries()) {
      const layout = layoutAt(BENTO_TIER_FROM_PX[tier]);
      expect(layout.spans[area], `${area} at ${tier}`).toBeLessThan(layout.lanes.length);
    }
  });
});

/** Every accepted gap as [area, tier, its measured range]. */
function gapEntries(): [BentoArea, BentoTier, readonly [number, number]][] {
  return Object.entries(BENTO_ESTIMATE_GAPS).flatMap(([area, ranges]) =>
    Object.entries(ranges ?? {}).map(
      ([tier, range]) =>
        [area as BentoArea, tier as BentoTier, range] as [
          BentoArea,
          BentoTier,
          readonly [number, number],
        ],
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// The pack
// ---------------------------------------------------------------------------------------------

interface Item {
  readonly area: BentoArea;
  readonly lanes: number;
  /** Rows of the row unit, the gap included. */
  readonly rows: number;
  /** The tile's own height in px, the gap excluded. */
  readonly height: number;
}

interface Placed extends Item {
  readonly lane: number;
  readonly row: number;
}

/**
 * CSS grid's sparse auto-placement for items with an auto position and a span in both axes: from
 * the cursor (the previous item's row, after its last lane), try each lane along the row, then the
 * next row from the first lane, until the item's whole area is free.
 */
function pack(items: readonly Item[], laneCount: number): Placed[] {
  const taken: boolean[][] = [];
  const isFree = (row: number, lane: number, item: Item): boolean => {
    for (let r = row; r < row + item.rows; r += 1) {
      for (let l = lane; l < lane + item.lanes; l += 1) if (taken[r]?.[l]) return false;
    }
    return true;
  };
  let cursor = { row: 0, lane: 0 };
  return items.map((item) => {
    let { row, lane } = cursor;
    while (lane + item.lanes > laneCount || !isFree(row, lane, item)) {
      if (lane + item.lanes > laneCount) {
        row += 1;
        lane = 0;
      } else {
        lane += 1;
      }
    }
    for (let r = row; r < row + item.rows; r += 1) {
      const cells = taken[r] ?? [];
      for (let l = lane; l < lane + item.lanes; l += 1) cells[l] = true;
      taken[r] = cells;
    }
    cursor = { row, lane: lane + item.lanes };
    return { ...item, lane, row };
  });
}

const topOf = (item: Placed): number => item.row * BENTO_ROW_PX;

/** Packs the lab's heights (in BENTO_AREAS order) with only the hero spanning two lanes. */
function packLab(heights: readonly number[], laneCount: number): (string | number)[][] {
  const items = BENTO_AREAS.map((area, index) => {
    const height = heights[index] ?? 0;
    return { area, lanes: area === 'hero' ? 2 : 1, rows: rowsFor(height + 16), height };
  });
  return pack(items, laneCount).map((item) => [item.area, item.lane + 1, topOf(item)]);
}

/** The estimated slots of a bento this wide, packed. */
function packAt(bento: number): { placed: Placed[]; layout: Layout } {
  const layout = layoutAt(bento);
  const items = BENTO_AREAS.map((area) => {
    const height = BENTO_TILE_HEIGHTS_PX[area][layout.tier];
    return { area, lanes: layout.spans[area], rows: rowsFor(height + layout.gap), height };
  });
  return { placed: pack(items, layout.lanes.length), layout };
}

describe('the pack simulator', () => {
  // The lab's measured packs (brief 2.A, refined type): area, lane and top in px.
  it('reproduces the lab’s measured wide pack at 1136 px from the lab’s heights', () => {
    expect(packLab([276, 98, 64, 152, 136, 244, 282.3, 106, 210, 117], 3)).toEqual([
      ['hero', 1, 0],
      ['now', 3, 0],
      ['status', 3, 114],
      ['leet', 3, 194],
      ['type', 1, 292],
      ['gh', 2, 292],
      ['proj', 3, 362],
      ['place', 1, 444],
      ['role', 2, 552],
      ['strip', 1, 566],
    ]);
  });

  it('reproduces the lab’s measured medium pack at 711 px', () => {
    expect(packLab([276, 98, 64, 152, 136, 244, 288.8, 124, 210, 117], 2)).toEqual([
      ['hero', 1, 0],
      ['now', 1, 292],
      ['status', 2, 292],
      ['leet', 2, 372],
      ['type', 1, 406],
      ['gh', 2, 540],
      ['proj', 1, 558],
      ['place', 2, 800],
      // The lab measured 863 with natural heights; whole rows round the project up a pixel.
      ['role', 1, 864],
      ['strip', 2, 940],
    ]);
  });

  it('reproduces the lab’s measured medium pack at 893 px, where the cover is taller', () => {
    expect(packLab([276, 98, 64, 152, 136, 244, 334.3, 106, 210, 117], 2)).toEqual([
      ['hero', 1, 0],
      ['now', 1, 292],
      ['status', 2, 292],
      ['leet', 2, 372],
      ['type', 1, 406],
      ['gh', 2, 540],
      ['proj', 1, 558],
      ['place', 2, 800],
      // The lab measured 908; whole rows round the project up a pixel and a half.
      ['role', 1, 910],
      ['strip', 2, 922],
    ]);
  });
});

/**
 * One bento per tier (sm, sm-wide, md, md-wide, lg), each a common window's: 375, 600 and 768 px
 * phones and tablets, a 1024 px desktop and the shell's cap. The estimates hold across their tier
 * (bento-layout.ts, the D1 rule), so the estimated pack is the same at any width in it.
 */
const REFERENCE_BENTOS = [343, 560, 711, 893, 1136] as const;
/**
 * Others, where only the lanes' widths change: the 320, 390 and 412 px phones' bentos, the old
 * 29rem step (a 500 px phone), and both edges of every tier.
 */
const OTHER_BENTOS = [288, 358, 380, 464, 479, 480, 639, 640, 799, 800, 1079, 1080] as const;

describe.each([...REFERENCE_BENTOS, ...OTHER_BENTOS])('the estimated pack at %s px', (bento) => {
  it('keeps the reading order: no tile’s top more than 2rem above the previous one’s', () => {
    const { placed } = packAt(bento);
    const climbs = placed.slice(1).flatMap((item, index) => {
      const previous = placed[index] as Placed;
      return topOf(item) < topOf(previous) - TOLERANCE_PX
        ? [`${item.area} at ${topOf(item)} after ${previous.area} at ${topOf(previous)}`]
        : [];
    });
    expect(climbs).toEqual([]);
  });

  it('keeps the hero the largest tile', () => {
    const { placed, layout } = packAt(bento);
    const widths = laneWidths(layout, bento);
    const areaOf = (item: Placed): number =>
      spanWidth(widths, item.lane, item.lanes, layout.gap) * item.height;
    const [hero, ...others] = placed;
    if (!hero) throw new Error('nothing packed');
    for (const other of others) expect(areaOf(other), other.area).toBeLessThan(areaOf(hero));
  });
});

// A long place name ('The Metropolitan Museum of Art') takes two lines in a 1fr lane at wide (318
// to 335 px) but one in the 1.3fr first lane (413 to 435 px). The place's wide estimate is the
// one-line height because the pack puts it in the first lane; were it to land in another, wide
// would need the two-line hedge md has (bento-layout.ts).
it('puts the place in the wide tier’s 1.3fr first lane, where its one-line estimate holds', () => {
  for (const bento of [BENTO_TIER_FROM_PX.lg, 1136]) {
    const place = packAt(bento).placed.find(({ area }) => area === 'place');
    expect(place?.lane, `${bento} px`).toBe(0);
  }
  expect(BENTO_TILE_HEIGHTS_PX.place.lg).toBe(BENTO_TILE_HEIGHTS_PX.place['md-wide']);
});

describe.each(REFERENCE_BENTOS)('the estimated pack at the reference width %s px', (bento) => {
  it('leaves no hole inside the pack more than 2rem beyond the gap', () => {
    const { placed, layout } = packAt(bento);
    const holes = layout.lanes.flatMap((_, lane) => {
      const inLane = placed
        .filter((item) => item.lane <= lane && lane < item.lane + item.lanes)
        .sort((a, b) => a.row - b.row);
      return inLane.slice(1).flatMap((item, index) => {
        const above = inLane[index] as Placed;
        const hole = topOf(item) - (topOf(above) + above.height + layout.gap);
        return hole > TOLERANCE_PX ? [`${hole} px in lane ${lane + 1} above ${item.area}`] : [];
      });
    });
    expect(holes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// The project cover's sizes
// ---------------------------------------------------------------------------------------------

const TAILWIND_SPACING_PX = 4;
/** Tailwind's lg breakpoint, where the rail (layout.tsx's lg:pl-*) appears. */
const LG_BREAKPOINT_PX = 1024;

const globals = readFileSync(GLOBALS_PATH, 'utf8');

/** --page-gutter, clamp(MIN, BASE + Nvw, MAX), as a function of the viewport width. */
function gutterAt(viewport: number): number {
  const match =
    /--page-gutter:\s*clamp\(([\d.]+)rem,\s*([\d.]+)rem \+ ([\d.]+)vw,\s*([\d.]+)rem\);/.exec(
      globals,
    );
  if (!match) throw new Error('--page-gutter is not clamp(Arem, Brem + Cvw, Drem)');
  const [, min = '', base = '', vw = '', max = ''] = match;
  const preferred = remToPx(base) + (Number(vw) / 100) * viewport;
  return Math.min(Math.max(preferred, remToPx(min)), remToPx(max));
}

const SHELL_PX = remToPx(/--container-shell:\s*([\d.]+rem);/.exec(globals)?.[1] ?? 'NaN');
const RAIL_PX =
  Number(/lg:pl-(\d+)/.exec(readFileSync(LAYOUT_PATH, 'utf8'))?.[1] ?? Number.NaN) *
  TAILWIND_SPACING_PX;

/**
 * The page scrollbar's gutter in a desktop browser. globals.css keeps a thin one
 * (`scrollbar-gutter: stable`), about 10 px in Chromium, so a desktop bento is about 10 px
 * narrower than a phone's (whose overlay scrollbar takes no room) until the shell's cap.
 */
const DESKTOP_SCROLLBAR_PX = 10;

/** A phone, then a desktop browser: the room each one's page scrollbar takes. */
const SCROLLBARS = [
  { browser: 'a phone', scrollbar: 0 },
  { browser: 'a desktop browser', scrollbar: DESKTOP_SCROLLBAR_PX },
] as const;

/**
 * The bento's content box: the shell beside the rail, less a gutter on each side. The scrollbar
 * narrows both: the shell's room, and the gutter's vw, which in Chromium leaves out a
 * `scrollbar-gutter: stable` gutter (measured: a 528 px window has a 518 px vw). Media queries,
 * like the rail's lg breakpoint and sizes' min-width, still read the whole window.
 */
function bentoWidthAt(viewport: number, scrollbar = 0): number {
  const rail = viewport >= LG_BREAKPOINT_PX ? RAIL_PX : 0;
  return Math.min(viewport - scrollbar - rail, SHELL_PX) - 2 * gutterAt(viewport - scrollbar);
}

const projectTileSource = readFileSync(PROJECT_TILE_PATH, 'utf8');

/** The tile's border (Tile's `border`, 1px): the cover is drawn inside it. */
const TILE_BORDER_PX = 1;

/** A rem threshold of the project tile's media object, read from its MEDIA_CLASS. */
function mediaThreshold(pattern: RegExp, name: string): number {
  const rem = pattern.exec(projectTileSource)?.[1];
  if (!rem) throw new Error(`no ${name} in project-tile.tsx's media object`);
  return remToPx(rem);
}

/**
 * Where the project tile is a media object, cover left at half the tile (MEDIA_CLASS): in a bento
 * from MIN to below MAX (`@min-[30rem]/bento:@max-[40rem]/bento:flex-row`), and from a tile whose
 * content box is TILE wide (`@[38rem]:flex-row`).
 */
const MEDIA_BENTO_MIN_PX = mediaThreshold(
  /@min-\[([\d.]+)rem\]\/bento:@max-\[[\d.]+rem\]\/bento:flex-row/,
  'bento minimum',
);
const MEDIA_BENTO_MAX_PX = mediaThreshold(
  /@min-\[[\d.]+rem\]\/bento:@max-\[([\d.]+)rem\]\/bento:flex-row/,
  'bento maximum',
);
const MEDIA_TILE_MIN_PX = mediaThreshold(/@\[([\d.]+)rem\]:flex-row/, 'tile minimum');

/**
 * How wide the cover is drawn in a project slot this wide: the tile's content box when stacked,
 * half of it in the media object.
 */
function coverIn(slot: number, bento: number): number {
  const tile = slot - 2 * TILE_BORDER_PX;
  const isMediaObject =
    (bento >= MEDIA_BENTO_MIN_PX && bento < MEDIA_BENTO_MAX_PX) || tile >= MEDIA_TILE_MIN_PX;
  return isMediaObject ? tile / 2 : tile;
}

/**
 * The widest the project cover is drawn at this viewport, with a page scrollbar this wide: in the
 * widest lanes the tile can land in, stacked or as the media object's left half. (Not the slot:
 * in the media object the cover is half of it, and sizes of the slot's width sent phones about
 * 3.5 times the pixels drawn.)
 */
function widestProjectAt(viewport: number, scrollbar = 0): number {
  const bento = bentoWidthAt(viewport, scrollbar);
  const layout = layoutAt(bento);
  const widths = laneWidths(layout, bento);
  const span = layout.spans.proj;
  return Math.max(
    ...widths
      .slice(0, widths.length - span + 1)
      .map((_, start) => coverIn(spanWidth(widths, start, span, layout.gap), bento)),
  );
}

/** The slot width a browser reads from a `sizes` of `(min-width: Npx) L` entries and a default. */
function evaluateSizes(sizes: string, viewport: number): number {
  for (const entry of sizes.split(/,\s*/)) {
    const conditional = /^\(min-width:\s*(\d+)px\)\s+(.+)$/.exec(entry.trim());
    const length = conditional ? (conditional[2] ?? '') : entry.trim();
    if (conditional && viewport < Number(conditional[1])) continue;
    const px = /^([\d.]+)px$/.exec(length)?.[1];
    if (px) return Number(px);
    const vw = /^([\d.]+)vw$/.exec(length)?.[1];
    if (vw) return (Number(vw) / 100) * viewport;
    throw new Error(`unexpected sizes length "${length}"`);
  }
  throw new Error(`sizes "${sizes}" has no default entry`);
}

/**
 * At most this much wider than drawn: the 100vw default is 12% over at 320 px (two gutters and
 * the tile's border). A sizes of the slot where the cover is half of it is 100% over.
 */
const MAX_OVERSIZE = 1.12;

describe("the project cover's sizes", () => {
  // Review findings WF2-D2-sizes-desktop-gutter and WF2-LAYOUT-3: the guard modelled a phone's
  // bento only. In 517 to 526 px desktop windows the bento is still below 30rem, so the cover is
  // stacked across it (about 470 px), while sizes said 48vw and Chromium fetched 256w. sizes
  // cannot tell the two apart, so it must cover the wider of the two covers at every viewport.
  it('is never narrower than the cover drawn in the widest lane on a phone or in a desktop browser, nor much wider, from 320 to 1920 px', () => {
    const sizes = /PROJECT_COVER_SIZES\s*=\s*'([^']+)'/.exec(projectTileSource)?.[1];
    if (!sizes) throw new Error('no PROJECT_COVER_SIZES string in project-tile.tsx');
    expect(SHELL_PX).toBeGreaterThan(0);
    expect(RAIL_PX).toBeGreaterThan(0);
    expect([MEDIA_BENTO_MIN_PX, MEDIA_BENTO_MAX_PX, MEDIA_TILE_MIN_PX]).toEqual([480, 640, 608]);

    const misfits: string[] = [];
    for (let viewport = 320; viewport <= 1920; viewport += 1) {
      const covers = SCROLLBARS.map(({ browser, scrollbar }) => ({
        browser,
        drawn: widestProjectAt(viewport, scrollbar),
      }));
      const widest = Math.max(...covers.map(({ drawn }) => drawn));
      const chosen = evaluateSizes(sizes, viewport);
      if (chosen < widest - 0.01 || chosen > widest * MAX_OVERSIZE) {
        const drawn = covers.map(({ browser, drawn }) => `${drawn.toFixed(1)} on ${browser}`);
        misfits.push(`${viewport} px: sizes ${chosen.toFixed(1)} for ${drawn.join(', ')}`);
      }
    }
    expect(misfits).toEqual([]);
  });

  // 30rem is where the media object starts: a 517 px phone's bento, a 527 px desktop window's.
  // Review finding R3-model-vw: measured in Chromium with classic scrollbars, a 527 px desktop
  // window's bento is 480.34 px (a media object) and a 526 px one's 479.38 (stacked).
  it('models a desktop bento 10 px narrower than a phone’s below the shell’s cap', () => {
    expect(bentoWidthAt(516)).toBeLessThan(MEDIA_BENTO_MIN_PX);
    expect(bentoWidthAt(517)).toBeGreaterThanOrEqual(MEDIA_BENTO_MIN_PX);
    expect(bentoWidthAt(526, DESKTOP_SCROLLBAR_PX)).toBeLessThan(MEDIA_BENTO_MIN_PX);
    expect(bentoWidthAt(527, DESKTOP_SCROLLBAR_PX)).toBeCloseTo(480.34, 1);
    expect(bentoWidthAt(1920, DESKTOP_SCROLLBAR_PX)).toBe(bentoWidthAt(1920));
  });
});
