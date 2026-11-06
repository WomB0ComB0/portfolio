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
 * @file What the home tiles show, picked from the lists the pages already load (no extra GROQ)
 * and, for the project tile, the public repositories GitHub counts the owner's own commits to.
 * Pure functions with no I/O.
 *
 * The rules are stated here rather than read off the lists' order. Today the selectors give the
 * same answer as taking the first match in D's GROQ order, and they keep giving it if a section
 * page later sorts its list another way. Studio order is the `order` field, ascending.
 */

import type { Experience, Place, Project } from '@/hooks/sanity/schemas';
import type { CommittedRepo } from '@/lib/api-integrations/github-activity';
import type { MonkeytypeProfile } from '@/lib/api-integrations/monkeytype';
import { type DateSpan, type Instant, lastDayOf, NY_TIME_ZONE, nyToday } from './format';

/** How many current roles the roles tile lists. */
export const ROLES_SHOWN = 3;

/**
 * How many days back the owner's newest commit to a project's repository may be for it to be his
 * latest work. GitHub is asked for the same span (RECENT_COMMITS_DAYS); this applies it again,
 * since a cached answer ages.
 */
export const ACTIVE_PROJECT_WINDOW_DAYS = 30;

/** This site's repository: showing 'this website' on this website says nothing. */
export const SITE_REPOSITORY = 'WomB0ComB0/portfolio';

const DAY_MS = 86_400_000;
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/u;
const GITHUB_HOST = 'github.com';
const WWW_PREFIX = /^www\./u;
const GIT_SUFFIX = /\.git$/u;
const SITE_REPOSITORY_KEY = SITE_REPOSITORY.toLowerCase();

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

/** A GitHub URL's owner and repository, lower-cased. */
export interface GitHubPath {
  readonly owner: string;
  /** Null for an owner's root (an org or user page, https://github.com/ElysiumOSS). */
  readonly name: string | null;
}

/** The project of the repository the owner committed to last, and the day of that commit. */
export interface ActiveProject {
  readonly project: Project;
  /** The repository, `owner/name` as GitHub spells it. */
  readonly repo: string;
  /** The day of his newest commit there, YYYY-MM-DD (GitHub's contribution day). */
  readonly lastCommitDay: string;
}

/** What the project tile shows: the owner's latest work, else the featured pick. */
export type ProjectPick =
  | ({ readonly source: 'activity' } & ActiveProject)
  | { readonly source: 'featured'; readonly project: Project };

/** A project with a github.com URL, and that URL's path. */
interface LinkedProject {
  readonly project: Project;
  readonly path: GitHubPath;
}

