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
 * @file The /experience story's model: every role on one rail, the years as chapters (the
 * owner's pick on 2026-11-15, Story over Folio for this page). Pure and isomorphic; it reads the
 * role index (role-index.ts), so the listing rule, the clock, the logos and the lengths are the
 * ones the role pages use.
 *
 * - Now comes first: the lead (the first current role in Studio order, the one the home page
 *   names) and then the other current roles, newest start first.
 * - Then a chapter for each year a role began, newest first, each role newest start first, so
 *   the month stops read down the rail as the path back. A role with no readable start ends the
 *   page under "Undated".
 * - Weight is earned: the lead is set large, each year's longest role (Studio order breaks a
 *   tie) is its chapter's major entry, and every other role is compact. A one-role chapter has
 *   no major entry: the folio chapter system gives it an inline heading, not an opener.
 * - Now is a small inline heading, whatever its count: the person leads the current-role cards (the
 *   lead role's title is the page's one display line), and the years keep the numerals.
 * - Each role's words keep their addresses as named links (linked-text.ts), each address
 *   linked once. A compact role shows its opening sentences; the rest of its description and
 *   its duties wait behind "What I did".
 * - "The path so far" (role-path.ts) puts every role on one month axis, before the chapters.
 */

import { type ChapterSize, chapterId, chapterSize } from '@/components/console/folio/chapter';
import type { Experience } from '@/hooks/sanity/schemas';
import {
  type LinkedPart,
  linkedHrefs,
  linkedPlain,
  linkedText,
  unlinkRepeats,
} from './linked-text';
import type { ClockAxis, RoleClock } from './role-clock';
import { buildRoleIndex, type RoleIndex, type RoleIndexOptions, type RoleRow } from './role-index';
import { buildRolePath, type RolePath } from './role-path';
import { dutiesBeyond, splitLede } from './role-text';

export type StoryWeight = 'lead' | 'major' | 'compact';
export type StoryChapterKind = 'now' | 'year' | 'undated';

export const NOW_TITLE = 'Now';
export const UNDATED_TITLE = 'Undated';

/** A role's words, its addresses named links. */
export interface StoryProse {
  /** The description's opening (all of it for a lead or a major entry). */
  readonly sentence: readonly LinkedPart[];
  /** The rest of the description; empty when the sentence is all of it. */
  readonly more: readonly LinkedPart[];
  /** The duties the description does not already state. */
  readonly duties: readonly (readonly LinkedPart[])[];
}

/** One role on the rail. */
export interface StoryStop {
  readonly row: RoleRow;
  readonly weight: StoryWeight;
  /** The month the rail marks: 'Mar' in a year's chapter, 'Mar 2026' under Now; null undated. */
  readonly month: string | null;
  readonly prose: StoryProse;
}

export interface StoryChapter {
  /** The section's id, the jump links' target (chapterId): 'now', 'y2024', 'undated'. */
  readonly id: string;
  readonly kind: StoryChapterKind;
  readonly title: string;
  readonly size: ChapterSize;
  readonly stops: readonly StoryStop[];
}

export interface RoleStory {
  readonly chapters: readonly StoryChapter[];
  /** Every role, the lead included. */
  readonly total: number;
  /** The roles that run now. */
  readonly current: number;
  /** The year the earliest role began; null when no start is readable. */
  readonly firstYear: number | null;
  readonly clock: RoleClock;
  readonly axis: ClockAxis;
  /** Every role on one month axis, for the opening figure. */
  readonly path: RolePath;
}

export type RoleStoryOptions = Omit<RoleIndexOptions, 'order'>;

const NO_PROSE: StoryProse = { sentence: [], more: [], duties: [] };

/** A chapter before its stops are written: its rows in rail order, and its major role's id. */
interface ChapterPlan {
  readonly kind: StoryChapterKind;
  readonly title: string;
  readonly rows: readonly RoleRow[];
  readonly majorId: string | null;
}

/** The start as a sortable 'YYYY-MM', or '' for a role with no readable start. */
const startKey = (row: RoleRow): string => row.period.start?.iso ?? '';

/** Newest start first; equal starts keep the order given (Studio order). */
function newestFirst(a: RoleRow, b: RoleRow): number {
  const left = startKey(a);
  const right = startKey(b);
  if (left === right) return 0;
  return left < right ? 1 : -1;
}

