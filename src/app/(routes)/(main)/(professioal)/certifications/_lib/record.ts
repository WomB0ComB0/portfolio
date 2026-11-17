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
 * @file The Folio record's model: how /certifications sets the certificates a filter keeps, as
 * year chapters. Pure, so the server and the filter island share it and every rule is tested.
 *
 * - A thin year (THIN_YEAR_MAX or fewer) sets each certificate large.
 * - A busy year is grouped by issuer family (Google folds in Skills Boost and Skillshop), the
 *   biggest first. Issuers with one certificate that year share a closing 'One each' group, and
 *   inside a group the certificates that share a month stack under one month in the margin.
 * - A group names the platform its links lead to only when it is true of all of them ('Verify on
 *   Sololearn') or of most ('Most verify on Coursera'); a certificate that verifies elsewhere names
 *   its own, so the line never claims Coursera for a Skills Boost badge.
 * - Each year gets one plain sentence from its data ('Mostly Google: 16 of 26.'), never a chart.
 * - Each count is said once around a year's opening. The year's jump link says how many it holds
 *   (or, filtered to one year, the results line does), so its byline never repeats that; it
 *   counts the issuers only when the sentence leaves some unnamed; and a group whose count the
 *   sentence states ('16 of 26' for Google), or the year's only group, leaves it out too.
 */

import { chapterId } from '@/components/console/folio';
import type { Month } from './format';
import { groupByYear, type LedgerEntry } from './ledger';

/** What the record reads of a certificate. */
export type RecordEntry = Pick<
  LedgerEntry,
  'id' | 'title' | 'issuer' | 'family' | 'familySlug' | 'month' | 'year' | 'link'
>;

/** A year with this many certificates or fewer sets each one large; more are grouped by issuer. */
export const THIN_YEAR_MAX = 4;
/** What the issuer counts count. */
export const ISSUER_NOUN = { one: 'issuer', many: 'issuers' } as const;
/** The closing group of a busy year: the issuers with one certificate that year. */
export const SINGLES_LABEL = 'One each';
const SINGLES_KEY = 'one-each';

/** Certificates of one month, in a row inside a group: the month is shown once, in the margin. */
export interface MonthStack<T> {
  readonly key: string;
  readonly month: Month | null;
  readonly entries: readonly T[];
}

/** Where a group's links lead, when one platform holds all of them or most. */
export interface GroupPlatform {
  readonly name: string;
  readonly share: 'all' | 'most';
}

export interface IssuerGroup<T> {
  /** Unique in its year: 'family-google', or 'one-each'. */
  readonly key: string;
  /** The family ('Google'), or 'One each'. */
  readonly label: string;
  /** The 'One each' group: every certificate names its own issuer. */
  readonly singles: boolean;
  readonly count: number;
  /**
   * Its count is already said: by the year's sentence ('Mostly Google: 16 of 26.') or, for the
   * year's only group, by the year's jump link. Its byline then leaves the count out.
   */
  readonly countSaid: boolean;
  /** The year's biggest group, set with the largest name. */
  readonly top: boolean;
  readonly platform: GroupPlatform | null;
  readonly stacks: readonly MonthStack<T>[];
}

/** A run of a year's sentence; a name is set in <em>, lifted to the foreground. */
export interface SummaryPart {
  readonly text: string;
  readonly name?: boolean;
}

export interface YearChapter<T> {
  readonly year: string;
  /** The section's id and the jump links' target: 'y2024'. */
  readonly id: string;
  readonly count: number;
  /** Issuer families that year. */
  readonly issuers: number;
  /**
   * The year's sentence names or counts every issuer ('IBM and MongoDB.', 'All 16 from Google.',
   * 'Google, Sololearn and five more.'), so its byline need not count them.
   */
  readonly issuersSaid: boolean;
  readonly layout: 'thin' | 'grouped';
  /** Every certificate of the year, newest first. */
  readonly entries: readonly T[];
  /** A busy year's issuer groups; none for a thin year. */
  readonly groups: readonly IssuerGroup<T>[];
  /** The year's sentence; none for a year of one. */
  readonly summary: readonly SummaryPart[];
}

const NUMBER_WORDS = [
  'zero',
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
] as const;

/** A count in words up to twelve ('ten'), in figures above ('13'). */
export const numberWord = (count: number): string => NUMBER_WORDS[count] ?? String(count);

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const sameName = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** A family and the year's certificates it holds. */
interface FamilyCount<T> {
  readonly slug: string;
  readonly label: string;
  readonly entries: T[];
}

/** The year's families, biggest first, then the newest (entries come newest first). */
function familiesOf<T extends RecordEntry>(entries: readonly T[]): FamilyCount<T>[] {
  const families = new Map<string, FamilyCount<T>>();
  for (const entry of entries) {
    const known = families.get(entry.familySlug);
    if (known) known.entries.push(entry);
    else {
      families.set(entry.familySlug, {
        slug: entry.familySlug,
        label: entry.family,
        entries: [entry],
      });
    }
  }
  // A Map keeps first-seen order (the newest) and sort is stable, so ties stay newest first.
  return [...families.values()].sort((a, b) => b.entries.length - a.entries.length);
}

/** Consecutive certificates of the same month, as stacks (entries come newest first). */
export function monthStacks<T extends RecordEntry>(entries: readonly T[]): MonthStack<T>[] {
  const stacks: { key: string; month: Month | null; entries: T[] }[] = [];
  for (const entry of entries) {
    const key = entry.month?.iso ?? 'undated';
    const last = stacks.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else stacks.push({ key, month: entry.month, entries: [entry] });
  }
  return stacks;
}

/**
 * The platform a group can name for all its certificates ('all': every one links there) or most
 * ('most': more than half do), else null.
 */
export function groupPlatform(entries: readonly RecordEntry[]): GroupPlatform | null {
  const counts = new Map<string, number>();
  for (const { link } of entries) {
    // A file host vouches for nothing, so it never becomes the group's platform.
    if (link?.verifies) counts.set(link.platform, (counts.get(link.platform) ?? 0) + 1);
  }
  const [best] = [...counts].sort(([, a], [, b]) => b - a);
  if (!best) return null;
  const [name, count] = best;
  if (count === entries.length) return { name, share: 'all' };
  return count * 2 > entries.length ? { name, share: 'most' } : null;
}

/**
 * The platform a certificate must name itself: none when its group already names it, or (with
 * no group platform) when it is the issuer's own site ('AlgoExpert' on AlgoExpert). None for a
 * file on a file host either: it says FILE_NOTE instead.
 */
export function ownPlatform(entry: RecordEntry, platform: GroupPlatform | null): string | null {
  if (!entry.link?.verifies) return null;
  const { platform: name } = entry.link;
  if (platform) return name === platform.name ? null : name;
  return sameName(name, entry.family) || sameName(name, entry.issuer) ? null : name;
}

/** A group's platform line: 'Verify on Sololearn', 'Most verify on Coursera', or null. */
export function platformLine(platform: GroupPlatform | null): string | null {
  if (!platform) return null;
  return platform.share === 'all'
    ? `Verify on ${platform.name}`
    : `Most verify on ${platform.name}`;
}

/** Where a certificate's link leads, when it is a stored file rather than a record that verifies. */
const FILE_NOTE = 'Certificate file';
/** A certificate with no credential URL. */
export const NO_LINK_NOTE = 'No public link';

/** Where a certificate in a group verifies, when the group's line does not say it already. */
function whereNote(entry: RecordEntry, platform: GroupPlatform | null): string | null {
  if (!entry.link) return NO_LINK_NOTE;
  if (!entry.link.verifies) return FILE_NOTE;
  const own = ownPlatform(entry, platform);
  return own ? `Verify on ${own}` : null;
}

/**
 * What a certificate in a group says under its title, only where the group does not say it: the
 * issuer as written (always in 'One each'; 'Google Cloud Skills Boost' under Google), and where
 * it verifies when that is not the group's platform, that its link is a stored file, or that it
 * has no public link.
 */
export function briefNotes(
  entry: RecordEntry,
  group: Pick<IssuerGroup<unknown>, 'label' | 'singles' | 'platform'>,
): string[] {
  const issuer = group.singles || !sameName(entry.issuer, group.label) ? entry.issuer : null;
  return [issuer, whereNote(entry, group.platform)].filter((note): note is string => Boolean(note));
}

function groupOf<T extends RecordEntry>(
  key: string,
  label: string,
  entries: readonly T[],
  singles: boolean,
): IssuerGroup<T> {
  return {
    key,
    label,
    singles,
    count: entries.length,
    countSaid: false,
    top: false,
    platform: singles ? null : groupPlatform(entries),
    stacks: monthStacks(entries),
  };
}

/**
 * A busy year's groups: each family with two or more, biggest first (then the newest), then the
 * one-certificate issuers together as 'One each'. A lone one-off keeps its own name instead. The
 * first group is the top one when it is bigger than the next.
 */
export function issuerGroups<T extends RecordEntry>(entries: readonly T[]): IssuerGroup<T>[] {
  const families = familiesOf(entries);
  const ones = families.filter((family) => family.entries.length === 1);
  const named = ones.length > 1 ? families.filter((family) => family.entries.length > 1) : families;
  const groups = named.map((family) =>
    groupOf(`family-${family.slug}`, family.label, family.entries, false),
  );
  if (ones.length > 1) {
    const slugs = new Set(ones.map((one) => one.slug));
    const singles = entries.filter((entry) => slugs.has(entry.familySlug));
    groups.push(groupOf(SINGLES_KEY, SINGLES_LABEL, singles, true));
  }
  const [first, second] = groups;
  if (!first || first.singles || (second && second.count >= first.count)) return groups;
  return [{ ...first, top: true }, ...groups.slice(1)];
}

/** Names joined as a sentence would: 'A', 'A and B', 'A, B and C'. */
const nameRuns = (labels: readonly string[]): SummaryPart[] =>
  labels.flatMap((label, index) => {
    const joiner = index === 0 ? [] : [{ text: index === labels.length - 1 ? ' and ' : ', ' }];
    return [...joiner, { text: label, name: true }];
  });

/**
 * A year's sentence and the counts it already gives, so the opener never says one twice: whether
 * it names or counts every issuer, and the family whose own count it states, if any.
 */
export interface YearSentence {
  readonly parts: readonly SummaryPart[];
  readonly issuersSaid: boolean;
  /** The family slug whose count the sentence gives ('Mostly Google: 16 of 26.'), or null. */
  readonly countOf: string | null;
}

const NO_SENTENCE: YearSentence = { parts: [], issuersSaid: false, countOf: null };

/** A year from one issuer (a filter often leaves one): 'Both from Sololearn.', 'All 16 from Google.' */
function oneIssuer(family: FamilyCount<RecordEntry>, count: number): YearSentence {
  const lead = count === 2 ? 'Both from ' : `All ${numberWord(count)} from `;
  return {
    parts: [{ text: lead }, { text: family.label, name: true }, { text: '.' }],
    issuersSaid: true,
    countOf: family.slug,
  };
}

/** A thin year's sentence, which names every issuer: 'Both from Sololearn.', 'IBM and MongoDB.' */
function thinSummary(families: readonly FamilyCount<RecordEntry>[], count: number): YearSentence {
  const [only] = families;
  if (families.length === 1 && only) return oneIssuer(only, count);
  return {
    parts: [...nameRuns(families.map((family) => family.label)), { text: '.' }],
    issuersSaid: true,
    countOf: null,
  };
}

/**
 * A busy year's sentence: who most of it came from, words first and figures after. 'Mostly
 * Google: 16 of 26.' gives Google's count; 'Mostly Sololearn and Coursera: 19 of 34.' gives
 * neither family's own; 'Google, Sololearn and five more.' counts every issuer.
 */
function busySummary(families: readonly FamilyCount<RecordEntry>[], count: number): YearSentence {
  const [first, second] = families;
  if (!first) return NO_SENTENCE;
  if (!second) return oneIssuer(first, count);
  const one = first.entries.length;
  if (one * 2 > count) {
    const parts = [
      { text: 'Mostly ' },
      { text: first.label, name: true },
      { text: `: ${one} of ${count}.` },
    ];
    return { parts, issuersSaid: false, countOf: first.slug };
  }
  const two = one + second.entries.length;
  if (two * 2 > count) {
    const parts = [
      { text: 'Mostly ' },
      ...nameRuns([first.label, second.label]),
      { text: `: ${two} of ${count}.` },
    ];
    return { parts, issuersSaid: families.length === 2, countOf: null };
  }
  const parts = [
    { text: first.label, name: true },
    { text: ', ' },
    { text: second.label, name: true },
    { text: ` and ${numberWord(families.length - 2)} more.` },
  ];
  return { parts, issuersSaid: true, countOf: null };
}

/** The full name of a month ('August'), from its long form ('August 2024'). */
const monthName = (month: Month): string => month.long.split(/\s/u)[0] ?? month.name;

/**
 * A busy year's burst, when one month alone holds at least three and a quarter of the year:
 * 'Ten of them in August.' Nothing when two months tie.
 */
export function burstSentence(entries: readonly RecordEntry[]): string | null {
  const months = new Map<string, { month: Month; count: number }>();
  for (const { month } of entries) {
    if (month) months.set(month.iso, { month, count: (months.get(month.iso)?.count ?? 0) + 1 });
  }
  const [best, next] = [...months.values()].sort((a, b) => b.count - a.count);
  if (!best || best.count < 3 || best.count * 4 < entries.length) return null;
  if (next && next.count === best.count) return null;
  if (best.count === entries.length) return `All in ${monthName(best.month)}.`;
  return `${capitalised(numberWord(best.count))} of them in ${monthName(best.month)}.`;
}

/** A year's one sentence in words, and the counts it gives; none for a single certificate. */
export function yearSentence(entries: readonly RecordEntry[]): YearSentence {
  const count = entries.length;
  if (count < 2) return NO_SENTENCE;
  const families = familiesOf(entries);
  if (count <= THIN_YEAR_MAX) return thinSummary(families, count);
  const sentence = busySummary(families, count);
  const burst = burstSentence(entries);
  return burst ? { ...sentence, parts: [...sentence.parts, { text: ` ${burst}` }] } : sentence;
}

/** A year's one sentence in words; none for a single certificate. */
export const yearSummary = (entries: readonly RecordEntry[]): SummaryPart[] => [
  ...yearSentence(entries).parts,
];

/** The sentence as plain text. */
export const summaryText = (parts: readonly SummaryPart[]): string =>
  parts.map((part) => part.text).join('');

/**
 * Marks the groups whose count is already said: the family the sentence counts, and a year's
 * only group, whose count is the year's own (said by its jump link). New objects.
 */
function withCountsSaid<T>(
  groups: readonly IssuerGroup<T>[],
  countOf: string | null,
): IssuerGroup<T>[] {
  return groups.map((group) => ({
    ...group,
    countSaid: groups.length === 1 || (countOf !== null && group.key === `family-${countOf}`),
  }));
}

/** The certificates a filter keeps, as year chapters, newest year first. */
export function buildRecord<T extends RecordEntry>(entries: readonly T[]): YearChapter<T>[] {
  return groupByYear(entries).map(({ year, entries: yearEntries }) => {
    const thin = yearEntries.length <= THIN_YEAR_MAX;
    const sentence = yearSentence(yearEntries);
    return {
      year,
      id: chapterId(year),
      count: yearEntries.length,
      issuers: new Set(yearEntries.map((entry) => entry.familySlug)).size,
      issuersSaid: sentence.issuersSaid,
      layout: thin ? 'thin' : 'grouped',
      entries: yearEntries,
      groups: thin ? [] : withCountsSaid(issuerGroups(yearEntries), sentence.countOf),
      summary: sentence.parts,
    };
  });
}
