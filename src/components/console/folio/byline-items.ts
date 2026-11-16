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
 * @file A byline's parts, cleaned: the words under a title ('CLI Tool · Feb 2026 · In progress')
 * that replace a table's column headers. Pure, so a page can build the same text for a title
 * attribute or a test that the Byline component draws.
 *
 * The words are written as given, in sentence case ('In progress', '7 projects'), never turned to
 * capitals: a kind such as 'AI/ML' or 'CLI Tool' keeps its own spelling.
 */

import type { Noun } from '@/lib/filters/types';
import { numberFormatter } from '../stat-strip';
import type { StatusTone } from '../status-dot';

/** A part with a status dot beside its word: `{ text: 'In progress', tone: 'ongoing' }`. */
export interface BylineStatus {
  readonly text: string;
  readonly tone: StatusTone;
  /** A live dot may breathe; other tones ignore it. */
  readonly pulse?: boolean;
}

/** What a byline is built from. Empty strings, null, undefined and false are left out. */
export type BylinePart = string | number | BylineStatus | null | undefined | false;

/** One cleaned part. `tone` is set only on a status. */
export interface BylineItem {
  readonly text: string;
  readonly tone?: StatusTone;
  readonly pulse?: boolean;
}

/** The separator between parts, as plain text. */
export const BYLINE_SEPARATOR = ' · ';

const tidy = (text: string): string => text.replace(/\s+/gu, ' ').trim();

function itemOf(part: BylinePart): BylineItem | null {
  if (part === null || part === undefined || part === false) return null;
  if (typeof part === 'number') {
    return Number.isFinite(part) ? { text: numberFormatter().format(part) } : null;
  }
  if (typeof part === 'string') {
    const text = tidy(part);
    return text === '' ? null : { text };
  }
  const text = tidy(part.text);
  if (text === '') return null;
  return part.pulse ? { text, tone: part.tone, pulse: true } : { text, tone: part.tone };
}

/**
 * The parts to show, in order: blanks dropped, spaces tidied, numbers grouped ('1,300'), and a
 * part that repeats an earlier one (ignoring case) dropped, so 'Other · other' cannot happen.
 */
export function bylineItems(parts: readonly BylinePart[]): BylineItem[] {
  const seen = new Set<string>();
  const items: BylineItem[] = [];
  for (const part of parts) {
    const item = itemOf(part);
    if (item === null) continue;
    const key = item.text.toLocaleLowerCase('en-US');
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

/** The byline as one line of plain text: 'CLI Tool · Feb 2026 · In progress'. */
export function bylineText(parts: readonly BylinePart[]): string {
  return bylineItems(parts)
    .map((item) => item.text)
    .join(BYLINE_SEPARATOR);
}

/** A count as shown, grouped in the site's locale: '7', '1,300'. */
export function formatCount(count: number): string {
  return numberFormatter().format(count);
}

/** A count and its noun, in sentence case: '1 project', '7 projects', '1,300 contributions'. */
export function countOf(count: number, noun: Noun): string {
  return `${formatCount(count)} ${count === 1 ? noun.one : noun.many}`;
}
