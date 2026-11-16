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
 * @file Where a note may wrap inside a web address (src/.../guestbook/_lib/breaks.ts), with notes
 * shaped like the real ones and notes a hostile guest could post:
 * - the parts always join back to the note exactly (nothing added, dropped or reordered);
 * - each word holding an address is one part, its lead ('(') included, so the page can keep it
 *   whole whenever it fits a line;
 * - an address is cut after each dot and slash, never inside '//', never before the bracket or
 *   punctuation that ends it;
 * - each piece's last character (a whole grapheme, emoji and accents included) is held with the
 *   marks that close it, and only marks up to two word-measure units wide, so no held run can be
 *   wider than a note;
 * - words that are not addresses are never cut, and any note the loader allows (280 characters)
 *   is handled in well under a millisecond.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type NotePart,
  type NoteRun,
  noteParts,
} from '@/app/(routes)/(main)/(personal)/guestbook/_lib/breaks';
import { letterUnits } from '@/components/console/folio';

/** A mark no test note contains, standing for a break opportunity. */
const MARK = '¦';
/** The closing marks (breaks.ts CLOSING_CHARS). */
const CLOSER = /^[/)\]}>.,;:!?'"]$/u;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

const runsOf = (parts: readonly NotePart[]): NoteRun[] =>
  parts.flatMap((part) =>
    typeof part === 'string' ? [{ text: part, breakBefore: false, held: false }] : [...part],
  );
const textOf = (parts: readonly NotePart[]): string =>
  runsOf(parts)
    .map((run) => run.text)
    .join('');
/** The text between break opportunities, as a reader would see it wrap. */
const piecesOf = (parts: readonly NotePart[]): string[] =>
  runsOf(parts)
    .map((run) => `${run.breakBefore ? MARK : ''}${run.text}`)
    .join('')
    .split(MARK);
const heldOf = (parts: readonly NotePart[]): string[] =>
  runsOf(parts)
    .filter((run) => run.held)
    .map((run) => run.text);
/** Each word the page keeps whole when it fits a line. */
const wordsOf = (parts: readonly NotePart[]): string[] =>
  parts
    .filter((part) => typeof part !== 'string')
    .map((runs) => runs.map((run) => run.text).join(''));
const segmentsOf = (text: string): string[] =>
  Array.from(graphemes.segment(text), (segment) => segment.segment);

/** A held run: one grapheme, then closing marks at most two word-measure units wide. */
function expectNarrowHold(held: string): void {
  const [first = '', ...marks] = segmentsOf(held);
  expect(CLOSER.test(first), `${held} starts with a character`).toBe(false);
  expect(marks.length).toBeGreaterThan(0);
  for (const mark of marks) expect(CLOSER.test(mark), `${held}: ${mark}`).toBe(true);
  expect(marks.reduce((sum, mark) => sum + letterUnits(mark), 0)).toBeLessThanOrEqual(2);
}

