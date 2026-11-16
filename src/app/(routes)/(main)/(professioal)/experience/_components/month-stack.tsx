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
 * @file The "Roles at once" stack: one cell for each role in each column of the shared axis (a
 * month, or a quarter at its busiest month once the history is long), so its height at any
 * point is how many roles ran then. Server-safe (no directive, no hooks); every cell is in the
 * server HTML and nothing here needs JavaScript.
 *
 * On the list, roles still running sit at the bottom in brand, ended ones pile above in the
 * quiet tone, and in this month's column each running role's cell is the "ongoing" ochre (a
 * role that ended this month keeps the quiet tone: it is not "now"); the peak is bracketed with
 * its true count. On a role's own page (`focus`) that one role is the bottom row, in brand with
 * a band over its months, and every other role is the quiet tone: its lane among the others.
 *
 * The quiet tone is the lanes' own (role-lane.tsx says why): `bg-faint/70`, written out here
 * for the cells and for the key's swatch, since a class must be whole in the source.
 *
 * A cell is as tall as a column is wide, 9px to 16px, unless an ancestor sets --stack-u: the
 * list's tile does, so the stack is the tile's graphic and not a strip a column's width tall.
 * The count on the bracket is the quiet one of a pair: the figure beside the stack says it at
 * full weight.
 *
 * The drawing is decorative (aria-hidden): what is around it says the same in words. It needs
 * --n and the year lines from an ancestor (role-lane.tsx axisStyle), and it carries the plot's
 * two edges as every lane does, so a stack and a lane of one width have the same columns.
 *
 * Each cell carries its role's id (data-r), which the cross-lighting island reads to light a
 * pointed-at row's months (data-lit="on" on its cells, "off" on the rest). Classes sit on the
 * stack, not on its 250-odd cells, so the HTML stays small.
 */

import { Fragment, type ReactElement } from 'react';

import { cn } from '@/lib/utils';
import {
  type ClockAxis,
  type ClockPeak,
  columnSpanOf,
  type RoleClock,
  stackOrderOf,
} from '../_lib/role-clock';
import { type CssVars, PLOT_EDGES_CLASS, percentOf, YEAR_LINES_CLASS } from './role-lane';

/** A container, so a cell can be as tall as a column is wide (--u). */
const BOX_CLASS = '@container min-w-0';
/**
 * Forced colours (Windows contrast themes) repaint every background as the page's own, and a
 * cell is a background and nothing else: the stack would be an empty frame. Each cell opts out
 * and takes a system colour, which is the reader's own theme and not a palette colour: GrayText
 * for an ended month (the quiet tone), Highlight for one still running, and CanvasText for this
 * month's, the colour its "Now" label is forced to. They hold over every state (the lighting
 * only dims the rest), hence the `!`. role-lane.tsx gives the lanes the same three.
 */
const FORCED_CELLS_CLASS = [
  'forced-colors:[&_i]:[forced-color-adjust:none] forced-colors:[&_i]:bg-[color:GrayText]!',
  'forced-colors:[&_i[data-tone=on]]:bg-[color:Highlight]!',
  'forced-colors:[&_i[data-tone=now]]:bg-[color:CanvasText]!',
].join(' ');
const STACK_CLASS = [
  'relative isolate grid grid-cols-[repeat(var(--n),minmax(0,1fr))]',
  // A cell is as tall as its column is wide, from 9px (a lane's height and its gap) to 16px,
  // or as tall as an ancestor asks (--stack-u).
  '[--u:var(--stack-u,clamp(0.5625rem,calc(100cqi/var(--n)),1rem))] h-[calc(var(--peak)*var(--u))]',
  'border-b border-b-hairline-strong',
  PLOT_EDGES_CLASS,
  YEAR_LINES_CLASS,
  // A column: its cells from the bottom up.
  '[&>span]:flex [&>span]:min-w-0 [&>span]:flex-col-reverse [&>span]:gap-px [&>span]:px-[0.5px] [&>span]:pb-px',
  // A cell: one role for one column.
  '[&_i]:h-[calc(var(--u)-1px)] [&_i]:flex-none [&_i]:rounded-[2px] [&_i]:bg-faint/70',
  '[&_i[data-tone=on]]:bg-brand [&_i[data-tone=now]]:bg-ongoing',
  '[&_i]:transition-[opacity,background-color] [&_i]:duration-(--motion-base) [&_i]:ease-effect',
  // Cross-lighting: a pointed-at row's cells brighten (this month's stays ochre), the rest dim.
  '[&_i[data-lit=off]]:opacity-40 [&_i[data-lit=on]:not([data-tone=now])]:bg-brand-ink',
  FORCED_CELLS_CLASS,
].join(' ');
/** A bracket over the marked columns, its count above it. */
const PEAK_CLASS =
  'pointer-events-none absolute bottom-[calc(100%+0.25rem)] h-1.5 rounded-t-[2px] border border-b-0 border-faint';
