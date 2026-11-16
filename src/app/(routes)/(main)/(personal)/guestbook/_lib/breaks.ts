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
 * @file Where a note may wrap inside a web address, pure and isomorphic. Any guest can post a
 * note, so this holds for any text up to the loader's 280 characters. The rule is the project
 * page's (projects/_components/detail/breakable.tsx):
 * - each word holding an address is one part, drawn as one inline block: it moves whole to the
 *   next line whenever it fits there ('(http://linktr.ee/mikeodnis)' never splits after 'http://'
 *   on a line it would fit on), and wraps only when it is wider than its line;
 * - inside it, a break opportunity (<wbr>) after each dot and slash of the address, so a wide one
 *   wraps there ('webaim.' / 'org/' / 'resources/');
 * - the address's last character is held with the bracket or punctuation that closes it ('r/)',
 *   'Q!'), so a ')' never starts a line alone, and each piece's last character with its dot or
 *   slash ('r.', 'e/'). Only that character (a whole grapheme: an emoji, a flag, a letter with its
 *   accents) and marks up to about 1.2em wide are held, so a held run is a few pixels wide and
 *   never runs past a note; wider marks ('://', '????') are not held;
 * - anything wider than its line still breaks: the page's last-resort break (overflow-wrap) does
 *   it, between any two characters outside the held run.
 *
 * The parts join back to the text exactly: nothing is added, dropped or reordered, so the note
 * still reads, copies and escapes exactly as it was published.
 */

import { letterUnits } from '@/components/console/folio/word-measure';

/** A web address: a scheme or 'www.', or a dotted name followed by a path ('linktr.ee/x'). */
const ADDRESS = /(?:[a-z][a-z\d+.-]*:\/\/|www\.)\S+|[\w-]+(?:\.[\w-]+)+\/\S*/giu;

/** The bracket and punctuation that may close an address ('/)', ').', ','). */
const CLOSING_CHARS = `/)\\]}>.,;:!?'"`;

/**
 * Inside an address: after a dot or a slash, but never between the two of '//', never right
 * before the closing bracket or punctuation that ends it, and never before an accent, a joiner or
 * a skin tone, which belong to the character before them.
 */
const BREAK = new RegExp(
  `(?<=[./])(?![${CLOSING_CHARS}]*$)(?!\\/)(?![\\p{M}\\p{Grapheme_Extend}\\p{Emoji_Modifier}\\u200d\\u0e33\\u0eb3])`,
  'u',
);

/** The closing run at the end of an address's last piece. */
const CLOSING = new RegExp(`[${CLOSING_CHARS}]+$`, 'u');

/**
 * The closing marks held with the last character are at most this wide, in the shared word
 * measure's units (about 1.2em; a ')' or '!' is half a unit, a '/' or '?' one): '))!!', '/)',
 * '?!'. With the widest character (an emoji, 1.22em) the held run stays under 2.4em, so it fits a
 * 140px note even at 200% text. Wider marks ('????') are not held.
 */
const MAX_HELD_UNITS = 2;

/** Space, where a word ends. */
const SPACE = /\s/u;

/** A combining mark, which belongs to the character before it. */
const MARK = /^\p{M}$/u;

/** The characters a reader sees (graphemes), where the runtime can tell them apart. */
const GRAPHEMES =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/** A stretch of an address word, in order. */
export interface NoteRun {
  readonly text: string;
  /** The note may wrap just before this run (rendered as a <wbr>). */
  readonly breakBefore: boolean;
  /** A piece's last character with its closing marks: never broken inside (white-space: nowrap). */
  readonly held: boolean;
}

/** A stretch of a note: plain text, or a word holding a web address, as its runs. */
export type NotePart = string | readonly NoteRun[];

/**
 * Where the character that ends at `end` starts: its whole grapheme, or, where graphemes cannot
 * be told apart, its code point with the marks after it. A surrogate pair is never split.
 */
