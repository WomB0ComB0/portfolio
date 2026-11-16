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
 * @file /experience/[id]'s model: the role as the list's row (words, length, links, technologies,
 * lane), its whole description without raw addresses, the roles that ran beside it with the
 * months they shared, how many ran at once at its busiest, the roles before and after it in the
 * list's own order, and the way back to its row on the list. Everything is read from the
 * experiences and the day passed in.
 */

import { makeExperience, makeProject } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';

import { peakText } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-clock';
import { buildRolePage } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-page';
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
      "Built Curvance's company blog (https://blog.curvance.com) from scratch as lead developer. Then moved the app (https://app.curvance.com) to a newer router.",
    responsibilities: [
      "Built Curvance's company blog from scratch as lead developer",
      'Added 172 of its 174 tests (https://github.com/example/cms)',
    ],
    technologies: ['Astro', 'TypeScript'],
  }),
  exp('resq', 1, '2026-03-01', null, { company: 'ResQ Systems, Inc.', position: 'Founder & CEO' }),
  exp('elysium', 3, '2023-01-01', null, { company: 'Elysium' }),
  exp('dfg', 4, '2024-04-01', '2026-02-28'),
  exp('mlh', 6, '2024-06-01', '2024-09-30'),
  exp('handshake', 5, '2025-11-01', null),
];

const page = (id: string, extra: Partial<Parameters<typeof buildRolePage>[2]> = {}) => {
  const built = buildRolePage(ROLES, id, { today: TODAY, ...extra });
  if (!built) throw new Error(`no page for ${id}`);
  return built;
};

describe('buildRolePage: the role', () => {
  it("is the list's own row for the role: words, length, links and lane", () => {
    const { role } = page('curvance');

    expect(role).toMatchObject({
      id: 'curvance',
      href: '/experience/curvance',
      role: 'Software Engineer',
      organization: 'Curvance',
      location: 'Remote',
      current: false,
    });
    expect(role.length?.text).toBe('7 mos');
    expect(role.lane).toEqual({ start: 38, end: 45, current: false });
    expect(role.links.map((link) => link.href)).toEqual([
      'https://blog.curvance.com',
      'https://app.curvance.com',
      'https://github.com/example/cms',
    ]);
  });

  it('prints the whole description, every sentence, without its raw addresses', () => {
    expect(page('curvance').description).toBe(
      "Built Curvance's company blog from scratch as lead developer. Then moved the app to a newer router.",
    );
  });

  it('keeps only the duties the description does not already state', () => {
    expect(page('curvance').role.duties).toEqual(['Added 172 of its 174 tests']);
  });

  it('links a technology into /projects only where a project has it', () => {
    const techLinks = buildTechLinks([makeProject({ technologies: ['TypeScript'] })]);
    const { role } = page('curvance', { techLinks });

    expect(role.tech.map((token) => [token.name, token.link?.href ?? null])).toEqual([
      ['Astro', null],
      ['TypeScript', '/projects?tech=typescript'],
    ]);
  });

  it('is null for an id no experience has', () => {
    expect(buildRolePage(ROLES, 'nope', { today: TODAY })).toBeNull();
    expect(buildRolePage([], 'curvance', { today: TODAY })).toBeNull();
  });
});

