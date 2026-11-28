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
 * @file The Kind row's width budget on /projects: how many of the most used kinds get a chip of
 * their own, so that every chip, All and Other included, shows whole on the bar's one line where
 * the bar is widest, whatever the kinds are called. A chip's estimate must never come out under
 * the real chip, or a chip would be cut again.
 */

import { describe, expect, it } from 'vitest';

import {
  CHIP_GAP_PX,
  chipPx,
  KIND_ROW_PX,
  type KindUse,
  kindChipCount,
  MAX_KIND_CHIPS,
} from '@/app/(routes)/(main)/(professioal)/projects/_lib/kind-chip-budget';

/**
 * [label, count, px]: real chips measured in the /projects row at 1440 (13px Geist 500 on Linux,
 * whose hinting draws the widest glyphs), from a GET of the site on 2026-11-13: that day's top kinds
 * with their counts, the other live kinds and some made-up names of the widest glyphs with a
 * two-digit count, and All and Other with a three-digit one.
 */
const MEASURED: readonly (readonly [string, number, number])[] = [
  ['Web Development', 8, 154],
  ['CLI Tool', 5, 89],
  ['Developer Tools', 4, 142],
  ['AI/ML', 3, 77],
  ['Financial Technology', 3, 168],
  ['Full-Stack', 88, 112],
  ['AI & Browser Automation', 88, 202],
  ['Healthcare Technology', 88, 190],
  ['Media & Entertainment', 88, 189],
  ['Security Technology', 88, 174],
  ['Community Platform', 88, 172],
  ['Monorepo', 88, 112],
  ['Web Scraping', 88, 135],
  ['Web', 88, 78],
  ['Games', 88, 94],
  ['AR/VR', 88, 90],
  ['DevOps', 88, 99],
  ['AI/ML/IOT DEVOPS', 88, 168],
  ['WWWWWWWW', 88, 154],
  ['MMMMMMMM', 88, 138],
  ['mmmmmmmm', 88, 138],
  ['All', 888, 74],
  ['Other', 888, 94],
];

/**
 * [label, count, px]: more real chips, measured the same way on 2026-11-13, each the larger of
 * font hinting on and off (off stands in for macOS and Windows). First names an earlier estimate
 * came in under: '1', '/' and '\' at 6px, the widest Arabic ligatures (U+FDFA, U+FDFD),
 * the two- and three-em dashes, Myanmar, Javanese, Tamil signs, cuneiform, Balinese. Then names in
 * the common scripts, the widest letters of each, and emoji sequences.
 */
const MEASURED_SCRIPTS: readonly (readonly [string, number, number])[] = [
  ['1/1/1/1/1/1', 3, 106],
  ['\\'.repeat(8), 3, 81],
  ['////////', 3, 81.45],
  ['11111111', 3, 81],
  ['NNNNNNNN', 88, 123.77],
  ['ﷺ Faith', 3, 107.13],
  ['﷽', 3, 100.03],
  ['ﷲ', 3, 55],
  ['ۺۻ۞', 3, 90.09],
  ['⸻', 3, 76.92],
  ['⸻⸻', 3, 113.84],
  ['ဿ', 3, 61],
  ['ဪဪ', 3, 104],
  ['꧅꧅', 3, 95],
  ['௵௸', 3, 95],
  ['ஔஔ', 3, 94],
  ['𒐫', 3, 100.25],
  ['𒐫𒈙', 3, 152.59],
  ['᭾᭽', 3, 122],
  ['Разработка игр', 3, 138.2],
  ['Машинное обучение', 3, 174.97],
  ['ШЩЖЮШЩЖЮ', 88, 154.55],
  ['Щщ Шш Жж Юю', 3, 146.31],
  ['Μηχανική μάθηση', 3, 153.77],
  ['ΜΩΨΦΜΩΨΦ', 88, 136.48],
  ['ἯἯᾯ', 3, 84.34],
  ['تطوير الويب', 3, 108],
  ['تعلم الآلة', 3, 88],
  ['سسسسسسسس', 88, 150],
  ['פיתוח אתרים', 3, 111.13],
  ['שששששששש', 88, 125.92],
  ['हिन्दी विकास', 3, 100.42],
  ['मशीन लर्निंग', 3, 97.05],
  ['क्षत्रिय', 3, 67.38],
  ['आऑओऔआऑओऔ', 88, 154.3],
  ['機械学習', 3, 92],
  ['ウェブ開発', 3, 105],
  ['웹 개발', 3, 79.02],
  ['机器学习与人工智能', 88, 167],
  ['🚀', 3, 56.2],
  ['👨‍👩‍👧‍👦 Family', 3, 99.27],
  ['🇺🇸🇯🇵🇩🇪', 3, 88.64],
  ['⌨️ Tools', 3, 93],
  ['1️⃣ First', 3, 86.8],
  ['👩🏽‍💻 Dev', 3, 83.05],
  ['Développement Web', 3, 169],
  ['Ǆǅǆ ŒŒ', 3, 118.52],
  ['ĤŨŪŬŮŰŲ', 88, 117.3],
  ['Ư', 3, 50.55],
  ['Łódź', 3, 69.17],
  ['Việt Nam', 3, 96.27],
  ['Ꝏꝏ', 3, 70.52],
  ['Über Ư', 3, 83.55],
  ['การพัฒนาเว็บ', 3, 111.38],
  ['Վեբ մշակում', 3, 127.16],
  ['ვებ განვითარება', 3, 148],
  ['இணைய மேம்பாடு', 3, 169.91],
  ['ക്ഷ്മ', 3, 71.42],
  ['ওয়েব উন্নয়ন', 3, 106],
];

