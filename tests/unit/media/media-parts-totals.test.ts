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
 * @file A series its titles number never states a total ("of N") that a total written in one of
 * its own titles contradicts (review F3, round ten). The series keeps the total its titles give
 * most often; a title that gives another one, or that numbers past it ("Part 3" or "Part 4/4"
 * beside "Part 1/2" and "Part 2/2"), reads whole. Before, "Recap Part 1/2" could say "Part 1 of 3".
 *
 * Review F1 (round eleven): a full stop that closes a title after its marker no longer hides the
 * total ("Recap Part 2/2." made a series named "Recap /2.", "Recap - Part 2 of 3." one of 2) or
 * stays in the series name ("Recap (Part 2/2)." made "Recap ."), and a "Part 0" reads whole in
 * every series its titles number ("Part 0" beside "Part 5" said "Part 0 of 5").
 */

import { describe, expect, it } from 'vitest';
import {
  type Foldable,
  foldParts,
  markerSpan,
  type SeriesPlace,
  SPACES,
  seriesPlaces,
} from '@/app/(routes)/(dev)/media/_lib/media-parts';

interface Upload extends Foldable {
  readonly kind: 'video';
}

/** An upload on day `day` of March 2025: one kind, one year. */
const upload = (id: string, title: string, day: number): Upload => ({
  id,
  kind: 'video',
  title,
  time: Date.UTC(2025, 2, day),
  year: '2025',
});

const byKind = (each: Upload): string => each.kind;

/** How a row says a place: "Part 1 of 2" or "Upload 3 of 5". */
const placeWords = ({ numbered, part, count }: SeriesPlace): string =>
  `${numbered === 'title' ? 'Part' : 'Upload'} ${part} of ${count}`;

/** Each upload's place as its row says it, by id; '-' where it has none. */
function placesOf(items: readonly Upload[]): Record<string, string> {
  const places = seriesPlaces(items, byKind);
  return Object.fromEntries(
    items.map((each) => {
      const place = places.get(each.id);
      return [each.id, place ? placeWords(place) : '-'];
    }),
  );
}

describe('seriesPlaces: a title that numbers past the total its series keeps', () => {
  it('reads "Part 4/4" and "Part 3" whole beside "Part 2/2" and "Part 1/2"', () => {
    const places = placesOf([
      upload('p4', 'Recap Part 4/4', 4),
      upload('p3', 'Recap Part 3', 3),
      upload('p2', 'Recap Part 2/2', 2),
      upload('p1', 'Recap Part 1/2', 1),
    ]);

    expect(places).toEqual({ p4: '-', p3: '-', p2: 'Part 2 of 2', p1: 'Part 1 of 2' });
  });

  it('reads "Part 3" whole beside "Part 2/2" and "Part 1/2", where every total agrees', () => {
    const places = placesOf([
      upload('p3', 'Recap Part 3', 3),
      upload('p2', 'Recap Part 2/2', 2),
      upload('p1', 'Recap Part 1/2', 1),
    ]);

    expect(places).toEqual({ p3: '-', p2: 'Part 2 of 2', p1: 'Part 1 of 2' });
  });

  it('reads a "Part 0" whole beside parts that give a total', () => {
    const places = placesOf([
      upload('p2', 'Recap Part 2/2', 3),
      upload('p1', 'Recap Part 1/2', 2),
      upload('p0', 'Recap Part 0', 1),
    ]);

    expect(places).toEqual({ p2: 'Part 2 of 2', p1: 'Part 1 of 2', p0: '-' });
  });

  it('keeps a title with no total that numbers within the total', () => {
    const places = placesOf([upload('p2', 'Recap Part 2', 2), upload('p1', 'Recap Part 1/3', 1)]);

    expect(places).toEqual({ p2: 'Part 2 of 3', p1: 'Part 1 of 3' });
  });

  it('folds the parts that agree into one row and leaves the others their own rows', () => {
    const rows = foldParts(
      [
        upload('p4', 'Recap Part 4/4', 4),
        upload('p3', 'Recap Part 3', 3),
        upload('p2', 'Recap Part 2/2', 2),
        upload('p1', 'Recap Part 1/2', 1),
      ],
      () => true,
    );

    expect(rows.map((row) => [row.title, row.parts.map((part) => part.id)])).toEqual([
      ['Recap Part 4/4', ['p4']],
      ['Recap Part 3', ['p3']],
      ['Recap', ['p1', 'p2']],
    ]);
  });
});

