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
 * @file How many Kind chips /projects can show, pure and server-safe. The most used kinds get a
 * chip of their own while every chip, All and Other included, fits the bar's one line where the
 * bar is widest (from a 1280px window), whatever the kinds are called; the rest fold under Other.
 * Below that width the row scrolls sideways (the FilterBar kit's `scroll` layout).
 *
 * A chip's width is estimated from its words on the safe side, never under the real chip: the
 * label is counted by grapheme (what a reader sees as one character: Intl.Segmenter), and each
 * grapheme as the widest glyph of its class in the chip's type (tile-label: 13px Geist 500, other
 * scripts in the browser's fallback fonts), measured in Linux Chromium with font hinting on and
 * off (off stands in for macOS and Windows), plus up to half a pixel. ASCII, basic Greek and
 * basic Cyrillic are classed letter by letter; a Latin letter with accents counts as its letter;
 * an emoji (a flag, a keycap, a family joined into one) counts once; every other script has its
 * own width, and a few glyphs far wider than their script have their own (EXTRA_WIDE). Shaping
 * makes Arabic and Devanagari words narrower than their letters, so those stay generous.
 *
 * Only the server runs it, and only the server imports it: project-filters.ts builds the page's
 * lookups with it, and the filter island imports the schema from project-schema.ts, so these
 * tables and the segmenter never reach the browser (tests/unit/projects/island-imports.test.ts).
 * The island receives the kinds it chose as data, so server and client can never disagree.
 */

/** Never more kind chips than this, however short their names. */
export const MAX_KIND_CHIPS = 5;
/** The gap between two chips (gap-1.5). */
export const CHIP_GAP_PX = 6;
/**
 * The row's inside width where the bar is widest (a conservative budget from a 1280px window,
 * less 24px for the Technology button growing by a two-digit count beside it, less the row's 4px
 * padding each end). With FilterBar controls aligned flush on the page axis, the row has even
 * more room than this conservative cap.
 */
export const KIND_ROW_PX = 767;
/** A chip's frame: 12px padding and a 1px border each side, and the 6px gap before its count. */
const CHIP_FRAME_PX = 32;
/** One digit of the count (tabular figures: 9px each). */
const DIGIT_PX = 9.5;
/** The last printable ASCII code point (~). */
const LAST_ASCII = 0x7e;

/** Glyphs at most 5.44px wide ('1', '/' and '\' draw 6px with hinting, so they are not here). */
const NARROW = new Set(' !"\'(),.:;I[]`fijlrt{|');
const NARROW_PX = 5.5;
/**
 * Glyphs wider than 9.45px, up to 13.6px: in ASCII W, @ and their like (N is 9.69 without
 * hinting), and the widest letters of basic Greek and basic Cyrillic (Ш, 13.59, the widest).
 */
const WIDE = new Set(
  `%@GMNOQWmw${'ͶΆΈΉΌΎΏΗΘΜΝΟΠΦΨΩφψωώϓϕϖϘϢϣϬϴϺϻ'}${'ЂЉЊЋЍЏДЖИЙМНОПФЦШЩЫЮжмфшщыюљњ'}`,
);
const WIDE_PX = 14;
/** Every other ASCII glyph, basic Greek or basic Cyrillic letter: at most 9.45px. */
const REGULAR_PX = 9.5;
/** A Latin letter that folds to an ASCII letter and accents: its letter, at least this (Ư 10.55). */
const FOLDED_MIN_PX = 11;
/** An emoji however many code points make it, a flag or a keycap (the keyboard, 19, is widest). */
const EMOJI_PX = 19.5;
/** Any other glyph outside ASCII (Egyptian 26.23, Javanese 26.16, Khmer 25.48 the widest seen). */
const OTHER_PX = 27;

/** A run of code points and the width each of its glyphs counts for: [first, last, px]. */
type Band = readonly [first: number, last: number, px: number];

/** Basic Greek and basic Cyrillic, classed letter by letter as ASCII is. */
const BY_LETTER: readonly Band[] = [
  [0x0370, 0x03ff, REGULAR_PX],
  [0x0400, 0x045f, REGULAR_PX],
];

/** Glyphs far wider than their script's width or OTHER_PX, found by measuring every block. */
const EXTRA_WIDE: readonly Band[] = [
  [0x060e, 0x060e, 21.5], // Arabic poetic verse sign (21)
  [0x06de, 0x06de, 23.5], // Arabic start of rub el hizb (23)
  [0x0b94, 0x0b94, 27.5], // Tamil letter AU (27)
  [0x0bf0, 0x0bfa, 29.5], // Tamil numbers and signs (29)
  [0x0d78, 0x0d78, 29], // Malayalam fraction one sixteenth (28.33)
  [0x102a, 0x102a, 32.5], // Myanmar letter AU (32)
  [0x1b7d, 0x1b7e, 43.5], // Balinese musical signs (43)
  [0x2e3a, 0x2e3b, 37.5], // two- and three-em dashes (25, 36.92)
  [0xfdfa, 0xfdfa, 34.5], // Arabic ligature sallallahou alayhe wasallam (34)
  [0xfdfd, 0xfdfd, 60.5], // Arabic ligature bismillah (60.06)
  [0xfc00, 0xfdff, 32.5], // the other Arabic ligatures (32)
  [0x12000, 0x1254f, 61], // cuneiform (60.28)
];

/** Each script's widest glyph, on the safe side; the first band that holds a code point wins. */
const SCRIPTS: readonly Band[] = [
  [0x00a0, 0x00ff, 13.5], // Latin-1 that folds to no ASCII letter (Æ 13)
  [0x0100, 0x017f, 15], // Latin Extended-A (Œ 14.3)
  [0x0180, 0x02af, 17.5], // Latin Extended-B and IPA (Ǆ 16.88)
  [0x0460, 0x052f, 19.5], // historic and supplementary Cyrillic (Ԫ 18.73)
  [0x0530, 0x058f, 13.5], // Armenian (13)
  [0x0590, 0x05ff, 10], // Hebrew (9.5)
  [0x0620, 0x064a, 16.5], // the Arabic letters (س 16)
  [0x0600, 0x06ff, 19], // the rest of Arabic (۩ 18.5)
  [0x0750, 0x077f, 19], // Arabic Supplement (18.33)
  [0x0870, 0x08ff, 19], // Arabic Extended (16.14)
  [0x0900, 0x097f, 14], // Devanagari (13.31)
  [0x0980, 0x09ff, 15.5], // Bengali (15.08)
  [0x0b80, 0x0bff, 21.5], // Tamil, but for AU and the signs above (21)
  [0x0e00, 0x0eff, 14], // Thai and Lao (13.38)
  [0x10a0, 0x10ff, 15.5], // Georgian (14)
  [0x1100, 0x11ff, 13.5], // Hangul Jamo (12)
  [0x1c80, 0x1c8f, 19.5], // Cyrillic Extended-C
  [0x1c90, 0x1cbf, 15.5], // Georgian Extended (15)
  [0x1e00, 0x1eff, 11], // Latin Extended Additional that folds to no ASCII letter (10.33)
  [0x1f00, 0x1fff, 15.5], // Greek Extended (15.03)
  [0x2c60, 0x2c7f, 13.5], // Latin Extended-C (12.81)
  [0x2e80, 0x9fff, 13.5], // CJK, kana and Bopomofo (13.08)
  [0xa640, 0xa69f, 19.5], // Cyrillic Extended-B (17.4)
  [0xa720, 0xa7ff, 18], // Latin Extended-D (Ꝏ 17.39)
  [0xa8e0, 0xa8ff, 14], // Devanagari Extended
  [0xa960, 0xa97f, 13.5], // Hangul Jamo Extended-A
  [0xab30, 0xab6f, 13.5], // Latin Extended-E (12.94)
  [0xac00, 0xd7ff, 13.5], // Hangul (12)
  [0xf900, 0xfaff, 13.5], // CJK compatibility ideographs (13.02)
  [0xfb1d, 0xfb4f, 10], // Hebrew presentation forms (9.5)
  [0xfb50, 0xfbff, 19], // Arabic presentation forms, letters (17)
  [0xfe30, 0xfe4f, 13.5], // CJK compatibility forms (13.02)
  [0xfe70, 0xfeff, 19], // Arabic presentation forms B (17)
  [0xff00, 0xffef, 13.5], // fullwidth forms (13.02)
  [0x1b000, 0x1b16f, 13.5], // kana supplement (13.02)
  [0x20000, 0x3ffff, 13.5], // CJK extensions (13.02)
];

/** An emoji grapheme: a pictograph, a flag's letters or a keycap. */
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;
/** Marks drawn on another glyph and invisible format characters: no width of their own. */
const ZERO_WIDTH = /^[\p{Mn}\p{Me}\p{Cf}]$/u;
/** Accents only (after a letter, in decomposed form). */
const ONLY_MARKS = /^[\p{Mn}\p{Me}]+$/u;

/** Splits text into graphemes; every current browser and Node has it. */
const GRAPHEMES =
  typeof Intl === 'object' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('en', { granularity: 'grapheme' })
    : null;

/** A kind and how many times the projects use it. */
export interface KindUse {
  readonly label: string;
  readonly uses: number;
}

/** The band holding a code point, if any. */
const bandOf = (codePoint: number, bands: readonly Band[]): Band | undefined =>
  bands.find(([first, last]) => codePoint >= first && codePoint <= last);

/** An ASCII glyph, or a basic Greek or Cyrillic letter, by its class. */
function letterPx(glyph: string): number {
  if (NARROW.has(glyph)) return NARROW_PX;
  return WIDE.has(glyph) ? WIDE_PX : REGULAR_PX;
}

/** One code point of a grapheme that is neither an emoji nor an accented Latin letter. */
function codePointPx(glyph: string): number {
  const codePoint = glyph.codePointAt(0) ?? 0;
  if (codePoint <= LAST_ASCII) return letterPx(glyph);
  if (ZERO_WIDTH.test(glyph)) return 0;
  if (bandOf(codePoint, BY_LETTER)) return letterPx(glyph);
  return (bandOf(codePoint, EXTRA_WIDE) ?? bandOf(codePoint, SCRIPTS))?.[2] ?? OTHER_PX;
}

/**
 * One grapheme, on the safe side: an emoji once; a Latin letter with accents as its letter (at
 * least FOLDED_MIN_PX, as some accented capitals draw wider); else each code point that takes
 * room (a conjunct's letters, a vowel sign beside its letter), so no shaping can outgrow it.
 */
function graphemePx(grapheme: string): number {
  if (EMOJI.test(grapheme)) return EMOJI_PX;
  const folded = grapheme.normalize('NFD');
  const base = folded.codePointAt(0) ?? 0;
  const accents = folded.slice(1);
  if (base > 0x20 && base <= LAST_ASCII && accents !== '' && ONLY_MARKS.test(accents)) {
    return Math.max(letterPx(folded.charAt(0)), FOLDED_MIN_PX);
  }
  let px = 0;
  for (const glyph of grapheme) px += codePointPx(glyph);
  return px;
}

/** A label's graphemes, composed first, so a decomposed accent counts as its precomposed letter. */
function graphemesOf(label: string): readonly string[] {
  const text = label.normalize('NFC');
  return GRAPHEMES ? Array.from(GRAPHEMES.segment(text), ({ segment }) => segment) : [...text];
}

/** A chip's width on the safe side: its frame, its label and its count's digits. */
export function chipPx(label: string, count: number): number {
  const words = graphemesOf(label).reduce((sum, grapheme) => sum + graphemePx(grapheme), 0);
  return CHIP_FRAME_PX + words + String(Math.max(0, Math.trunc(count))).length * DIGIT_PX;
}

/**
 * Whether All, these kinds and (with `other`) the Other chip fit the row. All and Other count at
 * `total` projects, the most either can show; a kind at its uses, the most its chip can show.
 */
function rowFits(kinds: readonly KindUse[], total: number, other: boolean): boolean {
  const chips = [
    chipPx('All', total),
    ...kinds.map(({ label, uses }) => chipPx(label, uses)),
    ...(other ? [chipPx('Other', total)] : []),
  ];
  const width = chips.reduce((sum, px) => sum + px, 0) + (chips.length - 1) * CHIP_GAP_PX;
  return width <= KIND_ROW_PX;
}

/**
 * How many of `kinds` (most used first) get a chip: every one when they all fit beside All
 * alone, so no Other is needed (unless `otherAnyway`: a kind is folded whatever happens); else
 * the most used that fit beside All and Other, up to MAX_KIND_CHIPS, stopping at the first that
 * does not, so the chips stay the most used.
 */
export function kindChipCount(
  kinds: readonly KindUse[],
  total: number,
  otherAnyway = false,
): number {
  if (!otherAnyway && kinds.length <= MAX_KIND_CHIPS && rowFits(kinds, total, false)) {
    return kinds.length;
  }
  const most = Math.min(kinds.length, MAX_KIND_CHIPS);
  const over = Array.from({ length: most }, (_, index) => index + 1).find(
    (count) => !rowFits(kinds.slice(0, count), total, true),
  );
  return over === undefined ? most : over - 1;
}
