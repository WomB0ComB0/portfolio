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
 * @file The home bento's three grid layouts, read from bento.module.css: each is a full grid of
 * its column count with no holes, every area is one rectangle, the areas appear in DOM order
 * (so reading and tab order match what is seen), and the hero dominates the medium and wide
 * layouts, in cells and against the tall featured project. Also the container the layouts query,
 * the class that places each slot, and the featured cover's `sizes` against the width the grid
 * gives it at every viewport width.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '../../../src');
const CSS_PATH = path.join(SRC, 'app/_components/home/bento.module.css');
const GLOBALS_PATH = path.join(SRC, 'styles/globals.css');
const LAYOUT_PATH = path.join(SRC, 'components/layout/layout.tsx');
const PROJECT_TILE_PATH = path.join(SRC, 'app/_components/home/tiles/project-tile.tsx');

/** The DOM order of the slots in home-page.tsx. */
const DOM_ORDER = [
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

interface Layout {
  readonly name: 'narrow' | 'medium' | 'wide';
  readonly columns: number;
  /** The container query's min width, or null for the base layout. */
  readonly minWidth: string | null;
}

const LAYOUTS: readonly Layout[] = [
  { name: 'narrow', columns: 2, minWidth: null },
  { name: 'medium', columns: 6, minWidth: '40rem' },
  { name: 'wide', columns: 12, minWidth: '67.5rem' },
];

type Grid = readonly (readonly string[])[];

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

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

interface ContainerBlock {
  readonly name: string;
  readonly query: string;
  readonly body: string;
  readonly start: number;
  readonly end: number;
}

function containerBlocks(source: string): ContainerBlock[] {
  return [...source.matchAll(/@container\s+([\w-]+)\s*\(([^)]*)\)\s*\{/g)].map((match) => {
    const open = (match.index ?? 0) + match[0].length - 1;
    const body = blockBody(source, open);
    return {
      name: match[1] ?? '',
      query: (match[2] ?? '').trim(),
      body,
      start: match.index ?? 0,
      end: open + body.length + 2,
    };
  });
}

/** The query's min width, from `width >= X` or `min-width: X`. */
function minWidthOf(query: string): string | undefined {
  return /^(?:width\s*>=\s*|min-width:\s*)([\d.]+rem)$/.exec(query)?.[1];
}

/** The declarations of `.grid` in `scope` (top level, or one container block's body). */
function gridDeclarations(scope: string): string {
  const match = /(?:^|[}\s])\.grid\s*\{/.exec(scope);
  if (!match) throw new Error('no .grid rule in this scope');
  return blockBody(scope, match.index + match[0].length - 1);
}

function areasOf(declarations: string): Grid {
  const value = /grid-template-areas:\s*([^;]+);/.exec(declarations)?.[1];
  if (!value) throw new Error('no grid-template-areas');
  return [...value.matchAll(/"([^"]*)"/g)].map((row) => (row[1] ?? '').trim().split(/\s+/));
}

function columnCountOf(declarations: string): number {
  const count = /grid-template-columns:\s*repeat\((\d+),\s*minmax\(0,\s*1fr\)\)/.exec(declarations);
  if (!count) throw new Error('no grid-template-columns: repeat(n, minmax(0, 1fr))');
  return Number(count[1]);
}

const blocks = containerBlocks(css);

/** The top level: the CSS with every container block cut out. */
const topLevel = blocks.reduceRight(
  (source, block) => source.slice(0, block.start) + source.slice(block.end),
  css,
);

function scopeOf(layout: Layout): string {
  if (layout.minWidth === null) return topLevel;
  const block = blocks.find((candidate) => minWidthOf(candidate.query) === layout.minWidth);
  if (!block) throw new Error(`no container block for ${layout.minWidth}`);
  return block.body;
}

const gridOf = (layout: Layout): Grid => areasOf(gridDeclarations(scopeOf(layout)));

const cellCounts = (grid: Grid): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const name of grid.flat()) counts.set(name, (counts.get(name) ?? 0) + 1);
  return counts;
};