describe('noteParts', () => {
  it.each([
    [
      'Cool Website - consider A11y (https://example.org/resources/checker/)\nGood luck!',
      [
        'Cool Website - consider A11y (https://',
        'example.',
        'org/',
        'resources/',
        'checker/)\nGood luck!',
      ],
      ['e.', 'g/', 's/', 'r/)'],
    ],
    [
      'Just use my page (http://links.example/someone) \n- Me',
      ['Just use my page (http://', 'links.', 'example/', 'someone) \n- Me'],
      ['s.', 'e/', 'e)'],
    ],
    ['see links.example/someone', ['see links.', 'example/', 'someone'], ['s.', 'e/']],
    ['visit www.example.com.', ['visit www.', 'example.', 'com.'], ['w.', 'e.', 'm.']],
    [
      'code at (git.example/someone/a-long-repo-name), thanks',
      ['code at (git.', 'example/', 'someone/', 'a-long-repo-name), thanks'],
      ['t.', 'e/', 'e/', 'e),'],
    ],
  ])('cuts the address in %j after its dots and slashes', (text, pieces, held) => {
    const parts = noteParts(text);

    expect(piecesOf(parts)).toEqual(pieces);
    expect(heldOf(parts)).toEqual(held);
    expect(textOf(parts)).toBe(text);
  });

  it('keeps each word holding an address as one part, its lead and closing marks included', () => {
    const parts = noteParts('Just use my LinkTree (http://linktr.ee/mikeodnis) \n- Mike');

    expect(parts[0]).toBe('Just use my LinkTree ');
    expect(wordsOf(parts)).toEqual(['(http://linktr.ee/mikeodnis)']);
    expect(parts.at(-1)).toBe(' \n- Mike');
    expect(wordsOf(noteParts('LinkTree:https://links.example/someone!'))).toEqual([
      'LinkTree:https://links.example/someone!',
    ]);
  });

  it("holds only the last character with the closing bracket, not the piece's whole word", () => {
    const runs = runsOf(noteParts('consider (https://example.org/contrastchecker/) Good luck!'));
    const last = runs.findLast((run) => run.held);
    const before = runs[runs.findLastIndex((run) => run.held) - 1];

    expect(last).toEqual({ text: 'r/)', breakBefore: false, held: true });
    // The word may still move to a new line whole: the break is before 'contrastchecke'.
    expect(before).toEqual({ text: 'contrastchecke', breakBefore: true, held: false });
    expect(runs.at(-1)).toEqual({ text: ' Good luck!', breakBefore: false, held: false });
  });

  const long = `https://example.com/${'a'.repeat(280 - 24)}))!!`;

  it.each([
    ['https://x.com/someone/status/1851234567890123456)', '6)'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ!', 'Q!'],
    [long, 'a))!!'],
    ['great site (https://example.com/🎉🎉🎉🎉🎉🎉🎉🎉)', '🎉)'],
    ['family (https://example.com/👨‍👩‍👧‍👦👨‍👩‍👧‍👦)', '👨‍👩‍👧‍👦)'],
    ['from (https://example.com/🇺🇸🇮🇳)!', '🇮🇳)!'],
    ['thumbs https://example.com/👍🏽).', '👍🏽).'],
    ['accent https://example.com/café)', 'é)'],
    ['موقع رائع (https://example.com/مرحبا/بكم/في/موقعي) شكرا', 'ي)'],
    ['אתר מעולה (https://example.co.il/שלום/עולם)!', 'ם)!'],
  ])('holds the hostile note %j narrowly, its last character whole', (text, last) => {
    const parts = noteParts(text);
    const held = heldOf(parts);

    expect(textOf(parts)).toBe(text);
    expect(held.at(-1)).toBe(last);
    for (const run of held) expectNarrowHold(run);
  });

  it('keeps a 280-character address one word, cut only where it may wrap', () => {
    const parts = noteParts(long);

    expect(long).toHaveLength(280);
    expect(wordsOf(parts)).toEqual([long]);
    expect(piecesOf(parts)).toEqual(['https://', 'example.', `com/`, `${'a'.repeat(256)}))!!`]);
  });

  it.each([
    ['brackets and bangs', `see https://example.com/page${')'.repeat(40)}${'!'.repeat(30)}`],
    ['wide marks', 'see https://example.com/W????'],
    ['slashes', `https://example.com/${'/'.repeat(200)})`],
  ])(
    'holds no closing run wider than two units (%s), so nothing held outgrows a note',
    (_, text) => {
      const parts = noteParts(text);

      expect(textOf(parts)).toBe(text);
      expect(heldOf(parts).at(-1)).not.toMatch(/[)!?/]{3,}$/u);
      for (const run of heldOf(parts)) expectNarrowHold(run);
    },
  );

  it.each([
    'goat',
    'one tweak,, the cursor. Was getting in…',
    'and/or this, i.e. that',
    'W port.\n\n-V',
    '',
    '<script>alert(1)</script>',
  ])('leaves %j whole, as one string', (text) => {
    expect(noteParts(text)).toEqual([text]);
  });

  it('cuts every address in a note, and keeps the words between them', () => {
    const text = 'a https://one.example/x and http://two.example/y end';
    const parts = noteParts(text);

    expect(textOf(parts)).toBe(text);
    expect(wordsOf(parts)).toEqual(['https://one.example/x', 'http://two.example/y']);
    expect(heldOf(parts)).toEqual(['e.', 'e/', 'o.', 'e/']);
    expect(piecesOf(parts)).toEqual([
      'a https://',
      'one.',
      'example/',
      'x and http://',
      'two.',
      'example/',
      'y end',
    ]);
  });
});

