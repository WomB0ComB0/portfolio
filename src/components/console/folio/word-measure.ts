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
 * @file How wide a word is in "units" (one unit is an average Geist 600 lowercase letter), so a
 * display word can be sized to fit its box in CSS without measuring it in the browser. The
 * folio-numeral and type-cover utilities (globals.css) divide the box's width by units x 0.6em.
 *
 * Measured in Geist 600 at 100px in the lab (2026-11-15): a unit is 0.51 to 0.54em at -0.06em
 * tracking and at most 0.56em at -0.04em ('Enterprise' 8.2 units, 4.33em; 'WaffleHacks' 10.2
 * units, 5.49em). Tabular figures are 0.565em each ('2026', 2.26em), so a figure counts 1.05.
 * At 0.6em a unit the estimate is 7 to 11% wider than the word, so it never overflows.
 */

/** Letters about half as wide as most ('i' 0.22em, 't' 0.36em against 'e' 0.55em). */
const NARROW_LETTER = /[fijlrtI.,:;'’()!|-]/u;
/** Letters about half as wide again ('m' 0.84em, 'W' 0.96em). */
const WIDE_LETTER = /[mwMW]/u;
/** Figures: tabular, each the same width. */
const FIGURE = /\p{Nd}/u;
/** Other capitals, about a fifth wider than most letters. */
const CAPITAL = /\p{Lu}/u;

/** The em width CSS multiplies a unit by. Kept here so the docs and the tests agree with CSS. */
export const EM_PER_UNIT = 0.6;

/** The smallest width a word is given, so a one-letter word is never set enormous. */
const MIN_UNITS = 2;

/** One letter's width in units. */
export function letterUnits(letter: string): number {
  if (NARROW_LETTER.test(letter)) return 0.5;
  if (WIDE_LETTER.test(letter)) return 1.5;
  if (FIGURE.test(letter)) return 1.05;
  return CAPITAL.test(letter) ? 1.2 : 1;
}

/** One word's width in units, rounded to a tenth, never under two. */
export function wordUnits(word: string): number {
  const units = Array.from(word.trim()).reduce((sum, letter) => sum + letterUnits(letter), 0);
  return Math.max(MIN_UNITS, Math.round(units * 10) / 10);
}

// Keep nonbreaking spaces and the word-joining BOM inside the run CSS must fit.
const WRAPPING_SPACES = /[^\S\u00a0\u2007\u202f\ufeff]+/u;

/**
 * The widest word of a text that may wrap at its spaces: the width a line must hold so no word
 * ever breaks inside itself.
 */
export function widestWordUnits(text: string): number {
  const words = text.split(WRAPPING_SPACES).filter((word) => word.length > 0);
  return words.reduce((widest, word) => Math.max(widest, wordUnits(word)), MIN_UNITS);
}

/** A space between words, in units: Geist's is about 0.25em, so 0.5 units leaves room to spare. */
const SPACE_UNITS = 0.5;

const wordsOf = (text: string): string[] =>
  text.split(WRAPPING_SPACES).filter((word) => word.length > 0);

/**
 * A phrase's width on one line: its words and the spaces between them, never under two units.
 * For a display line that never wraps, such as a type cover's two-word name ('Data Pipeline').
 */
export function phraseUnits(text: string): number {
  const words = wordsOf(text);
  const units = words.reduce((sum, word) => sum + wordUnits(word), 0);
  const spaces = Math.max(0, words.length - 1) * SPACE_UNITS;
  return Math.max(MIN_UNITS, Math.round((units + spaces) * 10) / 10);
}

/**
 * The width a box must hold for a text to fit on two lines: the longer line of its most even
 * split at a space. A box that wide wraps it onto two lines at most, as a browser wraps greedily
 * and greedy wrapping never needs more lines than any other split ('Segmentation &' /
 * 'Classification').
 */
export function twoLineUnits(text: string): number {
  const words = wordsOf(text);
  if (words.length < 2) return widestWordUnits(text);
  let best = phraseUnits(text);
  for (let split = 1; split < words.length; split += 1) {
    const first = phraseUnits(words.slice(0, split).join(' '));
    const second = phraseUnits(words.slice(split).join(' '));
    best = Math.min(best, Math.max(first, second));
  }
  return best;
}
