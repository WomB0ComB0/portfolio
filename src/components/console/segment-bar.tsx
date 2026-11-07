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
 * @file A thin bar of parts that make one whole (LeetCode's easy, medium and hard), with a legend
 * of names and amounts. Server-safe (no directive, no hooks, no motion).
 *
 * The bar is decorative (aria-hidden): the legend is a <dl> that says every name and amount in
 * words, and a swatch beside each name ties it to its part, so identity never rests on colour
 * alone. Parts sit 2px apart on an 8px track; a part at zero, or without a real number, draws
 * nothing, so a whole of zero is an empty track.
 */

import type { ReactElement, ReactNode } from 'react';

import { formatStatValue, presentValue } from '@/components/console/stat-strip';
import { cn } from '@/lib/utils';

/** A chart series slot: the fixed --chart-1..6 order, assigned in order and never cycled. */
export type ChartTone = 1 | 2 | 3 | 4 | 5 | 6;

/** LeetCode's own difficulty colours (--leet-easy, --leet-medium, --leet-hard). */
export type LeetCodeTone = 'leet-easy' | 'leet-medium' | 'leet-hard';

/**
 * What paints a part and its swatch: a chart series slot for parts with no colour of their own,
 * or a named colour for parts whose source already colours them (LeetCode's difficulties).
 */
export type SegmentTone = ChartTone | LeetCodeTone;

/** Literal classes so Tailwind's scanner sees every one; never build them from a template. */
const TONE_CLASS = {
  1: 'bg-chart-1',
  2: 'bg-chart-2',
  3: 'bg-chart-3',
  4: 'bg-chart-4',
  5: 'bg-chart-5',
  6: 'bg-chart-6',
  'leet-easy': 'bg-leet-easy',
  'leet-medium': 'bg-leet-medium',
  'leet-hard': 'bg-leet-hard',
} as const satisfies Record<SegmentTone, string>;

/** 8px, fully rounded ends; the 2px gap between parts shows the track. */
const TRACK_CLASS = 'flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-2';

/**
 * Inline items that stack in a tile narrower than 12rem. The legend is the tile's meta style
 * (tile-meta: Geist 13/18, tabular), names and amounts alike, so a stat tile keeps three type
 * styles: its label, its figure and its meta.
 */
const LEGEND_CLASS =
  'mt-2 flex flex-wrap gap-x-3.5 gap-y-1 tile-meta text-muted-foreground @max-[12rem]:flex-col';
const ITEM_CLASS = 'flex items-center gap-1.5';
const SWATCH_CLASS = 'size-2 shrink-0 rounded-xs';

/**
 * The loading look, as StatTile's placeholders: a muted fill, breathing unless motion is off.
 * Forced colours (Windows Contrast themes) paint every fill as Canvas, so there the bar keeps a
 * system-colour outline and still shows as a box; an outline takes no room, so nothing moves.
 */
const PLACEHOLDER_CLASS = 'bg-surface-3 motion-safe:animate-pulse forced-colors:outline';

/**
 * An amount while it loads: three tabular zeros, for LeetCode's three-digit amounts. Every tabular
 * digit has the font's one advance, so '000' is as wide as '120' in the legend's type (a hinting
 * rasteriser may round a digit by a pixel). A ch was wider: 9px in Geist 13px, a digit about 8.
 */
const AMOUNT_SHAPE = '000';
/**
 * The amount's placeholder: a span with no type of its own, so it is set in the legend's tile-meta
 * like the amount it stands for. Its zeros (data-shape) are generated content, so the document
 * holds no digit, and they are hidden with visibility, never colour: forced colours replace a
 * transparent colour with the text colour, and the zeros would read as an amount. Invisible, they
 * keep their advance and line, so the fill behind them is exactly the loaded amount's box.
 */
const AMOUNT_PLACEHOLDER_CLASS = cn(
  PLACEHOLDER_CLASS,
  'rounded-xs before:invisible before:content-[attr(data-shape)]',
);

/** Three decimals of a percent are far below a pixel and keep the HTML stable. */
const PERCENT_DECIMALS = 3;

/** An em dash is shown only next to a word that says why (the StatStrip convention). */
const UNAVAILABLE_DASH = '—';
const UNAVAILABLE_LABEL = 'unavailable';

export interface SegmentBarSegment {
  /** Unique within the bar; keys the part and its legend item. */
  key: string;
  label: string;
  value: number;
  tone: SegmentTone;
}

export interface SegmentBarProps {
  /** The parts in bar order, left to right; the legend lists them in the same order. */
  segments: readonly SegmentBarSegment[];
  className?: string;
}

/** Negative, NaN and infinite values have no width to draw. */
function drawable(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function shareOf(value: number, total: number): string {
  return `${Number(((value / total) * 100).toFixed(PERCENT_DECIMALS))}%`;
}

function LegendValue({ value }: { value: number }): ReactNode {
  const shown = presentValue(value);
  if (shown === null) {
    return (
      <>
        <span aria-hidden="true">{UNAVAILABLE_DASH}</span>
        <span className="sr-only">{UNAVAILABLE_LABEL}</span>
      </>
    );
  }
  return formatStatValue(shown);
}

export interface SegmentBarSkeletonProps {
  /** The parts' names in bar order: known before the amounts are, so the legend keeps them. */
  segments: readonly Pick<SegmentBarSegment, 'key' | 'label'>[];
  className?: string;
}

/**
 * SegmentBar while its amounts load: the 8px track and the legend's real names, each with a bar
 * for its amount the size of three digits in the legend's own type (AMOUNT_PLACEHOLDER_CLASS), in
 * SegmentBar's own container and legend classes, so it wraps (or stacks below 12rem) exactly where
 * a loaded legend of three-digit amounts will and nothing below moves when it arrives. Decorative
 * as a whole: the tile around it says what is loading.
 *
 * @example
 * <SegmentBarSkeleton
 *   segments={[
 *     { key: 'easy', label: 'Easy' },
 *     { key: 'hard', label: 'Hard' },
 *   ]}
 * />
 */
export function SegmentBarSkeleton({ segments, className }: SegmentBarSkeletonProps): ReactElement {
  return (
    <div aria-hidden="true" data-segment-bar-placeholder="" className={cn('@container', className)}>
      <span className={cn(PLACEHOLDER_CLASS, 'block h-2 w-full rounded-full')} />
      <dl className={LEGEND_CLASS}>
        {segments.map((segment) => (
          <div key={segment.key} className={ITEM_CLASS}>
            <dt className={ITEM_CLASS}>
              <span className={cn(SWATCH_CLASS, 'bg-surface-3')} />
              {segment.label}
            </dt>
            <dd>
              <span data-shape={AMOUNT_SHAPE} className={AMOUNT_PLACEHOLDER_CLASS} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * A part-to-whole bar. The root is an inline-size container (the legend stacks in narrow tiles),
 * so give it a definite width: a block in a column, not a shrink-to-fit flex item.
 *
 * @example
 * <SegmentBar
 *   segments={[
 *     { key: 'easy', label: 'Easy', value: 215, tone: 'leet-easy' },
 *     { key: 'medium', label: 'Medium', value: 379, tone: 'leet-medium' },
 *     { key: 'hard', label: 'Hard', value: 98, tone: 'leet-hard' },
 *   ]}
 * />
 */
export function SegmentBar({ segments, className }: SegmentBarProps): ReactElement {
  const total = segments.reduce((sum, segment) => sum + drawable(segment.value), 0);
  const drawn = segments.filter((segment) => drawable(segment.value) > 0);

  return (
    <div data-segment-bar="" className={cn('@container', className)}>
      <div aria-hidden="true" data-segment-track="" className={TRACK_CLASS}>
        {drawn.map((segment) => (
          <span
            key={segment.key}
            data-segment={segment.key}
            className={TONE_CLASS[segment.tone]}
            style={{ width: shareOf(drawable(segment.value), total) }}
          />
        ))}
      </div>
      <dl className={LEGEND_CLASS}>
        {segments.map((segment) => (
          <div key={segment.key} className={ITEM_CLASS}>
            <dt className={ITEM_CLASS}>
              <span aria-hidden="true" className={cn(SWATCH_CLASS, TONE_CLASS[segment.tone])} />
              {segment.label}
            </dt>{' '}
            <dd>
              <LegendValue value={segment.value} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
