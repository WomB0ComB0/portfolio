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
  buildRoleIndex,
  roleRowsOf,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-index';
import { subRolesOf } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-subroles';
import type { TechLinks } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-tech';
import type { Experience } from '@/hooks/sanity/schemas';

const TODAY = '2026-11-16';
const child = (
  key: string,
  position: string,
  startDate: string,
  endDate: string | null,
  extra: Record<string, unknown> = {},
) => ({
  _key: key,
  _type: 'experienceSubRole',
  position,
  startDate,
  endDate,
  current: false,
  ...extra,
});
const parent = (subRoles?: unknown, extra: Partial<Experience> = {}): Experience =>
  ({
    ...makeExperience({
      position: 'Program Lead',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      current: false,
      ...extra,
    }),
    ...(subRoles === undefined ? {} : { subRoles }),
  }) as Experience;
const rows = [
  child('engineer', 'Software Engineer', '2024-01-01', '2024-06-30'),
  child('lead', 'Team Lead', '2024-05-01', '2024-12-31'),
];

describe('subRolesOf', () => {
  it.each([undefined, null, [], 'bad-array'])(
    'preserves a parent without usable child data: %j',
    (subRoles) => {
      expect(subRolesOf(parent(subRoles), { today: TODAY })).toEqual([]);
    },
  );

  it('sorts newest first and permits overlapping ranges on one parent scale', () => {
    const result = subRolesOf(parent(rows), { today: TODAY });
    expect(result.map((r) => r.key)).toEqual(['lead', 'engineer']);
    expect(result[0]?.period.text).toBe('May 2024 – Dec 2024');
    expect(result[0]?.length?.months).toBe(8);
    expect(result[0]?.lane?.startPercent).toBeCloseTo(100 / 3);
    expect(result[0]?.lane?.widthPercent).toBeCloseTo(200 / 3);
    expect(result[1]?.lane).toEqual({ startPercent: 0, widthPercent: 50 });
  });

  it.each([
    child('', 'No key', '2024-01-01', '2024-06-01'),
    child('blank', ' ', '2024-01-01', '2024-06-01'),
    child('bad', 'Bad', 'not-a-date', '2024-06-01'),
    child('invalid-day', 'Bad day', '2024-02-30', '2024-06-01'),
    child('bad-end', 'Bad end', '2024-01-01', 'not-a-date'),
    child('reverse', 'Reversed', '2024-06-01', '2024-01-01'),
    child('reverse-day', 'Reversed day', '2024-01-31', '2024-01-01'),
    child('future', 'Future', '2099-01-01', null, { current: true }),
    child('early', 'Before parent', '2023-12-01', '2024-03-01'),
    child('late', 'After parent', '2024-06-01', '2025-01-01'),
    child('open', 'Still current', '2024-06-01', null, { current: true }),
    child('bad-text', 'Bad type', '2024-01-01', '2024-06-01', { responsibilities: [42] }),
    child('wrong-type', 'Wrong object', '2024-01-01', '2024-06-01', { _type: 'anotherObject' }),
    null,
  ])('omits an invalid or out-of-parent child without hiding the parent: %j', (invalid) => {
    const experience = parent([invalid, rows[0]]);
    const result = subRolesOf(experience, { today: TODAY });
    expect(result.map((r) => r.key)).toEqual(['engineer']);
    expect(buildRoleIndex([experience], { today: TODAY }).total).toBe(1);
  });

  it('deduplicates valid keys and preserves source order when starts tie', () => {
    const result = subRolesOf(
      parent([
        child('one', 'Invalid first', 'bad', null),
        child('one', 'First valid', '2024-01-01', '2024-03-01'),
        child('two', 'Same start', '2024-01-01', '2024-06-01'),
        child('one', 'Duplicate', '2024-06-01', '2024-12-01'),
      ]),
      { today: TODAY },
    );
    expect(result.map((r) => [r.key, r.position])).toEqual([
      ['one', 'First valid'],
      ['two', 'Same start'],
    ]);
  });

  it('uses supplied today for ongoing children and retains legacy missing-end semantics', () => {
    const result = subRolesOf(
      parent(
        [
          child('ongoing', 'Current role', '2026-09-01', null),
          child('not-yet', 'Future role', '2026-12-01', null),
        ],
        { startDate: '2026-01-01', endDate: null, current: true },
      ),
      { today: TODAY },
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.period.current).toBe(true);
    expect(result[0]?.length?.months).toBe(3);
    expect(result[0]?.lane?.startPercent).toBeCloseTo((8 / 11) * 100);
    expect(result[0]?.lane?.widthPercent).toBeCloseTo((3 / 11) * 100);
  });

  it('clips planned end dates to today for length and lanes on a current parent', () => {
    const result = subRolesOf(
      parent([child('planned', 'Fixed term', '2026-10-01', '2027-03-01')], {
        startDate: '2026-01-01',
        endDate: null,
        current: true,
      }),
      { today: TODAY },
    );
    expect(result[0]?.period.end?.iso).toBe('2027-03');
    expect(result[0]?.length?.months).toBe(2);
    expect(result[0]?.lane?.widthPercent).toBeCloseTo((2 / 11) * 100);
  });

  it('keeps dated children without drawing a lane when the parent start is unreadable', () => {
    const result = subRolesOf(parent([rows[0]], { startDate: 'unrecorded' }), { today: TODAY });
    expect(result[0]?.period.start?.iso).toBe('2024-01');
    expect(result[0]?.lane).toBeNull();
  });

  it('shapes plain descriptions, duties, explicit links and technology links with existing helpers', () => {
    const techLinks: TechLinks = new Map([
      ['typescript', { label: 'TypeScript', href: '/projects?tech=typescript', projects: 2 }],
    ]);
    const result = subRolesOf(
      parent([
        child('one', 'Engineer', '2024-01-01', '2024-12-31', {
          description: 'Built tools (https://tools.example.com).',
          responsibilities: ['Published a guide (https://guide.example.com).'],
          technologies: [' TypeScript ', 'Rust'],
        }),
      ]),
      { today: TODAY, techLinks },
    );
    expect(result[0]?.description).toBe('Built tools.');
    expect(result[0]?.duties).toEqual(['Published a guide.']);
    expect(result[0]?.links.map((l) => l.href)).toEqual([
      'https://tools.example.com',
      'https://guide.example.com',
    ]);
    expect(result[0]?.tech.map((t) => [t.name, t.link?.href ?? null])).toEqual([
      ['TypeScript', '/projects?tech=typescript'],
      ['Rust', null],
    ]);
  });
});

