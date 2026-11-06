// @vitest-environment node
/**
 * Copyright 2025 Mike Odnis
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
 * @file What the home tiles pick from the pages' Sanity lists, and the typing tile's numbers
 * (src/app/_components/home/data/selectors.ts). The rules hold whatever order the list arrives
 * in: Studio order (`order` ascending, then the newer start) for roles and the featured
 * project; the latest day, then the lower `order`, for the last place.
 */

import { makeExperience, makePlace, makeProject } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';
import {
  hasBest60,
  ROLES_SHOWN,
  selectCurrentRoles,
  selectFeaturedProject,
  selectLatestPlace,
  toTypingStats,
} from '@/app/_components/home/data/selectors';
import type { Project } from '@/hooks/sanity/schemas';
import type { MonkeytypeProfile } from '@/lib/api-integrations/monkeytype';

const TODAY = '2026-11-05';

const COVER: NonNullable<Project['image']> = {
  _type: 'image',
  asset: { _ref: 'image-cover-1200x750-png', _type: 'reference' },
};

const ids = (docs: readonly { readonly _id: string }[]): string[] => docs.map((doc) => doc._id);

describe('selectCurrentRoles', () => {
  it('lists the first 3 current roles in Studio order and counts all of them', () => {
    const founder = makeExperience({ current: true, order: 0, position: 'Founder & CEO' });
    const past = makeExperience({ current: false, order: 1 });
    const second = makeExperience({ current: true, order: 2 });
    const third = makeExperience({ current: true, order: 3 });
    const fourth = makeExperience({ current: true, order: 4 });
    const fifth = makeExperience({ current: true, order: 5 });

    const result = selectCurrentRoles([fifth, third, past, founder, fourth, second]);

    expect(ROLES_SHOWN).toBe(3);
    expect(ids(result.roles)).toEqual(ids([founder, second, third]));
    expect(result.total).toBe(5);
  });

  it('puts the newer start first when two roles share an order', () => {
    const older = makeExperience({ current: true, order: 1, startDate: '2023-05-01' });
    const newer = makeExperience({ current: true, order: 1, startDate: '2025-02-01' });

    expect(ids(selectCurrentRoles([older, newer]).roles)).toEqual(ids([newer, older]));
  });

  it('counts zero when no role is current', () => {
    expect(selectCurrentRoles([makeExperience({ current: false })])).toEqual({
      roles: [],
      total: 0,
    });
  });

  it('leaves the input list as it was', () => {
    const list = [
      makeExperience({ current: true, order: 5 }),
      makeExperience({ current: true, order: 1 }),
    ];
    const before = ids(list);

    selectCurrentRoles(list);

    expect(ids(list)).toEqual(before);
  });
});

describe('selectLatestPlace', () => {
  it('skips future-dated and undated places', () => {
    const future = makePlace({ startDate: '2026-12-01' });
    const undated = makePlace({ startDate: null });
    const visited = makePlace({ startDate: '2026-10-30' });

    expect(selectLatestPlace([future, undated, visited], TODAY)?._id).toBe(visited._id);
  });

  it('counts a place dated today as visited', () => {
    const today = makePlace({ startDate: TODAY });

    expect(selectLatestPlace([makePlace({ startDate: '2026-11-01' }), today], TODAY)?._id).toBe(
      today._id,
    );
  });

  it('picks order -94 before -74 on the same date (the later event of the day)', () => {
    const afternoon = makePlace({ startDate: '2026-08-11', order: -74 });
    const evening = makePlace({ startDate: '2026-08-11', order: -94 });
    const earlier = makePlace({ startDate: '2026-08-01', order: -99 });

    expect(selectLatestPlace([earlier, afternoon, evening], TODAY)?._id).toBe(evening._id);
  });

  it('is null when no place is dated on or before today', () => {
    expect(selectLatestPlace([makePlace({ startDate: null }), makePlace({})], '2026-01-01')).toBe(
      null,
    );
    expect(selectLatestPlace([], TODAY)).toBe(null);
  });
});

describe('selectFeaturedProject', () => {
  it('prefers a featured project with a cover over an earlier one without', () => {
    const noCover = makeProject({ featured: true, order: 0 });
    const withCover = makeProject({ featured: true, order: 1, image: COVER });
    const notFeatured = makeProject({ featured: false, order: -1, image: COVER });

    expect(selectFeaturedProject([withCover, notFeatured, noCover])?._id).toBe(withCover._id);
  });

  it('takes the first featured project in Studio order when none has a cover', () => {
    const second = makeProject({ featured: true, order: 2, image: null });
    const first = makeProject({ featured: true, order: 1 });

    expect(selectFeaturedProject([second, first])?._id).toBe(first._id);
  });

  it('is null when no project is featured', () => {
    expect(selectFeaturedProject([makeProject({ featured: false, image: COVER })])).toBe(null);
  });
});

/** A profile with these 60 s bests (none when undefined) and 412 tests. */
const profile = (bests60?: { wpm: number; acc: number }[]): MonkeytypeProfile => ({
  personalBests: { time: bests60 ? { '15': [{ wpm: 180, acc: 99 }], '60': bests60 } : {} },
  typingStats: { completedTests: 412 },
});

describe('toTypingStats', () => {
  it('picks the fastest 60 s entry and rounds wpm to a whole number and accuracy to 1 decimal', () => {
    const stats = toTypingStats(
      profile([
        { wpm: 118.2, acc: 98.04 },
        { wpm: 131.64, acc: 96.66 },
        { wpm: 125.0, acc: 99.9 },
      ]),
    );

    expect(stats).toEqual({ best60: { wpm: 132, accuracy: 96.7 }, completedTests: 412 });
    expect(hasBest60(stats)).toBe(true);
  });

  it('has no 60 s best without a time["60"] entry, even when other modes have one', () => {
    const withoutSixty: MonkeytypeProfile = {
      personalBests: { time: { '15': [{ wpm: 180, acc: 99 }] } },
      typingStats: { completedTests: 3 },
    };

    expect(toTypingStats(withoutSixty)).toEqual({ best60: null, completedTests: 3 });
    expect(toTypingStats(profile([])).best60).toBe(null);
    expect(hasBest60(toTypingStats(profile()))).toBe(false);
  });

  it('has no 60 s best when the profile has no timed bests at all', () => {
    const untimed: MonkeytypeProfile = { personalBests: {}, typingStats: { completedTests: 0 } };

    expect(toTypingStats(untimed).best60).toBe(null);
  });
});
