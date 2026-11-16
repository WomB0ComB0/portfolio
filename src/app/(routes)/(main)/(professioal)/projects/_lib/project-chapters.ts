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
 * @file How /projects lays its projects out as chapters, pure and server-safe (the filter island
 * runs it on whatever the filters keep):
 * - Stories: the page's own groups (Featured, then each year newest first, then Undated), each a
 *   chapter with one lead story, up to two features, and the rest as briefs. A Featured project
 *   is listed once, in Featured, so a year with projects of its own names it ('Also in
 *   Featured: …'); a year whose projects are all Featured has no chapter of its own.
 * - Index: every project under the year it started (Featured ones included), newest first.
 *
 * The lead is the chapter's one dominant story, so it needs a wide picture (4:3 or wider covers
 * crop well at 16:9; a square logo or a portrait phone shot never leads). In the Featured chapter
 * it is the first such project by Featured rank (the owner's own order); in a year it is the one
 * with the lowest Studio display order, then the most images, then page order. A Studio 'chapter
 * lead' field would let the owner pick instead (In2ne's architecture diagram leads 2025 by rule).
 */

import { chapterId } from '@/components/console/folio/chapter';
import type { ProjectEntry } from './project-index';
import { FEATURED_GROUP, groupInOrder, groupLabel, UNDATED_GROUP } from './project-order';
import { countWord, joinNames } from './project-words';

/** A cover at least this wide for its height leads a chapter (4:3 is 1.33; a square is 1). */
export const WIDE_MIN_RATIO = 1.3;
/** Features need a chapter this big: the lead, two features and at least two briefs. */
export const FEATURES_MIN_ITEMS = 5;
/** Features come in an unequal pair. */
export const FEATURE_COUNT = 2;
/** A chapter's summary names this many projects, then 'and four more'. */
export const SUMMARY_NAMES = 3;

/** What the layout reads of a project. */
export type ChapterItem = Pick<
  ProjectEntry,
  'id' | 'group' | 'title' | 'order' | 'images' | 'ongoing' | 'started'
>;

export interface Chapter<T> {
  /** FEATURED_GROUP, a year or UNDATED_GROUP. */
  readonly key: string;
  /** 'Featured', '2026', 'Undated'. */
  readonly label: string;
  /** The section's anchor: 'featured', 'y2026', 'undated'. */
  readonly id: string;
  readonly items: readonly T[];
}

/** A Stories chapter, with the Featured projects of its year, which Featured lists. */
export interface StoryChapter<T> extends Chapter<T> {
  /**
   * The Featured projects that started in this chapter's year, or have no start for Undated
   * (none for Featured itself). The chapter always has projects of its own as well.
   */
  readonly alsoFeatured: readonly T[];
}

/** The end of the Featured chapter: one wide brief when the rest would leave one alone, then rows. */
export interface FeaturedBriefs<T> {
  readonly wide: T | null;
  readonly rows: readonly T[];
}

export interface ArrangedChapter<T> {
  /** The one dominant story, or null when no project in the chapter has a wide cover. */
  readonly lead: T | null;
  /** The unequal pair after the lead (wide covers), or none. */
  readonly features: readonly T[];
  /** The rest, in page order. */
  readonly briefs: readonly T[];
}

/** A chapter's dek: the names it opens with and how many more there are. */
export interface ChapterSummary {
  readonly names: readonly string[];
  /** '' when every project is named, else ' and four more' (with its leading space). */
  readonly more: string;
}

/** Whether the project's cover is wide enough to lead (the cover is its first image). */
export const hasWideCover = (item: Pick<ChapterItem, 'images'>): boolean =>
  (item.images[0]?.ratio ?? 0) >= WIDE_MIN_RATIO;

interface Placed<T> {
  readonly item: T;
  readonly at: number;
}

/** Lower Studio order first, then more images, then the earlier place on the page. */
function byLeadRank<T extends ChapterItem>(a: Placed<T>, b: Placed<T>): number {
  return a.item.order - b.item.order || b.item.images.length - a.item.images.length || a.at - b.at;
}

/** The chapter's lead story (see the file comment), or null when nothing has a wide cover. */
export function pickLead<T extends ChapterItem>(items: readonly T[], group: string): T | null {
  const candidates = items
    .map((item, at) => ({ item, at }))
    .filter(({ item }) => hasWideCover(item));
  if (group === FEATURED_GROUP) return candidates[0]?.item ?? null;
  return [...candidates].sort(byLeadRank)[0]?.item ?? null;
}

/**
 * A chapter's layout: its lead, then (in a chapter of FEATURES_MIN_ITEMS or more) the next two
 * projects with wide covers as an unequal pair, then every other project as a brief, in page order.
 */
export function arrangeChapter<T extends ChapterItem>(
  items: readonly T[],
  group: string,
): ArrangedChapter<T> {
  const lead = pickLead(items, group);
  const rest = items.filter((item) => item !== lead);
  const wide = rest.filter(hasWideCover).slice(0, FEATURE_COUNT);
  const features =
    lead !== null && items.length >= FEATURES_MIN_ITEMS && wide.length === FEATURE_COUNT
      ? wide
      : [];
  return { lead, features, briefs: rest.filter((item) => !features.includes(item)) };
}

