// @vitest-environment node
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
 * @file One rule for "now" on every surface (listed-role.ts isNowRole): a role runs now when the
 * site lists it and it is current, by Studio's flag or for want of a readable end date. The home
 * page's hero and roles tile (selectors.ts selectCurrentRoles) and /experience (its lead, "Also
 * now" and the "N now" figure, role-index.ts) give the same answer, the two edge cases included:
 * the flag off with no end date, and the flag on with an end date already past.
 */

import { makeExperience } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';
import { selectCurrentRoles } from '@/app/_components/home/data/selectors';
import {
  isNowRole,
  nowExperiences,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/listed-role';
import { buildRoleIndex } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-index';
import type { Experience } from '@/hooks/sanity/schemas';

const TODAY = '2026-11-14';

/** Studio's flag off and no end date: the old timeline printed "Present" for it. */
const UNFLAGGED = makeExperience({
  _id: 'unflagged',
  order: 1,
  startDate: '2025-02-01',
  endDate: null,
  current: false,
});
/** Studio's flag on, though the end date is past: the flag wins. */
const FLAGGED_ENDED = makeExperience({
  _id: 'flagged-ended',
  order: 2,
  startDate: '2024-03-01',
  endDate: '2025-06-30',
  current: true,
});
const ENDED = makeExperience({
  _id: 'ended',
  order: 3,
  startDate: '2022-01-01',
  endDate: '2023-01-01',
  current: false,
});
const LEAD = makeExperience({
  _id: 'lead',
  order: 0,
  startDate: '2026-03-01',
  endDate: null,
  current: true,
});
/** Current, but it begins next month: on no list yet, so not "now" either. */
const TO_COME = makeExperience({
  _id: 'to-come',
  order: -1,
  startDate: '2026-12-01',
  endDate: null,
  current: true,
});
/** A blank end date reads as none. */
const BLANK_END = makeExperience({
  _id: 'blank-end',
  order: 4,
  startDate: '2023-05-01',
  endDate: '',
  current: false,
});

const ROLES: readonly Experience[] = [ENDED, FLAGGED_ENDED, TO_COME, UNFLAGGED, LEAD, BLANK_END];
const ids = (roles: readonly { readonly _id: string }[]): string[] => roles.map((role) => role._id);

describe('isNowRole', () => {
  it('counts a role with the flag off and no readable end date as now', () => {
    expect(isNowRole(UNFLAGGED, TODAY)).toBe(true);
    expect(isNowRole(BLANK_END, TODAY)).toBe(true);
  });

  it('counts a role with the flag on as now, whatever its end date says', () => {
    expect(isNowRole(FLAGGED_ENDED, TODAY)).toBe(true);
  });

  it('leaves out an ended role, and a current one the site does not list yet', () => {
    expect(isNowRole(ENDED, TODAY)).toBe(false);
    expect(isNowRole(TO_COME, TODAY)).toBe(false);
  });
});

describe('nowExperiences', () => {
  it('keeps the roles that run now, in the order given, and leaves the input as it was', () => {
    const input = [...ROLES];

    expect(ids(nowExperiences(input, TODAY))).toEqual([
      'flagged-ended',
      'unflagged',
      'lead',
      'blank-end',
    ]);
    expect(input).toEqual(ROLES);
  });
});

describe('the home page and /experience agree on "now"', () => {
  it('names the same roles, the edge cases included, and counts them alike', () => {
    const home = selectCurrentRoles(ROLES, TODAY);
    const list = buildRoleIndex(ROLES, { today: TODAY });
    const listNow = [list.lead, ...list.alsoNow].flatMap((row) => (row ? [row.id] : []));

    expect(home.total).toBe(4);
    expect(list.clock.now).toBe(4);
    expect(listNow.toSorted()).toEqual(['blank-end', 'flagged-ended', 'lead', 'unflagged']);
    // The hero names the first in Studio order, which is the list's lead.
    expect(home.roles[0]?._id).toBe(list.lead?.id);
    expect(ids(home.roles)).toEqual(['lead', 'unflagged', 'flagged-ended']);
  });
});
