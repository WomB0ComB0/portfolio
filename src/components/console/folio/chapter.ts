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
 * @file The chapter system's rules, pure: a chapter's anchor id, how big its opener is, and the
 * jump links to every chapter. One system on every page, so the years read alike everywhere.
 */

import type { Noun } from '@/lib/filters/types';
import { countOf, formatCount } from './byline-items';

/**
 * How big a chapter's opener is:
 * - `lead`: the page's first chapter, the one display numeral.
 * - `step`: every later chapter, stepped down so four big numerals never repeat down a page.
 * - `inline`: a chapter with one item, a small heading on the rule rather than a full opener.
 */
export type ChapterSize = 'lead' | 'step' | 'inline';

export interface ChapterPlace {
  /** The chapter's place on the page, from 0. */
  readonly index: number;
  /** How many items it holds. */
  readonly count: number;
}

/** The judges' rule: a one-item chapter never gets a full opener; only the first is large. */
export function chapterSize({ index, count }: ChapterPlace): ChapterSize {
  if (count <= 1) return 'inline';
  return index === 0 ? 'lead' : 'step';
}

/**
 * A chapter's anchor id: 'y2026' for a year (an id that starts with a figure needs escaping in
 * CSS), else the words as a slug ('Featured' -> 'featured', 'Also now' -> 'also-now').
 */
export function chapterId(key: string | number): string {
  const text = String(key).trim();
  if (/^\d/u.test(text)) return `y${text.replace(/[^\w-]+/gu, '-')}`;
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return slug === '' ? 'chapter' : slug;
}

/** A chapter as the jump row lists it. */
export interface ChapterJump {
  /** The chapter's section id (chapterId). */
  readonly id: string;
  /** What the link says: '2026', 'Featured'. */
  readonly label: string;
  /** How many items the chapter holds; a chapter with none is left out. */
  readonly count?: number;
}

/** A jump link, ready to draw. */
export interface ChapterJumpLink {
  readonly id: string;
  readonly href: string;
  readonly label: string;
  /** The count as shown ('1,300'), when there is one. */
  readonly count?: string;
  /** What a screen reader hears after the label: '7 projects' with a noun, else '7'. */
  readonly spoken?: string;
}

/**
 * The jump links, in page order: chapters with no items (a filter emptied them) and repeated ids
 * left out, so every link lands on a chapter that is on the page.
 */
export function chapterJumps(chapters: readonly ChapterJump[], noun?: Noun): ChapterJumpLink[] {
  const seen = new Set<string>();
  const links: ChapterJumpLink[] = [];
  for (const { id, label, count } of chapters) {
    if (id === '' || seen.has(id) || count === 0) continue;
    seen.add(id);
    const href = `#${encodeURIComponent(id)}`;
    if (count === undefined) {
      links.push({ id, href, label });
      continue;
    }
    const shown = formatCount(count);
    links.push({ id, href, label, count: shown, spoken: noun ? countOf(count, noun) : shown });
  }
  return links;
}