describe('buildRolePage: on the clock', () => {
  it('names the roles that ran beside it, the most months shared first, with the months', () => {
    const { alongside } = page('dfg');

    // Apr 2024 to Feb 2026: Elysium for all 23 months; Handshake and MLH for four each, in
    // Studio order.
    expect(alongside.map((each) => [each.role.id, each.shared.text])).toEqual([
      ['elysium', '1 yr 11 mos'],
      ['handshake', '4 mos'],
      ['mlh', '4 mos'],
    ]);
  });

  it('gives each of them as its own row, so it can link to its page', () => {
    const [first] = page('dfg').alongside;

    expect(first?.role).toMatchObject({ href: '/experience/elysium', organization: 'Elysium' });
    expect(first?.shared.spoken).toBe('1 year 11 months');
  });

  it('says how many ran at once at its busiest, itself counted, and when', () => {
    const { busiest } = page('dfg');

    // Itself and Elysium, with MLH from Jun to Sep 2024 and with Handshake from Nov 2025.
    expect(busiest?.count).toBe(3);
    expect(busiest?.runs).toHaveLength(2);
    expect(peakText(busiest)).toBe('first in Jun – Sep 2024');
  });

  it('carries the one clock every role is drawn on', () => {
    const { clock, axis } = page('dfg');

    expect(clock.months).toHaveLength(47);
    expect(axis.columns).toHaveLength(47);
    expect(clock.now).toBe(3);
  });

  it('has no one alongside, and no busiest months, for an ended role with no readable start', () => {
    const undated = exp('undated', 7, 'soon', '2024-06-30');
    const built = buildRolePage([...ROLES, undated], 'undated', { today: TODAY });

    expect(built?.role.lane).toBeNull();
    expect(built?.alongside).toEqual([]);
    expect(built?.busiest).toBeNull();
  });

  it('has no page for a role the list leaves out: current with no readable start, or not begun', () => {
    const undated = exp('undated', 7, 'soon', null);
    const next = exp('next', 8, '2026-12-01', null);

    expect(buildRolePage([...ROLES, undated], 'undated', { today: TODAY })).toBeNull();
    expect(buildRolePage([...ROLES, next], 'next', { today: TODAY })).toBeNull();
  });
});

describe('buildRolePage: the way back to the list', () => {
  it("leads back to the role's own row, which the list marks as where the visitor came from", () => {
    expect(page('curvance').listHref).toBe('/experience#role-curvance');
    expect(page('elysium').listHref).toBe('/experience#role-elysium');
    expect(page('mlh').listHref).toBe('/experience#role-mlh');
  });

  it('leads the lead back to its own stop too: the story hangs every role on the rail', () => {
    expect(page('resq').listHref).toBe('/experience#role-resq');
  });

  it('keeps every way back at its stop, whatever order is asked for', () => {
    expect(page('resq', { order: 'date' }).listHref).toBe('/experience#role-resq');
    expect(page('handshake', { order: 'date' }).listHref).toBe('/experience#role-handshake');
  });

  it("gives every role a row to return to when none is current: there is no lead's tile then", () => {
    const ended = ROLES.map((role) => ({ ...role, current: false, endDate: '2026-10-31' }));
    const built = buildRolePage(ended, 'resq', { today: TODAY });

    expect(built?.listHref).toBe('/experience#role-resq');
  });
});

describe('buildRolePage: the roles before and after', () => {
  it("follows the story's rail: the lead, the others now by newest start, then each year", () => {
    // Now: ResQ, Handshake (Nov 2025), Elysium (Jan 2023); 2026: Curvance; 2024: MLH (Jun), DfG (Apr).
    const order = ['resq', 'handshake', 'elysium', 'curvance', 'mlh', 'dfg'];

    for (const [index, id] of order.entries()) {
      const { previous, next } = page(id);
      expect(previous?.id ?? null).toBe(order[index - 1] ?? null);
      expect(next?.id ?? null).toBe(order[index + 1] ?? null);
    }
  });

  it('has no role before the first or after the last', () => {
    expect(page('resq').previous).toBeNull();
    expect(page('dfg').next).toBeNull();
  });

  it('has neither when the role is the only one', () => {
    const only = buildRolePage(ROLES.slice(0, 1), 'curvance', { today: TODAY });

    expect(only).toMatchObject({ previous: null, next: null, alongside: [] });
  });

  it('keeps the rail order when the date order is asked for: the rail is already by date', () => {
    const { previous, next } = page('elysium', { order: 'date' });

    // Now by newest start: ResQ leads, then Handshake (Nov 2025), then Elysium (Jan 2023).
    expect(previous?.id).toBe('handshake');
    expect(next?.id).toBe('curvance');
  });
});
