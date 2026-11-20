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
 * @file "The path so far" (role-path.ts): every dated role on one month axis, oldest first, each
 * on the lowest lane free from its start, its name inside its capsule where it fits at the
 * narrowest packed width and beside it otherwise, with the lane keeping that room free; and how
 * each role's months are spoken.
 */

import { makeExperience } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';

import {
  buildRolePath,
  PATH_LABEL_REM,
  PATH_PACKED_REM,
  type PathRole,
  spokenPeriodOf,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-path';
import { buildRoleStory } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-story';
import type { Experience } from '@/hooks/sanity/schemas';

const TODAY = '2026-11-12';

const exp = (
  id: string,
  order: number,
  startDate: string,
  endDate: string | null,
  company: string,
): Experience =>
  makeExperience({ _id: id, order, startDate, endDate, current: endDate === null, company });

/** Roles shaped like the real ones: a long current one, short fellowships, overlaps. */
const ROLES: readonly Experience[] = [
  exp('resq', 1, '2026-03-01', null, 'ResQ Systems, Inc.'),
  exp('curvance', 2, '2026-03-01', '2026-09-30', 'Curvance'),
  exp('elysium', 3, '2023-01-01', null, 'Elysium'),
  exp('dfg', 4, '2024-04-01', '2026-02-28', 'Develop for Good'),
  exp('mlh', 5, '2024-06-01', '2024-09-30', 'MLH Fellowship'),
  exp('board', 6, '2023-03-01', '2024-01-31', 'District 1 Youth Advisory Board'),
  exp('think', 7, '2023-05-01', '2023-12-31', 'Think Round, Inc.'),
  exp('late', 8, '2026-10-01', null, 'A Rather Long Organization Name'),
];

const pathOf = (roles: readonly Experience[] = ROLES) =>
  buildRoleStory(roles, { today: TODAY }).path;
const byId = (roles: readonly PathRole[], id: string): PathRole => {
  const found = roles.find((role) => role.id === id);
  if (!found) throw new Error(`no ${id} on the path`);
  return found;
};

describe('buildRolePath: the roles', () => {
  it('puts every dated role on the path once, oldest start first, the longer first on a tie', () => {
    expect(pathOf().roles.map((role) => role.id)).toEqual([
      'elysium',
      'board',
      'think',
      'dfg',
      'mlh',
      'resq',
      'curvance',
      'late',
    ]);
  });

  it('links each to its stop on the rail and names it by organization, role and months', () => {
    const resq = byId(pathOf().roles, 'resq');
    const mlh = byId(pathOf().roles, 'mlh');

    expect(resq).toMatchObject({
      href: '#role-resq',
      organization: 'ResQ Systems',
      current: true,
      spoken: 'since Mar 2026',
    });
    expect(mlh).toMatchObject({ current: false, spoken: 'Jun 2024 to Sep 2024' });
  });

  it('places each on the axis by its months, a running role reaching the last column', () => {
    const path = pathOf();
    const elysium = byId(path.roles, 'elysium');
    const mlh = byId(path.roles, 'mlh');

    expect(path.columns).toBe(47);
    expect([elysium.start, elysium.end]).toEqual([0, 47]);
    expect([mlh.start, mlh.end]).toEqual([17, 21]);
  });

  it('leaves out a role with no readable start, and draws nothing on an empty axis', () => {
    const undated = [...ROLES, exp('undated', 9, 'soon', '2024-06-30', 'Somewhere')];

    expect(pathOf(undated).roles.map((role) => role.id)).not.toContain('undated');
    expect(buildRolePath([], 0)).toEqual({ roles: [], lanes: 0, columns: 0 });
  });
});

describe('buildRolePath: lanes and labels', () => {
  it('never lets two capsules, or a capsule and a name beside it, share room on a lane', () => {
    const path = pathOf();
    const remPerColumn = PATH_PACKED_REM / path.columns;
    /** The columns a capsule keeps on its lane, its name beside it included. */
    const room = (role: PathRole): [number, number] => {
      const beside = (role.labelEm * PATH_LABEL_REM) / remPerColumn;
      if (role.label === 'after') return [role.start, role.end + beside];
      if (role.label === 'before') return [role.start - beside, role.end];
      return [role.start, role.end];
    };
    for (let lane = 0; lane < path.lanes; lane += 1) {
      const onLane = path.roles.filter((role) => role.lane === lane).map(room);
      for (const [index, [, end]] of onLane.entries()) {
        const next = onLane[index + 1];
        if (next) expect(end).toBeLessThanOrEqual(next[0]);
      }
    }
  });

  it('stacks as many lanes as roles ever ran at once, or a few more for names set beside', () => {
    const story = buildRoleStory(ROLES, { today: TODAY });

    expect(story.path.lanes).toBeGreaterThanOrEqual(story.clock.peak?.count ?? 0);
    expect(story.path.lanes).toBeLessThanOrEqual(ROLES.length);
  });

  it('sets a name inside a long capsule, after a short one, and before one at the axis end', () => {
    const path = pathOf();

    expect(byId(path.roles, 'elysium').label).toBe('inside');
    expect(byId(path.roles, 'mlh').label).toBe('after');
    expect(byId(path.roles, 'late').label).toBe('before');
  });

  it("measures each name in em at the label's own size, for a narrow row's hang", () => {
    const path = pathOf();

    expect(byId(path.roles, 'elysium').labelEm).toBeGreaterThan(3);
    expect(byId(path.roles, 'board').labelEm).toBeGreaterThan(
      byId(path.roles, 'elysium').labelEm * 3,
    );
  });
});

describe('buildRolePath: date notes', () => {
  const FREELANCE_NOTE = 'Dates cover freelance work, not the establishment of the studio.';
  const noted = (id: string, note: string): readonly Experience[] =>
    ROLES.map((role) => (role._id === id ? { ...role, dateNote: note } : role));

  it("carries a role's date note with a footnote mark, and nothing for the others", () => {
    const path = pathOf(noted('elysium', FREELANCE_NOTE));

    expect(byId(path.roles, 'elysium').note).toEqual({ mark: '*', text: FREELANCE_NOTE });
    expect(path.roles.filter((role) => role.note)).toHaveLength(1);
    expect(pathOf().roles.some((role) => role.note)).toBe(false);
  });

  it("marks several notes in the figure's order, '*' then '**', whatever Studio's order", () => {
    const roles = noted('elysium', FREELANCE_NOTE).map((role) =>
      role._id === 'dfg' ? { ...role, dateNote: 'Part time.' } : role,
    );
    const path = pathOf([...roles].reverse());

    expect(byId(path.roles, 'elysium').note?.mark).toBe('*');
    expect(byId(path.roles, 'dfg').note?.mark).toBe('**');
  });

  it('measures a noted name with its mark, so the mark fits wherever the name is set', () => {
    const plain = byId(pathOf().roles, 'mlh');
    const marked = byId(pathOf(noted('mlh', FREELANCE_NOTE)).roles, 'mlh');

    expect(marked.labelEm).toBeGreaterThan(plain.labelEm);
    expect(marked.insideRem).toBeGreaterThan(plain.insideRem);
  });

  it('ignores a blank date note', () => {
    expect(byId(pathOf(noted('elysium', '   ')).roles, 'elysium').note).toBeUndefined();
  });
});

describe('spokenPeriodOf', () => {
  const rowFor = (start: string, end: string | null) =>
    buildRoleStory([exp('one', 1, start, end, 'One')], { today: TODAY }).chapters[0]?.stops[0]?.row;

  it('says since when for a role that runs, and from and to for one that ended', () => {
    const running = rowFor('2025-11-01', null);
    const ended = rowFor('2024-04-01', '2026-02-28');
    if (!running || !ended) throw new Error('no rows');

    expect(spokenPeriodOf(running)).toBe('since Nov 2025');
    expect(spokenPeriodOf(ended)).toBe('Apr 2024 to Feb 2026');
  });

  it('says a one-month role by its month once', () => {
    const month = rowFor('2023-09-01', '2023-09-30');
    if (!month) throw new Error('no row');

    expect(spokenPeriodOf(month)).toBe('Sep 2023');
  });
});
