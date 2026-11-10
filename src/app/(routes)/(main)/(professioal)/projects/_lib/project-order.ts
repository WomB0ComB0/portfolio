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
 * @file The order of /projects, pure and server-safe. The Featured group comes first:
 * - once any project has a Studio "Featured rank", the ranked projects, lowest rank first (the
 *   Featured switch then no longer touches /projects; it still drives the home page);
 * - until then, the first four projects switched to Featured, in Studio display order (the order
 *   the home tile uses), as /certifications caps its featured row; the rest stay under their
 *   years, so the Index's year groups lead the page before the owner sets a rank.
 * Every other project sits under the year it started, newest year first, then 'Undated'. Each
 * project appears exactly once, so links, ids and preview ids stay unique. The GROQ order is
 * left alone (the home page, sitemap and v1 read it); this sorts in TypeScript.
 */

export const FEATURED_GROUP = 'featured';
/** The Featured group's size before any rank exists (the /certifications cap). Ranks are uncapped. */
export const FEATURED_FALLBACK_MAX = 4;
export const UNDATED_GROUP = 'undated';

/** What ordering reads of a project. */
export interface OrderableProject {
  readonly _id: string;
  readonly title: string;
  readonly featured: boolean;
  readonly order: number;
  readonly featuredRank?: number | null;
  readonly startDate?: string | null;
}

/** A project in page order, with the group it shows under. */
export interface PlacedProject<T> {
  readonly item: T;
  /** FEATURED_GROUP, a year ("2024") or UNDATED_GROUP. */
  readonly group: string;
}

export interface Group<T> {
  readonly key: string;
  readonly items: readonly T[];
}

/** The project's rank, or null when it has none (missing, null or not a finite number). */
const rankOf = (project: OrderableProject): number | null =>
  typeof project.featuredRank === 'number' && Number.isFinite(project.featuredRank)
    ? project.featuredRank
    : null;

const yearOf = (project: OrderableProject): string | null =>
  /^\d{4}/u.exec(project.startDate ?? '')?.[0] ?? null;

const byTitle = (a: OrderableProject, b: OrderableProject): number =>
  a.title.localeCompare(b.title);

/** The later start first; a project without one last. */
const byNewerStart = (a: OrderableProject, b: OrderableProject): number =>
  (b.startDate ?? '').localeCompare(a.startDate ?? '');

/** Studio display order, then the newer start, then the title. */
const byStudioOrder = (a: OrderableProject, b: OrderableProject): number =>
  a.order - b.order || byNewerStart(a, b) || byTitle(a, b);

/** Rank, then Studio display order. */
const byRank = (a: OrderableProject, b: OrderableProject): number =>
  (rankOf(a) ?? 0) - (rankOf(b) ?? 0) || byStudioOrder(a, b);

/**
 * The newest year first and Undated last; inside a year the later start, then Studio display
 * order, then the title.
 */
function byYear(a: OrderableProject, b: OrderableProject): number {
  const yearA = yearOf(a);
  const yearB = yearOf(b);
  if (yearA !== yearB) {
    if (yearA === null) return 1;
    if (yearB === null) return -1;
    return yearB.localeCompare(yearA);
  }
  return byNewerStart(a, b) || a.order - b.order || byTitle(a, b);
}

/**
 * The Featured group, in order: every ranked project once any project has a rank, else the first
 * FEATURED_FALLBACK_MAX projects switched to Featured.
 */
export function featuredOf<T extends OrderableProject>(projects: readonly T[]): T[] {
  if (projects.some((project) => rankOf(project) !== null)) {
    return projects.filter((project) => rankOf(project) !== null).sort(byRank);
  }
  return projects
    .filter((project) => project.featured)
    .sort(byStudioOrder)
    .slice(0, FEATURED_FALLBACK_MAX);
}

/** Every project once, in page order: the Featured group, then the years, then Undated. */
export function orderProjects<T extends OrderableProject>(
  projects: readonly T[],
): PlacedProject<T>[] {
  const featured = featuredOf(projects);
  const featuredIds = new Set(featured.map((project) => project._id));
  const rest = projects.filter((project) => !featuredIds.has(project._id)).sort(byYear);
  return [
    ...featured.map((item) => ({ item, group: FEATURED_GROUP })),
    ...rest.map((item) => ({ item, group: yearOf(item) ?? UNDATED_GROUP })),
  ];
}

/** Items grouped by key, groups in the order first seen and each keeping the given order. */
export function groupInOrder<T>(items: readonly T[], keyOf: (item: T) => string): Group<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups].map(([key, members]) => ({ key, items: members }));
}

/** A group's heading: "Featured", "Undated" or the year. */
export function groupLabel(group: string): string {
  if (group === FEATURED_GROUP) return 'Featured';
  if (group === UNDATED_GROUP) return 'Undated';
  return group;
}

/** A group's h2 id: projects-featured, projects-2024, projects-undated. */
export const groupId = (group: string): string => `projects-${group}`;
