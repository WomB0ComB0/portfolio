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
 * @file How /projects lays its chapters out: the lead rule (a wide cover only; Featured by rank,
 * a year by Studio order, then more images, then page order), the unequal pair, the briefs, the
 * end of Featured (no row left alone), the Stories chapters (a year names its Featured projects
 * and keeps its anchor when they are all Featured), the Index chapters, and the dek's words.
 * Synthetic projects only.
 */

import { describe, expect, it } from 'vitest';

import {
  arrangeChapter,
  type ChapterItem,
  chapterSummary,
  chapterSummaryText,
  featuredBriefs,
  hasWideCover,
  ongoingCount,
  pickLead,
  storyChapters,
  yearChapters,
} from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-chapters';
import { FEATURED_GROUP } from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-order';
import { startedOf } from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-text';

const image = (ratio: number) => ({
  src: `https://cdn.example/${ratio}.jpg`,
  ratio,
  alt: null,
  focus: null,
});
const WIDE = image(16 / 9);
const SQUARE = image(1);
const PORTRAIT = image(768 / 942);

interface ItemExtra extends Partial<Omit<ChapterItem, 'id' | 'started'>> {
  readonly start?: string;
}

const item = (id: string, extra: ItemExtra = {}): ChapterItem => ({
  id,
  group: extra.group ?? '2025',
  title: extra.title ?? id,
  order: extra.order ?? 10,
  images: extra.images ?? [WIDE],
  ongoing: extra.ongoing ?? false,
  started: startedOf(extra.start ?? '2025-06-01'),
});

const ids = (items: readonly ChapterItem[]): string[] => items.map((each) => each.id);

describe('hasWideCover', () => {
  it('takes 4:3 and wider covers only', () => {
    expect(hasWideCover(item('a', { images: [image(4 / 3)] }))).toBe(true);
    expect(hasWideCover(item('b', { images: [SQUARE] }))).toBe(false);
    expect(hasWideCover(item('c', { images: [PORTRAIT, WIDE] }))).toBe(false);
    expect(hasWideCover(item('d', { images: [] }))).toBe(false);
  });
});

describe('pickLead', () => {
  it('in a year: the lowest Studio order among wide covers', () => {
    const items = [
      item('logo', { order: 1, images: [SQUARE] }),
      item('late', { order: 7 }),
      item('early', { order: 2 }),
      item('none', { order: 0, images: [] }),
    ];

    expect(pickLead(items, '2025')?.id).toBe('early');
  });

  it('breaks a tie on Studio order by more images, then by page order', () => {
    const items = [
      item('one-shot', { order: 1, images: [WIDE] }),
      item('three-shots', { order: 1, images: [WIDE, WIDE, SQUARE] }),
      item('also-three', { order: 1, images: [WIDE, SQUARE, SQUARE] }),
    ];

    expect(pickLead(items, '2024')?.id).toBe('three-shots');
  });

  it('in Featured: the first wide cover by rank (page order), whatever the Studio order', () => {
    const items = [
      item('rank-1-logo', { group: FEATURED_GROUP, order: 1, images: [SQUARE] }),
      item('rank-2', { group: FEATURED_GROUP, order: 10 }),
      item('rank-3', { group: FEATURED_GROUP, order: 1 }),
    ];

    expect(pickLead(items, FEATURED_GROUP)?.id).toBe('rank-2');
  });

  it('has no lead when nothing has a wide cover', () => {
    const items = [item('a', { images: [] }), item('b', { images: [PORTRAIT] })];

    expect(pickLead(items, '2023')).toBeNull();
  });
});

describe('arrangeChapter', () => {
  it('leads, pairs the next two wide covers, and keeps the rest as briefs in page order', () => {
    const items = [
      item('a', { order: 5, images: [] }),
      item('b', { order: 4 }),
      item('c', { order: 1 }),
      item('d', { order: 6, images: [SQUARE] }),
      item('e', { order: 7 }),
      item('f', { order: 8 }),
    ];
    const { lead, features, briefs } = arrangeChapter(items, '2026');

    expect(lead?.id).toBe('c');
    expect(ids(features)).toEqual(['b', 'e']);
    expect(ids(briefs)).toEqual(['a', 'd', 'f']);
  });

  it('pairs nothing in a small chapter', () => {
    const small = arrangeChapter([item('a'), item('b'), item('c'), item('d')], '2025');

    expect(small.features).toEqual([]);
    expect(small.briefs).toHaveLength(3);
  });

  it('pairs nothing with fewer than two wide covers left after the lead', () => {
    const thin = arrangeChapter(
      [
        item('a'),
        item('b'),
        item('c', { images: [] }),
        item('d', { images: [] }),
        item('e', { images: [] }),
      ],
      '2025',
    );

    expect(thin.features).toEqual([]);
    expect(ids(thin.briefs)).toEqual(['b', 'c', 'd', 'e']);
  });

  it('lists every project exactly once', () => {
    const items = Array.from({ length: 9 }, (_, at) =>
      item(`p${at}`, { order: at % 3, images: at % 2 ? [WIDE] : [] }),
    );
    const { lead, features, briefs } = arrangeChapter(items, '2024');
    const shown = [...(lead ? [lead] : []), ...features, ...briefs];

    expect(ids(shown).sort()).toEqual(ids(items).sort());
  });

  it('makes briefs of everything when nothing can lead', () => {
    const arranged = arrangeChapter([item('a', { images: [] }), item('b', { images: [] })], '2023');

    expect(arranged.lead).toBeNull();
    expect(arranged.features).toEqual([]);
    expect(ids(arranged.briefs)).toEqual(['a', 'b']);
  });
});