/** Whether `name`'s cells exactly fill their bounding box. */
function isRectangle(grid: Grid, name: string): boolean {
  const cells = grid.flatMap((row, r) =>
    row.flatMap((cell, c) => (cell === name ? [{ r, c }] : [])),
  );
  const rows = cells.map(({ r }) => r);
  const cols = cells.map(({ c }) => c);
  const [top, bottom] = [Math.min(...rows), Math.max(...rows)];
  const [left, right] = [Math.min(...cols), Math.max(...cols)];
  for (let r = top; r <= bottom; r += 1) {
    for (let c = left; c <= right; c += 1) if (grid[r]?.[c] !== name) return false;
  }
  return cells.length === (bottom - top + 1) * (right - left + 1);
}

const firstAppearanceOrder = (grid: Grid): string[] => [...new Set(grid.flat())];

describe('the bento container', () => {
  it('is an inline-size container named bento that pads its sides with the page gutter', () => {
    const container = blockBody(css, css.indexOf('{', css.indexOf('.container')));
    expect(container).toMatch(/container:\s*bento\s*\/\s*inline-size;/);
    expect(container).toMatch(/padding-inline:\s*var\(--page-gutter\);/);
  });

  it('switches layouts at 40rem and 67.5rem of the bento container only', () => {
    expect(blocks.map((block) => block.name)).toEqual(['bento', 'bento']);
    expect(blocks.map((block) => minWidthOf(block.query))).toEqual(['40rem', '67.5rem']);
  });
});

// Each test reads its layout itself, so a missing or broken layout fails its own tests by name
// instead of the whole file at collection.
describe.each(LAYOUTS)('the $name layout ($columns columns)', (layout) => {
  it(`has ${layout.columns} grid columns and ${layout.columns} areas in every row`, () => {
    expect(columnCountOf(gridDeclarations(scopeOf(layout)))).toBe(layout.columns);
    for (const row of gridOf(layout)) expect(row).toHaveLength(layout.columns);
  });

  it('uses exactly the ten areas, with no holes', () => {
    const grid = gridOf(layout);
    expect([...cellCounts(grid).keys()].sort()).toEqual([...DOM_ORDER].sort());
    expect(grid.flat()).not.toContain('.');
  });

  it('makes every area one filled rectangle', () => {
    const grid = gridOf(layout);
    for (const name of DOM_ORDER) expect(isRectangle(grid, name), name).toBe(true);
  });

  it('meets the areas in DOM order, reading row by row', () => {
    expect(firstAppearanceOrder(gridOf(layout))).toEqual([...DOM_ORDER]);
  });
});

describe.each(LAYOUTS.filter((layout) => layout.minWidth !== null))(
  'the $name layout',
  (layout) => {
    it('gives the hero strictly the most cells', () => {
      const counts = cellCounts(gridOf(layout));
      const hero = counts.get('hero') ?? 0;
      for (const [name, count] of counts)
        if (name !== 'hero') expect(count, name).toBeLessThan(hero);
    });
  },
);

/** How many columns `name` spans: its cells in the first row it appears in. */
function columnSpanOf(grid: Grid, name: string): number {
  const row = grid.find((cells) => cells.includes(name));
  if (!row) throw new Error(`no ${name} area`);
  return row.filter((cell) => cell === name).length;
}

describe.each(LAYOUTS.filter((layout) => layout.minWidth !== null))(
  'the $name layout, on screen',
  (layout) => {
    // The 16:10 cover grows the project tile's height with its width. As wide as the hero (4 of
    // 6 columns), it came out taller than the hero at 768 and 1024 px.
    it('gives the featured project fewer columns than the hero, so the hero stays the largest', () => {
      const grid = gridOf(layout);
      expect(columnSpanOf(grid, 'proj')).toBeLessThan(columnSpanOf(grid, 'hero'));
    });
  },
);