/** Over one column a bracket would close into a box, so that one is a stem at its middle. */
const PEAK_STEM_CLASS =
  'pointer-events-none absolute bottom-[calc(100%+0.25rem)] h-1.5 w-0 border-l border-faint';
const PEAK_COUNT_CLASS =
  'absolute bottom-2 left-1/2 -translate-x-1/2 tile-label tabular-nums text-faint';
/** The focused role's months as a band behind the cells, the list's cross-lighting held still. */
const BAND_CLASS =
  'pointer-events-none absolute -top-1 bottom-0 -z-10 bg-(--brand-glow) shadow-[inset_1px_0_0_var(--brand-edge),inset_-1px_0_0_var(--brand-edge)]';

type CellTone = 'now' | 'on' | undefined;

/** Where a run of columns sits on the axis, as CSS. */
function placeOf(
  axis: ClockAxis,
  span: { readonly start: number; readonly end: number },
): { readonly left: string; readonly width: string } {
  const total = axis.columns.length;
  const columns = columnSpanOf(axis, span);
  return {
    left: percentOf(columns.start, total),
    width: percentOf(columns.end - columns.start, total),
  };
}

/** The bracket over one run of months at the marked count. */
function PeakMark({
  axis,
  count,
  run,
}: {
  readonly axis: ClockAxis;
  readonly count: number;
  readonly run: ClockPeak['runs'][number];
}): ReactElement {
  const columns = columnSpanOf(axis, { start: run.from.index, end: run.to.index + 1 });
  const single = columns.end - columns.start === 1;
  return (
    <div
      data-stack-peak=""
      className={single ? PEAK_STEM_CLASS : PEAK_CLASS}
      style={
        single
          ? { left: percentOf(columns.start + 0.5, axis.columns.length) }
          : placeOf(axis, { start: run.from.index, end: run.to.index + 1 })
      }
    >
      <b className={PEAK_COUNT_CLASS}>{count}</b>
    </div>
  );
}

export interface MonthStackProps {
  readonly clock: RoleClock;
  readonly axis: ClockAxis;
  /**
   * One role to set apart, on its own page: its cells take the bottom row in brand (this
   * month's in ochre) under a band over its months, and every other role's are the quiet tone.
   */
  readonly focus?: string;
  /** The count to bracket over its months: the clock's peak unless another is given. */
  readonly mark?: ClockPeak | null;
  readonly className?: string;
}

