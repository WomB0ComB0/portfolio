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
 * @file A role's words as /experience prints them. Pure and isomorphic.
 *
 * - plainText: Studio text without its raw links (the list shows those as named chips).
 * - sentencesOf, firstSentenceOf: whole sentences, never cut and never given an ellipsis.
 * - ledeOf: the first sentence and as many whole ones after it as fit a length.
 * - dutiesBeyond: the duties the description does not already state.
 */

import { TRAILING_PUNCTUATION, trailingRun } from '@/lib/text/trim';

/*
 * A pattern that opens on a run of spaces or full stops starts only where the run starts
 * ((?<!\s), (?<![.!?])). A match from inside a run is also one from its start, which is tried
 * first, so the results are the same, and a long run is read once rather than once per character.
 */

/** A raw link in brackets, with the space before it: "the blog (https://…)". */
const BRACKETED_LINK = /(?<!\s)\s*\(\s*https?:\/\/[^\s)]*\s*\)/giu;
/** A bare link that ends the text, with the dash or colon that led to it: "… — https://…". */
const LED_LINK_AT_END = /(?<!\s)\s*[—–:-]\s+https?:\/\/[^\s)]+$/iu;
/** Any other bare link, with the space before it. */
const BARE_LINK = /(?<!\s)\s*https?:\/\/[^\s)]+/giu;
/** A sentence's end: . ! or ?, then any closing quote or bracket, before a space or the end. */
const SENTENCE_END = /(?<![.!?])[.!?]+["'”’)\]]*(?=\s|$)/gu;
/** What opens a word without being part of it. */
const LEADING_MARKS = /^[("'“‘[]+/u;
const NOT_WORD = /[^\p{L}\p{N}]+/gu;

/** Words that end in a full stop without ending the sentence ("Think Round, Inc. builds"). */
const ABBREVIATIONS = new Set([
  'inc',
  'ltd',
  'co',
  'corp',
  'llc',
  'jr',
  'sr',
  'dr',
  'mr',
  'mrs',
  'ms',
  'st',
  'vs',
  'e.g',
  'i.e',
  'u.s',
]);

/** The longest text the lead tile sets: about four lines at its measure. */
export const LEDE_LIMIT = 240;

/**
 * The punctuation a removed address leaves behind: the sentence's own, which an address match
 * swallowed, if it took any.
 */
const endOf = (address: string): string => trailingRun(address, TRAILING_PUNCTUATION);

/**
 * Studio text without its raw http(s) links: a bracketed one goes with its brackets, a bare one
 * with the dash or colon that led to it at the end of the text. A sentence keeps its full stop,
 * and whitespace is collapsed.
 */
export function plainText(text: string): string {
  return text
    .replace(BRACKETED_LINK, '')
    .trimEnd()
    .replace(LED_LINK_AT_END, endOf)
    .replace(BARE_LINK, endOf)
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Whether the text so far ends in an abbreviation, whose full stop is not a sentence's. */
function endsInAbbreviation(before: string): boolean {
  const word = before.slice(before.lastIndexOf(' ') + 1).replace(LEADING_MARKS, '');
  return ABBREVIATIONS.has(word.toLowerCase());
}

/** The sentences of text already tidied (its whitespace collapsed), each with its own end. */
function splitSentences(source: string): string[] {
  const ends = [...source.matchAll(SENTENCE_END)]
    .filter((match) => !endsInAbbreviation(source.slice(0, match.index)))
    .map((match) => match.index + match[0].length);
  const cuts = [0, ...ends, source.length];
  return cuts
    .slice(1)
    .map((end, index) => source.slice(cuts[index] ?? 0, end).trim())
    .filter((sentence) => sentence !== '');
}

/**
 * The sentences of `text`, without its raw links, each with its own end. A full stop after an
 * abbreviation (Inc., e.g.) or inside a figure or a name (2.5, Next.js) ends nothing; text with
 * no sentence end is one sentence.
 */
export function sentencesOf(text: string): string[] {
  return splitSentences(plainText(text));
}

/**
 * The sentences of `text` with its raw links kept (whitespace collapsed), for prose that names
 * its links (linked-text.ts). An address's own dots are never followed by a space, so they end
 * nothing; the full stop after "(https://…)." does.
 */
export function rawSentencesOf(text: string): string[] {
  return splitSentences(text.replace(/\s+/gu, ' ').trim());
}

/** A text cut at a sentence: the lede and the rest, both with their raw links kept. */
export interface LedeSplit {
  readonly lede: string;
  /** '' when the lede is the whole text. */
  readonly rest: string;
}

/**
 * `text` cut after its first sentence and each whole one after it while the lede, read without
 * its addresses, stays within `limit` characters (ledeOf's rule, with the links kept). Nothing
 * is cut inside a sentence, and a first sentence over the limit is still the whole lede.
 */
export function splitLede(text: string, limit = LEDE_LIMIT): LedeSplit {
  const [first = '', ...rest] = rawSentencesOf(text);
  let lede = first;
  let taken = 0;
  for (const sentence of rest) {
    const longer = `${lede} ${sentence}`;
    if (plainText(longer).length > limit) break;
    lede = longer;
    taken += 1;
  }
  return { lede, rest: rest.slice(taken).join(' ') };
}

/** The first sentence, whole; '' for no text. */
export const firstSentenceOf = (text: string): string => sentencesOf(text)[0] ?? '';

/**
 * The first sentence and each whole sentence after it while the text stays within `limit`
 * characters. It stops at the first that does not fit, and a first sentence longer than the
 * limit is still kept whole: nothing is ever cut.
 */
export function ledeOf(text: string, limit = LEDE_LIMIT): string {
  const [first = '', ...rest] = sentencesOf(text);
  return rest.reduce<{ readonly text: string; readonly open: boolean }>(
    (lede, sentence) => {
      const longer = `${lede.text} ${sentence}`;
      return lede.open && longer.length <= limit
        ? { text: longer, open: true }
        : { text: lede.text, open: false };
    },
    { text: first, open: true },
  ).text;
}

/** Text as its bare words: no links, case or punctuation. */
const wordsOf = (text: string): string =>
  plainText(text).toLowerCase().replace(NOT_WORD, ' ').trim();

/**
 * The duties worth printing beside the description: in order, without the blank ones and
 * without any the description already states word for word (case, punctuation and raw links
 * aside). A duty that says more, or says it differently, is always kept.
 */
export function dutiesBeyond(description: string, responsibilities: readonly string[]): string[] {
  const stated = ` ${wordsOf(description)} `;
  return responsibilities.filter((duty) => {
    const words = wordsOf(duty);
    return words !== '' && !stated.includes(` ${words} `);
  });
}