/** The longest role of `rows` by months; the first in `rows` (Studio order) wins a tie. */
function longestOf(rows: readonly RoleRow[]): RoleRow | null {
  return rows.reduce<RoleRow | null>((best, row) => {
    const months = row.length?.months ?? 0;
    return best === null || months > (best.length?.months ?? 0) ? row : best;
  }, null);
}

/** One year's chapter: its roles newest start first, and its longest one when it has two. */
function yearPlan(year: number, before: readonly RoleRow[]): ChapterPlan {
  const rows = before.filter((row) => row.period.start?.year === year);
  const major = rows.length > 1 ? longestOf(rows) : null;
  return {
    kind: 'year',
    title: String(year),
    rows: [...rows].sort(newestFirst),
    majorId: major?.id ?? null,
  };
}

/** The ended roles by the year they began, newest first; undated ones last. */
function yearPlans(before: readonly RoleRow[]): ChapterPlan[] {
  const starts = before.flatMap((row) => (row.period.start ? [row.period.start.year] : []));
  const dated = [...new Set(starts)].sort((a, b) => b - a).map((year) => yearPlan(year, before));
  const undated = before.filter((row) => !row.period.start);
  return undated.length > 0
    ? [...dated, { kind: 'undated', title: UNDATED_TITLE, rows: undated, majorId: null }]
    : dated;
}

/** Now, then every year a role began. */
function chapterPlans(index: RoleIndex): ChapterPlan[] {
  const before = index.groups.find((group) => group.key === 'before')?.rows ?? [];
  const now = index.lead ? [index.lead, ...[...index.alsoNow].sort(newestFirst)] : [];
  const nowPlan: ChapterPlan[] =
    now.length > 0 ? [{ kind: 'now', title: NOW_TITLE, rows: now, majorId: null }] : [];
  return [...nowPlan, ...yearPlans(before)];
}

/**
 * Every role in the story's order: Now, then each year, as the rail runs. The role pages step
 * through the roles in this order, so "Next" is the role under this one on /experience.
 */
export function storyRowsOf(index: RoleIndex): RoleRow[] {
  return chapterPlans(index).flatMap((plan) => [...plan.rows]);
}

/** 'Mar' of 'Mar 2026'. */
const monthName = (label: string): string => label.slice(0, label.lastIndexOf(' '));

function weightOf(row: RoleRow, plan: ChapterPlan, leadId: string | undefined): StoryWeight {
  if (row.id === leadId) return 'lead';
  return row.id === plan.majorId ? 'major' : 'compact';
}

/** A text's words and figures, lower case. */
const wordsIn = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
/** A duty's opening label ("Clients: "), which names what follows rather than saying it. */
const DUTY_LABEL = /^\s*\p{L}[\p{L} ]{0,24}:\s/u;

/** Whether a duty says nothing beyond `stated` (the description's words), its label aside. */
function addsNothing(duty: readonly LinkedPart[], stated: ReadonlySet<string>): boolean {
  return wordsIn(linkedPlain(duty).replace(DUTY_LABEL, '')).every((word) => stated.has(word));
}

/**
 * The duties as linked parts, each address linked once on the stop. A duty whose every link
 * the description (or a duty before it) already has, and that says nothing the description
 * does not, is skipped: Develop for Good's "Clients: …" after its four case studies. Any other
 * duty keeps its words, with a repeated address set as its plain name.
 */
function dutiesOf(
  duties: readonly string[],
  stated: readonly LinkedPart[],
  linked: ReadonlySet<string>,
): LinkedPart[][] {
  const words = new Set(wordsIn(linkedPlain(stated)));
  return duties.reduce<{ out: LinkedPart[][]; seen: ReadonlySet<string> }>(
    (acc, duty) => {
      const parts = linkedText(duty);
      const hrefs = linkedHrefs(parts);
      const repeats = hrefs.length > 0 && hrefs.every((href) => acc.seen.has(href));
      if (repeats && addsNothing(parts, words)) return acc;
      const once = unlinkRepeats(parts, acc.seen);
      return { out: [...acc.out, once.parts], seen: once.seen };
    },
    { out: [], seen: linked },
  ).out;
}