/** A repository committed to inside the window, keyed by its lower-cased owner and name. */
interface RecentWork {
  readonly repo: CommittedRepo;
  readonly owner: string;
  readonly name: string;
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

/** A place whose visit is over, with that visit's last day (YYYY-MM-DD, lastDayOf). */
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
 * The hour on New York's clock (0 to 23) from which a visit that ended the day before counts as
 * over: noon. Visits are stored as days, not times. An evening event (a Luma or Partiful RSVP) can
 * run past midnight, and west of New York the day itself is not over at midnight ET. So a visit on
 * day D counts as over from 12:00 ET on D + 1 (wall-clock time, so on a daylight-saving day too),
 * never while the owner may still be there.
 */
export const PLACE_CUTOFF_HOUR_ET = 12;

/** New York's clock hour, 0 to 23 (h23: midnight is 0, never 24). */
const NY_HOUR = new Intl.DateTimeFormat('en-US', {
  timeZone: NY_TIME_ZONE,
  hour: 'numeric',
  hourCycle: 'h23',
});

const nyHour = (now: Instant): number =>
  Number(NY_HOUR.formatToParts(now).find((part) => part.type === 'hour')?.value);

/** The calendar day before `day` (YYYY-MM-DD). */
const dayBefore = (day: string): string =>
  new Date(Date.parse(day) - DAY_MS).toISOString().slice(0, 10);

/**
 * The day (YYYY-MM-DD) a visit must end before to count as over at `now`: New York's today from
 * {@link PLACE_CUTOFF_HOUR_ET}:00 on its clock, its yesterday before then.
 *
 * @example
 * placeCutoffDay(Date.UTC(2026, 10, 7, 5, 30)) // '2026-11-06': at 00:30 ET Nov 7, Nov 6 is not over
 * placeCutoffDay(Date.UTC(2026, 10, 7, 17, 30)) // '2026-11-07': from noon ET Nov 7, it is
 */
export function placeCutoffDay(now: Instant): string {
  const today = nyToday(now);
  return nyHour(now) >= PLACE_CUTOFF_HOUR_ET ? today : dayBefore(today);
}

/**
 * The visit's last day (lastDayOf: a range's end, else its one day) when it is strictly before
 * `cutoff` (placeCutoffDay), so the visit is over. Null for a visit that may still be on (its last
 * day is the cutoff or later), one yet to come, and an undated one.
 */
export function lastDayIfOver(span: DateSpan, cutoff: string): string | null {
  const day = lastDayOf(span);
  return day !== null && day < cutoff ? day : null;
}

/**
 * The place whose visit ended most recently before `cutoff` (YYYY-MM-DD; the loader passes
 * placeCutoffDay: New York's today from noon ET, its yesterday before). Past visits only, so the
 * home page never tells where the owner is now: a place counts once lastDayIfOver says its visit
 * is over. A visit on the cutoff day, a range still on (ending on it or later) and a place yet to
 * come are skipped, as are undated places. Ranked by that last day, newest first, then the lower
 * `order` (byLatestVisit). So from a Sep 16 cutoff a run of visits from Jul 29 to Sep 15 is more
 * recent than a single day on Aug 21, though it started first; until then only the Aug 21 day can
 * show. Null when none qualifies.
 */
export function selectLatestPlace(places: readonly Place[], cutoff: string): Place | null {
  const visits = places.flatMap((place): Visit[] => {
    const day = lastDayIfOver(place, cutoff);
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

/**
 * Where `url` points on github.com: its owner and repository, lower-cased, without a trailing
 * slash or `.git`; 'www.' and http or https alike. Null for another host (gitlab.com,
 * bitbucket.org), another scheme, or a value that is not a URL.
 */
export function parseGitHubPath(url: string): GitHubPath | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (parsed.hostname.replace(WWW_PREFIX, '') !== GITHUB_HOST) return null;
  const [owner, repository] = parsed.pathname.toLowerCase().split('/').filter(Boolean);
  if (!owner) return null;
  return { owner, name: repository?.replace(GIT_SUFFIX, '') || null };
}

/** The project list's order: featured first, then Studio order. */
const byListOrder = (a: Project, b: Project): number =>
  Number(b.featured) - Number(a.featured) || byStudioOrder(a, b);

/** The projects whose githubUrl is on github.com, in the list's order. */
function linkedProjects(projects: readonly Project[]): LinkedProject[] {
  return [...projects].sort(byListOrder).flatMap((project) => {
    const path = project.githubUrl ? parseGitHubPath(project.githubUrl) : null;
    return path ? [{ project, path }] : [];
  });
}

/**
 * How many days `day` (YYYY-MM-DD) lies before New York's today at `now`: 0 today, negative
 * ahead. NaN when `day` is not a calendar day.
 */
function daysAgo(day: string, now: number): number {
  if (!CALENDAR_DAY.test(day)) return Number.NaN;
  return Math.round((Date.parse(nyToday(now)) - Date.parse(day)) / DAY_MS);
}

/**
 * `repo` as recent work: committed to within {@link ACTIVE_PROJECT_WINDOW_DAYS} days of New
 * York's today at `now`. Null outside the window, for a day that is not one or lies ahead (GitHub
 * dates days in Pacific time, never ahead of New York's), for a name that is not `owner/name`,
 * and for {@link SITE_REPOSITORY}.
 */
function toRecentWork(repo: CommittedRepo, now: number): RecentWork | null {
  const [owner, name, ...rest] = repo.nameWithOwner.toLowerCase().split('/');
  if (!owner || !name || rest.length > 0 || `${owner}/${name}` === SITE_REPOSITORY_KEY) return null;
  const age = daysAgo(repo.lastCommitDay, now);
  return age >= 0 && age <= ACTIVE_PROJECT_WINDOW_DAYS ? { repo, owner, name } : null;
}

/** Newest commit day first; on one day, more commits that day first; else as they came. */
const byNewestWork = (a: RecentWork, b: RecentWork): number =>
  b.repo.lastCommitDay.localeCompare(a.repo.lastCommitDay) ||
  b.repo.commitsThatDay - a.repo.commitsThatDay;

/** The repositories committed to in the window, newest first, whatever order they came in. */
const recentWork = (repos: readonly CommittedRepo[], now: number): RecentWork[] =>
  repos.flatMap((repo) => toRecentWork(repo, now) ?? []).sort(byNewestWork);

/** The project that names `work`'s repository, else one whose githubUrl is its owner's root. */
function projectFor(linked: readonly LinkedProject[], work: RecentWork): Project | null {
  const sameOwner = linked.filter(({ path }) => path.owner === work.owner);
  const exact = sameOwner.find(({ path }) => path.name === work.name);
  return (exact ?? sameOwner.find(({ path }) => path.name === null))?.project ?? null;
}

/**
 * The project of the repository the owner committed to last, within
 * {@link ACTIVE_PROJECT_WINDOW_DAYS} days of New York's today at `now` (epoch ms), that a
 * project's githubUrl names. `repos` are his own commits as GitHub counts them (readRecentCommits):
 * a bot's, a teammate's or a Dependabot branch's push never counts, so neither does a repository
 * he has not committed to himself. Repositories are taken by his newest commit day, newest first
 * (on one day, the one with more of his commits that day): one no project names is passed over for
 * the next.
 *
 * - A project matches a repository when its githubUrl is that repository (parseGitHubPath: case,
 *   a trailing slash, `.git` and 'www.' do not matter). Only when no project names it does a
 *   project whose githubUrl is the repository's owner root (https://github.com/ElysiumOSS) match.
 *   gitlab.com and bitbucket.org URLs never match.
 * - {@link SITE_REPOSITORY} never matches: work on it is passed over.
 * - A project whose githubUrl is a fork never matches: GitHub does not count commits to a fork
 *   as his (only once they reach the original repository). Repositories he collaborates on or
 *   belongs to through an organization do count, as long as they are public.
 * - Among projects naming the same repository, the first in the list's order (featured first,
 *   then Studio order).
 *
 * Null when no repository committed to in the window has a project.
 */
export function selectActiveProject(
  projects: readonly Project[],
  repos: readonly CommittedRepo[],
  now: number,
): ActiveProject | null {
  const linked = linkedProjects(projects);
  for (const work of recentWork(repos, now)) {
    const project = projectFor(linked, work);
    if (project) {
      return { project, repo: work.repo.nameWithOwner, lastCommitDay: work.repo.lastCommitDay };
    }
  }
  return null;
}

/**
 * What the project tile shows: the owner's latest work ({@link selectActiveProject}), else the
 * featured pick ({@link selectFeaturedProject}), else null.
 */
export function selectProjectPick(
  projects: readonly Project[],
  repos: readonly CommittedRepo[],
  now: number,
): ProjectPick | null {
  const active = selectActiveProject(projects, repos, now);
  if (active) return { source: 'activity', ...active };
  const featured = selectFeaturedProject(projects);
  return featured ? { source: 'featured', project: featured } : null;
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
