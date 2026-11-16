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
 * @file "The path so far": every role as a capsule on one shared month axis, the Story mock's
 * map, after the Now chapter of /experience (never first: the judges). Pure and isomorphic; it
 * reads the story's rows (their lanes on the clock's axis), so the figure and the rail agree.
 *
 * - On a wide figure (PATH_PACKED_REM and up) the capsules share lanes: each takes the lowest
 *   lane that is free from its start, oldest start first, so the busiest months read as the
 *   tallest stack. A label goes inside its capsule when it fits there at the narrowest packed
 *   width, else just after it (or before it, at the axis's end), and the lane keeps that room
 *   free, so no label is ever clipped, faded or set over another capsule (the mock's defects).
 * - On a narrow one each role is its own row, its name over its line (role-path.tsx), so
 *   nothing scrolls sideways on a phone.
 *
 * Widths are estimated in average Geist letters (word-measure.ts), which run a little wider
 * than the real words, so a label judged to fit always does.
 */

import { EM_PER_UNIT, wordUnits } from '@/components/console/folio/word-measure';
import { type RoleRow, roleRowAnchor } from './role-index';

/** The figure's width in rem from which the capsules share lanes (its container query). */
export const PATH_PACKED_REM = 52;
/** A capsule's label size in rem (text-xs). */
export const PATH_LABEL_REM = 0.75;
/** A capsule's inner padding on each side, in rem (px-2.5). */
const LABEL_PAD_REM = 0.625;
/** The space between a capsule and a label set beside it, in rem (ml-1.5 / mr-1.5). */
const LABEL_GAP_REM = 0.375;
/** The least space between two capsules on one lane, in rem. */
const LANE_GAP_REM = 0.375;

/** Where a capsule's name is set: in it, just after it, or just before it. */
export type PathLabelSide = 'inside' | 'after' | 'before';

/** One role on the path. */
export interface PathRole {
  readonly id: string;
  /** Its stop on the page: '#role-<id>'. */
  readonly href: string;
  readonly organization: string;
  readonly role: string;
  readonly current: boolean;
  /** Its first column on the axis. */
  readonly start: number;
  /** One past its last column. */
  readonly end: number;
  /** Its lane on a wide figure, 0 at the top. */
  readonly lane: number;
  readonly label: PathLabelSide;
  /** The name's width in em at the label's own size, an overestimate (a narrow row's hang). */
  readonly labelEm: number;
  /**
   * The capsule width in rem its name needs inside it, padding included: a name set beside its
   * capsule at the narrowest packed width moves inside once the capsule is this wide.
   */
  readonly insideRem: number;
  /** When it ran, as a screen reader hears it: 'since Mar 2026', 'Apr 2024 to Feb 2026'. */
  readonly spoken: string;
}

export interface RolePath {
  /** Every role with a place on the axis, oldest start first (the rail's order breaks a tie). */
  readonly roles: readonly PathRole[];
  /** How many lanes a wide figure stacks. */
  readonly lanes: number;
  /** The axis's columns. */
  readonly columns: number;
}

const EMPTY_PATH: RolePath = { roles: [], lanes: 0, columns: 0 };

/** When a role ran, for a screen reader: 'since Mar 2026', 'Sep 2023', 'Apr 2024 to Feb 2026'. */
export function spokenPeriodOf(row: Pick<RoleRow, 'period' | 'current'>): string {
  const { start, end, text } = row.period;
  if (!start) return text;
  if (row.current || !end) return `since ${start.label}`;
  return start.iso === end.iso ? start.label : `${start.label} to ${end.label}`;
}

/** A role with a place on the axis, before its lane is chosen. */
interface Placed {
  readonly row: RoleRow;
  readonly start: number;
  readonly end: number;
  readonly label: PathLabelSide;
  readonly labelEm: number;
  readonly insideRem: number;
  /** The columns it keeps free on its lane, its label beside it included. */
  readonly from: number;
  readonly to: number;
}

/** Where the name goes, and the columns the capsule keeps free, at the narrowest packed width. */
function place(row: RoleRow, start: number, end: number, columns: number): Placed {
  const remPerColumn = PATH_PACKED_REM / columns;
  const labelEm = wordUnits(row.organization) * EM_PER_UNIT;
  const textRem = labelEm * PATH_LABEL_REM;
  const insideRem = textRem + 2 * LABEL_PAD_REM;
  const base = { row, start, end, labelEm, insideRem };
  if (insideRem <= (end - start) * remPerColumn) {
    return { ...base, label: 'inside', from: start, to: end };
  }
  const beside = (textRem + LABEL_GAP_REM) / remPerColumn;
  if (end + beside <= columns) return { ...base, label: 'after', from: start, to: end + beside };
  if (start - beside >= 0) return { ...base, label: 'before', from: start - beside, to: end };
  return { ...base, label: 'inside', from: start, to: end };
}

/** Oldest start first; then the longer role; then the order given. */
const byStart = (a: Placed, b: Placed): number => a.start - b.start || b.end - a.end;

/** Each role's lane: the lowest one free from where it starts (with a gap), oldest first. */
function packLanes(
  placed: readonly Placed[],
  gap: number,
): { readonly lanes: number[]; readonly count: number } {
  const ends: number[] = [];
  const lanes = placed.map((item) => {
    const free = ends.findIndex((laneEnd) => laneEnd + gap <= item.from);
    const lane = free === -1 ? ends.length : free;
    ends[lane] = item.to;
    return lane;
  });
  return { lanes, count: ends.length };
}

/**
 * The path for `rows` (the story's order) on an axis of `columns`: the roles with a lane on the
 * clock, each with its lane, where its name goes and how it is spoken. A role with no readable
 * start has no place on the axis and is left to the rail.
 */
export function buildRolePath(rows: readonly RoleRow[], columns: number): RolePath {
  if (columns <= 0) return EMPTY_PATH;
  const placed = rows
    .flatMap((row) => (row.lane && row.lane.end > row.lane.start ? [{ row, lane: row.lane }] : []))
    .map(({ row, lane }) => place(row, lane.start, lane.end, columns))
    .sort(byStart);
  if (placed.length === 0) return EMPTY_PATH;
  const { lanes, count } = packLanes(placed, LANE_GAP_REM / (PATH_PACKED_REM / columns));
  const roles = placed.map(
    (item, index): PathRole => ({
      id: item.row.id,
      href: `#${roleRowAnchor(item.row.id)}`,
      organization: item.row.organization,
      role: item.row.role,
      current: item.row.current,
      start: item.start,
      end: item.end,
      lane: lanes[index] ?? 0,
      label: item.label,
      labelEm: Math.round(item.labelEm * 100) / 100,
      insideRem: Math.ceil(item.insideRem * 100) / 100,
      spoken: spokenPeriodOf(item.row),
    }),
  );
  return { roles, lanes: count, columns };
}