/** A chapter for a group key, with its items. */
const chapterOf = <T>(key: string, items: readonly T[]): Chapter<T> => ({
  key,
  label: groupLabel(key),
  id: chapterId(groupLabel(key)),
  items,
});

/** A chapter for each key, in the order the keys first come. */
const chaptersBy = <T extends ChapterItem>(
  items: readonly T[],
  keyOf: (item: T) => string,
): Chapter<T>[] =>
  groupInOrder(items, keyOf).map(({ key, items: members }) => chapterOf(key, members));

/** The year a project started, or UNDATED_GROUP. */
const yearKey = (item: ChapterItem): string => item.started?.year ?? UNDATED_GROUP;

/** Chapter keys newest year first, Undated last. */
function byNewerKey(a: string, b: string): number {
  if (a === b) return 0;
  if (a === UNDATED_GROUP) return 1;
  if (b === UNDATED_GROUP) return -1;
  return b.localeCompare(a);
}

/** Items by key, each list in the order given. */
const byKey = <T>(items: readonly T[], keyOf: (item: T) => string): Map<string, readonly T[]> =>
  new Map(groupInOrder(items, keyOf).map(({ key, items: members }) => [key, members]));

/**
 * The Stories chapters: Featured first, then each year newest first, then Undated, each in page
 * order. A year names the Featured projects that started in it (`alsoFeatured`). A year whose
 * projects are all Featured has no chapter: it would hold nothing but a link back up to them
 * (a search for one Featured project would end in an empty year), and a Featured project's page
 * links to #featured, not to its year.
 */
export function storyChapters<T extends ChapterItem>(items: readonly T[]): StoryChapter<T>[] {
  const featured = items.filter((item) => item.group === FEATURED_GROUP);
  const featuredByYear = byKey(featured, yearKey);
  const groups = byKey(
    items.filter((item) => item.group !== FEATURED_GROUP),
    (item) => item.group,
  );
  const keys = [...groups.keys()].sort(byNewerKey);
  const years = keys.map((key) => ({
    ...chapterOf(key, groups.get(key) ?? []),
    alsoFeatured: featuredByYear.get(key) ?? [],
  }));
  if (featured.length === 0) return years;
  return [{ ...chapterOf(FEATURED_GROUP, featured), alsoFeatured: [] }, ...years];
}

/**
 * How the Featured chapter ends after its lead and its pair: rows, two to a line on a wide page.
 * When that would leave one row alone, the first of them (by rank) is a wide brief instead.
 */
export function featuredBriefs<T>(briefs: readonly T[]): FeaturedBriefs<T> {
  if (briefs.length % 2 === 0) return { wide: null, rows: briefs };
  const [wide = null, ...rows] = briefs;
  return { wide, rows };
}

/** The newest year first, Undated last; in a year the later start, Studio order, then A to Z. */
function byStartedYear(a: ChapterItem, b: ChapterItem): number {
  const yearA = yearKey(a);
  const yearB = yearKey(b);
  if (yearA !== yearB) {
    if (yearA === UNDATED_GROUP) return 1;
    if (yearB === UNDATED_GROUP) return -1;
    return yearB.localeCompare(yearA);
  }
  const startA = a.started?.iso ?? '';
  const startB = b.started?.iso ?? '';
  return startB.localeCompare(startA) || a.order - b.order || a.title.localeCompare(b.title);
}

/** The Index chapters: every project under the year it started, newest year first. */
export const yearChapters = <T extends ChapterItem>(items: readonly T[]): Chapter<T>[] =>
  chaptersBy([...items].sort(byStartedYear), yearKey);

/**
 * The chapter's dek, in the order the chapter shows its projects (lead, features, briefs): up to
 * SUMMARY_NAMES names, then how many more in words.
 */
export function chapterSummary<T extends ChapterItem>(
  arranged: ArrangedChapter<T>,
): ChapterSummary {
  const shown = [
    ...(arranged.lead ? [arranged.lead] : []),
    ...arranged.features,
    ...arranged.briefs,
  ];
  const names = shown.slice(0, SUMMARY_NAMES).map((item) => item.title);
  const rest = shown.length - names.length;
  return { names, more: rest > 0 ? ` and ${countWord(rest)} more` : '' };
}

/** The dek as one plain sentence: 'ResQ Viz, grepo and FOIA-Stream.' or 'A, B, C and two more.' */
export function chapterSummaryText({ names, more }: ChapterSummary): string {
  if (names.length === 0) return '';
  return more === '' ? `${joinNames(names)}.` : `${names.join(', ')}${more}.`;
}

/** How many of the chapter's projects are still in progress. */
export const ongoingCount = (items: readonly Pick<ChapterItem, 'ongoing'>[]): number =>
  items.filter((item) => item.ongoing).length;
