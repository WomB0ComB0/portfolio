/**
 * Copyright 2025 Mike Odnis
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
 * @file The guestbook wall's rules (src/.../guestbook/_lib/wall.ts), with synthetic notes:
 * - year chapters keep the server's newest-first order exactly, and an unreadable date stays
 *   where it was listed;
 * - a note's scale follows its length, by characters, not bytes (an emoji is one), and so does
 *   how it sits on the wall: a few words a sticker, a sentence a tile, feedback a quote;
 * - a sticker's planned width is its widest typed line, capped;
 * - the wall always has a first chapter, keyed the same, so the compose tile never remounts;
 *   a post dated after every server year opens its own chapter;
 * - a chapter keeps the size it opened with while it is the same year, so the refresh after a
 *   post never grows the year over the compose box; a chapter that changes year takes its own.
 */

import { describe, expect, it } from 'vitest';

import {
  groupByYear,
  NEWEST_CHAPTER_KEY,
  noteScale,
  noteTreatment,
  planChapters,
  STICKER_MAX_UNITS,
  steadySize,
  stickerUnits,
  yearOf,
} from '@/app/(routes)/(main)/(personal)/guestbook/_lib/wall';
import { wordUnits } from '@/components/console/folio';

const note = (id: string, createdAt: string) => ({ id, createdAt });

describe('yearOf', () => {
  it('reads the UTC year, and null for an unreadable date', () => {
    expect(yearOf('2025-10-27T09:19:00.000Z')).toBe(2025);
    // 23:30 on 31 December in New York is already 2026 in UTC.
    expect(yearOf('2025-12-31T23:30:00-05:00')).toBe(2026);
    expect(yearOf('not a date')).toBeNull();
  });
});

describe('groupByYear', () => {
  it('cuts newest-first notes into years without reordering any', () => {
    const notes = [
      note('a', '2026-11-09T07:19:00.000Z'),
      note('b', '2025-11-18T10:00:00.000Z'),
      note('c', '2025-10-27T09:19:00.000Z'),
      note('d', '2024-03-01T00:00:00.000Z'),
    ];

    const groups = groupByYear(notes);

    expect(groups.map((group) => group.year)).toEqual([2026, 2025, 2024]);
    expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([
      ['a'],
      ['b', 'c'],
      ['d'],
    ]);
    expect(groups.flatMap((group) => group.items)).toEqual(notes);
  });

  it('keeps a note with an unreadable date where it was listed', () => {
    const groups = groupByYear([
      note('top', 'garbled'),
      note('a', '2026-01-02T00:00:00.000Z'),
      note('b', '2025-10-27T09:19:00.000Z'),
      note('middle', ''),
      note('c', '2025-10-01T00:00:00.000Z'),
    ]);

    expect(groups.map((group) => [group.year, group.items.map((item) => item.id)])).toEqual([
      [2026, ['top', 'a']],
      [2025, ['b', 'middle', 'c']],
    ]);
  });

  it('gives one undated chapter when no date can be read, and none for no notes', () => {
    expect(groupByYear([note('a', 'x'), note('b', 'y')])).toEqual([
      { year: null, items: [note('a', 'x'), note('b', 'y')] },
    ]);
    expect(groupByYear([])).toEqual([]);
  });
});

describe('noteScale', () => {
  it.each([
    ['goat', 'word'],
    ['👋', 'word'],
    ['rawr xd', 'word'],
    ['  waddup  ', 'word'],
    ['inspiration!!', 'line'],
    ['Hello, testing 123', 'line'],
    ['btw your twitter leads to a profile that dne', 'note'],
    ['x'.repeat(60), 'note'],
    ['x'.repeat(61), 'body'],
    ['x'.repeat(120), 'body'],
    ['x'.repeat(121), 'long'],
  ])('%j is set as %s', (text, scale) => {
    expect(noteScale(text)).toBe(scale);
  });

  it('counts characters, so a short note of emoji is still short', () => {
    expect(noteScale('😭😭😭😭😭😭😭😭')).toBe('word');
  });
});

describe('planChapters', () => {
  it('keys the first server chapter as the newest and the rest by year', () => {
    expect(planChapters([2026, 2025], null)).toEqual([
      { key: NEWEST_CHAPTER_KEY, year: 2026, server: 0 },
      { key: 'y2025', year: 2025, server: 1 },
    ]);
  });

  it('puts a post from a year the server has into the first chapter', () => {
    expect(planChapters([2026, 2025], 2026).map((plan) => plan.server)).toEqual([0, 1]);
  });

  it('opens the wall with a post dated after every server year', () => {
    expect(planChapters([2025], 2026)).toEqual([
      { key: NEWEST_CHAPTER_KEY, year: 2026, server: null },
      { key: 'y2025', year: 2025, server: 0 },
    ]);
  });

  it('always has a first chapter, for the compose tile', () => {
    expect(planChapters([], null)).toEqual([{ key: NEWEST_CHAPTER_KEY, year: null, server: null }]);
    expect(planChapters([], 2026)).toEqual([{ key: NEWEST_CHAPTER_KEY, year: 2026, server: null }]);
  });

  it('keeps an undated list as one chapter when a post comes in', () => {
    expect(planChapters([null], 2026)).toEqual([
      { key: NEWEST_CHAPTER_KEY, year: null, server: 0 },
    ]);
  });
});

describe('noteTreatment', () => {
  it.each([
    ['goat', 'sticker'],
    ['rawr xd', 'sticker'],
    ['cool project fam!', 'sticker'],
    ['really trippy mouse cursor man', 'tile'],
    ['Ty, and you should have sent me an email at that point', 'tile'],
    ['Love your work. Looking forward for a project collaboration with you!', 'quote'],
    ['x'.repeat(280), 'quote'],
  ])('%j sits on the wall as a %s', (text, treatment) => {
    expect(noteTreatment(noteScale(text))).toBe(treatment);
  });
});

describe('stickerUnits', () => {
  it('measures the whole line, spaces counted, so a sticker is as wide as its words', () => {
    expect(stickerUnits('rawr xd')).toBe(wordUnits('rawr xd'));
    expect(stickerUnits('rawr xd')).toBeGreaterThan(wordUnits('rawr'));
  });

  it('takes the widest typed line, not the lines run together', () => {
    expect(stickerUnits('W port.\n\n-V')).toBe(wordUnits('W port.'));
  });

  it('caps a long line, so it wraps rather than running across the row', () => {
    const wide = 'WOW '.repeat(6).trim();

    expect(wordUnits(wide)).toBeGreaterThan(STICKER_MAX_UNITS);
    expect(stickerUnits(wide)).toBe(STICKER_MAX_UNITS);
  });
});

describe('steadySize', () => {
  it('keeps the size a chapter opened with while it is the same year', () => {
    // 2026 opened with one note (a heading on the rule); the refresh after a post brings two.
    expect(steadySize({ year: 2026, size: 'inline' }, 2026, 'lead')).toBe('inline');
  });

  it('takes the new size once the chapter is another year', () => {
    // A post on New Year's Day opens 2027 in the first chapter's place.
    expect(steadySize({ year: 2026, size: 'lead' }, 2027, 'inline')).toBe('inline');
    // The first post into an empty guestbook turns the untitled chapter into its year.
    expect(steadySize({ year: null, size: 'inline' }, 2026, 'inline')).toBe('inline');
  });
});
