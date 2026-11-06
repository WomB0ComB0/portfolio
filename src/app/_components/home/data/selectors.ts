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
 * @file What the home tiles show, picked from the lists the pages already load (no extra GROQ).
 * Pure functions with no I/O.
 *
 * The rules are stated here rather than read off the lists' order. Today the selectors give the
 * same answer as taking the first match in D's GROQ order, and they keep giving it if a section
 * page later sorts its list another way. Studio order is the `order` field, ascending.
 */

import type { Experience, Place, Project } from '@/hooks/sanity/schemas';
import type { MonkeytypeProfile } from '@/lib/api-integrations/monkeytype';
import { lastVisitDay } from './format';

/** How many current roles the roles tile lists. */
export const ROLES_SHOWN = 3;

/** The Monkeytype time mode the typing tile shows, in seconds. */
const TIMED_TEST_SECONDS = '60';

export interface CurrentRoles {
  /** Up to {@link ROLES_SHOWN} current roles, in Studio order. */
  readonly roles: readonly Experience[];
  /** Every current role, shown or not. */
  readonly total: number;
}

/** A Monkeytype personal best, rounded for display. */
export interface PersonalBest {
  /** Whole words per minute. */
  readonly wpm: number;
  /** Percent, to 1 decimal. */
  readonly accuracy: number;
}

export interface TypingStats {
  /** The fastest 60 s test, or null when there is none. */
  readonly best60: PersonalBest | null;
  readonly completedTests: number;
}

/** Typing stats that have a 60 s best: what the typing tile renders. */
export interface TypingTileData extends TypingStats {
  readonly best60: PersonalBest;
}

/** Sanity dates are ISO strings, so they sort as text. A missing one sorts last. */
function newerFirst(a?: string | null, b?: string | null): number {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? 1 : -1;
}

/** Studio order, then the newer start first: how the experience and project queries sort. */
const byStudioOrder = (
  a: { readonly order: number; readonly startDate?: string | null },
  b: { readonly order: number; readonly startDate?: string | null },
): number => a.order - b.order || newerFirst(a.startDate, b.startDate);

/** A place with the day of its last known visit by today (YYYY-MM-DD, lastVisitDay). */
interface Visit {
  readonly place: Place;
  readonly day: string;
}

/**
 * The latest visit first; on the same day the lower `order` first (by convention, a more negative
 * order is later in the day).
 */
const byLatestVisit = (a: Visit, b: Visit): number =>
  newerFirst(a.day, b.day) || a.place.order - b.place.order;

/** The current roles in Studio order: the first {@link ROLES_SHOWN}, and how many there are. */
export function selectCurrentRoles(experiences: readonly Experience[]): CurrentRoles {
  const current = experiences.filter((experience) => experience.current).sort(byStudioOrder);
  return { roles: current.slice(0, ROLES_SHOWN), total: current.length };
}

/**
 * The place visited most recently by `today` (YYYY-MM-DD), by the latest day known to be a visit
 * (lastVisitDay): a range's last day once that day has come, else its first or only day. So from
 * Sep 15 a run of visits from Jul 29 to Sep 15 is more recent than a single day on Aug 21, though
 * it started first; before Sep 15 the Aug 21 day is. Undated places, and places that start after
 * today, are skipped. Null when none qualifies.
 */
export function selectLatestPlace(places: readonly Place[], today: string): Place | null {
  const visits = places.flatMap((place): Visit[] => {
    const day = lastVisitDay(place, today);
    return day === null ? [] : [{ place, day }];
  });
  return visits.sort(byLatestVisit)[0]?.place ?? null;
}

/**
 * The first featured project in Studio order that has a cover image, else the first featured
 * project, else null.
 */
export function selectFeaturedProject(projects: readonly Project[]): Project | null {
  const featured = projects.filter((project) => project.featured).sort(byStudioOrder);
  return featured.find((project) => project.image?.asset) ?? featured[0] ?? null;
}

const roundToTenth = (value: number): number => Math.round(value * 10) / 10;

/** The 60 s personal best with the highest wpm (the first on a tie), rounded; null without one. */
export function toTypingStats(profile: MonkeytypeProfile): TypingStats {
  const bests = profile.personalBests.time?.[TIMED_TEST_SECONDS] ?? [];
  const fastest = bests.reduce<(typeof bests)[number] | null>(
    (top, entry) => (top === null || entry.wpm > top.wpm ? entry : top),
    null,
  );
  return {
    best60: fastest ? { wpm: Math.round(fastest.wpm), accuracy: roundToTenth(fastest.acc) } : null,
    completedTests: profile.typingStats.completedTests,
  };
}

/** True when the stats have a 60 s best to show. */
export const hasBest60 = (stats: TypingStats): stats is TypingTileData => stats.best60 !== null;