/**
 * Names in Cyrillic, Greek, Hebrew, CJK, accented Latin and with emoji (from MEASURED_SCRIPTS):
 * counted by grapheme with each script's own widths, none comes out near twice its real chip,
 * which would fold such a kind under Other early.
 */
const NOT_TWICE: readonly string[] = [
  'Разработка игр',
  'Машинное обучение',
  'Μηχανική μάθηση',
  'פיתוח אתרים',
  '機械学習',
  'ウェブ開発',
  '웹 개발',
  '👨‍👩‍👧‍👦 Family',
  'Développement Web',
  'Việt Nam',
];
/** How far over its real chip a name in NOT_TWICE may be estimated. */
const NOT_TWICE_RATIO = 1.35;

/** The kinds with a chip at `total` projects: the first `count` of `kinds`. */
const kindsUsed = (kinds: readonly KindUse[], total: number): readonly KindUse[] =>
  kinds.slice(0, kindChipCount(kinds, total));

/**
 * The row the estimates add up to: All, the kinds with a chip and, when a kind is folded, Other,
 * with their gaps.
 */
const estimatedRow = (kinds: readonly KindUse[], total: number): number => {
  const used = kindsUsed(kinds, total);
  const chips = [
    chipPx('All', total),
    ...used.map(({ label, uses }) => chipPx(label, uses)),
    ...(used.length < kinds.length ? [chipPx('Other', total)] : []),
  ];
  return chips.reduce((sum, px) => sum + px, 0) + (chips.length - 1) * CHIP_GAP_PX;
};

/**
 * The kinds before the 2026-11-27 content consolidation (a GET of the site's 32 projects), most
 * used first, ties A to Z.
 */
const BEFORE_CONSOLIDATION: readonly KindUse[] = [
  { label: 'Web Development', uses: 8 },
  { label: 'CLI Tool', uses: 5 },
  { label: 'Developer Tools', uses: 4 },
  { label: 'AI/ML', uses: 3 },
  { label: 'Financial Technology', uses: 3 },
  { label: 'Full-Stack', uses: 3 },
  { label: 'AI & Browser Automation', uses: 2 },
];

const SHORT: readonly KindUse[] = [
  { label: 'Web', uses: 9 },
  { label: 'CLI Tool', uses: 8 },
  { label: 'AI/ML', uses: 7 },
  { label: 'Games', uses: 6 },
  { label: 'Education', uses: 5 },
  { label: 'Robotics', uses: 4 },
];

/**
 * The kinds since the content consolidation (a GET of the site's 33 projects on 2026-11-27), most
 * used first, ties A to Z: six, so before a lone sixth could take Other's place, Platform was
 * folded under an Other chip of its own.
 */
const CONSOLIDATED: readonly KindUse[] = [
  { label: 'Web app', uses: 13 },
  { label: 'Developer tool', uses: 7 },
  { label: 'Website', uses: 7 },
  { label: 'AI/ML', uses: 2 },
  { label: 'Mobile', uses: 2 },
  { label: 'Platform', uses: 2 },
];

