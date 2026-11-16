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
 * @file The Role ledger's model: every experience as a row, in two groups, "Now" (current
 * roles) and "Before", plus the header's figures and the sentence that says how the rows are
 * ordered. Pure and isomorphic; the logo URL comes from an injected `logoOf`, so this module
 * never loads the Sanity client.
 *
 * Two orders (the lab's exp-order switch; the owner's open call):
 * - `groups` (the default): Studio order (`order` ascending) within each group.
 * - `date`: newest start first within each group, so only this one is called chronological.
 * Every tie is settled the same way on every render: Studio order, then the newer start, then
 * the id.
 */

import { companyName } from '@/app/_components/home/data/format';
import type { Experience } from '@/hooks/sanity/schemas';
import { parseRoleMonth, periodOf, type RolePeriod } from './period';
import { firstSentenceOf } from './role-text';

export const ROLE_ORDERS = ['groups', 'date'] as const;
export type RoleOrder = (typeof ROLE_ORDERS)[number];
export const DEFAULT_ROLE_ORDER: RoleOrder = 'groups';

export type RoleGroupKey = 'now' | 'before';

/** One role's row. */
export interface RoleEntry {
  readonly id: string;
  /** Its page, the row's one link. */
  readonly href: string;
  /** The position, as Studio writes it. */
  readonly role: string;
  /** The organization as people say it ('ResQ Systems', without ', Inc.'). */
  readonly organization: string;
  /** The organization as Studio writes it. */
  readonly company: string;
  readonly companyUrl: string | null;
  /** A square logo URL, or null for the monogram. */
  readonly logo: string | null;
  /** The organization's first letter or digit, for a role without a logo. */
  readonly monogram: string;
  readonly location: string | null;
  /** The description's first sentence, without its raw links. */
  readonly line: string;
  readonly current: boolean;
  readonly period: RolePeriod;
}

export interface RoleGroup {
  readonly key: RoleGroupKey;
  readonly label: 'Now' | 'Before';
  readonly entries: readonly RoleEntry[];
}

export interface RoleStats {
  readonly roles: number;
  readonly current: number;
  /** The year the earliest role began, or null when no start date is readable. */
  readonly firstYear: string | null;
}

export interface RoleLedger {
  /** Now, then Before; a group with no roles is left out. */
  readonly groups: readonly RoleGroup[];
  readonly stats: RoleStats;
}

export interface RoleLedgerOptions {
  readonly order?: RoleOrder;
  /** The role's logo URL, or null; null for every role when not given. */
  readonly logoOf?: (experience: Experience) => string | null;
}

/** The fields the two orders sort on. */
type Sortable = Pick<Experience, '_id' | 'order' | 'startDate'>;

/** The list's own path: every role's page is under it, and leads back to it. */
export const EXPERIENCE_PATH = '/experience';

const DESCRIPTIONS: Readonly<Record<RoleOrder, string>> = {
  groups: "Where I work now, then where I worked before, in the order I'd tell it.",
  date: 'Where I work now, then where I worked before, each in chronological order, newest first.',
};

const FIRST_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/** The exp-order switch's value, or the default for anything else (a stale link). */
export function parseRoleOrder(value: string | undefined): RoleOrder {
  return ROLE_ORDERS.find((order) => order === value) ?? DEFAULT_ROLE_ORDER;
}

/** The header's sentence for `order`: only the date order is chronological. */
export const ledgerDescription = (order: RoleOrder): string => DESCRIPTIONS[order];

/** '1 role', '10 roles'. */
export const roleCount = (count: number): string => `${count} ${count === 1 ? 'role' : 'roles'}`;

/** The role's page. */
export const roleHref = (id: string): string => `${EXPERIENCE_PATH}/${encodeURIComponent(id)}`;

/** The name's first letter or digit, upper-cased; '' when it has none. */
export function monogramOf(name: string): string {
  return FIRST_LETTER_OR_DIGIT.exec(name)?.[0].toUpperCase() ?? '';
}

/**
 * The description's first sentence, with its raw links taken out and its whitespace collapsed
 * (role-text.ts, which the list's rows read too). A full stop after an abbreviation (Inc., e.g.)
 * does not end it; text with no sentence end is kept whole.
 */
export const shortLineOf = (description: string): string => firstSentenceOf(description);

/** A start date's sortable day ('2024-06-01'), or null when it is not a readable date. */
const startKey = (role: Sortable): string | null =>
  parseRoleMonth(role.startDate) ? role.startDate.trim().slice(0, 10) : null;

/** The newer start first; a role with no readable start after every dated one. */
function newerStartFirst(a: Sortable, b: Sortable): number {
  const left = startKey(a);
  const right = startKey(b);
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? 1 : -1;
}

const byStudioOrder = (a: Sortable, b: Sortable): number => a.order - b.order;

/** Ids ascending, so two roles alike in every other way still sort the same on every render. */
function byId(a: Sortable, b: Sortable): number {
  if (a._id === b._id) return 0;
  return a._id < b._id ? -1 : 1;
}

/**
 * A sorted copy of `roles`: in Studio order (then the newer start, then the id) for `groups`,
 * or newest start first (then Studio order, then the id) for `date`. The input is never moved.
 */
export function sortRoles<T extends Sortable>(roles: readonly T[], order: RoleOrder): T[] {
  const compare =
    order === 'date'
      ? (a: T, b: T) => newerStartFirst(a, b) || byStudioOrder(a, b) || byId(a, b)
      : (a: T, b: T) => byStudioOrder(a, b) || newerStartFirst(a, b) || byId(a, b);
  return [...roles].sort(compare);
}

/** One experience's row, with the logo URL the caller built for it (null for the monogram). */
export function roleEntryOf(experience: Experience, logo: string | null): RoleEntry {
  const period = periodOf(experience);
  const organization = companyName(experience.company);
  return {
    id: experience._id,
    href: roleHref(experience._id),
    role: experience.position,
    organization,
    company: experience.company,
    companyUrl: experience.companyUrl || null,
    logo,
    monogram: monogramOf(organization),
    location: experience.location?.trim() || null,
    line: shortLineOf(experience.description),
    current: period.current,
    period,
  };
}

/** The year the earliest readable start falls in, as text; null when there is none. */
function firstYearOf(entries: readonly RoleEntry[]): string | null {
  const years = entries.flatMap((entry) => (entry.period.start ? [entry.period.start.year] : []));
  return years.length > 0 ? String(Math.min(...years)) : null;
}

/** Every experience as the ledger: Now then Before, in `order`, with the header's figures. */
export function buildRoleLedger(
  experiences: readonly Experience[],
  { order = DEFAULT_ROLE_ORDER, logoOf = () => null }: RoleLedgerOptions = {},
): RoleLedger {
  const entries = sortRoles(experiences, order).map((experience) =>
    roleEntryOf(experience, experience.logo?.asset ? logoOf(experience) : null),
  );
  const now = entries.filter((entry) => entry.current);
  const before = entries.filter((entry) => !entry.current);
  const groups: RoleGroup[] = [
    { key: 'now', label: 'Now', entries: now },
    { key: 'before', label: 'Before', entries: before },
  ];
  return {
    groups: groups.filter((group) => group.entries.length > 0),
    stats: { roles: entries.length, current: now.length, firstYear: firstYearOf(entries) },
  };
}
