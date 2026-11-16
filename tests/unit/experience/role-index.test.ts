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
 * @file The /experience list's model: the lead role (the first current one in Studio order),
 * the other current roles, the "Also now" and Before groups without the lead, each row's words,
 * length, links, technologies and lane on the shared clock. Everything is read from the
 * experiences and the day passed in.
 */

import { makeExperience, makeProject } from '@tests/fixtures/sanity-docs';
import { describe, expect, it, vi } from 'vitest';

import {
  buildRoleIndex,
  roleRowAnchor,
  roleRowsOf,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-index';
import { buildTechLinks } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-tech';
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

/** Studio order 1 to 6: three current roles, three ended. */
const ROLES: readonly Experience[] = [
  exp('curvance', 2, '2026-03-01', '2026-09-30', {
    company: 'Curvance',
    position: 'Software Engineer',
    location: 'Remote',
    description:
      "Built Curvance's company blog (https://blog.curvance.com) from scratch as lead developer. Then moved the app.",
    responsibilities: [
      "Built Curvance's company blog from scratch as lead developer",
      'Added 172 of its 174 tests (https://github.com/example/cms)',
    ],
    technologies: ['Astro', 'TypeScript', 'React.js'],
  }),
  exp('resq', 1, '2026-03-01', null, {
    company: 'ResQ Systems, Inc.',
    position: 'Founder & CEO',
    description:
      'ResQ Systems builds coordination software for multi-drone operations. Pre-revenue, with a simulation-based demo.',
  }),
  exp('elysium', 3, '2023-01-01', null, { company: 'Elysium' }),
  exp('dfg', 4, '2024-04-01', '2026-02-28'),
  exp('mlh', 6, '2024-06-01', '2024-09-30'),
  exp('handshake', 5, '2025-11-01', null),
];

const idsOf = (rows: readonly { readonly id: string }[]): string[] => rows.map((row) => row.id);
const groupsOf = (index: ReturnType<typeof buildRoleIndex>) =>
  index.groups.map((group) => [group.key, idsOf(group.rows)]);
const rowOf = (index: ReturnType<typeof buildRoleIndex>, id: string) => {
  const row = index.groups.flatMap((group) => group.rows).find((each) => each.id === id);
  if (!row) throw new Error(`no row ${id}`);
  return row;
};

describe('buildRoleIndex: the lead and the groups', () => {
  it('leads with the first current role in Studio order', () => {
    const index = buildRoleIndex(ROLES, { today: TODAY });

    expect(index.lead).toMatchObject({
      id: 'resq',
      role: 'Founder & CEO',
      organization: 'ResQ Systems',
      href: '/experience/resq',
    });
  });

  it('lists the other current roles, and never the lead again', () => {
    const index = buildRoleIndex(ROLES, { today: TODAY });

    expect(idsOf(index.alsoNow)).toEqual(['elysium', 'handshake']);
    expect(groupsOf(index)).toEqual([
      ['now', ['elysium', 'handshake']],
      ['before', ['curvance', 'dfg', 'mlh']],
    ]);
    // The lead is "Now"; the group under it is the rest of what runs now, so it says so.
    expect(index.groups.map((group) => group.label)).toEqual(['Also now', 'Before']);
  });

  it("names a row's anchor from its id, for a link that jumps to it", () => {
    expect(roleRowAnchor('exp-curvance')).toBe('role-exp-curvance');
  });

  it('counts every role, the lead included', () => {
    expect(buildRoleIndex(ROLES, { today: TODAY }).total).toBe(6);
  });

  it('keeps the lead in Studio order when the rows go by date', () => {
    const index = buildRoleIndex(ROLES, { today: TODAY, order: 'date' });

    expect(index.lead?.id).toBe('resq');
    expect(groupsOf(index)).toEqual([
      ['now', ['handshake', 'elysium']],
      ['before', ['curvance', 'mlh', 'dfg']],
    ]);
    expect(idsOf(index.alsoNow)).toEqual(['handshake', 'elysium']);
  });

  it('has no Now group when the lead is the only current role', () => {
    const index = buildRoleIndex(
      ROLES.filter((role) => !['elysium', 'handshake'].includes(role._id)),
      { today: TODAY },
    );

    expect(index.lead?.id).toBe('resq');
    expect(index.alsoNow).toEqual([]);
    expect(groupsOf(index)).toEqual([['before', ['curvance', 'dfg', 'mlh']]]);
  });

  it('has no lead when no role is current', () => {
    const index = buildRoleIndex(
      ROLES.filter((role) => !role.current),
      { today: TODAY },
    );

    expect(index.lead).toBeNull();
    expect(index.alsoNow).toEqual([]);
    expect(groupsOf(index)).toEqual([['before', ['curvance', 'dfg', 'mlh']]]);
  });

  it('is empty for no experiences', () => {
    const index = buildRoleIndex([], { today: TODAY });

    expect(index).toMatchObject({ lead: null, alsoNow: [], groups: [], total: 0 });
    expect(index.clock.months).toEqual([]);
    expect(index.axis.columns).toEqual([]);
  });
});

describe('roleRowsOf', () => {
  it('lists every role once: the lead, then Now, then Before', () => {
    expect(idsOf(roleRowsOf(buildRoleIndex(ROLES, { today: TODAY })))).toEqual([
      'resq',
      'elysium',
      'handshake',
      'curvance',
      'dfg',
      'mlh',
    ]);
  });

  it('lists the rows alone when no role leads, and none for no roles', () => {
    const ended = ROLES.filter((role) => !role.current);

    expect(idsOf(roleRowsOf(buildRoleIndex(ended, { today: TODAY })))).toEqual([
      'curvance',
      'dfg',
      'mlh',
    ]);
    expect(roleRowsOf(buildRoleIndex([], { today: TODAY }))).toEqual([]);
  });
});

describe('buildRoleIndex: a row', () => {
  it("carries the role's words: the first sentence whole, and the lead's sentences", () => {
    const index = buildRoleIndex(ROLES, { today: TODAY });

    expect(rowOf(index, 'curvance')).toMatchObject({
      role: 'Software Engineer',
      organization: 'Curvance',
      location: 'Remote',
      line: "Built Curvance's company blog from scratch as lead developer.",
    });
    expect(index.lead?.line).toBe(
      'ResQ Systems builds coordination software for multi-drone operations.',
    );
    expect(index.lead?.lede).toBe(
      'ResQ Systems builds coordination software for multi-drone operations. Pre-revenue, with a simulation-based demo.',
    );
  });

  it('drops the duty the description already states, and prints the rest without raw links', () => {
    expect(rowOf(buildRoleIndex(ROLES, { today: TODAY }), 'curvance').duties).toEqual([
      'Added 172 of its 174 tests',
    ]);
  });

  it('names each address in the description and the duties once', () => {
    expect(rowOf(buildRoleIndex(ROLES, { today: TODAY }), 'curvance').links).toEqual([
      { href: 'https://blog.curvance.com', label: 'blog.curvance.com', host: null, token: false },
      {
        href: 'https://github.com/example/cms',
        label: 'example/cms',
        host: 'github.com',
        token: true,
      },
    ]);
  });

  it('gives its length to the day passed in, and its period', () => {
    const index = buildRoleIndex(ROLES, { today: TODAY });

    expect(index.lead?.length).toMatchObject({ months: 9, text: '9 mos' });
    expect(rowOf(index, 'elysium').length?.text).toBe('3 yrs 11 mos');
    expect(rowOf(index, 'curvance')).toMatchObject({
      current: false,
      length: { text: '7 mos' },
      period: { text: 'Mar 2026 – Sep 2026' },
    });
    expect(buildRoleIndex(ROLES, { today: '2026-12-02' }).lead?.length?.text).toBe('10 mos');
  });

  it('never reads the day from a clock of its own', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2031-06-15T12:00:00Z'));
    try {
      const index = buildRoleIndex(ROLES, { today: TODAY });
      expect(index.clock.months).toHaveLength(47);
      expect(index.lead?.length?.text).toBe('9 mos');
    } finally {
      vi.useRealTimers();
    }
  });

  it('links a technology only where /projects has it, with the project count', () => {
    const techLinks = buildTechLinks([
      makeProject({ technologies: ['TypeScript', 'React'] }),
      makeProject({ technologies: ['TypeScript'] }),
    ]);
    const row = rowOf(buildRoleIndex(ROLES, { today: TODAY, techLinks }), 'curvance');

    expect(row.tech).toEqual([
      { name: 'Astro', link: null },
      {
        name: 'TypeScript',
        link: { href: '/projects?tech=typescript', label: 'TypeScript', projects: 2 },
      },
      { name: 'React.js', link: { href: '/projects?tech=react', label: 'React', projects: 1 } },
    ]);
  });

  it('links no technology without the projects', () => {
    const row = rowOf(buildRoleIndex(ROLES, { today: TODAY }), 'curvance');

    expect(row.tech.map((token) => token.link)).toEqual([null, null, null]);
  });

  it('asks for a logo only where Studio has one', () => {
    const logo = {
      _type: 'image' as const,
      asset: { _ref: 'image-logo-200x200-png', _type: 'reference' as const },
    };
    const logoOf = vi.fn(() => 'https://cdn.example/logo.png');
    const index = buildRoleIndex(
      [exp('with', 1, '2024-01-01', null, { logo }), exp('without', 2, '2024-01-01', '2024-06-30')],
      { today: TODAY, logoOf },
    );

    expect(logoOf).toHaveBeenCalledTimes(1);
    expect(index.lead).toMatchObject({ logo: 'https://cdn.example/logo.png' });
    expect(rowOf(index, 'without')).toMatchObject({ logo: null, monogram: 'C' });
  });
});