describe('chipPx: a chip’s width, on the safe side', () => {
  it.each(MEASURED)('is at least the real chip: %s with %i', (label, count, measured) => {
    expect(chipPx(label, count)).toBeGreaterThanOrEqual(measured);
  });

  it('adds the same width for each digit of the count', () => {
    const digit = chipPx('CLI Tool', 88) - chipPx('CLI Tool', 8);

    expect(digit).toBeGreaterThanOrEqual(9);
    expect(chipPx('CLI Tool', 888) - chipPx('CLI Tool', 88)).toBe(digit);
  });

  it.each(MEASURED_SCRIPTS)(
    'is at least the real chip in any script: %s with %i',
    (label, count, measured) => {
      expect(chipPx(label, count)).toBeGreaterThanOrEqual(measured);
    },
  );

  it.each(['1', '/', '\\'])(
    'counts %s at least as wide as it draws (6.44px), not as narrow',
    (glyph) => {
      expect(chipPx(glyph, 1) - chipPx('', 1)).toBeGreaterThanOrEqual(6.44);
    },
  );

  it.each(NOT_TWICE)('is not near twice the real chip for a common script: %s', (label) => {
    const [, count, measured] = MEASURED_SCRIPTS.find(([name]) => name === label) ?? [label, 0, 0];

    expect(measured).toBeGreaterThan(0);
    expect(chipPx(label, count)).toBeLessThanOrEqual(measured * NOT_TWICE_RATIO);
  });

  it('counts by grapheme: a family emoji as one emoji, a combining accent as nothing more', () => {
    expect(chipPx('👨‍👩‍👧‍👦', 1)).toBe(chipPx('🚀', 1));
    expect(chipPx('Über', 1)).toBe(chipPx('Über', 1));
    expect(chipPx('é', 1)).toBe(chipPx('é', 1));
  });
});

describe('kindChipCount: the most used kinds that fit the widest row', () => {
  it('gave the first four kinds before the consolidation a chip and folded Financial Technology', () => {
    expect(kindsUsed(BEFORE_CONSOLIDATION, 32).map(({ label }) => label)).toEqual([
      'Web Development',
      'CLI Tool',
      'Developer Tools',
      'AI/ML',
    ]);
  });

  it(`gives a lone sixth kind Other's place, never a chip more than All, ${MAX_KIND_CHIPS} kinds and Other`, () => {
    expect(MAX_KIND_CHIPS).toBe(5);
    expect(kindChipCount(SHORT, 39)).toBe(6);
    // Seven short kinds fit beside All alone, but a seventh would make a chip more than All, five
    // kinds and Other, so two fold under Other.
    expect(kindChipCount([...SHORT, { label: 'IoT', uses: 3 }], 42)).toBe(5);
    // Names this short leave room for six kinds beside All and Other, but five is the most.
    const tiny = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((label) => ({ label, uses: 1 }));
    expect(kindChipCount(tiny, 7)).toBe(5);
    // A kind folded whatever happens (one called Other) brings the Other chip, so no sixth.
    expect(kindChipCount(SHORT, 39, true)).toBe(5);
  });

  it('gives each of the six kinds since the consolidation a chip, with no Other', () => {
    expect(kindChipCount(CONSOLIDATED, 33)).toBe(6);
  });

  it('folds a lone sixth kind under Other when its chip does not fit in Other’s place', () => {
    const kinds = [...CONSOLIDATED.slice(0, 5), { label: 'Healthcare Technology', uses: 2 }];

    expect(kindChipCount(kinds, 33)).toBe(5);
  });

  it('gives every kind a chip, with no Other, when they all fit beside All alone', () => {
    const kinds = [
      { label: 'Financial Technology', uses: 4 },
      { label: 'Full-Stack', uses: 4 },
      { label: 'Machine Learning', uses: 4 },
      { label: 'Mobile', uses: 4 },
    ];

    expect(kindChipCount(kinds, 12)).toBe(4);
    // A kind folded whatever happens (one called Other) brings the Other chip, so room for it.
    expect(kindChipCount(kinds, 12, true)).toBe(3);
  });

  it('stops at the first kind that does not fit, so the chips stay the most used', () => {
    const kinds = [
      {
        label:
          'Interdisciplinary Research and Development for Community Platforms and Civic Infrastructure',
        uses: 9,
      },
      { label: 'Web', uses: 3 },
    ];

    expect(kindChipCount(kinds, 12)).toBe(0);
  });

  it.each([
    ['the kinds before the consolidation', BEFORE_CONSOLIDATION, 32],
    ['six short kinds', SHORT, 39],
    ['the kinds before the consolidation at a thousand projects', BEFORE_CONSOLIDATION, 1000],
    ['the six kinds since the consolidation', CONSOLIDATED, 33],
    ['the six kinds since the consolidation at a thousand projects', CONSOLIDATED, 1000],
  ] as const)('keeps the estimated row inside the budget: %s', (_name, kinds, total) => {
    expect(estimatedRow(kinds, total)).toBeLessThanOrEqual(KIND_ROW_PX);
  });

  it('makes room for All’s and Other’s counts at the total’s digits', () => {
    expect(kindChipCount(BEFORE_CONSOLIDATION, 10_000_000)).toBeLessThan(
      kindChipCount(BEFORE_CONSOLIDATION, 32),
    );
  });
});
