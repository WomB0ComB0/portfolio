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
 * @file The guestbook wall's rules, pure and isomorphic: which year chapter a note sits in, how
 * large its words are set and how it sits on the wall, which chapters the wall draws once a
 * visitor posts on the page, and how large each chapter's year is.
 *
 * Nothing here reorders a note. The server lists the notes newest first and the wall keeps that
 * order, so the DOM, the Tab order and a screen reader all read newest first, and the wall's rows
 * (left to right, then down) read the same way.
 */

import type { ChapterSize } from '@/components/console/folio';
// The measure alone, not the barrel and its components, so a note's row loads anywhere.
import { wordUnits } from '@/components/console/folio/word-measure';

/** The UTC year of an ISO date, or null when it cannot be read (as monthOf reads it). */
export function yearOf(iso: string): number | null {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? new Date(time).getUTCFullYear() : null;
}

/** One year's notes, in the order the server listed them. */
export interface YearGroup<T> {
  /** The UTC year; null only when no note in the list has a readable date. */
  readonly year: number | null;
  readonly items: readonly T[];
}

/**
 * Each item's year, with an unreadable date taking the year of the note listed before it (or,
 * at the top of the list, the first readable one after it), so it stays where it was listed.
 */
function filledYears(items: readonly { readonly createdAt: string }[]): (number | null)[] {
  const years = items.map((item) => yearOf(item.createdAt));
  let current = years.find((year) => year !== null) ?? null;
  return years.map((year) => {
    current = year ?? current;
    return current;
  });
}

/**
 * The notes cut into year chapters: each run of notes from one UTC year, in the order given
 * (newest first from the server, so each year comes once). Never reorders or drops a note.
 */
export function groupByYear<T extends { readonly createdAt: string }>(
  items: readonly T[],
): YearGroup<T>[] {
  const years = filledYears(items);
  const groups: { year: number | null; items: T[] }[] = [];
  items.forEach((item, index) => {
    const year = years[index] ?? null;
    const last = groups.at(-1);
    if (last && last.year === year) last.items.push(item);
    else groups.push({ year, items: [item] });
  });
  return groups;
}

/**
 * How large a note's words are set, by its length. Short notes ('goat', a lone wave) are set
 * large and long feedback as calm body text, never smaller than the body's 1rem, so the scale
 * never makes real feedback the quietest thing on the wall. `note`, `body` and `long` all read as
 * body text and differ only in their tile's width: a short sentence shares a phone's row, a long
 * one takes it, and a 280-character note is never a narrow tower.
 */
export type NoteScale = 'word' | 'line' | 'note' | 'body' | 'long';

/** The most characters (code points, trimmed) each scale takes; anything longer is `long`. */
const NOTE_SCALE_MAX: Readonly<Record<Exclude<NoteScale, 'long'>, number>> = {
  word: 8,
  line: 24,
  note: 60,
  body: 120,
};

const SCALES_BY_LENGTH = ['word', 'line', 'note', 'body'] as const;

/** The scale for a note's text. */
export function noteScale(text: string): NoteScale {
  const length = Array.from(text.trim()).length;
  return SCALES_BY_LENGTH.find((scale) => length <= NOTE_SCALE_MAX[scale]) ?? 'long';
}

/**
 * How a note sits on the wall, chosen by the note itself (its length), never by decoration:
 * - `sticker`: a few words ('goat', 'rawr xd', 'cool project fam!') set large as type, no box.
 * - `tile`: a sentence in a quiet surface tile.
 * - `quote`: longer feedback as calm body text under a hanging quote mark, no box.
 * So the wall's rhythm comes from what people wrote, and no two neighbours need look alike.
 */
export type NoteTreatment = 'sticker' | 'tile' | 'quote';

const TREATMENT_BY_SCALE: Readonly<Record<NoteScale, NoteTreatment>> = {
  word: 'sticker',
  line: 'sticker',
  note: 'tile',
  body: 'quote',
  long: 'quote',
};

/** The treatment for a note's scale. */
export function noteTreatment(scale: NoteScale): NoteTreatment {
  return TREATMENT_BY_SCALE[scale];
}

/** A sticker is never planned wider than this many units, so a long line wraps rather than run. */
export const STICKER_MAX_UNITS = 24;

/**
 * How wide a sticker's text runs on one line, in units (wordUnits, spaces counted): its widest
 * typed line, capped at STICKER_MAX_UNITS. CSS turns it into the sticker's width at its type size,
 * so a short note takes only the room its words need and the wall's rhythm follows the notes.
 */
export function stickerUnits(text: string): number {
  const widest = text
    .trim()
    .split('\n')
    .reduce((units, line) => Math.max(units, wordUnits(line)), 0);
  return Math.min(widest, STICKER_MAX_UNITS);
}

/**
 * The key of the wall's first chapter, whatever its year or state. The compose tile lives in
 * that chapter, so one key keeps the compose card mounted (its text, its "Posted" line, focus and
 * a post still being sent) when the first chapter changes: the first post into an empty
 * guestbook, a post in a new year, or a refresh that brings either.
 */
export const NEWEST_CHAPTER_KEY = 'newest';

/** A chapter the wall draws. */
export interface ChapterPlan {
  /** React's key: NEWEST_CHAPTER_KEY for the first chapter, else 'y2025'-style. */
  readonly key: string;
  /** Its UTC year, or null for a list with no readable date or no notes at all. */
  readonly year: number | null;
  /** The index of the server chapter it draws, or null when it holds only posted notes. */
  readonly server: number | null;
}

/**
 * The chapters to draw: the server's year chapters, newest first, the first keyed as the newest.
 * Notes posted on this page join the first chapter; when they are dated in a later year than
 * every server chapter (a post on New Year's Day), that year opens the wall instead. With no
 * server chapters there is still one, so the compose tile always has its place.
 */
export function planChapters(
  serverYears: readonly (number | null)[],
  postedYear: number | null,
): ChapterPlan[] {
  const fromServer = serverYears.map((year, server) => ({ year, server }));
  const firstYear = fromServer[0]?.year ?? null;
  const opensNewYear = postedYear !== null && firstYear !== null && postedYear > firstYear;
  const ordered: { year: number | null; server: number | null }[] = opensNewYear
    ? [{ year: postedYear, server: null }, ...fromServer]
    : fromServer;
  if (ordered.length === 0) ordered.push({ year: postedYear, server: null });
  return ordered.map((plan, index) => ({
    key: index === 0 ? NEWEST_CHAPTER_KEY : `y${plan.year ?? `undated-${index}`}`,
    ...plan,
  }));
}

/** The size a chapter's year opened with on this page, and the year it was. */
export interface OpenedSize {
  readonly year: number | null;
  readonly size: ChapterSize;
}

/**
 * The size a chapter's year is shown at. A chapter's size follows the chapter system
 * (chapterSize over the server's notes: a one-note year is a heading on the rule, a fuller first
 * year the numeral), but while the page is open a chapter keeps the size it opened with as long as
 * it is still that year. So the refresh after a post never grows the year from a heading into a
 * numeral and pushes the compose box down under the visitor's focus; a chapter that becomes
 * another year (the first post into an empty guestbook, a post on New Year's Day) takes its own.
 */
export function steadySize(
  opened: OpenedSize,
  year: number | null,
  size: ChapterSize,
): ChapterSize {
  return opened.year === year ? opened.size : size;
}