describe('parent engagement integration', () => {
  it('keeps a concurrent same-start engagement title instead of inventing a promotion', () => {
    const experience = parent(
      [
        child('product', 'Product Engineer', '2023-01-01', null, { current: true }),
        child('platform', 'Platform Engineer', '2023-01-15', null, { current: true }),
      ],
      {
        company: 'Elysium',
        position: 'Full Stack Engineer',
        startDate: '2023-01-01',
        endDate: null,
        current: true,
      },
    );
    const result = buildRoleIndex([experience], { today: TODAY });
    const row = roleRowsOf(result)[0];
    expect(row?.role).toBe('Full Stack Engineer');
    expect(row?.subRoles).toHaveLength(2);
    expect(result.total).toBe(1);
    expect(result.clock.peak?.count).toBe(1);
  });

  it('retains a progression when the preceding role ends in the next role’s start month', () => {
    const experience = parent([
      child('engineer', 'Software Engineer', '2024-01-01', '2024-06-30'),
      child('lead', 'Program Lead', '2024-06-01', '2024-12-31'),
    ]);
    const result = buildRoleIndex([experience], { today: TODAY });
    expect(roleRowsOf(result)[0]?.role).toBe('Software Engineer → Program Lead');
    expect(result.total).toBe(1);
  });

  it('keeps different employment types on overlapping children without adding engagements', () => {
    const experience = parent(
      [
        { ...rows[0], employmentType: '  Part-time  ' },
        { ...rows[1], employmentType: 'Freelance' },
      ],
      { employmentType: '  Contract  ' },
    );
    const result = buildRoleIndex([experience], { today: TODAY });
    const row = roleRowsOf(result)[0];
    expect(row?.employmentType).toBe('Contract');
    expect(row?.subRoles.map((role) => role.employmentType)).toEqual(['Freelance', 'Part-time']);
    expect(result.total).toBe(1);
    expect(result.clock.peak?.count).toBe(1);
    expect(result.clock.spans.size).toBe(1);
  });

  it.each([undefined, null, '', '  '])(
    'omits absent or blank employment metadata: %j',
    (employmentType) => {
      const experience = parent([{ ...rows[0], employmentType }], { employmentType });
      const row = roleRowsOf(buildRoleIndex([experience], { today: TODAY }))[0];
      expect(row).not.toHaveProperty('employmentType');
      expect(row?.subRoles[0]).not.toHaveProperty('employmentType');
    },
  );

  it('does not invent a child type from its parent employment type', () => {
    const row = roleRowsOf(
      buildRoleIndex([parent(rows, { employmentType: 'Full-time' })], { today: TODAY }),
    )[0];
    expect(row?.employmentType).toBe('Full-time');
    expect(row?.subRoles.every((role) => role.employmentType === undefined)).toBe(true);
  });
  it('uses chronological progression without counting child overlap as extra employment', () => {
    const experience = parent(rows);
    const original = JSON.stringify(experience);
    const result = buildRoleIndex([experience], { today: TODAY });
    const row = roleRowsOf(result)[0];
    expect(row?.role).toBe('Software Engineer → Team Lead');
    expect(row?.subRoles).toHaveLength(2);
    expect(row?.period.text).toBe('Jan 2024 – Dec 2024');
    expect(row?.length?.months).toBe(12);
    expect(result.total).toBe(1);
    expect(result.clock.peak?.count).toBe(1);
    expect(result.clock.spans.size).toBe(1);
    expect(JSON.stringify(experience)).toBe(original);
  });

  it('preserves existing titles and counts for old docs or a single title', () => {
    for (const experience of [parent(), parent([rows[0]])]) {
      const result = buildRoleIndex([experience], { today: TODAY });
      expect(roleRowsOf(result)[0]?.role).toBe('Program Lead');
      expect(result.total).toBe(1);
    }
    expect(roleRowsOf(buildRoleIndex([parent()], { today: TODAY }))[0]?.subRoles).toEqual([]);
  });
});