const REM_PX = 16;
const TAILWIND_SPACING_PX = 4;
/** Tailwind's lg breakpoint, where the rail (layout.tsx's lg:pl-*) appears. */
const LG_BREAKPOINT_PX = 1024;
const remToPx = (value: string): number => Number.parseFloat(value) * REM_PX;

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

/** The bento's content box: the shell beside the rail, less a gutter on each side. */
function bentoWidthAt(viewport: number): number {
  const rail = viewport >= LG_BREAKPOINT_PX ? RAIL_PX : 0;
  return Math.min(viewport - rail, SHELL_PX) - 2 * gutterAt(viewport);
}

/** A layout's gap in px: its own, or the one it inherits from the layout below it. */
function gapOf(layout: Layout): number {
  for (const candidate of LAYOUTS.slice(0, LAYOUTS.indexOf(layout) + 1).reverse()) {
    const gap = /(?:^|[\s;])gap:\s*([\d.]+rem);/.exec(gridDeclarations(scopeOf(candidate)))?.[1];
    if (gap) return remToPx(gap);
  }
  throw new Error(`no gap for the ${layout.name} layout`);
}

/** The layout the bento's container queries pick at this bento width: the widest it reaches. */
function layoutAt(bento: number): Layout {
  const reached = LAYOUTS.filter(
    (layout) => layout.minWidth === null || bento >= remToPx(layout.minWidth),
  );
  const layout = reached.at(-1);
  if (!layout) throw new Error(`no layout for a ${bento} px bento`);
  return layout;
}

/** How wide the grid draws the proj area at this viewport width. */
function projectWidthAt(viewport: number): number {
  const bento = bentoWidthAt(viewport);
  const layout = layoutAt(bento);
  const gap = gapOf(layout);
  const span = columnSpanOf(gridOf(layout), 'proj');
  const track = (bento - (layout.columns - 1) * gap) / layout.columns;
  return span * track + (span - 1) * gap;
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

/** At most this much wider than drawn: the 100vw default is 11% over at 320 px (two gutters). */
const MAX_OVERSIZE = 1.12;

describe("the featured cover's sizes", () => {
  it('is never narrower than the proj area, nor much wider, from 320 to 1920 px', () => {
    const sizes = /PROJECT_COVER_SIZES\s*=\s*'([^']+)'/.exec(
      readFileSync(PROJECT_TILE_PATH, 'utf8'),
    )?.[1];
    if (!sizes) throw new Error('no PROJECT_COVER_SIZES string in project-tile.tsx');
    expect(SHELL_PX).toBeGreaterThan(0);
    expect(RAIL_PX).toBeGreaterThan(0);

    const misfits: string[] = [];
    for (let viewport = 320; viewport <= 1920; viewport += 1) {
      const drawn = projectWidthAt(viewport);
      const chosen = evaluateSizes(sizes, viewport);
      if (chosen < drawn - 0.01 || chosen > drawn * MAX_OVERSIZE) {
        misfits.push(`${viewport} px: sizes ${chosen.toFixed(1)} for ${drawn.toFixed(1)} drawn`);
      }
    }
    expect(misfits).toEqual([]);
  });
});

describe('the slot classes', () => {
  it('place each slot in its own area', () => {
    for (const name of DOM_ORDER) {
      expect(css).toMatch(new RegExp(`\\.${name}\\s*\\{\\s*grid-area:\\s*${name};\\s*\\}`));
    }
  });

  it('let a slot shrink below its content width, so long text clamps instead of overflowing', () => {
    const slot = blockBody(css, css.indexOf('{', css.search(/\.slot\s*\{/)));
    expect(slot).toMatch(/min-width:\s*0;/);
    expect(slot).toMatch(/display:\s*grid;/);
  });
});
