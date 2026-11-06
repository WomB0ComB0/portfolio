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
 * @file A small trend line for console tiles: a translucent area under a brand line, with a dot
 * on the latest value. Server-safe (no directive, no hooks, no motion).
 *
 * It draws at a fixed height and stretches across its container's width. The area and line sit
 * in a nested <svg> whose viewBox stretches (preserveAspectRatio="none"); the line stays 2px
 * thanks to non-scaling-stroke. The dot lives in the outer svg, which has no viewBox, so its
 * radius is in CSS pixels and its centre is a percentage: it stays round at any width, where a
 * circle inside the stretched viewBox would turn into an ellipse.
 *
 * Decorative: the svg is hidden from assistive tech, so the caller states in words what it shows
 * (an sr-only summary next to it).
 */

import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';

/** Inset from every edge, in viewBox units, so the line's width and the dot are never clipped. */
const PAD = 4;

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 48;
const LINE_WIDTH = 2;
const DOT_RADIUS = 3;

/** Two decimals are finer than a pixel at any tile width and keep the HTML short and stable. */
const COORD_DECIMALS = 2;

/**
 * Translucent brand from a literal token, never an opacity modifier on the brand fill: that
 * compiles to a full-strength fill for browsers without color-mix(). (The modifier is not spelled
 * out here because Tailwind scans comments too, and would emit the unused rule.)
 */
const AREA_CLASS = 'fill-(--brand-wash)';
const LINE_CLASS = 'fill-none stroke-brand';
const DOT_CLASS = 'fill-foreground';

export interface SparklinePoint {
  x: number;
  y: number;
}

/** Negative, NaN and infinite values have no height to draw, so they sit on the zero line. */
function plottable(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * The points of a sparkline in a `w` x `h` box, oldest value first. x is evenly spaced from the
 * inset to `w` minus the inset; y puts zero on the bottom inset and the largest value on the top
 * one. The scale never drops below 1, so all zeros give a flat baseline (never NaN) and values
 * under 1 stay low. One value gives two points: a level line across the whole box.
 *
 * @example
 * sparklinePoints([0, 10], 240, 48); // [{ x: 4, y: 44 }, { x: 236, y: 4 }]
 */
export function sparklinePoints(values: readonly number[], w: number, h: number): SparklinePoint[] {
  if (values.length === 0) return [];

  const heights = values.map(plottable);
  const max = heights.reduce((top, value) => Math.max(top, value), 1);
  // A box smaller than the insets draws flat rather than upside down.
  const spanX = Math.max(0, w - 2 * PAD);
  const spanY = Math.max(0, h - 2 * PAD);
  const yOf = (value: number): number => h - PAD - (value / max) * spanY;

  const [only] = heights;
  if (heights.length === 1 && only !== undefined) {
    const y = yOf(only);
    return [
      { x: PAD, y },
      { x: PAD + spanX, y },
    ];
  }

  const step = spanX / (heights.length - 1);
  return heights.map((value, index) => ({ x: PAD + index * step, y: yOf(value) }));
}

function coord(value: number): string {
  return String(Number(value.toFixed(COORD_DECIMALS)));
}

function pointAt({ x, y }: SparklinePoint): string {
  return `${coord(x)} ${coord(y)}`;
}

function linePath(points: readonly SparklinePoint[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${pointAt(point)}`).join('');
}

/** The line, closed down to the zero line at both ends. */
function areaPath(
  points: readonly SparklinePoint[],
  first: SparklinePoint,
  last: SparklinePoint,
  baseline: number,
): string {
  const top = points.map((point) => `L${pointAt(point)}`).join('');
  return `M${pointAt({ x: first.x, y: baseline })}${top}L${pointAt({ x: last.x, y: baseline })}Z`;
}

/** `part` as a percentage of `whole`, for the dot's position in the unscaled outer svg. */
function percentOf(part: number, whole: number): string {
  return `${whole > 0 ? coord((part / whole) * 100) : 0}%`;
}

export interface SparklineProps {
  /** One value per period, oldest first. An empty list renders nothing. */
  values: readonly number[];
  /**
   * Width of the drawing grid in viewBox units. It sets the proportions of the grid, not the
   * size on screen: the sparkline always spans its container (`w-full`).
   */
  width?: number;
  /** Height on screen in CSS pixels, and of the viewBox. A height class in className wins. */
  height?: number;
  className?: string;
}

/**
 * A decorative trend line. Pair it with words that say what it shows.
 *
 * @example
 * <Sparkline values={weeklyCounts} height={56} />
 * <p className="sr-only">412 contributions in the last 12 weeks</p>
 */
export function Sparkline({
  values,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
}: SparklineProps): ReactElement | null {
  const points = sparklinePoints(values, width, height);
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined) return null;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-sparkline=""
      height={height}
      className={cn('block w-full overflow-visible', className)}
    >
      {/* Hidden already by the outer svg; repeated so the nested drawing is never announced. */}
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        overflow="visible"
      >
        <path d={areaPath(points, first, last, height - PAD)} className={AREA_CLASS} />
        <path
          d={linePath(points)}
          className={LINE_CLASS}
          strokeWidth={LINE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <circle
        cx={percentOf(last.x, width)}
        cy={percentOf(last.y, height)}
        r={DOT_RADIUS}
        className={DOT_CLASS}
      />
    </svg>
  );
}
