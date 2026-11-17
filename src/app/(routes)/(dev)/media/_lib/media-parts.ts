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
 * @file Livestream parts on /media. A long Twitch broadcast reaches YouTube as several uploads
 * that share one title, sometimes marked "(Part 1/2)", "Pt. 2" or "(2/3)". The feed folds them
 * into one row. Pure and server-safe (no directive).
 *
 * The rule (an owner call, answered by the lab's media-parts switch):
 * - A part marker is read off the title: "Part N" or "Pt. N" (optionally "of M" or "/M"), bare or
 *   in brackets, or a bracketed "(N/M)" with N at most M and M at most 10. Numbers that only look
 *   like parts stay: "Project 10", "Web 3.0", "Party 2", "(2020)", an unbracketed "1/2", and a
 *   bracketed date such as "(12/29)" or "(1/15)". A closing run after a marker (stops, white
 *   space, closing quotes and brackets, to the title's end) goes with it, with any quote or
 *   bracket around the whole title ("Recap Part 2/2...", '"Recap (Part 2/2)."' and "Recap Part
 *   2/2!" are part 2 of 2 of "Recap"), though a full stop straight after a bare number with no
 *   total leaves the title whole ("Recap Part 2.", as "Part 1.5" is).
 * - A bracketed "(N/M)" is a part only where every such marker in its group gives the same M:
 *   "Recap (1/2)" beside "Recap (3/5)" reads as two whole titles, not two parts of one recap.
 * - A series its titles number states one total at most, the one its titles give most often, and
 *   never one a title contradicts: a title that gives another total reads whole ("Part 3/4"
 *   beside "Part 1/2" and "Part 2/2": the two stay one series of 2), and so does a title that
 *   numbers past it ("Part 3" or "Part 3 of 2" beside them). A "Part 0" reads whole in every
 *   series its titles number, whatever totals they give, so every place counts from 1. Where no
 *   total is given most often ("Part 2/2" beside "(1/3)"), every title that gives one reads whole.
 *   A title that gives no total and numbers within it ("Part 1") is no disagreement. A series
 *   numbered by date states no part total and keeps every upload, whatever totals its broadcasts
 *   give.
 * - Items that may fold (videos) and share a base title within one year become one row at the
 *   newest part's place, so each year bar keeps its own parts. A lone part keeps its own title.
 * - Only a title's first 300 characters are read (YouTube's own limit is 100), so an oversized
 *   CMS entry cannot stall the patterns on every /media and project page.
 *
 * Unfolded, the same uploads are a series: two or more of one kind sharing a base title, in any
 * year. Each knows its place ("Upload 14 of 27", or the titles' own "Part 1 of 2", counted to the
 * total the titles give where any gives one), and the series has a URL value
 * (seriesSlug) the page filters by. Uploads are numbered oldest first, except that the parts of
 * one broadcast keep the order their titles give them. Uploads that only share a title by chance
 * are kept apart by hand (media-not-series.ts).
 */

import { trimEnd } from '@/lib/text/trim';

/**
 * Every character a pattern's `\s` matches, each one UTF-16 code unit, so a set built on them
 * trims exactly what a '[\s…]+$' pattern did, by a loop (trimEnd) rather than a re-scanning match.
 */
export const SPACES: readonly string[] = [
  0x9, 0xa, 0xb, 0xc, 0xd, 0x20, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
  0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
].map((code) => String.fromCharCode(code));

/** What a title may close with that a sentence it sits in closes anyway: a stop, white space. */
export const SENTENCE_STOPS: ReadonlySet<string> = new Set([...SPACES, '.', '!', '?', '…']);

/** Each closing quote or bracket a title may end with, and the opener it pairs with. */
const OPENER_OF: ReadonlyMap<string, string> = new Map([
  [')', '('],
  [']', '['],
  ['}', '{'],
  ['"', '"'],
  ["'", "'"],
  ['”', '“'],
  ['’', '‘'],
  ['»', '«'],
  ['›', '‹'],
  ['“', '„'],
  ['‘', '‚'],
]);

/**
 * What may follow a marker to the end of its title and still close it: sentence stops, white
 * space (zero-width too) and closing quotes and brackets. BARE's closing class holds the same.
 */
const CLOSING_RUN: ReadonlySet<string> = new Set([
  ...SENTENCE_STOPS,
  ...[0x200b, 0x200c, 0x200d, 0x2060].map((code) => String.fromCharCode(code)),
  ...OPENER_OF.keys(),
]);

/** A title split into its base and the part number it carries, if any. */
interface SplitTitle {
  readonly base: string;
  readonly part: number | null;
}

/** What folding reads of an item. */
export interface Foldable {
  readonly id: string;
  readonly title: string;
  /** Epoch ms, or null when undated. */
  readonly time: number | null;
  /** The year group: '2025', or 'Undated'. */
  readonly year: string;
}

/** One row of the folded list: its newest part, the title it shows and every part, oldest first. */
export interface Folded<T> {
  readonly lead: T;
  readonly title: string;
  readonly parts: readonly T[];
}

/** The most of a title the patterns read. */
const TITLE_READ_MAX = 300;
/** The highest total a bracketed "(N/M)" may give and still be a part ("(12/29)" is a date). */
const BARE_TOTAL_MAX = 10;

/**
 * "(Part 1/2)", "[part 2 of 3]", "(Pt. 4)" or "(2/3)", with the space before it. Groups: the
 * "Part" form's number and total, then the bare form's number and total.
 */
const BRACKETED =
  /\s*[([]\s*(?:(?:part|pt\.?)\s*(\d{1,3})(?:\s*(?:\/|of)\s*(\d{1,3}))?|(\d{1,3})\s*\/\s*(\d{1,3}))\s*[)\]]/gi;
/**
 * "Part 1", " - Part 3", ", Pt. 2", "pt 4 of 5", with the separator before it. No letter, digit or
 * full stop may follow ("Part 1.5" is none), except a full stop after a total that a closing run
 * ({@link CLOSING_RUN}) follows to the end ("Part 2/2.", "Part 2/2...", "(Recap Part 2/2.)"). A
 * match never starts inside a run of white space (one from inside is also one from its start,
 * tried first), so no run is re-scanned from each of its characters: the pattern is linear.
 */
const BARE =
  /(?:^|(?<!\s)\s*[-–—:,|]\s*|(?<!\s)\s+)(?:part|pt\.?)\s*(\d{1,3})(?:\s*(?:\/|of)\s*(\d{1,3})(?!\w)(?!\.(?![\s\u200B-\u200D\u2060.!?…)\]}"'”’»›“‘]*$))|(?![\w.]))/i;
/** Separators left dangling, or doubled, where a marker was cut out. */
const LEADING_SEPARATORS = /^[\s\-–—:,|]+/;
const SEPARATORS: ReadonlySet<string> = new Set([...SPACES, '-', '–', '—', ':', ',', '|']);
const DOUBLED_DASH = /\s+[-–—]\s+[-–—]\s+/g;

/** Where a marker's own words sit in a title: [start, end), without the space before them. */
export type MarkerSpan = readonly [start: number, end: number];

/**
 * A title's marker as read: its base and part, the total it gives, whether it is "(N/M)", and
 * where its words sit in the title (null when the title is read whole).
 */
interface Marker extends SplitTitle {
  readonly total: number | null;
  readonly bare: boolean;
  readonly span: MarkerSpan | null;
}

/** The space or separator a match may open with, before the marker's own words. */
const MATCH_LEAD = /^[\s\-–—:,|]*/;

/** Where a match's marker words sit in the title it was found in. */
function spanOf(match: RegExpExecArray | RegExpMatchArray): MarkerSpan {
  const at = match.index ?? 0;
  return [at + (MATCH_LEAD.exec(match[0])?.[0].length ?? 0), at + match[0].length];
}

/** A title read whole: its own base, no part and no total. */
const wholeTitle = (title: string): Marker => ({
  base: title.slice(0, TITLE_READ_MAX),
  part: null,
  total: null,
  bare: false,
  span: null,
});

/** Whether `text` leaves open the quote or bracket that `closer` closes. */
function leftOpen(text: string, closer: string): boolean {
  const opener = OPENER_OF.get(closer) ?? closer;
  const opened = text.split(opener).length - 1;
  return opener === closer ? opened % 2 === 1 : opened > text.split(closer).length - 1;
}

/**
 * `before` (a title before its marker) as the closing run `run` after the marker leaves it: a
 * quote or bracket around the whole title goes with the run ('"Recap Part 2/3."' is "Recap"), one
 * that closes an opener left open inside it stays ('Talk: "Recap Part 2/3."' is 'Talk: "Recap"'),
 * and the rest of the run (stops, white space, a closer with nothing to close) goes.
 */
function closedBase(before: string, run: string): string {
  const closers = [...run].filter((char) => OPENER_OF.has(char));
  let start = 0;
  for (let closer = closers.at(-1); closer !== undefined; closer = closers.at(-1)) {
    const opener = before.charAt(start);
    if (opener !== OPENER_OF.get(closer) || !leftOpen(before.slice(start), closer)) break;
    closers.pop();
    start += 1;
  }
  let base = trimEnd(before.slice(start), SEPARATORS);
  for (const closer of closers) if (leftOpen(base, closer)) base += closer;
  return base;
}

/**
 * The title without the marker match covers, tidied: no doubled dash where a mid-title marker
 * sat, no separator left at either end, and no closing run after the marker ("Recap (Part
 * 2/2)." and "Recap Part 2/2..." are "Recap", see {@link closedBase} for quotes and brackets).
 * The whole title when nothing would be left.
 */
function cutOut(title: string, match: RegExpExecArray | RegExpMatchArray): string {
  const at = match.index ?? 0;
  const before = title.slice(0, at);
  const after = title.slice(at + match[0].length);
  const closing = trimEnd(after, CLOSING_RUN) === '';
  const base = trimEnd(
    (closing ? `${closedBase(before, after)} ` : `${before} ${after}`)
      .replaceAll(DOUBLED_DASH, ' - ')
      .replaceAll(/\s+/g, ' ')
      .replace(LEADING_SEPARATORS, ''),
    SEPARATORS,
  );
  return base === '' ? title : base;
}

const numberOr = (digits: string | undefined): number | null =>
  digits === undefined ? null : Number(digits);

/**
 * A bracketed match as a marker: the "Part" form always, the bare "(N/M)" only when `bare` is
 * allowed and N is between 1 and M, and M at most {@link BARE_TOTAL_MAX}; else null.
 */
function bracketedMarker(title: string, match: RegExpMatchArray, bare: boolean): Marker | null {
  const [, part, partTotal, number, total] = match;
  if (part !== undefined) {
    return {
      base: cutOut(title, match),
      part: Number(part),
      total: numberOr(partTotal),
      bare: false,
      span: spanOf(match),
    };
  }
  const n = Number(number);
  const m = Number(total);
  if (!bare || n < 1 || n > m || m > BARE_TOTAL_MAX) return null;
  return { base: cutOut(title, match), part: n, total: m, bare: true, span: spanOf(match) };
}

/**
 * The marker a title carries: the first acceptable bracketed one, else a bare "Part N", else none
 * (the title is its own base). With `bare` off, a bracketed "(N/M)" is never read as a part.
 */
function readMarker(title: string, bare = true): Marker {
  const read = title.slice(0, TITLE_READ_MAX);
  for (const match of read.matchAll(BRACKETED)) {
    const marker = bracketedMarker(read, match, bare);
    if (marker) return marker;
  }
  const plain = BARE.exec(read);
  if (plain) {
    return {
      base: cutOut(read, plain),
      part: Number(plain[1]),
      total: numberOr(plain[2]),
      bare: false,
      span: spanOf(plain),
    };
  }
  return wholeTitle(read);
}

/**
 * Where the part marker sits in `title` ("(Part 2/2)", "Part 3"), without the space or separator
 * before it, so a row can keep those words on one line; null when the title carries none. A
 * bracketed marker wins over a bare one.
 */
export function markerSpan(title: string): MarkerSpan | null {
  return readMarker(title).span;
}

/** What a grouping key may not end in: closing punctuation and white space. */
const KEY_END: ReadonlySet<string> = new Set([
  ...SPACES,
  ...['.', '!', '?', '…', ':', ';', ',', '-', '–', '—'],
]);

/** A base title as a grouping key: lower case, single-spaced, no closing punctuation. */
const baseKey = (base: string): string =>
  trimEnd(base.normalize('NFKC').toLowerCase().replaceAll(/\s+/g, ' '), KEY_END).trim();

/** The grouping key of a title: its base in lower case, single-spaced, no closing punctuation. */
export function partKey(title: string): string {
  return baseKey(readMarker(title).base);
}

/**
 * An item's marker as its series settles it, the group `groupOf` named and the key of the
 * series it falls in (the group and its base title).
 */
interface Reading {
  readonly group: string;
  readonly key: string;
  readonly marker: Marker;
}

/** `marker` as a reading in `group`: keyed by the group and its base title. */
const readingOf = (group: string, marker: Marker): Reading => ({
  group,
  key: `${group}\u0000${baseKey(marker.base)}`,
  marker,
});

/** The totals the members' bracketed "(N/M)" markers give. */
function bareTotalsOf(members: readonly Reading[]): ReadonlySet<number> {
  return new Set(
    members.flatMap(({ marker }) => (marker.total !== null && marker.bare ? [marker.total] : [])),
  );
}

/** Whether every member's title carries a part number and no two the same one. */
function numberedByTitles(members: readonly Reading[]): boolean {
  const parts = members.map(({ marker }) => marker.part);
  return parts.every((part) => part !== null) && new Set(parts).size === parts.length;
}

/**
 * The total the members' titles give most often; null when none gives one, or when two totals
 * are given equally often (then no total speaks for the series).
 */
function leadingTotal(members: readonly Reading[]): number | null {
  const tally = new Map<number, number>();
  for (const { marker } of members) {
    if (marker.total !== null) tally.set(marker.total, (tally.get(marker.total) ?? 0) + 1);
  }
  const [first, second] = [...tally].sort(([, a], [, b]) => b - a);
  if (!first || (second && second[1] === first[1])) return null;
  return first[0];
}

/** Which readings of one series to read whole, decided once from all its members. */
type WholePicker = (members: readonly Reading[]) => (reading: Reading) => boolean;

/**
 * `read` again, each reading that `whole` picks read anew by `reread` and keyed apart. `whole` is
 * asked once per series, with all its members.
 */
function settle<T extends Foldable>(
  items: readonly T[],
  read: readonly (Reading | null)[],
  whole: WholePicker,
  reread: (title: string) => Marker,
): (Reading | null)[] {
  const members = new Map<string, Reading[]>();
  for (const reading of read) {
    if (!reading) continue;
    const series = members.get(reading.key);
    if (series) series.push(reading);
    else members.set(reading.key, [reading]);
  }
  const picks = new Map([...members].map(([key, series]) => [key, whole(series)] as const));
  return read.map((reading, index) => {
    if (!reading || !picks.get(reading.key)?.(reading)) return reading;
    return readingOf(reading.group, reread(items[index]?.title ?? ''));
  });
}

/**
 * Whether a title disagrees with its series, numbered by its titles, and the total it keeps
 * (`kept`, the one its titles give most often; null when none is): it numbers below 1 ("Part 0",
 * whatever the totals), gives another total ("Part 3/4" beside "Part 1/2" and "Part 2/2"), or
 * numbers past the kept total ("Part 3", "Part 3 of 2"). Where no total is kept, every title that
 * gives one disagrees, and a title that gives none and numbers from 1 never does.
 */
function disagrees({ part, total }: Marker, kept: number | null): boolean {
  if (part !== null && part < 1) return true;
  if (kept === null) return total !== null;
  return (total !== null && total !== kept) || (part !== null && part > kept);
}

/**
 * Each item's reading, by index; null for an item `groupOf` places in no group. Items group by
 * their base title within the group `groupOf` names. A series states one total at most, so:
 * - a bracketed "(N/M)" whose total the other such markers in its series do not share is no
 *   part (it may be a date): its title is read whole and keyed apart;
 * - in a series its titles number, each title that disagrees with it ({@link disagrees}: a
 *   "Part 0", a total other than the one given most often, or a number past it) is then read
 *   whole. The parts left are then numbered from 1 to the kept total at most, so the series
 *   counts to it: no place states a count a title contradicts, and the titles that agree stay
 *   one series. A series numbered by date states no part total, so it keeps every upload.
 */
function readings<T extends Foldable>(
  items: readonly T[],
  groupOf: (item: T) => string | null,
): (Reading | null)[] {
  const first = items.map((item) => {
    const group = groupOf(item);
    return group === null ? null : readingOf(group, readMarker(item.title));
  });
  const dated = settle(
    items,
    first,
    (members) => {
      const disagree = bareTotalsOf(members).size > 1;
      return (reading) => disagree && reading.marker.bare;
    },
    (title) => readMarker(title, false),
  );
  return settle(
    items,
    dated,
    (members) => {
      if (!numberedByTitles(members)) return () => false;
      const kept = leadingTotal(members);
      return (reading) => disagrees(reading.marker, kept);
    },
    wholeTitle,
  );
}

/** An item with its index in the list it came from. */
type Member<T> = readonly [item: T, index: number];
/** A member's part number, by its index; null when it carries none. */
type PartOf = (index: number) => number | null;

/** Undated parts sort after dated ones, as the feed does. */
const timeOrLast = (time: number | null): number => time ?? Number.POSITIVE_INFINITY;
const partOrLast = (part: number | null): number => part ?? Number.POSITIVE_INFINITY;

/**
 * `ordered` with each run of numbered parts in the order its titles number it. A run is
 * neighbouring uploads that each carry a part number, none twice: the parts of one broadcast,
 * which can reach YouTube out of order ("(Part 2/2)" hours before "(Part 1/2)"). An upload
 * without a number ends a run, and so does a number the run already holds (the next broadcast's
 * "Part 1"), so a part never moves past an upload that is not one of its own.
 */
function inTitleOrder<T>(ordered: readonly Member<T>[], partOf: PartOf): Member<T>[] {
  const runs: { readonly member: Member<T>; readonly part: number | null }[][] = [];
  for (const member of ordered) {
    const part = partOf(member[1]);
    const run = runs.at(-1);
    if (part !== null && run?.every((each) => each.part !== null && each.part !== part)) {
      run.push({ member, part });
    } else {
      runs.push([{ member, part }]);
    }
  }
  return runs.flatMap((run) =>
    [...run].sort((a, b) => partOrLast(a.part) - partOrLast(b.part)).map(({ member }) => member),
  );
}

/**
 * Parts oldest first: by time, then by part number (two uploads can share a timestamp), then
 * by the feed's order reversed (the feed is newest first); the parts of one broadcast then follow
 * their titles' numbers ({@link inTitleOrder}).
 */
function oldestFirst<T extends Foldable>(
  members: readonly Member<T>[],
  partOf: PartOf,
): Member<T>[] {
  return inTitleOrder(
    [...members].sort(
      ([a, indexA], [b, indexB]) =>
        timeOrLast(a.time) - timeOrLast(b.time) ||
        partOrLast(partOf(indexA)) - partOrLast(partOf(indexB)) ||
        indexB - indexA,
    ),
    partOf,
  );
}

/** The members of each group, in list order, by the group's key; ungrouped items left out. */
function groupsOf<T>(
  items: readonly T[],
  read: readonly (Reading | null)[],
): Map<string, Member<T>[]> {
  const groups = new Map<string, Member<T>[]>();
  items.forEach((item, index) => {
    const key = read[index]?.key;
    if (key === undefined) return;
    groups.set(key, [...(groups.get(key) ?? []), [item, index]]);
  });
  return groups;
}

/**
 * `items` (newest first) as rows: items `canFold` accepts that share a base title within one
 * year fold into one row at the newest part's place; every other item is a row of its own.
 */
export function foldParts<T extends Foldable>(
  items: readonly T[],
  canFold: (item: T) => boolean,
): Folded<T>[] {
  const read = readings(items, (item) => (canFold(item) ? item.year : null));
  const groups = groupsOf(items, read);
  const partOf: PartOf = (index) => read[index]?.marker.part ?? null;
  const placed = new Set<string>();
  return items.flatMap((item, index): Folded<T>[] => {
    const key = read[index]?.key;
    if (key === undefined) return [{ lead: item, title: item.title, parts: [item] }];
    if (placed.has(key)) return [];
    placed.add(key);
    const members = groups.get(key) ?? [[item, index]];
    if (members.length === 1) return [{ lead: item, title: item.title, parts: [item] }];
    const parts = oldestFirst(members, partOf).map(([part]) => part);
    return [{ lead: item, title: read[index]?.marker.base ?? item.title, parts }];
  });
}

/** An upload's place in its series. */
export interface SeriesPlace {
  /** The series' key: the kind and the base title's key. */
  readonly key: string;
  /** The base title, as the newest upload writes it. */
  readonly name: string;
  /** This upload's number, from 1. */
  readonly part: number;
  /** How many uploads the series has. */
  readonly count: number;
  /** 'title': the titles' own part numbers. 'order': oldest first. */
  readonly numbered: 'title' | 'order';
}

/** The fewest uploads that make a series. */
const SERIES_MIN = 2;

/**
 * The titles' own part numbers, oldest first, when every member carries one and no two are
 * equal; null otherwise, and the series is numbered by date instead (so a row never says
 * "Part 25" beside a title that says "(Part 1/2)").
 */
function ownNumbers<T>(members: readonly Member<T>[], partOf: PartOf): number[] | null {
  const numbers = members.map(([, index]) => partOf(index));
  const distinct = new Set(numbers);
  return numbers.every((part): part is number => part !== null) && distinct.size === numbers.length
    ? numbers
    : null;
}

/**
 * How many uploads a series has: with the titles' own numbers, the total the titles give (those
 * that give one all give the same, see {@link readings}) when it is no less than what they number,
 * else the highest number (a missing part still counts); numbered by date, the uploads there are.
 */
function seriesCount<T>(
  members: readonly Member<T>[],
  numbers: readonly number[] | null,
  totalOf: (index: number) => number | null,
): number {
  if (!numbers) return members.length;
  const highest = Math.max(members.length, ...numbers);
  const totals = new Set(
    members.flatMap(([, index]) => {
      const total = totalOf(index);
      return total === null ? [] : [total];
    }),
  );
  const [total] = totals;
  return totals.size === 1 && total !== undefined && total >= highest ? total : highest;
}

/**
 * Each item's place in its series, by item id; an item in no series has no entry. `items` are
 * newest first, as the feed is. `groupOf` names the group an item may form a series within (its
 * kind), or null for an item that is never part of one.
 */
export function seriesPlaces<T extends Foldable>(
  items: readonly T[],
  groupOf: (item: T) => string | null,
): Map<string, SeriesPlace> {
  const read = readings(items, groupOf);
  const partOf: PartOf = (index) => read[index]?.marker.part ?? null;
  const totalOf = (index: number): number | null => read[index]?.marker.total ?? null;
  const places = new Map<string, SeriesPlace>();
  for (const [key, members] of groupsOf(items, read)) {
    const [newest, newestIndex] = members[0] ?? [];
    if (!newest || newestIndex === undefined || members.length < SERIES_MIN) continue;
    const ordered = oldestFirst(members, partOf);
    const numbers = ownNumbers(ordered, partOf);
    const count = seriesCount(ordered, numbers, totalOf);
    const name = read[newestIndex]?.marker.base ?? newest.title;
    ordered.forEach(([member], index) => {
      places.set(member.id, {
        key,
        name,
        part: numbers?.[index] ?? index + 1,
        count,
        numbered: numbers ? 'title' : 'order',
      });
    });
  }
  return places;
}

/** The longest series slug. */
export const SERIES_SLUG_MAX = 80;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const BASE_36 = 36;

/** A short, stable name for `text` (FNV-1a, base 36): the same text always gives the same one. */
export function shortHash(text: string): string {
  let hash = FNV_OFFSET;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME);
  }
  return (hash >>> 0).toString(BASE_36);
}

/**
 * A series' base title as a URL value: lower case, digits and hyphens, 80 characters at most
 * (accents dropped, every other run of characters one hyphen). A title that leaves nothing (no
 * Latin letter or digit) gets "series-" and a short hash of itself instead.
 */
export function seriesSlug(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, SERIES_SLUG_MAX)
    .replace(/-+$/, '');
  return slug === '' ? `series-${shortHash(name)}` : slug;
}
