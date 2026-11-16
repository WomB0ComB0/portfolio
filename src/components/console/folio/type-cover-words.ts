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
 * @file The words on a type cover, pure. The cover names the project at a glance: its large line
 * is a name of at most two words ('Brain Tumor', 'Data Pipeline', 'Web Scraper', 'MedChain'),
 * and the rest of the short name sits on a quiet line under it ('Segmentation & Classification').
 * The judges' and the verifier's fix for covers that led with the first word alone, where 'Brain'
 * stood by itself and both 'Enterprise …' projects read 'Enterprise'.
 *
 * The rule, on the short name (the title before a dash, colon, bar or bracket):
 * - its head is the words before the first joining word ('&', 'and', 'for', 'on' …), so 'Brain
 *   Tumor Segmentation & Classification' is headed 'Brain Tumor Segmentation';
 * - a head of one or two words is the name;
 * - a longer head that opens with a generic word ('Enterprise', 'AI', 'Personal' …) is named by
 *   its last two words, where English puts the thing itself ('Enterprise Data Pipeline' is a
 *   'Data Pipeline'); any other longer head by its first two ('Brain Tumor').
 * Given the other covers on the page (`others`), a name another project would also get is
 * swapped for a fallback that avoids the other preferred names. Two fallbacks may still
 * coincide; the full project title remains alongside each decorative cover.
 */

import { phraseUnits, twoLineUnits } from './word-measure';

export interface TypeCoverWords {
  /** The large line, one or two words: 'Data Pipeline'. */
  readonly lead: string;
  /** The rest of the short name in order, '' when there is none: 'Enterprise'. */
  readonly rest: string;
  /** The large line's width in units (word-measure), for the cover's fit. It never wraps. */
  readonly units: number;
  /** The width the quiet line needs to fit on two lines, so it is never cut by an ellipsis. */
  readonly restUnits: number;
}

/** Where a title's subtitle starts: a spaced dash, a colon, a bar or a bracket. */
const SUBTITLE_MARK = /\s[-–—|]\s|:\s|\s?[([]/u;
/** A word that joins the head to what follows it. */
const JOINER = /^(?:&|\+|and|or|for|of|on|in|with|to|at|by|from|via|the|a|an)$/iu;
/** An opening word too generic to name a project alone. */
const GENERIC_OPENER =
  /^(?:enterprise|ai|ml|llm|smart|personal|simple|basic|modern|advanced|automated|intelligent|custom|my|our|the|a|an)$/iu;
/** The most words the large line takes. */
const MAX_NAME_WORDS = 2;

const tidyTitle = (title: string): string => title.replace(/\s+/gu, ' ').trim();

/** A title's short name: 'SparkMind - AI-Driven Personalized Learning Hub' -> 'SparkMind'. */
export function shortName(title: string): string {
  const tidy = tidyTitle(title);
  const [name = ''] = tidy.split(SUBTITLE_MARK);
  return name.trim() === '' ? tidy : name.trim();
}

/** The short name's words before its first joining word ('Brain Tumor Segmentation'). */
function headWords(title: string): string[] {
  const words = shortName(title).split(' ');
  const joiner = words.findIndex((word, index) => index > 0 && JOINER.test(word));
  return joiner > 0 ? words.slice(0, joiner) : words;
}

/** The names a cover could take, best first, each distinct. */
function nameChoices(title: string): string[] {
  const head = headWords(title);
  if (head.length <= MAX_NAME_WORDS) return [head.join(' ')];
  const first = head.slice(0, MAX_NAME_WORDS).join(' ');
  const last = head.slice(-MAX_NAME_WORDS).join(' ');
  const choices = GENERIC_OPENER.test(head[0] ?? '') ? [last, first] : [first, last];
  return [...new Set(choices)];
}

/**
 * The cover's large line: the project's name in at most two words. With `others` (the other
 * titles on the page), a name one of them would also get gives way to the next distinct choice.
 */
export function coverName(title: string, others: readonly string[] = []): string {
  const [best = shortName(title), ...rest] = nameChoices(title);
  if (others.length === 0) return best;
  const self = tidyTitle(title).toLocaleLowerCase('en-US');
  const taken = new Set(
    others
      .filter((other) => tidyTitle(other).toLocaleLowerCase('en-US') !== self)
      .map((other) => (nameChoices(other)[0] ?? '').toLocaleLowerCase('en-US')),
  );
  return [best, ...rest].find((name) => !taken.has(name.toLocaleLowerCase('en-US'))) ?? best;
}

/** The short name's words that the large line leaves out, in their order. */
function restOf(title: string, lead: string): string {
  const words = shortName(title).split(' ');
  const leadWords = lead.split(' ');
  const at = words.findIndex((_word, index) =>
    leadWords.every((word, offset) => words[index + offset] === word),
  );
  if (at < 0) return '';
  return [...words.slice(0, at), ...words.slice(at + leadWords.length)].join(' ');
}

/** The cover's large line, its quiet line, and the widths CSS fits them by. */
export function typeCoverWords(title: string, others: readonly string[] = []): TypeCoverWords {
  const lead = coverName(title, others);
  const rest = restOf(title, lead);
  return { lead, rest, units: phraseUnits(lead), restUnits: twoLineUnits(rest) };
}

/** An aspect ratio as a number or 'w/h'. */
export type CoverRatio = number | `${number}/${number}` | `${number} / ${number}`;

const RATIO = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/u;
const DEFAULT_RATIO = '16 / 10';

/** The CSS aspect-ratio for a cover ('16 / 10'); one that is not positive gets 16 / 10. */
export function coverRatio(ratio: CoverRatio | undefined): string {
  if (typeof ratio === 'number') {
    return ratio > 0 && Number.isFinite(ratio) ? String(ratio) : DEFAULT_RATIO;
  }
  const match = RATIO.exec(ratio ?? '');
  if (!match) return DEFAULT_RATIO;
  const [, width = '0', height = '0'] = match;
  return Number(width) > 0 && Number(height) > 0 ? `${width} / ${height}` : DEFAULT_RATIO;
}