/** The stack for a clock; nothing when the clock has no months. */
export function MonthStack({
  clock,
  axis,
  focus,
  mark = clock.peak,
  className,
}: MonthStackProps): ReactElement | null {
  const { peak, spans } = clock;
  if (!peak || axis.columns.length === 0) return null;
  const order = stackOrderOf(clock);
  const piled = focus === undefined ? order : [focus, ...order.filter((id) => id !== focus)];
  const rank = new Map(piled.map((id, index) => [id, index]));
  const byRank = (a: string, b: string): number => (rank.get(a) ?? 0) - (rank.get(b) ?? 0);
  const current = (id: string): boolean => spans.get(id)?.current === true;
  const lit = (id: string): boolean => (focus === undefined ? current(id) : id === focus);
  // This month's tone is for a role that runs now: one that ended this month keeps its own.
  const toneOf = (id: string, now: boolean): CellTone => {
    if (!lit(id)) return undefined;
    return now && current(id) ? 'now' : 'on';
  };
  const focused = focus === undefined ? undefined : spans.get(focus);
  const style: CssVars = { '--peak': peak.count };

  return (
    <div
      aria-hidden="true"
      data-month-stack=""
      data-focus={focus}
      className={cn(BOX_CLASS, className)}
      style={style}
    >
      <div className={STACK_CLASS}>
        {axis.columns.map((column) => (
          <span key={column.index} data-now={column.now ? '' : undefined}>
            {[...column.roleIds].sort(byRank).map((id) => (
              <i key={id} data-r={id} data-tone={toneOf(id, column.now)} />
            ))}
          </span>
        ))}
        {focused && (
          <div data-stack-band="" className={BAND_CLASS} style={placeOf(axis, focused)} />
        )}
        {mark?.runs.map((run) => (
          <PeakMark key={run.from.iso} axis={axis} count={mark.count} run={run} />
        ))}
      </div>
    </div>
  );
}

/** The line under a stack: where the axis starts, what its tones mean, and where "now" is. */
const LEGEND_CLASS =
  "mt-1.5 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 tile-meta text-faint [grid-template-areas:'start_now'_'key_key'] @min-[20rem]:grid-cols-[auto_1fr_auto] @min-[20rem]:[grid-template-areas:'start_key_now']";
/**
 * The keys side by side; where the plot has no line for both (a narrow phone with its text
 * enlarged) the second goes under the first, whole, and neither leaves the tile.
 */
const LEGEND_KEY_CLASS =
  'flex flex-wrap items-center gap-x-3 gap-y-1 [grid-area:key] @min-[20rem]:justify-center [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5 [&_i]:size-2 [&_i]:flex-none [&_i]:rounded-[2px]';
/** The two cell tones a key can name, each with the system colour its cells take in forced colours. */
const KEY_SWATCH: Readonly<Record<StackKeyTone, string>> = {
  brand: 'bg-brand forced-colors:[forced-color-adjust:none] forced-colors:bg-[color:Highlight]',
  quiet: 'bg-faint/70 forced-colors:[forced-color-adjust:none] forced-colors:bg-[color:GrayText]',
};

export type StackKeyTone = 'brand' | 'quiet';

export interface StackLegendProps {
  /** The axis's first month: 'Jan 2023'. */
  readonly start: string;
  /** What each tone of cell means, in the order to print them. */
  readonly keys: readonly { readonly tone: StackKeyTone; readonly label: string }[];
  /** The word at the axis's end, in the "ongoing" ochre. */
  readonly now: string;
}

/**
 * The stack's ends and key on one line, or the key under the ends when the plot is under 20rem
 * wide. It answers to the nearest container, so its parent must be the plot's (@container).
 * Decorative with the stack: hidden from screen readers.
 */
export function StackLegend({ start, keys, now }: StackLegendProps): ReactElement {
  return (
    <p aria-hidden="true" data-stack-legend="" className={LEGEND_CLASS}>
      <span className="[grid-area:start]">{start}</span>{' '}
      <span className={LEGEND_KEY_CLASS}>
        {keys.map((key, index) => (
          <Fragment key={key.label}>
            {index > 0 && ' '}
            <span>
              <i className={KEY_SWATCH[key.tone]} />
              {key.label}
            </span>
          </Fragment>
        ))}
      </span>{' '}
      <span className="text-right text-ongoing [grid-area:now]">{now}</span>
    </p>
  );
}
