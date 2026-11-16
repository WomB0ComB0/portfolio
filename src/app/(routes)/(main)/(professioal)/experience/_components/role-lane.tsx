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
 * @file What every drawing on the shared clock reads: axisStyle() sets the column count (--n)
 * and the year lines once on an ancestor, so the "Roles at once" stack on a role page
 * (month-stack.tsx) and "The path so far" on /experience (story/role-path.tsx) line up by
 * construction. Server-safe (no directive, no hooks). Palette tokens only: a year line is the
 * hairline.
 */

import type { CSSProperties } from 'react';

import type { ClockAxis } from '../_lib/role-clock';

/** A style object that also sets CSS custom properties. */
export type CssVars = CSSProperties & Readonly<Record<`--${string}`, string | number>>;

const YEAR_LINE = 'linear-gradient(var(--hairline),var(--hairline))';
const PERCENT_PLACES = 4;

/** `part` of `whole` as a CSS percentage: '25.5319%'. */
export const percentOf = (part: number, whole: number): string =>
  `${Number(((part / whole) * 100).toFixed(PERCENT_PLACES))}%`;

/**
 * The variables the axis's drawings read, for an ancestor of them all: the column count, and a
 * one-pixel line at each year's start (the first column needs none: the plot's edge is there).
 */
export function axisStyle(axis: ClockAxis): CssVars {
  const total = axis.columns.length;
  const lines = axis.ticks.filter((tick) => tick.column > 0);
  if (lines.length === 0) return { '--n': Math.max(total, 1), '--year-lines': 'none' };
  return {
    '--n': total,
    '--year-lines': lines.map(() => YEAR_LINE).join(','),
    '--year-line-at': lines.map((tick) => `${percentOf(tick.column, total)} 0`).join(','),
  };
}

/**
 * The plot's two edges, as borders, so everything drawn on the axis has one inner width: the
 * "now" edge at the right at every width, and the start edge from a 56rem page, where the lane
 * is a column of its own.
 */
export const PLOT_EDGES_CLASS =
  'border-r border-r-hairline-strong @min-[56rem]/page:border-l @min-[56rem]/page:border-l-hairline';

/** The year lines as a background, for a plot as wide as the axis. */
export const YEAR_LINES_CLASS =
  '[background-image:var(--year-lines)] [background-position:var(--year-line-at,0_0)] [background-size:1px_100%] bg-no-repeat';
