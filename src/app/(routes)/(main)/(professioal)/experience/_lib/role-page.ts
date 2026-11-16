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
 * @file The model of /experience/[id]: one role as the list shows it (role-index.ts's row), and
 * where it sits among the others. Pure and isomorphic: the day, the logo URLs and the /projects
 * links come from the caller, exactly as for the list, so both pages draw one clock.
 *
 * - The role's whole description is printed, without its raw links (those are the row's chips);
 *   the row's duties are already the ones the description does not state.
 * - "Alongside" is every other role that shared a month with it, the most months first, and
 *   "busiest" the most that ran at once during it. Both are read from the dates alone.
 * - The roles before and after follow the list's own order, the story's rail (role-story.ts:
 *   Now, then each year a role began), so "Next" is the role under this one on /experience.
 * - The way back to the list is the role's own stop there, the lead's included.
 */

import type { Experience } from '@/hooks/sanity/schemas';
import { type ClockAxis, type ClockPeak, type RoleClock, roleContextOf } from './role-clock';
import { buildRoleIndex, type RoleIndexOptions, type RoleRow, roleRowHref } from './role-index';
import { lengthFromMonths, type RoleLength } from './role-length';
import { storyRowsOf } from './role-story';
import { plainText } from './role-text';

/** A role that ran beside the page's role. */
export interface RoleCompanion {
  readonly role: RoleRow;
  /** The months both ran. */
  readonly shared: RoleLength;
}

export interface RolePage {
  readonly role: RoleRow;
  /** The whole description, without its raw links. */
  readonly description: string;
  /** The roles that shared a month with it: the most months first, then Studio order. */
  readonly alongside: readonly RoleCompanion[];
  /**
   * The most roles that ran at once during it, itself counted, with every run of its months at
   * that count; null for a role with no place on the clock.
   */
  readonly busiest: ClockPeak | null;
  /** The roles before and after it in the list's order; null at either end. */
  readonly previous: RoleRow | null;
  readonly next: RoleRow | null;
  /** The way back to the list: at this role's stop, so the visitor lands where they came from. */
  readonly listHref: string;
  /** The clock and axis every role is drawn on, the list's own. */
  readonly clock: RoleClock;
  readonly axis: ClockAxis;
}

/**
 * The page for the experience with `id`, among `experiences`; null when none has that id. The
 * options are the list's: the day, the order its rows are in, the logos and the /projects links.
 */
export function buildRolePage(
  experiences: readonly Experience[],
  id: string,
  options: RoleIndexOptions,
): RolePage | null {
  const experience = experiences.find((each) => each._id === id);
  if (!experience) return null;
  const index = buildRoleIndex(experiences, options);
  const rows = storyRowsOf(index);
  const at = rows.findIndex((row) => row.id === id);
  const role = rows[at];
  if (!role) return null;

  const byId = new Map(rows.map((row) => [row.id, row]));
  const context = roleContextOf(index.clock, id);
  const alongside = (context?.alongside ?? []).flatMap((neighbour): RoleCompanion[] => {
    const row = byId.get(neighbour.id);
    const shared = lengthFromMonths(neighbour.shared);
    return row && shared ? [{ role: row, shared }] : [];
  });
  return {
    role,
    description: plainText(experience.description),
    alongside,
    busiest: context?.busiest ?? null,
    previous: rows[at - 1] ?? null,
    next: rows[at + 1] ?? null,
    listHref: roleRowHref(id),
    clock: index.clock,
    axis: index.axis,
  };
}