/** The series name each upload's place gives, by id; '-' where it has none. */
function namesOf(items: readonly Upload[]): Record<string, string> {
  const places = seriesPlaces(items, byKind);
  return Object.fromEntries(items.map((each) => [each.id, places.get(each.id)?.name ?? '-']));
}

/** The marker's own words in `title`, or null when it carries none. */
function markerWords(title: string): string | null {
  const span = markerSpan(title);
  return span ? title.slice(span[0], span[1]) : null;
}

describe('seriesPlaces: a full stop that closes a title after its marker', () => {
  it('reads "Part 2/2." with its total, in a series named "Recap"', () => {
    const items = [upload('p2', 'Recap Part 2/2.', 2), upload('p1', 'Recap Part 1/2.', 1)];

    expect(placesOf(items)).toEqual({ p2: 'Part 2 of 2', p1: 'Part 1 of 2' });
    expect(namesOf(items)).toEqual({ p2: 'Recap', p1: 'Recap' });
  });

  it('says "of 3" on each row of "Recap - Part 2 of 3.", as its title does', () => {
    const items = [
      upload('p2', 'Recap - Part 2 of 3.', 2),
      upload('p1', 'Recap - Part 1 of 3.', 1),
    ];

    expect(placesOf(items)).toEqual({ p2: 'Part 2 of 3', p1: 'Part 1 of 3' });
    expect(namesOf(items)).toEqual({ p2: 'Recap', p1: 'Recap' });
  });

  it('leaves no full stop behind a bracketed marker in the series name', () => {
    const items = [upload('p2', 'Recap (Part 2/2).', 2), upload('p1', 'Recap (Part 1/2) .', 1)];

    expect(placesOf(items)).toEqual({ p2: 'Part 2 of 2', p1: 'Part 1 of 2' });
    expect(namesOf(items)).toEqual({ p2: 'Recap', p1: 'Recap' });
  });

  it('keeps titles with and without the closing full stop in one series', () => {
    const items = [upload('p2', 'Recap Part 2/2.', 2), upload('p1', 'Recap Part 1/2', 1)];

    expect(placesOf(items)).toEqual({ p2: 'Part 2 of 2', p1: 'Part 1 of 2' });
  });

  it('folds them into one row named "Recap", and keeps "Part 2/2" as the marker words', () => {
    const rows = foldParts(
      [upload('p2', 'Recap Part 2/2.', 2), upload('p1', 'Recap Part 1/2.', 1)],
      () => true,
    );

    expect(rows.map((row) => [row.title, row.parts.map((part) => part.id)])).toEqual([
      ['Recap', ['p1', 'p2']],
    ]);
    expect(markerWords('Recap Part 2/2.')).toBe('Part 2/2');
    expect(markerWords('Recap - Part 2 of 3.')).toBe('Part 2 of 3');
  });

  it('leaves a full stop that closes nothing after the marker as it was', () => {
    // Before the marker it stays in the name; a decimal or a sentence after it gives no total.
    const items = [
      upload('p2', 'Coding marathon. (Part 2/2)', 2),
      upload('p1', 'Coding marathon. (Part 1/2)', 1),
    ];
    expect(namesOf(items)).toEqual({ p2: 'Coding marathon.', p1: 'Coding marathon.' });
    expect(markerWords('Recap Part 2/2.5')).toBe('Part 2');
    expect(markerWords('Recap Part 2/2. Then more')).toBe('Part 2');
    expect(markerWords('Recap Part 2.')).toBeNull();
  });

  it('reads 100,000-character titles built on a closing full stop fast', () => {
    const titles = [
      `Recap Part 1/2.${' '.repeat(99_985)}`,
      `x${' '.repeat(50_000)}Part 1of2.${' '.repeat(49_988)}x`,
      `Recap (Part 2/2)${' '.repeat(99_983)}.`,
      'Recap Part 0 '.repeat(7_692),
    ];
    const start = performance.now();
    for (const title of titles) {
      markerWords(title);
      placesOf([upload('a', title, 2), upload('b', 'Recap Part 5', 1)]);
    }

    // About 2 ms on a desk machine: only a title's first 300 characters are read.
    expect(performance.now() - start).toBeLessThan(400);
  });
});

