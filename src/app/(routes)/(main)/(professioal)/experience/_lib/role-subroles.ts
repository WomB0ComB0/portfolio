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

import type { Experience } from '@/hooks/sanity/schemas';
import { isListedRole } from './listed-role';
import { monthsBetween, parseRoleMonth, periodOf, type RoleMonth, type RolePeriod } from './period';
import { lengthOf, type RoleLength } from './role-length';
import { type RoleLink, roleLinksOf } from './role-links';
import { NO_TECH_LINKS, type TechLinks, type TechToken, techTokensOf } from './role-tech';
import { dutiesBeyond, plainText } from './role-text';

/** A dated child position; it never becomes another engagement on the overall clock. */
export interface RoleSubRole {
  readonly key: string;
  readonly position: string;
  readonly employmentType?: string;
  readonly period: RolePeriod;
  readonly length: RoleLength | null;
  readonly description: string;
  readonly duties: readonly string[];
  readonly links: readonly RoleLink[];
  readonly tech: readonly TechToken[];
  readonly lane: { readonly startPercent: number; readonly widthPercent: number } | null;
}

export interface SubRoleOptions {
  readonly today: string;
  readonly techLinks?: TechLinks;
}

interface SourceSubRole {
  readonly _key: string;
  readonly position: string;
  readonly employmentType?: string | null;
  readonly startDate: string;
  readonly endDate?: string | null;
  readonly current?: boolean | null;
  readonly description?: string | null;
  readonly responsibilities?: readonly string[] | null;
  readonly technologies?: readonly string[] | null;
}

const optionalText = (value: unknown): boolean => value == null || typeof value === 'string';
const optionalTexts = (value: unknown): boolean =>
  value == null || (Array.isArray(value) && value.every((item) => typeof item === 'string'));

/** The page loader validates this already; keep direct model calls safe on partial old data too. */
function isSource(value: unknown): value is SourceSubRole {
  if (!value || typeof value !== 'object') return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source._key === 'string' &&
    typeof source.position === 'string' &&
    optionalText(source.employmentType) &&
    (source._type == null || source._type === 'experienceSubRole') &&
    typeof source.startDate === 'string' &&
    optionalText(source.endDate) &&
    (source.current == null || typeof source.current === 'boolean') &&
    optionalText(source.description) &&
    optionalTexts(source.responsibilities) &&
    optionalTexts(source.technologies)
  );
}

interface CalendarMonth {
  readonly text: string;
  readonly month: RoleMonth;
}

/** Sanity calendar days (or month-precision imports), rejecting rollovers such as February 30. */
function calendarMonth(value: string): CalendarMonth | null {
  const text = value.trim();
  if (!/^\d{4}-\d{2}(?:-\d{2})?$/u.test(text)) return null;
  const ms = Date.parse(text.length === 7 ? `${text}-01` : text);
  if (!Number.isFinite(ms) || !new Date(ms).toISOString().startsWith(text)) return null;
  const month = parseRoleMonth(text);
  return month ? { text, month } : null;
}

const monthIndex = (month: RoleMonth): number => month.year * 12 + month.month - 1;
const earlier = (end: RoleMonth | null, today: RoleMonth | null): RoleMonth | null =>
  end && today ? (monthIndex(end) <= monthIndex(today) ? end : today) : (end ?? today);

/** A known parent interval is the one shared scale; missing bounds leave the child undrawn. */
function laneOf(
  parent: RolePeriod,
  child: RolePeriod,
  today: RoleMonth | null,
): RoleSubRole['lane'] {
  const end = parent.current ? today : earlier(parent.end, today);
  const childEnd = child.current ? today : earlier(child.end, today);
  if (!parent.start || !end || !child.start || !childEnd) return null;
  const total = monthsBetween(parent.start, end);
  if (total === 0) return null;
  const startPercent = ((monthIndex(child.start) - monthIndex(parent.start)) / total) * 100;
  const widthPercent = (monthsBetween(child.start, childEnd) / total) * 100;
  return { startPercent, widthPercent: Math.min(100 - startPercent, widthPercent) };
}

/**
 * Valid children, newest start first (source order on a tie). Parent dates retain their existing
 * month semantics. Child dates must be real calendar values; future starts and spans outside a
 * known parent bound are omitted. Overlap is valid. Missing end dates mean ongoing, as on parents.
 * The only clock is `today`; no environment, logo building or project loading is performed.
 */
export function subRolesOf(
  experience: Experience,
  { today, techLinks = NO_TECH_LINKS }: SubRoleOptions,
): RoleSubRole[] {
  if (!Array.isArray(experience.subRoles) || !isListedRole(experience, today)) return [];
  const parent = periodOf(experience);
  const clock = parseRoleMonth(today);
  const seen = new Set<string>();
  const rows: { readonly start: string; readonly role: RoleSubRole }[] = [];
  for (const source of experience.subRoles) {
    if (!isSource(source)) continue;
    const key = source._key.trim();
    const position = source.position.replaceAll(/\s+/gu, ' ').trim();
    if (!key || !position || seen.has(key)) continue;
    const start = calendarMonth(source.startDate);
    const endText = source.endDate?.trim();
    const end = endText ? calendarMonth(endText) : null;
    if (!start || (endText && !end)) continue;
    if (
      end &&
      (monthIndex(end.month) < monthIndex(start.month) ||
        (start.text.length === 10 && end.text.length === 10 && end.text < start.text))
    )
      continue;
    const dates = {
      startDate: start.text,
      endDate: end?.text ?? null,
      current: source.current === true,
    };
    if (!isListedRole(dates, today)) continue;
    const period = periodOf(dates);
    const last = period.current ? clock : period.end;
    if (parent.start && monthIndex(start.month) < monthIndex(parent.start)) continue;
    if (parent.end && (!last || monthIndex(last) > monthIndex(parent.end))) continue;
    const description = source.description ?? '';
    const employmentType = plainText(source.employmentType ?? '');
    const responsibilities = source.responsibilities ?? [];
    seen.add(key);
    rows.push({
      start: start.text.length === 7 ? `${start.text}-01` : start.text,
      role: {
        key,
        position,
        ...(employmentType ? { employmentType } : {}),
        period,
        length: lengthOf(period, today),
        description: plainText(description),
        duties: dutiesBeyond(description, responsibilities).map(plainText),
        links: roleLinksOf([description, ...responsibilities]),
        tech: techTokensOf(source.technologies ?? [], techLinks),
        lane: laneOf(parent, period, clock),
      },
    });
  }
  return rows
    .sort((a, b) => (a.start === b.start ? 0 : a.start > b.start ? -1 : 1))
    .map(({ role }) => role);
}

/** A concise progression when distinct positions span the tenure; otherwise keep the parent title. */
export function subRoleProgressionTitle(
  fallback: string,
  subRoles: readonly RoleSubRole[],
): string {
  if (subRoles.length < 2) return fallback;
  // Equal start months describe concurrent roles, not evidence of a promotion.
  if (subRoles.at(-1)?.period.start?.iso === subRoles[0]?.period.start?.iso) return fallback;
  const first = subRoles.at(-1)?.position;
  const last = subRoles[0]?.position;
  return first && last && first !== last ? `${first} → ${last}` : fallback;
}
