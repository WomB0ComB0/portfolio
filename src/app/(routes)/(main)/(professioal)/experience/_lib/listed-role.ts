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
 * @file Which roles the site lists on a day, and which of them run now: one rule each for
 * /experience (role-index.ts), a role's own page (404 for the others), /sitemap.xml and the home
 * page's roles (selectors.ts). Pure and
 * isomorphic, and light: its one value import is period.ts, so a route or the home's selectors
 * can read it without loading the list's model or any page or client code. The day comes from
 * the caller: New York's (nyToday()) everywhere, so every surface agrees on the month.
 */

import type { Experience } from '@/hooks/sanity/schemas';
import { isCurrentRole, monthsBetween, parseRoleMonth, periodOf } from './period';

/** The fields of an experience the rule reads. */
export type ListedRoleDates = Pick<Experience, 'startDate' | 'endDate' | 'current'>;

/**
 * Whether the site lists a role on `today` (YYYY-MM-DD): once it has begun, by month. A role
 * that starts in a later month, or a current one whose start cannot be read, is on no list and
 * its page answers 404, until the clock can draw it: before then it is neither "now" nor
 * "before". An ended role whose start cannot be read is still listed, without a lane. A day that
 * cannot be read lists every role with a start.
 */
export function isListedRole(experience: ListedRoleDates, today: string): boolean {
  const { start, current } = periodOf(experience);
  if (!start) return !current;
  const clock = parseRoleMonth(today);
  return !clock || monthsBetween(start, clock) > 0;
}

/** The roles of `experiences` the site lists on `today`, in the order given (a new array). */
export function listedExperiences<T extends ListedRoleDates>(
  experiences: readonly T[],
  today: string,
): T[] {
  return experiences.filter((experience) => isListedRole(experience, today));
}

/**
 * Whether a role runs now on `today` (YYYY-MM-DD): the site lists it (isListedRole) and it is
 * current, by Studio's flag or for want of a readable end date (period.ts isCurrentRole, which
 * periodOf reads too). The one rule for "now" everywhere: the home page's hero and roles tile
 * (selectors.ts), and /experience's lead, "Also now" and its "N now" figure (role-index.ts on
 * the listed roles' periods).
 */
export function isNowRole(experience: ListedRoleDates, today: string): boolean {
  return isCurrentRole(experience) && isListedRole(experience, today);
}

/** The roles of `experiences` that run now on `today` (isNowRole), in the order given. */
export function nowExperiences<T extends ListedRoleDates>(
  experiences: readonly T[],
  today: string,
): T[] {
  return experiences.filter((experience) => isNowRole(experience, today));
}