/** Characters that cannot be seen in source, by code point. */
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const WORD_JOINER = String.fromCharCode(0x2060);

describe('seriesPlaces: a closing run of stops, quotes, brackets or white space after the total', () => {
  // Verify P1 (round eleven): only a lone full stop was read as closing the title.
  it.each([
    ['Recap Part 2/3...', 'Recap Part 1/3...'],
    ['Recap Part 2 of 3...', 'Recap Part 1 of 3...'],
    ['Recap Part 2/3..', 'Recap Part 1/3..'],
    ['"Recap Part 2/3."', '"Recap Part 1/3."'],
    ['(Recap Part 2/3.)', '(Recap Part 1/3.)'],
    ['“Recap Part 2/3.”', '“Recap Part 1/3.”'],
    [`Recap Part 2/3.${ZERO_WIDTH_SPACE}`, `Recap Part 1/3.${ZERO_WIDTH_SPACE}`],
    [`Recap Part 2/3. ${WORD_JOINER}`, `Recap Part 1/3. ${WORD_JOINER}`],
    ['Recap Part 2/3!', 'Recap Part 1/3!'],
    ['Recap Part 2/3?', 'Recap Part 1/3?'],
    ['Recap Part 2/3…', 'Recap Part 1/3…'],
    ['Recap (Part 2/3)...', 'Recap (Part 1/3)!'],
  ])('reads %j and %j as Part 2 and Part 1 of 3 of "Recap"', (newer, older) => {
    const items = [upload('p2', newer, 2), upload('p1', older, 1)];

    expect(placesOf(items)).toEqual({ p2: 'Part 2 of 3', p1: 'Part 1 of 3' });
    expect(namesOf(items)).toEqual({ p2: 'Recap', p1: 'Recap' });
  });

  it('keeps the total in the marker words', () => {
    expect(markerWords('Recap Part 2/3...')).toBe('Part 2/3');
    expect(markerWords('(Recap Part 2 of 3.)')).toBe('Part 2 of 3');
    expect(markerWords(`Recap Part 2/3.${ZERO_WIDTH_SPACE}`)).toBe('Part 2/3');
  });

  it('keeps a quote or bracket that closes one opened inside the title', () => {
    const quoted = [
      upload('p2', 'Talk: "Recap Part 2/3."', 2),
      upload('p1', 'Talk: "Recap Part 1/3."', 1),
    ];
    const bracketed = [
      upload('p2', 'Stream (marathon Part 2/3)', 2),
      upload('p1', 'Stream (marathon Part 1/3)', 1),
    ];

    expect(namesOf(quoted)).toEqual({ p2: 'Talk: "Recap"', p1: 'Talk: "Recap"' });
    expect(placesOf(quoted)).toEqual({ p2: 'Part 2 of 3', p1: 'Part 1 of 3' });
    expect(namesOf(bracketed)).toEqual({ p2: 'Stream (marathon)', p1: 'Stream (marathon)' });
  });

  it('reads the total after a full stop only when the closing run reaches the end', () => {
    // As before: a decimal, a sentence, a bare number with no total, a quote closed earlier.
    expect(markerWords('Recap Part 2/3.5')).toBe('Part 2');
    expect(markerWords('Recap Part 2/3... Then more')).toBe('Part 2');
    expect(markerWords('Recap Part 2...')).toBeNull();
    expect(markerWords('Recap Part 2.')).toBeNull();
    const items = [
      upload('p2', '"Old" Recap Part 2/3', 2),
      upload('p1', '"Old" Recap Part 1/3', 1),
    ];
    expect(namesOf(items)).toEqual({ p2: '"Old" Recap', p1: '"Old" Recap' });
  });

  it('reads a total after a full stop for exactly the closing characters', () => {
    // White space (including zero-width), stops, and closing quotes and brackets.
    const closing = new Set([
      ...SPACES,
      ...[0x200b, 0x200c, 0x200d, 0x2060].map((code) => String.fromCharCode(code)),
      ...['.', '!', '?', '…', ')', ']', '}', '"', "'", '”', '’', '»', '›', '“', '‘'],
    ]);
    const differ: string[] = [];
    for (let code = 0; code < 0x1_0000; code += 1) {
      const unit = String.fromCharCode(code);
      const read = markerWords(`Recap Part 2/3.${unit}`) === 'Part 2/3';
      if (read !== closing.has(unit)) differ.push(code.toString(16));
    }

    expect(differ).toEqual([]);
  });

  it('reads 100,000-character titles built on closing runs fast', () => {
    const titles = [
      `"Recap Part 1/2${'.'.repeat(99_985)}`,
      `(Recap Part 1/2.${ZERO_WIDTH_SPACE.repeat(99_983)})`,
      `x${' '.repeat(50_000)}Part 1of2.${'"'.repeat(49_988)}x`,
      `${'(“'.repeat(49_990)}Recap Part 2/2.”)`,
    ];
    const start = performance.now();
    for (const title of titles) {
      markerWords(title);
      placesOf([upload('a', title, 2), upload('b', 'Recap Part 1/2', 1)]);
    }

    // A few milliseconds on a desk machine: only a title's first 300 characters are read.
    expect(performance.now() - start).toBeLessThan(400);
  });
});

