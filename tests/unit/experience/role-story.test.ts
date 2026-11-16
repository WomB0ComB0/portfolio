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

import { makeExperience } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';

import {
  linkedHrefs,
  linkedPlain,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/linked-text';
import { buildRoleIndex } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-index';
import {
  buildRoleStory,
  chapterNamesOf,
  numberWord,
  proseOf,
  type StoryChapter,
  storyLede,
  storyRowsOf,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-story';
import type { Experience } from '@/hooks/sanity/schemas';

const TODAY = '2026-11-12';

const exp = (
  id: string,
  order: number,
  startDate: string,
  endDate: string | null,
  extra: Partial<Experience> = {},
): Experience =>
  makeExperience({ _id: id, order, startDate, endDate, current: endDate === null, ...extra });

/** Ten roles shaped like the real ones: three current, the rest by the year they began. */
const ROLES: readonly Experience[] = [
  exp('resq', 1, '2026-03-01', null, {
    company: 'ResQ Systems, Inc.',
    position: 'Founder & CEO',
    description: 'ResQ builds coordination software for drones. Pre-revenue, with a demo.',
    responsibilities: ['Founded and run the company', 'Raising a pre-seed round'],
  }),
  exp('curvance', 2, '2026-03-01', '2026-09-30', {
    company: 'Curvance',
    description: 'Built the blog (https://blog.curvance.com) from scratch.',
  }),
  exp('elysium', 3, '2023-01-01', null, { company: 'Elysium' }),
  exp('dfg', 4, '2024-04-01', '2026-02-28', { company: 'Develop for Good' }),
  exp('talent', 5, '2024-03-01', '2025-09-30', { company: 'TalentSprint' }),
  exp('mlh', 6, '2024-06-01', '2024-09-30', { company: 'MLH Fellowship' }),
  exp('handshake', 7, '2025-11-01', null, { company: 'Handshake' }),
  exp('c180', 8, '2023-09-01', '2024-09-30', {
    company: 'Campaign 180',
    description: 'Built apps with Flutter. Configured CI. Wrote tests for every release.',
    responsibilities: ['Built apps with Flutter', 'Ran the daily standup'],
  }),
  exp('waffle', 9, '2023-08-01', '2025-06-30', { company: 'Waffle Hacks' }),
  exp('think', 10, '2023-05-01', '2023-12-31', { company: 'Think Round, Inc.' }),
];

const story = (roles: readonly Experience[] = ROLES) => buildRoleStory(roles, { today: TODAY });
const chapter = (id: string, roles?: readonly Experience[]): StoryChapter => {
  const found = story(roles).chapters.find((each) => each.id === id);
  if (!found) throw new Error(`no chapter ${id}`);
  return found;
};
const ids = (of: StoryChapter): string[] => of.stops.map((stop) => stop.row.id);

describe('buildRoleStory: the chapters', () => {
  it('opens with Now, then every year a role began, newest first', () => {
    expect(story().chapters.map((each) => [each.id, each.title])).toEqual([
      ['now', 'Now'],
      ['y2026', '2026'],
      ['y2024', '2024'],
      ['y2023', '2023'],
    ]);
  });

  it('sets Now as a small inline heading, and the years by the chapter system', () => {
    // The person leads the current-role cards, not a display word: Now is inline whatever its count,
    // a one-role year is inline, and the years with more step down from the numerals.
    expect(story().chapters.map((each) => each.size)).toEqual(['inline', 'inline', 'step', 'step']);
  });

  it('lists every role once, the lead included', () => {
    const listed = story().chapters.flatMap(ids);
    expect(listed).toHaveLength(ROLES.length);
    expect(new Set(listed).size).toBe(ROLES.length);
    expect(story()).toMatchObject({ total: 10, current: 3, firstYear: 2023 });
  });

  it('starts with the first year when no role is current, and gives that chapter the display size', () => {
    const ended = ROLES.map((role) => ({
      ...role,
      current: false,
      endDate: role.endDate ?? '2026-10-31',
    }));
    const built = story(ended);
    expect(built.chapters[0]).toMatchObject({ id: 'y2026', size: 'lead' });
    expect(built.chapters.some((each) => each.kind === 'now')).toBe(false);
  });

  it('ends with "Undated" for an ended role whose start cannot be read', () => {
    const undated = exp('undated', 11, 'soon', '2024-06-30', { company: 'Somewhere' });
    const built = story([...ROLES, undated]);
    const last = built.chapters.at(-1);
    expect(last).toMatchObject({ id: 'undated', title: 'Undated' });
    expect(last?.stops.map((stop) => [stop.row.id, stop.month])).toEqual([['undated', null]]);
  });
});

describe('buildRoleStory: the rail order and the month stops', () => {
  it('puts the lead first under Now, then the others by newest start', () => {
    expect(ids(chapter('now'))).toEqual(['resq', 'handshake', 'elysium']);
    expect(chapter('now').stops.map((stop) => stop.month)).toEqual([
      'Mar 2026',
      'Nov 2025',
      'Jan 2023',
    ]);
  });

  it('orders a year newest start first, its stops marked by the month alone', () => {
    expect(ids(chapter('y2024'))).toEqual(['mlh', 'dfg', 'talent']);
    expect(chapter('y2024').stops.map((stop) => stop.month)).toEqual(['Jun', 'Apr', 'Mar']);
  });

  it('steps the role pages through the roles in the same order', () => {
    const index = buildRoleIndex(ROLES, { today: TODAY });
    expect(storyRowsOf(index).map((row) => row.id)).toEqual(story().chapters.flatMap(ids));
  });
});

describe('buildRoleStory: weight', () => {
  it('sets the first current role in Studio order large, and the other current roles compact', () => {
    expect(chapter('now').stops.map((stop) => stop.weight)).toEqual(['lead', 'compact', 'compact']);
  });

  it("makes each year's longest role its major entry, whatever its place in Studio order", () => {
    // Waffle Hacks ran 23 months, Campaign 180 13, though Campaign 180 comes first in Studio.
    expect(chapter('y2023').stops.map((stop) => [stop.row.id, stop.weight])).toEqual([
      ['c180', 'compact'],
      ['waffle', 'major'],
      ['think', 'compact'],
    ]);
    expect(chapter('y2024').stops.find((stop) => stop.weight === 'major')?.row.id).toBe('dfg');
  });

  it('breaks a tie in length by Studio order', () => {
    const twins = [
      exp('second', 2, '2022-01-01', '2022-06-30', { company: 'Second' }),
      exp('first', 1, '2022-03-01', '2022-08-31', { company: 'First' }),
    ];
    const year = chapter('y2022', twins);
    expect(year.stops.find((stop) => stop.weight === 'major')?.row.id).toBe('first');
  });

  it('gives a one-role year no major entry: it is compact under an inline heading', () => {
    expect(chapter('y2026').stops.map((stop) => stop.weight)).toEqual(['compact']);
  });
});

describe("buildRoleStory: each role's words", () => {
  it('gives the lead its whole description and every duty it does not already state', () => {
    const lead = chapter('now').stops[0];
    expect(linkedPlain(lead?.prose.sentence ?? [])).toBe(
      'ResQ builds coordination software for drones. Pre-revenue, with a demo.',
    );
    expect(lead?.prose.more).toEqual([]);
    expect(lead?.prose.duties.map(linkedPlain)).toEqual([
      'Founded and run the company',
      'Raising a pre-seed round',
    ]);
  });

  it('keeps a compact role to its opening and leaves the rest for "What I did"', () => {
    const c180 = chapter('y2023').stops.find((stop) => stop.row.id === 'c180');
    const sentence = linkedPlain(c180?.prose.sentence ?? []);
    const more = linkedPlain(c180?.prose.more ?? []);
    expect(`${sentence} ${more}`.trim()).toBe(
      'Built apps with Flutter. Configured CI. Wrote tests for every release.',
    );
    // The duty the description states word for word is left out.
    expect(c180?.prose.duties.map(linkedPlain)).toEqual(['Ran the daily standup']);
  });

  it('names the addresses in place instead of printing them', () => {
    const curvance = chapter('y2026').stops[0];
    expect(curvance?.prose.sentence).toContainEqual({
      kind: 'link',
      href: 'https://blog.curvance.com',
      label: 'blog.curvance.com',
    });
    expect(linkedPlain(curvance?.prose.sentence ?? [])).not.toContain('https://');
  });
});

describe('buildRoleStory: one link per address', () => {
  const CASES = 'https://dfg.example/cases';
  const GIRLS = 'https://dfg.example/3d-girls';
  const BOOKS = 'https://dfg.example/books';
  const dfg = (responsibilities: string[]) =>
    exp('dfg', 1, '2024-04-01', '2026-02-28', {
      company: 'Develop for Good',
      description: `Led five nonprofit projects. Case studies: 3D Girls (${GIRLS}) and Barbershop Books (${BOOKS}); also worked with FullCircle Experience.`,
      responsibilities,
    });
  const stopOf = (role: Experience, weight: 'lead' | 'major' | 'compact' = 'major') => ({
    weight,
    prose: proseOf(role, weight),
  });

  it("skips a duty that only links the description's addresses again and says nothing new", () => {
    const { prose } = stopOf(
      dfg([
        `Clients: 3D Girls (${GIRLS}), Barbershop Books (${BOOKS}), FullCircle Experience`,
        'Built a tiered admin system',
      ]),
    );

    expect(prose.duties.map(linkedPlain)).toEqual(['Built a tiered admin system']);
    expect([prose.sentence, ...prose.duties].flatMap(linkedHrefs)).toEqual([GIRLS, BOOKS]);
  });

  it('keeps a duty that says more, its repeated addresses as plain names', () => {
    const { prose } = stopOf(
      dfg([`Shipped the 3D Girls (${GIRLS}) admin to 40 schools, with its case study (${CASES})`]),
    );
    const [duty = []] = prose.duties;

    expect(linkedPlain(duty)).toBe(
      'Shipped the 3D Girls admin to 40 schools, with its case study (dfg.example)',
    );
    expect(linkedHrefs(duty)).toEqual([CASES]);
  });

  it('links an address once across a compact role, its opening, "What I did" and its duties', () => {
    const { prose } = stopOf(
      dfg([`Wrote up 3D Girls (${GIRLS})`, `Wrote up Barbershop Books again (${BOOKS})`]),
      'compact',
    );
    const all = [prose.sentence, prose.more, ...prose.duties].flatMap(linkedHrefs);

    expect(all).toEqual([GIRLS, BOOKS]);
    expect(prose.duties.map(linkedPlain)).toEqual([
      'Wrote up 3D Girls',
      'Wrote up Barbershop Books again',
    ]);
  });

  it("keeps a duty with no links at all, even when its words are the description's", () => {
    const { prose } = stopOf(dfg(['Barbershop Books and 3D Girls']));

    expect(prose.duties.map(linkedPlain)).toEqual(['Barbershop Books and 3D Girls']);
  });
});

describe('buildRoleStory: the path', () => {
  it('puts every dated role on it, and the peak on the clock it is drawn from', () => {
    // Six at once from Jun to Sep 2024: Elysium, DfG, TalentSprint, MLH, Campaign 180, Waffle.
    expect(story().clock.peak?.count).toBe(6);
    expect(story().path.roles).toHaveLength(ROLES.length);
    expect(story().path.columns).toBe(story().axis.columns.length);
  });
});

describe('storyLede', () => {
  it('writes the figures in words: how many, since when and how many still go', () => {
    expect(storyLede(story())).toBe(
      'Ten roles since 2023, three of them still going. Current roles and the work that led here, by the year each role began.',
    );
  });

  it('says all of them, one of them, or none, as the figures say', () => {
    expect(storyLede({ total: 2, current: 2, firstYear: 2024 })).toMatch(
      /^Two roles since 2024, all of them still going\. /,
    );
    expect(storyLede({ total: 1, current: 1, firstYear: 2024 })).toMatch(
      /^One role since 2024, still going\. /,
    );
    expect(storyLede({ total: 3, current: 0, firstYear: 2022 })).toBe(
      'Three roles since 2022. The path so far, by the year each role began.',
    );
    expect(storyLede({ total: 0, current: 0, firstYear: null })).toBe('');
  });

  it('writes counts past twenty in figures', () => {
    expect(numberWord(5)).toBe('five');
    expect(numberWord(21)).toBe('21');
  });
});

describe('chapterNamesOf', () => {
  it('names the lead first, then the rail; three names rather than two and "one more"', () => {
    expect(chapterNamesOf(chapter('now'))).toEqual({
      names: ['ResQ Systems', 'Handshake', 'Elysium'],
      more: 0,
    });
  });

  it("puts a year's major role first", () => {
    expect(chapterNamesOf(chapter('y2023')).names[0]).toBe('Waffle Hacks');
  });

  it('names two and counts the rest past three', () => {
    const many = [
      ...ROLES,
      exp('x', 11, '2023-02-01', '2023-03-31', { company: 'Extra Co' }),
      exp('y', 12, '2023-02-01', '2023-03-31', { company: 'Other Co' }),
    ];
    expect(chapterNamesOf(chapter('y2023', many))).toEqual({
      names: ['Waffle Hacks', 'Campaign 180'],
      more: 3,
    });
  });
});