describe('buildRoleIndex: the clock and each lane', () => {
  it('draws every role on one clock, the lead included', () => {
    const index = buildRoleIndex(ROLES, { today: TODAY });

    expect(index.clock.months).toHaveLength(47);
    expect(index.clock.now).toBe(3);
    expect(index.clock.spans.has('resq')).toBe(true);
    expect(index.axis.unit).toBe('month');
    expect(index.axis.columns).toHaveLength(47);
  });

  it("gives each row its lane in the axis' columns", () => {
    const index = buildRoleIndex(ROLES, { today: TODAY });

    expect(index.lead?.lane).toEqual({ start: 38, end: 47, current: true });
    expect(rowOf(index, 'elysium').lane).toEqual({ start: 0, end: 47, current: true });
    expect(rowOf(index, 'mlh').lane).toEqual({ start: 17, end: 21, current: false });
  });

  it('gives the lane in quarters once the history is drawn in quarters', () => {
    const index = buildRoleIndex(ROLES, { today: '2028-01-20' });

    expect(index.axis.unit).toBe('quarter');
    expect(rowOf(index, 'mlh').lane).toEqual({ start: 5, end: 7, current: false });
  });

  it('gives a role with no readable start no lane and no length', () => {
    const index = buildRoleIndex(
      [exp('known', 1, '2024-01-01', null), exp('undated', 2, 'unknown', '2024-06-30')],
      { today: TODAY },
    );

    expect(rowOf(index, 'undated')).toMatchObject({ lane: null, length: null });
  });
});