describe('seriesPlaces: a "Part 0" in a series its titles number', () => {
  it('reads "Part 0" whole beside "Part 5", where no title gives a total', () => {
    const places = placesOf([upload('p5', 'Recap Part 5', 2), upload('p0', 'Recap Part 0', 1)]);

    expect(places).toEqual({ p5: '-', p0: '-' });
  });

  it('keeps the parts numbered from 1 one series beside it', () => {
    const places = placesOf([
      upload('p2', 'Recap Part 2', 3),
      upload('p1', 'Recap Part 1', 2),
      upload('p0', 'Recap Part 0', 1),
    ]);

    expect(places).toEqual({ p2: 'Part 2 of 2', p1: 'Part 1 of 2', p0: '-' });
  });

  it('reads "Part 0" whole where two totals are given equally often', () => {
    const places = placesOf([
      upload('p3', 'Recap Part 3', 4),
      upload('p2', 'Recap Part 2/3', 3),
      upload('p1', 'Recap Part 1/2', 2),
      upload('p0', 'Recap Part 0', 1),
    ]);

    expect(places).toEqual({ p3: '-', p2: '-', p1: '-', p0: '-' });
  });

  it('leaves a series numbered by date as it was', () => {
    const places = placesOf([upload('p0', 'Recap Part 0', 2), upload('r', 'Recap', 1)]);

    expect(places).toEqual({ p0: 'Upload 2 of 2', r: 'Upload 1 of 2' });
  });

  it('folds "Part 0" apart from "Part 5"', () => {
    const rows = foldParts(
      [upload('p5', 'Recap Part 5', 2), upload('p0', 'Recap Part 0', 1)],
      () => true,
    );

    expect(rows.map((row) => [row.title, row.parts.map((part) => part.id)])).toEqual([
      ['Recap Part 5', ['p5']],
      ['Recap Part 0', ['p0']],
    ]);
  });
});

