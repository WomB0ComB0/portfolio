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
 * @file The trailing trims on /media by a loop (trimEnd) instead of a '[…]+$' pattern, which
 * re-scans a long run from each of its starts (review F7, round ten): a series' name inside a
 * sentence (inSentence), a grouping key (partKey) and a base title's separators. Each gives what
 * its pattern gave; SPACES holds exactly what the patterns' `\s` matched.
 */

import { describe, expect, it } from 'vitest';
import { inSentence } from '@/app/(routes)/(dev)/media/_components/feed-sections';
import { foldParts, partKey, SPACES } from '@/app/(routes)/(dev)/media/_lib/media-parts';

/** The pattern inSentence used before. */
const OLD_IN_SENTENCE = /[\s.!?…]+$/;

/** Characters that cannot be seen in source, by code point. */
const NO_BREAK_SPACE = String.fromCharCode(0xa0);
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const IDEOGRAPHIC_SPACE = String.fromCharCode(0x3000);
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** A small seeded generator (mulberry32), so every run checks the same strings. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

describe('SPACES', () => {
  it("holds exactly the code units a pattern's \\s matches", () => {
    const matched = Array.from({ length: 0x1_0000 }, (_, code) => String.fromCharCode(code)).filter(
      (unit) => /\s/.test(unit),
    );

    expect([...SPACES].sort()).toEqual(matched.sort());
  });
});

describe('inSentence', () => {
  it.each([
    [
      'Coding, building, learning, and growing marathon.',
      'Coding, building, learning, and growing marathon',
    ],
    ['What now?! ', 'What now'],
    [`Mr. Robot… ${IDEOGRAPHIC_SPACE}`, 'Mr. Robot'],
    ['Web 3.0', 'Web 3.0'],
    ['...', ''],
  ])('writes %j as %j', (name, words) => {
    expect(inSentence(name)).toBe(words);
  });

  it('gives what its pattern gave, on 20,000 seeded strings', () => {
    const random = seeded(1_114);
    const pool = [...SPACES, '.', '!', '?', '…', ':', 'a', 'Z', '0', 'é', ZERO_WIDTH_SPACE];
    const differ: string[] = [];
    for (let run = 0; run < 20_000; run += 1) {
      const length = Math.floor(random() * 16);
      const name = Array.from(
        { length },
        () => pool[Math.floor(random() * pool.length)] ?? '',
      ).join('');
      if (inSentence(name) !== name.replace(OLD_IN_SENTENCE, '')) differ.push(JSON.stringify(name));
    }

    expect(differ.slice(0, 5)).toEqual([]);
  });
});

describe('the grouping key and the base title', () => {
  /** The title a row folding two uploads of `title` shows: the base title. */
  const baseOf = (title: string): string =>
    foldParts(
      [
        { id: 'b', title, time: 2, year: '2025' },
        { id: 'a', title, time: 1, year: '2025' },
      ],
      () => true,
    )[0]?.title ?? '';

  it.each([
    [`Show:${IDEOGRAPHIC_SPACE}Part 3 -–— `, 'show', 'Show'],
    ['Q&A, Pt. 2 |', 'q&a', 'Q&A'],
    [`Live!${NO_BREAK_SPACE}${NO_BREAK_SPACE}`, 'live', `Live!${NO_BREAK_SPACE}${NO_BREAK_SPACE}`],
  ])('reads %j as the key %j and the base %j, as before', (title, key, base) => {
    expect(partKey(title)).toBe(key);
    expect(baseOf(title)).toBe(base);
  });

  it('drops a closing full stop with the marker it follows, after white space', () => {
    const title = `Mix (2/3)${BYTE_ORDER_MARK}.`;
    expect(partKey(title)).toBe('mix');
    expect(baseOf(title)).toBe('Mix');
  });
});