/** A role's words: whole for a lead or major entry, the opening for a compact one. */
export function proseOf(experience: Experience, weight: StoryWeight): StoryProse {
  const beyond = dutiesBeyond(experience.description, experience.responsibilities ?? []);
  if (weight !== 'compact') {
    const said = unlinkRepeats(linkedText(experience.description), new Set());
    return { sentence: said.parts, more: [], duties: dutiesOf(beyond, said.parts, said.seen) };
  }
  const { lede, rest } = splitLede(experience.description);
  const sentence = unlinkRepeats(linkedText(lede), new Set());
  const more = unlinkRepeats(linkedText(rest), sentence.seen);
  const stated = [...sentence.parts, { kind: 'text' as const, text: ' ' }, ...more.parts];
  return {
    sentence: sentence.parts,
    more: more.parts,
    duties: dutiesOf(beyond, stated, more.seen),
  };
}

/** One chapter's stops, each with its weight, its month and its words. */
function stopsOf(
  plan: ChapterPlan,
  leadId: string | undefined,
  byId: ReadonlyMap<string, Experience>,
): StoryStop[] {
  return plan.rows.map((row) => {
    const weight = weightOf(row, plan, leadId);
    const experience = byId.get(row.id);
    const start = row.period.start;
    const month = start ? (plan.kind === 'year' ? monthName(start.label) : start.label) : null;
    return { row, weight, month, prose: experience ? proseOf(experience, weight) : NO_PROSE };
  });
}

/** Every experience as the story: its chapters, its counts and the clock for its figure. */
export function buildRoleStory(
  experiences: readonly Experience[],
  options: RoleStoryOptions,
): RoleStory {
  const index = buildRoleIndex(experiences, { ...options, order: 'groups' });
  const byId = new Map(experiences.map((experience) => [experience._id, experience]));
  const chapters = chapterPlans(index).map((plan, place): StoryChapter => {
    const stops = stopsOf(plan, index.lead?.id, byId);
    return {
      id: chapterId(plan.title),
      kind: plan.kind,
      title: plan.title,
      size: plan.kind === 'now' ? 'inline' : chapterSize({ index: place, count: stops.length }),
      stops,
    };
  });
  const rows = chapters.flatMap((chapter) => chapter.stops.map((stop) => stop.row));
  const years = rows.flatMap((row) => (row.period.start ? [row.period.start.year] : []));
  return {
    chapters,
    total: index.total,
    current: rows.filter((row) => row.current).length,
    firstYear: years.length > 0 ? Math.min(...years) : null,
    clock: index.clock,
    axis: index.axis,
    path: buildRolePath(rows, index.axis.columns.length),
  };
}

const NUMBER_WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
] as const;

/** A count in words up to twenty ('five'), in figures past it ('21'). */
export const numberWord = (count: number): string => NUMBER_WORDS[count] ?? String(count);

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** ', five of them still going.' and its kin, or '.' when none runs now. */
function stillGoing(total: number, current: number): string {
  if (current === 0) return '.';
  if (current < total) return `, ${numberWord(current)} of them still going.`;
  return total === 1 ? ', still going.' : ', all of them still going.';
}

/**
 * The page's opening sentence, from the figures: 'Fifteen roles since 2023, five of them still
 * going. Current roles and the work that led here, by the year each role began.'
 * '' with no roles.
 */
export function storyLede({
  total,
  current,
  firstYear,
}: Pick<RoleStory, 'total' | 'current' | 'firstYear'>): string {
  if (total === 0) return '';
  const count = `${capitalised(numberWord(total))} ${total === 1 ? 'role' : 'roles'}`;
  const since = firstYear === null ? count : `${count} since ${firstYear}`;
  const order =
    current > 0
      ? 'Current roles and the work that led here, by the year each role began.'
      : 'The path so far, by the year each role began.';
  return `${since}${stillGoing(total, current)} ${order}`;
}

/** The names a chapter's summary sets, and how many more organizations it has. */
export interface ChapterNames {
  readonly names: readonly string[];
  readonly more: number;
}

/**
 * The organizations a chapter's one-line summary names: its lead or major role first, then the
 * rail's order, each organization once, at most `shown` of them; `more` counts the rest. Two
 * names and "one more" read worse than three names, so three are named then.
 */
export function chapterNamesOf(chapter: StoryChapter, shown = 2): ChapterNames {
  const first = chapter.stops.filter((stop) => stop.weight !== 'compact');
  const rest = chapter.stops.filter((stop) => stop.weight === 'compact');
  const names = [...new Set([...first, ...rest].map((stop) => stop.row.organization))];
  const take = names.length === shown + 1 ? names.length : Math.min(shown, names.length);
  return { names: names.slice(0, take), more: names.length - take };
}
