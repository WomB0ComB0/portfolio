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
 * @file Livestream part folding on /media: a part marker ("Part 1", "Pt. 2", "(2/3)", "(part 1)"
 * mid-title) is read off a title, leaving its base title, while titles that only look numbered
 * ("Project 10", "Web 3.0", "Party 2", "COVID-19 (2020)") are left whole. Items that share a base
 * title within one year fold into one row at the newest part's place, parts oldest first.
 * A series is two or more uploads of one kind that share a base title, in any year: each upload
 * knows its place ("Upload 2 of 3", or the titles' own "Part 1 of 2").
 */

import { describe, expect, it } from 'vitest';
import {
  type Foldable,
  foldParts,
  markerSpan,
  partKey,
  seriesPlaces,
  seriesSlug,
} from '@/app/(routes)/(dev)/media/_lib/media-parts';

describe('reading a part marker (markerSpan and partKey)', () => {
  /** The marker's own words in `title`, or null when it carries none. */
  const markerWords = (title: string): string | null => {
    const span = markerSpan(title);
    return span ? title.slice(span[0], span[1]) : null;
  };

  it.each([
    ['Coding marathon (Part 1/2)', 'coding marathon', '(Part 1/2)'],
    ['Coding marathon. (Part 2/2)', 'coding marathon', '(Part 2/2)'],
    ['Stream Part 1', 'stream', 'Part 1'],
    ['Stream - Part 3', 'stream', 'Part 3'],
    ['Stream, Pt. 2', 'stream', 'Pt. 2'],
    ['Stream pt 4', 'stream', 'pt 4'],
    ['Stream (2/3)', 'stream', '(2/3)'],
    ['Stream [3/3]', 'stream', '[3/3]'],
    ['Stream (part 2 of 3)', 'stream', '(part 2 of 3)'],
    ['Part 1: Intro to Rust', 'intro to rust', 'Part 1'],
    [
      'HeadStarter Accelerator - Project 2 (part 1) - Discord Clone',
      'headstarter accelerator - project 2 - discord clone',
      '(part 1)',
    ],
  ])('reads %j as base %j with the marker %j', (title, key, words) => {
    expect(partKey(title)).toBe(key);
    expect(markerWords(title)).toBe(words);
  });

  it.each([
    'HeadStarter Accelerator -Project 10 - Financial Market Crash Anomaly Detection',
    'Top 10 tips for interviews',
    'Web 3.0 explained',
    'Next.js 15 upgrade',
    'Party 2 recap',
    'Departure 2',
    'Spare parts 2',
    'Part of the plan',
    'COVID-19 (2020)',
    'Half off: 1/2 price',
    'Episode 3',
    'Coding, building, learning, and growing marathon.',
  ])('leaves %j whole: no part', (title) => {
    expect(markerSpan(title)).toBeNull();
  });

  it('keeps a title that is nothing but a marker', () => {
    expect(partKey('Part 1')).toBe('part 1');
    expect(markerWords('Part 1')).toBe('Part 1');
    expect(partKey('(2/3)')).toBe('(2/3)');
    expect(markerWords('(2/3)')).toBe('(2/3)');
  });
});

describe('markerSpan', () => {
  /** The marker's own words, as the row keeps them on one line. */
  const marker = (title: string): string | null => {
    const span = markerSpan(title);
    return span ? title.slice(span[0], span[1]) : null;
  };

  it.each([
    ['Coding marathon. (Part 2/2)', '(Part 2/2)'],
    ['Stream - Part 3', 'Part 3'],
    ['Stream, Pt. 2', 'Pt. 2'],
    ['Stream (part 2 of 3)', '(part 2 of 3)'],
    ['Stream (2/3)', '(2/3)'],
    ['HeadStarter Accelerator - Project 2 (part 1) - Discord Clone', '(part 1)'],
    ['Part 1: Intro to Rust', 'Part 1'],
  ])('finds the marker in %j, without the space or separator before it', (title, words) => {
    expect(marker(title)).toBe(words);
  });

  it.each(['Company overview', 'Meetup recap (12/29)', 'Web 3.0 explained'])(
    'finds none in %j',
    (title) => {
      expect(markerSpan(title)).toBeNull();
    },
  );
});

describe('partKey', () => {
  it('ignores case, spacing, a trailing full stop and the marker', () => {
    const key = partKey('Coding, building, learning, and growing marathon.');
    expect(partKey('coding,  building, learning, and growing MARATHON (Part 1/2)')).toBe(key);
    expect(partKey('Coding, building, learning, and growing marathon. (Part 2/2)')).toBe(key);
  });

  it('tells different shows apart', () => {
    expect(partKey('Discord Clone (part 1)')).not.toBe(partKey('TikTok Clone (part 1)'));
  });
});

interface Item extends Foldable {
  readonly kind: 'video' | 'post';
}

/** An item dated `iso` (newest first in the lists below). */
const item = (
  id: string,
  title: string,
  iso: string | null,
  kind: Item['kind'] = 'video',
): Item => ({
  id,
  kind,
  title,
  time: iso === null ? null : Date.parse(iso),
  year: iso === null ? 'Undated' : iso.slice(0, 4),
});

const isVideo = (each: Item): boolean => each.kind === 'video';

describe('foldParts', () => {
  it('folds parts that share a base title into one row at the newest part, parts oldest first', () => {
    const items = [
      item('a', 'Marathon', '2025-12-30T10:00:00Z'),
      item('b', 'Portfolio revamp', '2025-12-29T12:00:00Z'),
      item('c', 'Marathon (Part 2/2)', '2025-12-29T09:00:00Z'),
      item('d', 'Marathon (Part 1/2)', '2025-12-29T09:00:00Z'),
    ];

    const rows = foldParts(items, isVideo);

    expect(rows.map((row) => row.lead.id)).toEqual(['a', 'b']);
    expect(rows[0]?.title).toBe('Marathon');
    expect(rows[0]?.parts.map((part) => part.id)).toEqual(['d', 'c', 'a']);
    expect(rows[1]?.parts.map((part) => part.id)).toEqual(['b']);
  });

  it('never folds across years, so each year bar keeps its own parts', () => {
    const items = [
      item('new', 'Weekly stream', '2026-01-02T00:00:00Z'),
      item('old1', 'Weekly stream', '2025-12-31T00:00:00Z'),
      item('old2', 'Weekly stream', '2025-12-20T00:00:00Z'),
    ];

    const rows = foldParts(items, isVideo);

    expect(rows.map((row) => row.parts.map((part) => part.id))).toEqual([
      ['new'],
      ['old2', 'old1'],
    ]);
  });

  it('leaves items it may not fold alone, even with the same title', () => {
    const items = [
      item('p1', 'Rust notes, Part 2', '2025-05-02T00:00:00Z', 'post'),
      item('p2', 'Rust notes, Part 1', '2025-05-01T00:00:00Z', 'post'),
    ];

    expect(foldParts(items, isVideo).map((row) => row.parts.length)).toEqual([1, 1]);
  });

  it('keeps a lone part under its own title', () => {
    const rows = foldParts(
      [item('x', 'Project 4 (part 1) - AI Coding Agent', '2024-11-22')],
      isVideo,
    );

    expect(rows[0]?.title).toBe('Project 4 (part 1) - AI Coding Agent');
  });

  it('orders same-time parts by their number, and keeps an undated part out of a dated row', () => {
    const items = [
      item('u', 'Talk (Part 3/3)', null),
      item('two', 'Talk (Part 2/3)', '2024-03-01T00:00:00Z'),
      item('one', 'Talk (Part 1/3)', '2024-03-01T00:00:00Z'),
    ];

    const rows = foldParts(items, isVideo);

    // The undated part is in the Undated year, so it never joins 2024's row.
    expect(rows.map((row) => row.parts.map((part) => part.id))).toEqual([['u'], ['one', 'two']]);
  });
});

describe('foldParts: parts published out of order', () => {
  it("lists a broadcast's parts as their titles number them inside the folded row", () => {
    const rows = foldParts(
      [
        item('after', 'Marathon.', '2025-12-30T03:17:20Z'),
        item('one', 'Marathon. (Part 1/2)', '2025-12-29T09:02:28Z'),
        item('two', 'Marathon. (Part 2/2)', '2025-12-29T00:42:07Z'),
        item('before', 'Marathon.', '2025-10-20T23:16:26Z'),
      ],
      isVideo,
    );

    expect(rows.map((row) => row.parts.map((part) => part.id))).toEqual([
      ['before', 'one', 'two', 'after'],
    ]);
  });
});

/** Videos and streams may be in a series, each among its own kind; nothing else. */
const groupOf = (each: Item | Mixed): string | null => (each.kind === 'post' ? null : each.kind);

interface Mixed extends Foldable {
  readonly kind: 'video' | 'stream' | 'post';
}

const mixed = (id: string, title: string, iso: string | null, kind: Mixed['kind']): Mixed => ({
  id,
  kind,
  title,
  time: iso === null ? null : Date.parse(iso),
  year: iso === null ? 'Undated' : iso.slice(0, 4),
});

describe('seriesPlaces', () => {
  it('numbers same-titled uploads oldest first, whatever the feed order', () => {
    const places = seriesPlaces(
      [
        item('c', 'Marathon.', '2025-12-30T10:00:00Z'),
        item('x', 'Portfolio revamp', '2025-12-29T12:00:00Z'),
        item('b', 'Marathon.', '2025-10-01T09:00:00Z'),
        item('a', 'marathon', '2025-08-24T09:00:00Z'),
      ],
      groupOf,
    );

    expect([...places.keys()].sort()).toEqual(['a', 'b', 'c']);
    expect(places.get('a')).toMatchObject({ part: 1, count: 3, numbered: 'order' });
    expect(places.get('b')).toMatchObject({ part: 2, count: 3, numbered: 'order' });
    expect(places.get('c')).toMatchObject({ part: 3, count: 3, numbered: 'order' });
    // The base title as the newest upload writes it.
    expect(places.get('a')?.name).toBe('Marathon.');
    expect(new Set([...places.values()].map((place) => place.key)).size).toBe(1);
  });

  it('orders uploads that share a timestamp by the part number their titles carry', () => {
    const places = seriesPlaces(
      [
        item('two', 'Talk (Part 2/2)', '2024-03-01T00:00:00Z'),
        item('one', 'Talk (Part 1/2)', '2024-03-01T00:00:00Z'),
        item('zero', 'Talk', '2024-02-01T00:00:00Z'),
      ],
      groupOf,
    );

    // One title has no number, so the series is numbered by date: never "Part 3" beside "(Part 2/2)".
    expect(places.get('zero')).toMatchObject({ part: 1, count: 3, numbered: 'order' });
    expect(places.get('one')).toMatchObject({ part: 2, count: 3, numbered: 'order' });
    expect(places.get('two')).toMatchObject({ part: 3, count: 3, numbered: 'order' });
  });

  it("uses the titles' own part numbers when every title has one and none repeats", () => {
    const places = seriesPlaces(
      [
        item('p2', 'Project 2 (part 2) - Discord Clone', '2024-11-07T15:59:35Z'),
        item('p1', 'Project 2 (part 1) - Discord Clone', '2024-10-24T22:17:10Z'),
      ],
      groupOf,
    );

    expect(places.get('p1')).toMatchObject({ part: 1, count: 2, numbered: 'title' });
    expect(places.get('p2')).toMatchObject({ part: 2, count: 2, numbered: 'title' });
    expect(places.get('p1')?.name).toBe('Project 2 - Discord Clone');
  });

  it('counts up to the highest title number when a part is missing', () => {
    const places = seriesPlaces(
      [
        item('p4', 'Build log, Part 4', '2024-11-07T00:00:00Z'),
        item('p1', 'Build log, Part 1', '2024-10-24T00:00:00Z'),
      ],
      groupOf,
    );

    expect(places.get('p1')).toMatchObject({ part: 1, count: 4, numbered: 'title' });
    expect(places.get('p4')).toMatchObject({ part: 4, count: 4, numbered: 'title' });
  });

  it('falls back to date order when two titles carry the same part number', () => {
    const places = seriesPlaces(
      [
        item('b', 'Stream (Part 1/2)', '2025-02-01T00:00:00Z'),
        item('a', 'Stream (Part 1/2)', '2025-01-01T00:00:00Z'),
      ],
      groupOf,
    );

    expect(places.get('a')).toMatchObject({ part: 1, count: 2, numbered: 'order' });
    expect(places.get('b')).toMatchObject({ part: 2, count: 2, numbered: 'order' });
  });

  it('gives a lone part no place', () => {
    const places = seriesPlaces(
      [item('x', 'Project 4 (part 1) - AI Coding Agent', '2024-11-22T00:00:00Z')],
      groupOf,
    );

    expect(places.size).toBe(0);
  });

  it('never joins uploads of different kinds, or items that may not be in a series', () => {
    const places = seriesPlaces(
      [
        mixed('s', 'Weekly', '2025-03-01T00:00:00Z', 'stream'),
        mixed('v', 'Weekly', '2025-02-01T00:00:00Z', 'video'),
        mixed('p2', 'Rust notes, Part 2', '2025-01-02T00:00:00Z', 'post'),
        mixed('p1', 'Rust notes, Part 1', '2025-01-01T00:00:00Z', 'post'),
      ],
      groupOf,
    );

    expect(places.size).toBe(0);
  });

  it('orders the parts of one broadcast by the numbers in their titles, whenever each went up', () => {
    // "(Part 2/2)" reached YouTube hours before "(Part 1/2)".
    const places = seriesPlaces(
      [
        item('after', 'Marathon.', '2025-12-30T03:17:20Z'),
        item('one', 'Marathon. (Part 1/2)', '2025-12-29T09:02:28Z'),
        item('two', 'Marathon. (Part 2/2)', '2025-12-29T00:42:07Z'),
        item('before', 'Marathon.', '2025-10-20T23:16:26Z'),
      ],
      groupOf,
    );

    expect(places.get('before')).toMatchObject({ part: 1, count: 4, numbered: 'order' });
    expect(places.get('one')).toMatchObject({ part: 2, count: 4, numbered: 'order' });
    expect(places.get('two')).toMatchObject({ part: 3, count: 4, numbered: 'order' });
    expect(places.get('after')).toMatchObject({ part: 4, count: 4, numbered: 'order' });
  });

  it('orders two numbered broadcasts next to each other each by its own numbers', () => {
    const places = seriesPlaces(
      [
        item('b1', 'Show (Part 1/2)', '2025-03-02T10:00:00Z'),
        item('b2', 'Show (Part 2/2)', '2025-03-02T01:00:00Z'),
        item('a1', 'Show (Part 1/2)', '2025-03-01T10:00:00Z'),
        item('a2', 'Show (Part 2/2)', '2025-03-01T01:00:00Z'),
      ],
      groupOf,
    );

    expect(['a1', 'a2', 'b1', 'b2'].map((id) => places.get(id)?.part)).toEqual([1, 2, 3, 4]);
    expect(places.get('a1')?.numbered).toBe('order');
  });

  it('never moves a numbered part past an upload without a number', () => {
    const places = seriesPlaces(
      [
        item('one', 'Show (Part 1/2)', '2025-03-03T00:00:00Z'),
        item('plain', 'Show', '2025-03-02T00:00:00Z'),
        item('two', 'Show (Part 2/2)', '2025-03-01T00:00:00Z'),
      ],
      groupOf,
    );

    expect(['two', 'plain', 'one'].map((id) => places.get(id)?.part)).toEqual([1, 2, 3]);
  });

  it('lets a series span years', () => {
    const places = seriesPlaces(
      [
        item('new', 'Weekly stream', '2026-01-02T00:00:00Z'),
        item('old', 'Weekly stream', '2025-12-31T00:00:00Z'),
      ],
      groupOf,
    );

    expect(places.get('old')).toMatchObject({ part: 1, count: 2 });
    expect(places.get('new')).toMatchObject({ part: 2, count: 2 });
  });
});

describe('seriesPlaces: totals and bracketed numbers', () => {
  it('reads a bracketed date as no part, so two recaps are no series', () => {
    expect(markerSpan('Meetup recap (12/29)')).toBeNull();
    expect(markerSpan('Meetup recap (1/15)')).toBeNull();
    expect(markerSpan('Meetup recap (3/2)')).toBeNull();

    const places = seriesPlaces(
      [
        item('dec', 'Meetup recap (12/29)', '2025-12-30T00:00:00Z'),
        item('jan', 'Meetup recap (1/15)', '2025-01-16T00:00:00Z'),
      ],
      groupOf,
    );

    expect(places.size).toBe(0);
  });

  it('joins bracketed numbers only when the group shares their total', () => {
    const shared = seriesPlaces(
      [
        item('two', 'Build (2/3)', '2025-03-02T00:00:00Z'),
        item('one', 'Build (1/3)', '2025-03-01T00:00:00Z'),
      ],
      groupOf,
    );
    const mixed = seriesPlaces(
      [
        item('b', 'Recap (3/5)', '2025-05-03T00:00:00Z'),
        item('a', 'Recap (1/2)', '2025-01-02T00:00:00Z'),
      ],
      groupOf,
    );

    expect(shared.get('one')).toMatchObject({ part: 1, count: 3, numbered: 'title' });
    expect(shared.get('two')).toMatchObject({ part: 2, count: 3, numbered: 'title' });
    expect(mixed.size).toBe(0);
  });

  it('a bracketed number its group does not share leaves that title whole', () => {
    // "(1/2)" and "(3/5)" disagree on the total, so neither is a part: the plain "Recap" upload
    // is no series with either.
    const places = seriesPlaces(
      [
        item('b', 'Recap (3/5)', '2025-05-03T00:00:00Z'),
        item('plain', 'Recap', '2025-03-01T00:00:00Z'),
        item('a', 'Recap (1/2)', '2025-01-02T00:00:00Z'),
      ],
      groupOf,
    );

    expect(places.size).toBe(0);
  });

  it('counts to the total the titles give when every title gives the same one', () => {
    const slash = seriesPlaces(
      [
        item('p2', 'Stream (Part 2/3)', '2025-03-02T00:00:00Z'),
        item('p1', 'Stream (Part 1/3)', '2025-03-01T00:00:00Z'),
      ],
      groupOf,
    );
    const words = seriesPlaces(
      [
        item('p2', 'Workshop, Part 2 of 4', '2025-03-02T00:00:00Z'),
        item('p1', 'Workshop, Part 1 of 4', '2025-03-01T00:00:00Z'),
      ],
      groupOf,
    );

    expect(slash.get('p1')).toMatchObject({ part: 1, count: 3, numbered: 'title' });
    expect(slash.get('p2')).toMatchObject({ part: 2, count: 3, numbered: 'title' });
    expect(words.get('p2')).toMatchObject({ part: 2, count: 4 });
  });

  it('reads a title that numbers past the total whole, so no place contradicts a title', () => {
    // Counted to 3, "Show, Part 1 of 2" said "Part 1 of 3" (review F3, round ten).
    const tooSmall = seriesPlaces(
      [
        item('p3', 'Show, Part 3 of 2', '2025-03-02T00:00:00Z'),
        item('p1', 'Show, Part 1 of 2', '2025-03-01T00:00:00Z'),
      ],
      groupOf,
    );

    expect(tooSmall.size).toBe(0);
  });
});

describe('seriesPlaces: one set of totals per series (round 8)', () => {
  it('counts to the total the titles give, past a title that gives none', () => {
    // "(Part 1)" gives no total and "(2/3)" gives 3: the series read "Part 1 of 2", "Part 2 of 2"
    // beside a title that says 2/3.
    const places = seriesPlaces(
      [
        item('two', 'Mix (2/3)', '2025-03-02T00:00:00Z'),
        item('one', 'Mix (Part 1)', '2025-03-01T00:00:00Z'),
      ],
      groupOf,
    );

    expect(places.get('one')).toMatchObject({ part: 1, count: 3, numbered: 'title' });
    expect(places.get('two')).toMatchObject({ part: 2, count: 3, numbered: 'title' });
  });

  it('reads the titles whole when a "Part N/M" total and a bracketed one disagree', () => {
    // They read "Part 2 of 2" and "Part 1 of 2" beside a title that says 1/3.
    const places = seriesPlaces(
      [
        item('two', 'Stream (Part 2/2)', '2025-03-02T00:00:00Z'),
        item('one', 'Stream (1/3)', '2025-03-01T00:00:00Z'),
      ],
      groupOf,
    );

    expect(places.size).toBe(0);
  });

  it('reads the titles whole when two "Part N/M" totals disagree', () => {
    const places = seriesPlaces(
      [
        item('p2', 'Stream (Part 2/4)', '2025-03-02T00:00:00Z'),
        item('p1', 'Stream (Part 1/3)', '2025-03-01T00:00:00Z'),
      ],
      groupOf,
    );

    expect(places.size).toBe(0);
  });

  it('keeps every upload of a series numbered by date, whatever totals its broadcasts give', () => {
    // A series numbered by date claims no total, so a broadcast cut in three beside one cut in
    // two loses none of its uploads.
    const places = seriesPlaces(
      [
        item('c3', 'Show (Part 3/3)', '2025-03-06T00:00:00Z'),
        item('c2', 'Show (Part 2/3)', '2025-03-05T00:00:00Z'),
        item('c1', 'Show (Part 1/3)', '2025-03-04T00:00:00Z'),
        item('plain', 'Show', '2025-03-03T00:00:00Z'),
        item('b2', 'Show (Part 2/2)', '2025-03-02T00:00:00Z'),
        item('b1', 'Show (Part 1/2)', '2025-03-01T00:00:00Z'),
      ],
      groupOf,
    );

    expect(places.size).toBe(6);
    expect(['b1', 'b2', 'plain', 'c1', 'c2', 'c3'].map((id) => places.get(id)?.part)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(places.get('c3')).toMatchObject({ count: 6, numbered: 'order' });
  });

  it('keeps the agreeing parts a series when one more title gives another total (round 10)', () => {
    // "(Part 1/2)" and "(Part 2/2)" agree on 2; only "(Part 3/4)" disagrees, so only it reads whole.
    const places = seriesPlaces(
      [
        item('p3', 'Recap (Part 3/4)', '2025-03-03T00:00:00Z'),
        item('p2', 'Recap (Part 2/2)', '2025-03-02T00:00:00Z'),
        item('p1', 'Recap (Part 1/2)', '2025-03-01T00:00:00Z'),
      ],
      groupOf,
    );

    expect(places.get('p1')).toMatchObject({ part: 1, count: 2, numbered: 'title', name: 'Recap' });
    expect(places.get('p2')).toMatchObject({ part: 2, count: 2, numbered: 'title', name: 'Recap' });
    expect(places.has('p3')).toBe(false);
  });

  it('folds the agreeing parts into one row and leaves the title that disagrees its own (round 10)', () => {
    const rows = foldParts(
      [
        item('p3', 'Recap (Part 3/4)', '2025-03-03T00:00:00Z'),
        item('p2', 'Recap (Part 2/2)', '2025-03-02T00:00:00Z'),
        item('p1', 'Recap (Part 1/2)', '2025-03-01T00:00:00Z'),
      ],
      isVideo,
    );

    expect(rows.map((row) => [row.title, row.parts.map((part) => part.id)])).toEqual([
      ['Recap (Part 3/4)', ['p3']],
      ['Recap', ['p1', 'p2']],
    ]);
  });

  it('counts past a title that gives no total once the one that disagrees reads whole (round 10)', () => {
    // Three titles agree on 3 ("Part 1" gives none), one says 4/5: the three and "Part 1" stay.
    const places = seriesPlaces(
      [
        item('p4', 'Mix (Part 4/5)', '2025-03-04T00:00:00Z'),
        item('p3', 'Mix (Part 3/3)', '2025-03-03T00:00:00Z'),
        item('p2', 'Mix (Part 2/3)', '2025-03-02T00:00:00Z'),
        item('p1', 'Mix (Part 1)', '2025-03-01T00:00:00Z'),
      ],
      groupOf,
    );

    expect(['p1', 'p2', 'p3'].map((id) => places.get(id)?.part)).toEqual([1, 2, 3]);
    expect(places.get('p1')).toMatchObject({ count: 3, numbered: 'title' });
    expect(places.has('p4')).toBe(false);
  });

  it('still reads every title whole when no one total is given more often than the others', () => {
    // Two say 2, two say 4: neither total wins, so no place states a count a title contradicts.
    const places = seriesPlaces(
      [
        item('p4', 'Show (Part 4/4)', '2025-03-04T00:00:00Z'),
        item('p3', 'Show (Part 3/4)', '2025-03-03T00:00:00Z'),
        item('p2', 'Show (Part 2/2)', '2025-03-02T00:00:00Z'),
        item('p1', 'Show (Part 1/2)', '2025-03-01T00:00:00Z'),
      ],
      groupOf,
    );

    expect(places.size).toBe(0);
  });

  it("reads today's marathon and the two Discord parts as before", () => {
    const marathon = 'Coding, building, learning, and growing marathon.';
    const day = (n: number): string =>
      new Date(Date.UTC(2025, 7, 24) + n * 86_400_000).toISOString();
    const items = [
      ...Array.from({ length: 25 }, (_, n) => item(`m${25 - n}`, marathon, day(100 - n))),
      item('two', `${marathon} (Part 2/2)`, day(40)),
      item('one', `${marathon} (Part 1/2)`, day(39)),
      item('d2', 'HeadStarter Accelerator - Project 2 (part 2) - Discord Clone', '2024-11-07'),
      item('d1', 'HeadStarter Accelerator - Project 2 (part 1) - Discord Clone', '2024-10-24'),
    ];
    const places = seriesPlaces(items, groupOf);

    expect(places.get('one')).toMatchObject({ part: 1, count: 27, numbered: 'order' });
    expect(places.get('two')).toMatchObject({ part: 2, count: 27, numbered: 'order' });
    expect(places.get('m25')).toMatchObject({ part: 27, count: 27, numbered: 'order' });
    expect(places.get('d1')).toMatchObject({ part: 1, count: 2, numbered: 'title' });
    expect(places.get('d2')).toMatchObject({ part: 2, count: 2, numbered: 'title' });
  });
});

describe('seriesSlug', () => {
  it('writes a base title as lower case, digits and hyphens', () => {
    expect(seriesSlug('Coding, building, learning, and growing marathon.')).toBe(
      'coding-building-learning-and-growing-marathon',
    );
    expect(seriesSlug('HeadStarter Accelerator - Project 2 - Discord Clone')).toBe(
      'headstarter-accelerator-project-2-discord-clone',
    );
    expect(seriesSlug('  Café & Crème: Été 2025!  ')).toBe('cafe-creme-ete-2025');
  });

  it('keeps to 80 characters, never ending on a hyphen', () => {
    const slug = seriesSlug(`${'word '.repeat(15)}tail and ${'more '.repeat(10)}`);

    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('still names a title with no Latin letters or digits, the same way every time', () => {
    const slug = seriesSlug('配信アーカイブ');

    expect(slug).toMatch(/^series-[a-z0-9]+$/);
    expect(seriesSlug('配信アーカイブ')).toBe(slug);
    expect(seriesSlug('別の配信')).not.toBe(slug);
  });
});