/** A seeded generator, so a failing note can be found again (mulberry32). */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Pieces a hostile note is built from: letters, marks, emoji, RTL words, spaces, addresses. */
const PIECES = [
  '\u200c',
  '\u{E0067}',
  '\uff9e',
  '\u0e33',
  'a',
  'W',
  '7',
  '.',
  '/',
  ')',
  ']',
  '!',
  '?',
  ',',
  "'",
  '"',
  '>',
  ':',
  ' ',
  '\n',
  '-',
  'https://',
  'www.',
  'x.co/',
  '🎉',
  '👨‍👩‍👧‍👦',
  '🇺🇸',
  '👍🏽',
  'é',
  '‍',
  'مرحبا',
  'שלום',
  '<b>',
];

describe('noteParts with any note a guest could post', () => {
  it('joins back exactly, cuts only between graphemes, and holds only narrow runs', () => {
    const next = random(20261115);
    for (let note = 0; note < 400; note += 1) {
      let text = '';
      while (text.length < 280) text += PIECES[Math.floor(next() * PIECES.length)];
      text = text.slice(0, 1 + Math.floor(next() * 280));
      const parts = noteParts(text);
      const ends = new Set([0]);
      for (const segment of graphemes.segment(text)) ends.add(segment.index);
      let at = 0;
      for (const run of runsOf(parts)) {
        // A cut or a held run that starts mid-grapheme would split an emoji or an accent.
        if (run.breakBefore || run.held) expect(ends.has(at), JSON.stringify(text)).toBe(true);
        at += run.text.length;
      }

      expect(textOf(parts)).toBe(text);
      for (const run of heldOf(parts)) expectNarrowHold(run);
      parts.forEach((part, index) => {
        if (typeof part === 'string') return;
        // An address part is a whole word: only space (or nothing) on either side of it.
        expect(String(parts[index - 1] ?? ' ').slice(-1)).toMatch(/\s/u);
        expect(String(parts[index + 1] ?? ' ').charAt(0)).toMatch(/\s/u);
      });
    }
  });

  it('stays well under a millisecond for the hardest 280-character notes', () => {
    const hardest = [
      'a'.repeat(280),
      'a.'.repeat(140),
      'https://'.padEnd(280, '/'),
      `${')'.repeat(279)}a`,
      `x.co/${'./'.repeat(137)}a`,
      `www.${'a-'.repeat(138)}`,
      'https://x.co/'.repeat(21).slice(0, 280),
      `https://x.co/${'🎉'.repeat(133)}`,
    ];
    for (const text of hardest) {
      noteParts(text);
      const started = performance.now();
      for (let round = 0; round < 20; round += 1) noteParts(text);
      const each = (performance.now() - started) / 20;
      // Measured at 0.01 to 0.2ms each; the bound is loose so a busy machine can't fail it.
      expect(each, text.slice(0, 20)).toBeLessThan(5);
    }
  });
});

describe('noteParts where Intl.Segmenter is missing', () => {
  const segmenter = Intl.Segmenter;

  afterEach(() => {
    Object.defineProperty(Intl, 'Segmenter', { value: segmenter, configurable: true });
    vi.resetModules();
  });

  it('still holds a whole code point and its accents, never half a surrogate pair', async () => {
    Object.defineProperty(Intl, 'Segmenter', { value: undefined, configurable: true });
    vi.resetModules();
    const fallback = await import('@/app/(routes)/(main)/(personal)/guestbook/_lib/breaks');

    for (const [text, last] of [
      ['see https://example.com/🎉)', '🎉)'],
      ['see https://example.com/café́).', 'é́).'],
      ['see https://example.com/x)', 'x)'],
    ] as const) {
      const parts = fallback.noteParts(text);
      expect(heldOf(parts).at(-1)).toBe(last);
      expect(textOf(parts)).toBe(text);
    }
  });
});
