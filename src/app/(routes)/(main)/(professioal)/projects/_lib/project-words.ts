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
 * @file The words /projects writes about a project in its bylines, pure and server-safe, in
 * sentence case (never upper-cased): whether it is still in progress, when it ran ('Mar – Jun
 * 2026', 'Sep 2024 – Apr 2025', 'Apr 2026 – now'), what it was built with ('Rust, Ratatui,
 * TypeScript and 7 more') and the 'and four more' after a chapter's names. Dates are read in UTC
 * at month precision, the precision Studio's project dates are meant at.
 */

import { type ProjectMonth, startedOf } from './project-text';

/** Studio's free-text status names a project still under way: 'In Progress', 'in progress'. */
const IN_PROGRESS = /\bin[\s-]+progress\b/iu;
/** A spaced en dash, read as 'to'. */
const RANGE = ' – ';
/**
 * What a run still in progress ends with: 'Apr 2026 – now'. The one word for it on /projects and
 * on a project page (its case study imports this), so the two never disagree.
 */
export const PRESENT_LABEL = 'now';
/** Counts up to twelve are written as words in a sentence ('and four more'), larger as figures. */
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

/** Whether a Studio status says the project is still in progress. */
export const isInProgress = (status: string | null | undefined): boolean =>
  IN_PROGRESS.test(status ?? '');

/** 'Mar 2026'. */
export const monthYear = (month: ProjectMonth): string => `${month.name} ${month.year}`;

/**
 * When a project ran, at month precision: one month ('Feb 2025'), a run inside a year ('Mar – Jun
 * 2026'), a run across years ('Sep 2024 – Apr 2025'), or one still in progress with no end
 * ('Apr 2026 – now'). Null without a readable start. An end on or before the start month is
 * read as no run.
 */
export function periodOf(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  ongoing: boolean,
): string | null {
  const start = startedOf(startDate);
  if (!start) return null;
  const end = startedOf(endDate);
  if (!end || end.iso <= start.iso) {
    return ongoing && !end ? `${monthYear(start)}${RANGE}${PRESENT_LABEL}` : monthYear(start);
  }
  if (end.year === start.year) return `${start.name}${RANGE}${monthYear(end)}`;
  return `${monthYear(start)}${RANGE}${monthYear(end)}`;
}

/** A count in a sentence: 'four' up to twelve, then figures ('13'). */
export const countWord = (count: number): string =>
  Number.isInteger(count) && count >= 0 && count < NUMBER_WORDS.length
    ? (NUMBER_WORDS[count] ?? String(count))
    : String(count);

/** Names joined as a sentence: 'A', 'A and B', 'A, B and C'. */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/**
 * What a project was built with, as a line: the first `shown` names, then how many more.
 *
 * @example
 * builtWithText(['Rust', 'Ratatui', 'TypeScript', 'Go'], 3) // 'Rust, Ratatui, TypeScript and 1 more'
 */
export function builtWithText(names: readonly string[], shown = 3): string {
  const listed = names.slice(0, Math.max(1, shown));
  const more = names.length - listed.length;
  if (more <= 0) return joinNames(listed);
  return `${listed.join(', ')} and ${more} more`;
}
