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
 * @file The Role ledger's rows: two groups, "Now" (current roles, a missing end date included)
 * and "Before", each in Studio order by default or newest start first by date, with every tie
 * settled the same way on every render (Studio order, then the newer start, then the id). Plus
 * the header's figures, its honest description of the order, and each row's short line.
 */

import { makeExperience } from '@tests/fixtures/sanity-docs';
import { describe, expect, it, vi } from 'vitest';

import {
  buildRoleLedger,
  DEFAULT_ROLE_ORDER,
  ledgerDescription,
  monogramOf,
  parseRoleOrder,
  roleCount,
  shortLineOf,
  sortRoles,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-ledger';
import type { Experience } from '@/hooks/sanity/schemas';

const exp = (
  id: string,
  order: number,
  startDate: string,
  endDate: string | null,
  extra: Partial<Experience> = {},
): Experience => makeExperience({ _id: id, order, startDate, endDate, current: false, ...extra });

/** Studio order 1..6; two current (one by flag, one only by its missing end date). */
const ROLES: readonly Experience[] = [
  exp('curvance', 2, '2026-03-01', '2026-09-30'),
  exp('resq', 1, '2026-03-01', null, { current: true }),
  exp('elysium', 3, '2023-01-01', null),
  exp('dfg', 4, '2024-04-01', '2026-02-28'),
  exp('mlh', 6, '2024-06-01', '2024-09-30'),
  exp('codepath', 5, '2024-06-01', '2025-06-01'),
];

const idsOf = (ledger: ReturnType<typeof buildRoleLedger>) =>
  ledger.groups.map((group) => [group.key, group.entries.map((entry) => entry.id)]);

describe('buildRoleLedger: groups (Studio order, the default)', () => {
  it('is the default order', () => {
    expect(DEFAULT_ROLE_ORDER).toBe('groups');
    expect(idsOf(buildRoleLedger(ROLES))).toEqual(
      idsOf(buildRoleLedger(ROLES, { order: 'groups' })),
    );
  });

  it('puts current roles in Now and the rest in Before, each in Studio order', () => {
    expect(idsOf(buildRoleLedger(ROLES))).toEqual([
      ['now', ['resq', 'elysium']],
      ['before', ['curvance', 'dfg', 'codepath', 'mlh']],
    ]);
  });

  it('counts a role with no end date as current, even without the Studio flag', () => {
    const elysium = buildRoleLedger(ROLES).groups[0]?.entries.find((e) => e.id === 'elysium');
    expect(elysium).toMatchObject({ current: true, period: { text: 'Jan 2023 – Present' } });
  });

  it('settles an equal Studio order by the newer start, then by id', () => {
    const tied = [
      exp('b-old', 1, '2023-01-01', '2023-06-01'),
      exp('z-new', 1, '2024-01-01', '2024-06-01'),
      exp('a-old', 1, '2023-01-01', '2023-06-01'),
    ];
    expect(sortRoles(tied, 'groups').map((role) => role._id)).toEqual(['z-new', 'a-old', 'b-old']);
  });

  it('labels the groups and leaves out an empty one', () => {
    const past = buildRoleLedger([exp('only', 1, '2023-01-01', '2023-02-01')]);
    expect(past.groups.map((group) => [group.key, group.label])).toEqual([['before', 'Before']]);
    const ledger = buildRoleLedger(ROLES);
    expect(ledger.groups.map((group) => group.label)).toEqual(['Now', 'Before']);
  });
});

describe('buildRoleLedger: date (newest start first)', () => {
  it('orders each group by start, newest first, ties in Studio order', () => {
    expect(idsOf(buildRoleLedger(ROLES, { order: 'date' }))).toEqual([
      ['now', ['resq', 'elysium']],
      // codepath (order 5) and mlh (order 6) both started 2024-06: Studio order breaks the tie.
      ['before', ['curvance', 'codepath', 'mlh', 'dfg']],
    ]);
  });

  it('settles an equal start and Studio order by id', () => {
    const tied = [
      exp('b', 3, '2024-06-01', '2024-07-01'),
      exp('a', 3, '2024-06-01', '2024-07-01'),
      exp('c', 1, '2025-01-01', '2025-02-01'),
    ];
    expect(sortRoles(tied, 'date').map((role) => role._id)).toEqual(['c', 'a', 'b']);
  });

  it('sorts a role with no readable start last', () => {
    const roles = [
      exp('undated', 1, 'unknown', '2024-01-01'),
      exp('dated', 9, '2020-01-01', '2020-02-01'),
    ];
    expect(sortRoles(roles, 'date').map((role) => role._id)).toEqual(['dated', 'undated']);
  });

  it('never reorders its input', () => {
    const input = [...ROLES];
    sortRoles(input, 'date');
    expect(input).toEqual(ROLES);
  });
});

describe('the ledger header', () => {
  it('counts the roles, the current ones and the year of the first', () => {
    expect(buildRoleLedger(ROLES).stats).toEqual({ roles: 6, current: 2, firstYear: '2023' });
    expect(buildRoleLedger([]).stats).toEqual({ roles: 0, current: 0, firstYear: null });
  });

  it('calls only the date order chronological', () => {
    expect(ledgerDescription('groups')).not.toMatch(/chronolog/i);
    expect(ledgerDescription('date')).toMatch(/chronological/i);
  });

  it('reads the order from a switch value, falling back to the default', () => {
    expect(parseRoleOrder('date')).toBe('date');
    expect(parseRoleOrder('groups')).toBe('groups');
    expect(parseRoleOrder('nope')).toBe('groups');
    expect(parseRoleOrder(undefined)).toBe('groups');
  });

  it('counts roles in words', () => {
    expect(roleCount(1)).toBe('1 role');
    expect(roleCount(10)).toBe('10 roles');
  });
});

describe('a row', () => {
  it('carries its link, its organization as people say it, its logo and its short line', () => {
    const logoOf = vi.fn(() => 'https://cdn.example/logo.png');
    const role = exp('id with space', 1, '2026-03-01', null, {
      position: 'Founder & CEO',
      company: 'ResQ Systems, Inc.',
      companyUrl: 'https://resq.example',
      location: 'Remote',
      description:
        'ResQ builds coordination software (https://resq.example/demo) for drones. Pre-revenue.',
      logo: { _type: 'image', asset: { _ref: 'image-a-1x1-png', _type: 'reference' } },
    });
    const entry = buildRoleLedger([role], { logoOf }).groups[0]?.entries[0];
    expect(entry).toMatchObject({
      href: '/experience/id%20with%20space',
      role: 'Founder & CEO',
      organization: 'ResQ Systems',
      company: 'ResQ Systems, Inc.',
      companyUrl: 'https://resq.example',
      logo: 'https://cdn.example/logo.png',
      monogram: 'R',
      location: 'Remote',
      line: 'ResQ builds coordination software for drones.',
    });
    expect(logoOf).toHaveBeenCalledWith(role);
  });

  it('has no logo when none is given', () => {
    const entry = buildRoleLedger([exp('x', 1, '2024-01-01', null)]).groups[0]?.entries[0];
    expect(entry?.logo).toBeNull();
  });
});

describe('shortLineOf', () => {
  it('keeps the first sentence without its raw links', () => {
    expect(
      shortLineOf(
        "Built Curvance's blog (https://blog.curvance.com) as lead developer. Then moved the app.",
      ),
    ).toBe("Built Curvance's blog as lead developer.");
  });

  it('does not end a sentence at an abbreviation or a decimal', () => {
    expect(shortLineOf('Joined Think Round, Inc. as an engineer. Later left.')).toBe(
      'Joined Think Round, Inc. as an engineer.',
    );
    expect(shortLineOf('Shipped v2.5 to 7,023 users. More.')).toBe('Shipped v2.5 to 7,023 users.');
  });

  it('collapses whitespace and keeps a description with no full stop whole', () => {
    expect(shortLineOf('  Teaching   fellowship\nfor interviews ')).toBe(
      'Teaching fellowship for interviews',
    );
    expect(shortLineOf('')).toBe('');
  });
});

describe('monogramOf', () => {
  it("is the name's first letter or digit, upper-cased", () => {
    expect(monogramOf('elysium')).toBe('E');
    expect(monogramOf('  3D Girls')).toBe('3');
    expect(monogramOf('(ResQ)')).toBe('R');
    expect(monogramOf('')).toBe('');
  });
});