/** A small seeded generator (mulberry32), so every run checks the same titles. */
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

interface Written {
  readonly title: string;
  /** The total the title writes, read as a part total; null when it writes none. */
  readonly total: number | null;
}

/** One title of the show "Show": a marker in one of the forms uploads use, or none. */
function writtenTitle(random: () => number): Written {
  const pick = (n: number): number => Math.floor(random() * n);
  const part = pick(6);
  const total = 1 + pick(5);
  switch (pick(9)) {
    case 0:
      return { title: 'Show', total: null };
    case 1:
      return { title: `Show Part ${part}`, total: null };
    case 2:
      return { title: `Show (Part ${part})`, total: null };
    case 3:
      return { title: `Show Part ${part}/${total}`, total };
    case 4:
      return { title: `Show (Part ${part} of ${total})`, total };
    case 5:
      // A full stop closing the title after the marker (review F1, round eleven).
      return { title: `Show Part ${part}/${total}.`, total };
    case 6:
      return { title: `Show - Part ${part} of ${total}.`, total };
    case 7:
      return { title: `Show (Part ${part}/${total}).`, total };
    default:
      // "(N/M)" is a part only for N from 1 to M; otherwise the title reads whole.
      return { title: `Show (${part}/${total})`, total: part >= 1 && part <= total ? total : null };
  }
}

/**
 * What is wrong with a place given to a title written as `total` says, among `titles`; null when
 * nothing is. A series is named "Show" or by a title read whole, never by what a cut left.
 */
function fault(place: SeriesPlace, { total }: Written, titles: readonly string[]): string | null {
  if (!titles.includes(place.name) && place.name !== 'Show') return `is named "${place.name}"`;
  if (place.numbered !== 'title') return null;
  if (total !== null && place.count !== total) return `says ${placeWords(place)}`;
  if (place.part < 1 || place.part > place.count) return `says ${placeWords(place)}`;
  return null;
}

describe('seriesPlaces: no place states a total its own title contradicts', () => {
  it('holds for 3,000 generated series of two to five titles', () => {
    const random = seeded(20_261_114);
    const broken: string[] = [];
    let numberedPlaces = 0;
    let writtenTotals = 0;
    let closingStops = 0;
    for (let series = 0; series < 3_000; series += 1) {
      const size = 2 + Math.floor(random() * 4);
      const written = Array.from({ length: size }, () => writtenTitle(random));
      const titles = written.map((each) => each.title);
      // Newest first, as the feed is: the last title went up first.
      const items = written.map(({ title }, index) => upload(`u${index}`, title, size - index));
      const places = seriesPlaces(items, byKind);
      written.forEach((each, index) => {
        const place = places.get(`u${index}`);
        if (!place) return;
        if (place.numbered === 'title') {
          numberedPlaces += 1;
          if (each.total !== null) writtenTotals += 1;
          if (each.title.endsWith('.')) closingStops += 1;
        }
        const wrong = fault(place, each, titles);
        if (wrong) broken.push(`${titles.join(' | ')}: "${each.title}" ${wrong}`);
      });
    }

    expect(broken.slice(0, 5)).toEqual([]);
    // Not vacuous: 520 places are numbered by their titles, 252 beside a total the title writes,
    // 126 of them after a closing full stop. Before round eleven's fix, 900 places in 337 series
    // were wrong: 873 named by what a cut left ("Show /2.", "Show of 3.", "Show ."), 27 "Part 0".
    expect(numberedPlaces).toBeGreaterThan(400);
    expect(writtenTotals).toBeGreaterThan(200);
    expect(closingStops).toBeGreaterThan(100);
  });
});
