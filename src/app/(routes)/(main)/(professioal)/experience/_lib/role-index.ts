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
 * @file The /experience list's model. Pure and isomorphic: the day comes from the caller, the
 * logo URL from an injected `logoOf` and the /projects links from `techLinks`, so this module
 * loads neither the clock, the Sanity client nor the projects.
 *
 * - A role is listed once it has begun (listed-role.ts, the rule the role pages, the sitemap and
 *   the home page share): one that starts in a later month is on no list until then, so "now"
 *   is only ever what runs now.
 * - The lead is the first current role in Studio order (the one the home hero names), whatever
 *   order the rows are in.
 * - The groups are "Also now" and Before, never a kind of work (Studio holds none). The lead is
 *   "Now" on its own tile and is not repeated: the first group is the rest of what runs now, so
 *   the lead and that group add up to the figure the page prints. A group with no rows is left
 *   out.
 * - Every role, the lead included, is on one clock, and each row carries its lane in the
 *   clock's columns.
 */

import type { Experience } from '@/hooks/sanity/schemas';
import { listedExperiences } from './listed-role';
import {
  buildRoleClock,
  type ClockAxis,
  clockAxis,
  columnSpanOf,
  type RoleClock,
} from './role-clock';
import {
  DEFAULT_ROLE_ORDER,
  EXPERIENCE_PATH,
  type RoleEntry,
  type RoleGroupKey,
  type RoleOrder,
  roleEntryOf,
  sortRoles,
} from './role-ledger';
import { lengthOf, type RoleLength } from './role-length';
import { type RoleLink, roleLinksOf } from './role-links';
import { NO_TECH_LINKS, type TechLinks, type TechToken, techTokensOf } from './role-tech';
import { dutiesBeyond, ledeOf, plainText } from './role-text';

/** A role's columns on the axis: `end` is one past its last. */
export interface RoleLane {
  readonly start: number;
  readonly end: number;
  /** Still running: its last column is the clock's. */
  readonly current: boolean;
}

/** One role as the list shows it: the ledger's row, and what the opened row and its lane need. */
export interface RoleRow extends RoleEntry {
  /** The first sentence and the whole ones after it that fit the lead tile. */
  readonly lede: string;
  /** Null without a readable start. */
  readonly length: RoleLength | null;
  /** The duties the description does not already state, without their raw links. */
  readonly duties: readonly string[];
  /** Each address in the description and the duties, once, named. */
  readonly links: readonly RoleLink[];
  readonly tech: readonly TechToken[];
  /** Null without a readable start, or for a role that starts after the clock. */
  readonly lane: RoleLane | null;
}

export interface RoleIndexGroup {
  readonly key: RoleGroupKey;
  readonly label: 'Also now' | 'Before';
  readonly rows: readonly RoleRow[];
}

export interface RoleIndex {
  /** The first current role in Studio order; null when no role is current. */
  readonly lead: RoleRow | null;
  /** The other current roles, in the rows' order. */
  readonly alsoNow: readonly RoleRow[];
  /** Also now (what runs now, without the lead), then Before. */
  readonly groups: readonly RoleIndexGroup[];
  readonly clock: RoleClock;
  readonly axis: ClockAxis;
  /** Every role, the lead included. */
  readonly total: number;
}

export interface RoleIndexOptions {
  /** The day the page is rendered for (YYYY-MM-DD): the clock's last month. */
  readonly today: string;
  readonly order?: RoleOrder;
  /** The role's logo URL, or null; null for every role when not given. */
  readonly logoOf?: (experience: Experience) => string | null;
  /** The technologies /projects has; without them no technology links. */
  readonly techLinks?: TechLinks;
}

interface RowContext {
  readonly today: string;
  readonly clock: RoleClock;
  readonly axis: ClockAxis;
  readonly logoOf: (experience: Experience) => string | null;
  readonly techLinks: TechLinks;
}

/** A role's lane in the axis's columns. */
function laneOf(id: string, { clock, axis }: RowContext): RoleLane | null {
  const span = clock.spans.get(id);
  return span ? { ...columnSpanOf(axis, span), current: span.current } : null;
}

/** One experience as a row. */
function rowOf(experience: Experience, context: RowContext): RoleRow {
  const logo = experience.logo?.asset ? context.logoOf(experience) : null;
  const entry = roleEntryOf(experience, logo);
  const responsibilities = experience.responsibilities ?? [];
  return {
    ...entry,
    lede: ledeOf(experience.description),
    length: lengthOf(entry.period, context.today),
    duties: dutiesBeyond(experience.description, responsibilities).map(plainText),
    links: roleLinksOf([experience.description, ...responsibilities]),
    tech: techTokensOf(experience.technologies ?? [], context.techLinks),
    lane: laneOf(entry.id, context),
  };
}

/** The id of a role's row on the list: what a link that jumps to the row points at. */
export const roleRowAnchor = (id: string): string => `role-${id}`;

/**
 * The list at a role's row, from another page: where the role's own page leads back to, so the
 * visitor lands on the row they came from and it is the page's target.
 */
export const roleRowHref = (id: string): string =>
  `${EXPERIENCE_PATH}#${encodeURIComponent(roleRowAnchor(id))}`;

/**
 * Every role of an index once, as the page shows them: the lead, then each group's rows. For a
 * caller that needs one role by its id (the role's own page) or all of them in order.
 */
export function roleRowsOf(index: RoleIndex): RoleRow[] {
  const listed = index.groups.flatMap((group) => group.rows);
  return index.lead ? [index.lead, ...listed] : listed;
}

/** Every experience as the list: the lead, the groups "Also now" and Before, and the clock. */
export function buildRoleIndex(
  experiences: readonly Experience[],
  options: RoleIndexOptions,
): RoleIndex {
  const { today, order = DEFAULT_ROLE_ORDER, logoOf = () => null } = options;
  const listed = listedExperiences(experiences, today);
  // The clock and the lead read Studio order, whatever order the rows are shown in.
  const inStudioOrder = sortRoles(listed, 'groups').map((experience) =>
    roleEntryOf(experience, null),
  );
  const clock = buildRoleClock(inStudioOrder, today);
  const context: RowContext = {
    today,
    clock,
    axis: clockAxis(clock),
    logoOf,
    techLinks: options.techLinks ?? NO_TECH_LINKS,
  };

  const rows = sortRoles(listed, order).map((experience) => rowOf(experience, context));
  const leadId = inStudioOrder.find((entry) => entry.current)?.id;
  const alsoNow = rows.filter((row) => row.current && row.id !== leadId);
  const groups: RoleIndexGroup[] = [
    { key: 'now', label: 'Also now', rows: alsoNow },
    { key: 'before', label: 'Before', rows: rows.filter((row) => !row.current) },
  ];
  return {
    lead: rows.find((row) => row.id === leadId) ?? null,
    alsoNow,
    groups: groups.filter((group) => group.rows.length > 0),
    clock,
    axis: context.axis,
    total: rows.length,
  };
}