describe('storyChapters', () => {
  it('keeps the page’s groups in page order, Featured first, with anchors', () => {
    const chapters = storyChapters([
      item('f1', { group: FEATURED_GROUP, start: '2026-02-01' }),
      item('y1', { group: '2026', start: '2026-05-01' }),
      item('y2', { group: '2026', start: '2026-01-01' }),
      item('u1', { group: 'undated', start: 'unknown' }),
    ]);

    expect(chapters.map(({ label, id, items }) => [label, id, items.length])).toEqual([
      ['Featured', 'featured', 1],
      ['2026', 'y2026', 2],
      ['Undated', 'undated', 1],
    ]);
  });

  it('names in each year the Featured projects that started in it', () => {
    const chapters = storyChapters([
      item('resq-viz', { group: FEATURED_GROUP, start: '2026-04-01' }),
      item('ktp', { group: FEATURED_GROUP, start: '2024-09-01' }),
      item('grepo', { group: FEATURED_GROUP, start: '2026-03-01' }),
      item('platform', { group: '2026', start: '2026-05-01' }),
      item('sparkmind', { group: '2024', start: '2024-06-01' }),
    ]);

    expect(chapters.map(({ label, alsoFeatured }) => [label, ids(alsoFeatured)])).toEqual([
      ['Featured', []],
      ['2026', ['resq-viz', 'grepo']],
      ['2024', ['ktp']],
    ]);
  });

  it('gives a year whose projects are all Featured no chapter: Featured already lists them', () => {
    const chapters = storyChapters([
      item('resq-viz', { group: FEATURED_GROUP, start: '2027-04-01' }),
      item('platform', { group: '2026', start: '2026-05-01' }),
      item('waffle', { group: '2023', start: '2023-02-01' }),
      item('ktp', { group: FEATURED_GROUP, start: '2024-09-01' }),
      item('sparkmind', { group: '2024', start: '2024-06-01' }),
    ]);

    expect(
      chapters.map(({ id, items, alsoFeatured }) => [id, ids(items), ids(alsoFeatured)]),
    ).toEqual([
      ['featured', ['resq-viz', 'ktp'], []],
      ['y2026', ['platform'], []],
      ['y2024', ['sparkmind'], ['ktp']],
      ['y2023', ['waffle'], []],
    ]);
  });

  it('ends a search that keeps only Featured projects at Featured, with no empty year', () => {
    const chapters = storyChapters([
      item('grepo', { group: FEATURED_GROUP, start: '2026-03-01' }),
      item('foia', { group: FEATURED_GROUP, start: '2025-02-01' }),
    ]);

    expect(chapters.map(({ id, items }) => [id, ids(items)])).toEqual([
      ['featured', ['grepo', 'foia']],
    ]);
  });

  it('has no Featured chapter when a filter leaves no Featured project', () => {
    const chapters = storyChapters([item('a', { group: '2025' }), item('b', { group: '2025' })]);

    expect(chapters.map(({ id }) => id)).toEqual(['y2025']);
  });
});

describe('featuredBriefs', () => {
  it('ends Featured in rows, two to a line, when they pair up', () => {
    expect(featuredBriefs(['a', 'b'])).toEqual({ wide: null, rows: ['a', 'b'] });
    expect(featuredBriefs([])).toEqual({ wide: null, rows: [] });
  });

  it('makes the first of an odd number a wide brief, so no row is left alone', () => {
    expect(featuredBriefs(['foia', 'elysium', 'site'])).toEqual({
      wide: 'foia',
      rows: ['elysium', 'site'],
    });
    expect(featuredBriefs(['only'])).toEqual({ wide: 'only', rows: [] });
  });
});

describe('yearChapters', () => {
  it('puts every project under the year it started, Featured ones too, newest first', () => {
    const chapters = yearChapters([
      item('featured-2023', { group: FEATURED_GROUP, start: '2023-01-01' }),
      item('mar-2026', { start: '2026-03-01', order: 2 }),
      item('aug-2026', { start: '2026-08-01' }),
      item('mar-2026-first', { start: '2026-03-15', order: 1 }),
      item('undated', { start: 'unknown' }),
    ]);

    expect(chapters.map(({ label, items }) => [label, ids(items)])).toEqual([
      ['2026', ['aug-2026', 'mar-2026-first', 'mar-2026']],
      ['2023', ['featured-2023']],
      ['Undated', ['undated']],
    ]);
  });
});

describe('the chapter dek', () => {
  it('names the lead, the pair and the first brief, then counts the rest in words', () => {
    const arranged = {
      lead: item('lead', { title: 'ResQ Viz' }),
      features: [item('f1', { title: 'grepo' }), item('f2', { title: 'KTP' })],
      briefs: [item('b1'), item('b2'), item('b3'), item('b4'), item('b5')],
    };
    const summary = chapterSummary(arranged);

    expect(summary).toEqual({ names: ['ResQ Viz', 'grepo', 'KTP'], more: ' and five more' });
    expect(chapterSummaryText(summary)).toBe('ResQ Viz, grepo, KTP and five more.');
  });

  it('joins a short chapter as a sentence', () => {
    const summary = chapterSummary({ lead: null, features: [], briefs: [item('A'), item('B')] });

    expect(chapterSummaryText(summary)).toBe('A and B.');
    expect(chapterSummaryText({ names: [], more: '' })).toBe('');
  });

  it('counts the projects still in progress', () => {
    const items = [item('a', { ongoing: true }), item('b'), item('c', { ongoing: true })];

    expect(ongoingCount(items)).toBe(2);
  });
});
