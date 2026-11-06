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
 * @file The Live Console tile grid and its span helper. Server-safe (no directive, no hooks).
 *
 * The grid answers to its own width, not the viewport's: a wrapper is the `tiles` container
 * (an element cannot container-query itself) and the grid steps from 2 columns to 6 at `@xl`
 * (36rem) and to 12 at `@4xl` (56rem). Every span class is written out in a literal map so
 * Tailwind's scanner finds it; never build one from a template string.
 */

import type { AriaAttributes, AriaRole, ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utils';

type BaseSpan = 1 | 2;
type MdSpan = 1 | 2 | 3 | 4 | 5 | 6;
type LgSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
type RowSpan = 1 | 2 | 3;

/** How many grid tracks a tile covers at each grid width. */
export interface TileSpan {
  /** Columns of 2 below `@xl` (phones). */
  base?: BaseSpan;
  /** Columns of 6 from `@xl` (36rem of grid). */
  md?: MdSpan;
  /** Columns of 12 from `@4xl` (56rem of grid). */
  lg?: LgSpan;
  /** Rows from `@4xl`, each at least `--tile-row` tall. Unset spans one row. */
  rows?: RowSpan;
}

/** The span a key falls back to when a TileSpan leaves it out: full width, then a half, a quarter. */
export const DEFAULT_TILE_SPAN = { base: 2, md: 3, lg: 3 } as const satisfies TileSpan;

const BASE_SPAN = { 1: 'col-span-1', 2: 'col-span-2' } as const satisfies Record<BaseSpan, string>;

const MD_SPAN = {
  1: '@xl/tiles:col-span-1',
  2: '@xl/tiles:col-span-2',
  3: '@xl/tiles:col-span-3',
  4: '@xl/tiles:col-span-4',
  5: '@xl/tiles:col-span-5',
  6: '@xl/tiles:col-span-6',
} as const satisfies Record<MdSpan, string>;

const LG_SPAN = {
  1: '@4xl/tiles:col-span-1',
  2: '@4xl/tiles:col-span-2',
  3: '@4xl/tiles:col-span-3',
  4: '@4xl/tiles:col-span-4',
  5: '@4xl/tiles:col-span-5',
  6: '@4xl/tiles:col-span-6',
  7: '@4xl/tiles:col-span-7',
  8: '@4xl/tiles:col-span-8',
  9: '@4xl/tiles:col-span-9',
  10: '@4xl/tiles:col-span-10',
  11: '@4xl/tiles:col-span-11',
  12: '@4xl/tiles:col-span-12',
} as const satisfies Record<LgSpan, string>;

const ROW_SPAN = {
  1: '@4xl/tiles:row-span-1',
  2: '@4xl/tiles:row-span-2',
  3: '@4xl/tiles:row-span-3',
} as const satisfies Record<RowSpan, string>;

const GRID_CLASS =
  'grid grid-cols-2 gap-3 @xl/tiles:grid-cols-6 @4xl/tiles:grid-cols-12 @4xl/tiles:auto-rows-[minmax(var(--tile-row),auto)] @4xl/tiles:gap-4';

const DENSE_CLASS = '@4xl/tiles:grid-flow-row-dense';

/**
 * The column and row classes for `span`. Keys it leaves out take DEFAULT_TILE_SPAN; rows are added
 * only when given.
 *
 * @example
 * tileSpanClass({ base: 2, md: 3, lg: 6, rows: 2 });
 * // 'col-span-2 @xl/tiles:col-span-3 @4xl/tiles:col-span-6 @4xl/tiles:row-span-2'
 */
export function tileSpanClass(span?: TileSpan): string {
  const rows = span?.rows === undefined ? [] : [ROW_SPAN[span.rows]];
  return [
    BASE_SPAN[span?.base ?? DEFAULT_TILE_SPAN.base],
    MD_SPAN[span?.md ?? DEFAULT_TILE_SPAN.md],
    LG_SPAN[span?.lg ?? DEFAULT_TILE_SPAN.lg],
    ...rows,
  ].join(' ');
}

/** The grid element. Use `ul` when every child is a `<Tile as="li">`. */
export type TileGridElement = 'div' | 'ul' | 'section';

export interface TileGridProps extends AriaAttributes {
  /** The grid's element; the container wrapper around it is always a div. */
  as?: TileGridElement;
  /** Defaults to 'list' on a `ul` (see TileGrid); anything given here wins. */
  role?: AriaRole;
  /**
   * Back-fills holes with later tiles from `@4xl`. This moves tiles away from their DOM order, so
   * focus order no longer follows what is on screen: use it only when that does not matter (no
   * links in the moved tiles).
   */
  dense?: boolean;
  id?: string;
  /** Classes for the grid element, not the wrapper. */
  className?: string;
  children?: ReactNode;
}

/**
 * A container-query grid for tiles: 2 columns, 6 from `@xl`, 12 from `@4xl`, rows at least
 * `--tile-row` tall from `@4xl`. Give each tile a `span` (see TileSpan).
 *
 * A bento needs one dominant tile (`lg` of 6 or more with `rows: 2`); equal tiles read as a
 * spreadsheet, not a console.
 *
 * @example
 * <TileGrid as="ul" aria-label="Highlights">
 *   <Tile as="li" span={{ lg: 6, rows: 2 }}>...</Tile>
 *   <Tile as="li" span={{ base: 1 }}>...</Tile>
 * </TileGrid>
 */
export function TileGrid({
  as: Grid = 'div',
  dense = false,
  className,
  children,
  ...rest
}: TileGridProps): ReactElement {
  // Safari and VoiceOver stop announcing a list once list-style is none (preflight sets it) unless
  // the list says role="list". Set before the rest, so a caller's role still wins.
  return (
    <div className="@container/tiles">
      <Grid
        role={Grid === 'ul' ? 'list' : undefined}
        {...rest}
        className={cn(GRID_CLASS, dense && DENSE_CLASS, className)}
      >
        {children}
      </Grid>
    </div>
  );
}