function charStart(text: string, end: number): number {
  if (GRAPHEMES) {
    return GRAPHEMES.segment(text.slice(0, end)).containing(end - 1)?.index ?? end - 1;
  }
  const points = Array.from(text.slice(0, end));
  let start = end;
  for (let point = points.pop(); point !== undefined; point = points.pop()) {
    start -= point.length;
    if (!MARK.test(point)) break;
  }
  return start;
}

/** How wide closing marks are, in word-measure units. */
const unitsOf = (marks: string): number =>
  Array.from(marks).reduce((sum, mark) => sum + letterUnits(mark), 0);

/**
 * Where the held run of an address's piece starts: its last character, before the marks that
 * close the piece. -1 when no mark closes it (nothing to strand) or the marks are wider than
 * MAX_HELD_UNITS ('://': holding them could make a run wider than a note).
 */
function heldStart(piece: string): number {
  const closing = CLOSING.exec(piece);
  if (!closing || closing.index === 0 || unitsOf(closing[0]) > MAX_HELD_UNITS) return -1;
  return charStart(piece, closing.index);
}

/** Collects runs: plain text, a break opportunity, or a held run. */
function runCollector() {
  const runs: NoteRun[] = [];
  let text = '';
  let breakBefore = false;
  const flush = (): void => {
    if (text === '') return;
    runs.push({ text, breakBefore, held: false });
    text = '';
    breakBefore = false;
  };
  return {
    add(more: string): void {
      text += more;
    },
    /** A break opportunity here. */
    cut(): void {
      flush();
      breakBefore = true;
    },
    hold(held: string): void {
      flush();
      runs.push({ text: held, breakBefore, held: true });
      breakBefore = false;
    },
    done(): NoteRun[] {
      flush();
      return runs;
    },
  };
}

/**
 * One word holding an address: what leads it in the word ('(' or 'LinkTree:'), then the address
 * cut after its dots and slashes. Each piece's last character is held with the marks that close
 * it (the dot or slash before a cut, the bracket after the address), so even a piece wider than
 * its line never puts a mark at the start of one ('averyverylongnam' / 'e/', not '/').
 */
function addressRuns(lead: string, address: string): NoteRun[] {
  const collect = runCollector();
  collect.add(lead);
  const pieces = address.split(BREAK).filter((piece) => piece !== '');
  pieces.forEach((piece, index) => {
    if (index > 0) collect.cut();
    const start = heldStart(piece);
    if (start < 0) {
      collect.add(piece);
      return;
    }
    collect.add(piece.slice(0, start));
    collect.hold(piece.slice(start));
  });
  return collect.done();
}

/** Where the word holding `index` starts: just after the space before it, never before `from`. */
function wordStart(text: string, index: number, from: number): number {
  let start = index;
  while (start > from && !SPACE.test(text.charAt(start - 1))) start -= 1;
  return start;
}

/**
 * The note as parts: plain text (a string), and each word holding an address as its runs. Render
 * a word as one inline block, with a <wbr> before each run that may wrap there and a held run
 * unbreakable. Text without an address comes back as one string. An address always runs to the
 * end of its word, so a word is never split between two parts.
 *
 * @example
 * noteParts('see (linktr.ee/mikeodnis)')
 * // ['see ', [{ text: '(linkt' }, { text: 'r.', held: true },
 * //  { text: 'e', breakBefore: true }, { text: 'e/', held: true },
 * //  { text: 'mikeodni', breakBefore: true }, { text: 's)', held: true }]]
 */
export function noteParts(text: string): NotePart[] {
  const parts: NotePart[] = [];
  let last = 0;
  for (const match of text.matchAll(ADDRESS)) {
    const start = wordStart(text, match.index, last);
    if (start > last) parts.push(text.slice(last, start));
    parts.push(addressRuns(text.slice(start, match.index), match[0]));
    last = match.index + match[0].length;
  }
  if (last < text.length || parts.length === 0) parts.push(text.slice(last));
  return parts;
}
