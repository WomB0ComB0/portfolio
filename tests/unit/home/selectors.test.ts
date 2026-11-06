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
 * project; past visits only (a visit's last day, a range's end, strictly before the cutoff day:
 * New York's today 12 hours ago), the latest last day first, then the lower `order`, for the last
 * place; the owner's newest commit day in the last 30 days (by New York's calendar) to a
 * repository (else its owner's root) a project's githubUrl names, never this site's, for his
 * latest work. selectLatestPlace takes the cutoff day; TODAY stands for it.
 */

import { makeExperience, makePlace, makeProject } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';
import {
  ACTIVE_PROJECT_WINDOW_DAYS,
  hasBest60,
  lastDayIfOver,
  PLACE_CUTOFF_HOUR_ET,
  parseGitHubPath,
  placeCutoffDay,
  ROLES_SHOWN,
  SITE_REPOSITORY,
  selectActiveProject,
  selectCurrentRoles,
  selectFeaturedProject,
  selectLatestPlace,
  selectProjectPick,
  toTypingStats,
} from '@/app/_components/home/data/selectors';
import type { Project } from '@/hooks/sanity/schemas';
import type { CommittedRepo } from '@/lib/api-integrations/github-activity';
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

  // Past visits only (owner decision): a visit dated today may not be over, so it never shows.
  it('never picks a visit dated today, whatever its order', () => {
    const today = makePlace({ startDate: TODAY, order: -999 });
    const before = makePlace({ startDate: '2026-11-01' });

    expect(selectLatestPlace([before, today], TODAY)?._id).toBe(before._id);
    expect(selectLatestPlace([today], TODAY)).toBe(null);
  });

  it('picks a visit dated yesterday over an older one', () => {
    const yesterday = makePlace({ startDate: '2026-11-04' });
    const older = makePlace({ startDate: '2026-11-01', order: -999 });

    expect(selectLatestPlace([older, yesterday], TODAY)?._id).toBe(yesterday._id);
  });

  it('picks order -94 before -74 on the same date (the later event of the day)', () => {
    const afternoon = makePlace({ startDate: '2026-08-11', order: -74 });
    const evening = makePlace({ startDate: '2026-08-11', order: -94 });
    const earlier = makePlace({ startDate: '2026-08-01', order: -99 });

    expect(selectLatestPlace([earlier, afternoon, evening], TODAY)?._id).toBe(evening._id);
  });

  describe('around a stated run of visits (the live places, Nov 2026)', () => {
    // Corgi NYC's visits were Jul 29 and Sep 15, stored as one range; the rest are single days.
    const corgi = makePlace({
      name: 'Corgi NYC',
      category: 'Event',
      startDate: '2026-07-29',
      endDate: '2026-09-15',
      order: -91,
    });
    const buildFridays = makePlace({ name: 'build fridays', startDate: '2026-08-21', order: -98 });
    const pitchAndRun = makePlace({ name: 'Pitch and Run', startDate: '2026-08-21', order: -97 });
    const antler = makePlace({ name: 'Antler NYC', startDate: '2026-08-11', order: -74 });
    const places = [corgi, buildFridays, pitchAndRun, antler];

    it('ranks the range by its last day once that day is over, beating days inside it', () => {
      expect(selectLatestPlace(places, TODAY)?.name).toBe('Corgi NYC');
      expect(selectLatestPlace(places, '2026-09-16')?.name).toBe('Corgi NYC');
    });

    // Until the day after its last day, he may still be going there: the range is not shown.
    it.each(['2026-08-22', '2026-09-01', '2026-09-14', '2026-09-15'])(
      'skips the range while it is on, so the latest single day before it wins on %s',
      (today) => {
        expect(selectLatestPlace(places, today)?.name).toBe('build fridays');
      },
    );

    it('picks a single day inside the range once that day is over, whatever its order', () => {
      expect(selectLatestPlace([corgi, antler], '2026-08-12')?.name).toBe('Antler NYC');
      expect(selectLatestPlace([corgi, antler], '2026-08-11')).toBe(null);
    });
  });

  it('never picks a range that is on, however recently it started', () => {
    const hackathon = makePlace({ startDate: '2026-11-04', endDate: '2026-11-06', order: -99 });
    const before = makePlace({ startDate: '2026-11-03', order: 5 });

    expect(selectLatestPlace([before, hackathon], TODAY)?._id).toBe(before._id);
    expect(selectLatestPlace([hackathon], TODAY)).toBe(null);
  });

  it('skips a range that ends today, and picks one that ended yesterday by its last day', () => {
    const endsToday = makePlace({ startDate: '2026-10-01', endDate: TODAY, order: -99 });
    const endedYesterday = makePlace({ startDate: '2026-10-01', endDate: '2026-11-04', order: 0 });
    const single = makePlace({ startDate: '2026-11-03', order: -50 });

    expect(selectLatestPlace([endsToday, single], TODAY)?._id).toBe(single._id);
    expect(selectLatestPlace([single, endedYesterday, endsToday], TODAY)?._id).toBe(
      endedYesterday._id,
    );
  });

  it('breaks a tie between a range that ended yesterday and a day yesterday by order', () => {
    const range = makePlace({ startDate: '2026-10-01', endDate: '2026-11-04', order: -10 });
    const earlier = makePlace({ startDate: '2026-11-04', order: -20 });
    const later = makePlace({ startDate: '2026-11-04', order: 0 });

    expect(selectLatestPlace([range, earlier], TODAY)?._id).toBe(earlier._id);
    expect(selectLatestPlace([later, range], TODAY)?._id).toBe(range._id);
  });

  it('counts a range that ends on its first day as that one day', () => {
    const yesterday = makePlace({ startDate: '2026-11-04', endDate: '2026-11-04' });

    expect(selectLatestPlace([yesterday], TODAY)?._id).toBe(yesterday._id);
    expect(selectLatestPlace([makePlace({ startDate: TODAY, endDate: TODAY })], TODAY)).toBe(null);
  });

  it('compares the date part of a timestamp', () => {
    const lateYesterday = makePlace({ startDate: '2026-11-04T23:30:00Z' });
    const overnight = makePlace({
      startDate: '2026-11-04T22:00:00Z',
      endDate: `${TODAY}T02:00:00Z`,
    });

    expect(selectLatestPlace([lateYesterday], TODAY)?._id).toBe(lateYesterday._id);
    expect(selectLatestPlace([overnight], TODAY)).toBe(null);
  });

  it('skips a range that has not started, however late it ends', () => {
    const upcoming = makePlace({ startDate: '2026-11-06', endDate: '2026-11-08' });
    const past = makePlace({ startDate: '2026-10-01' });

    expect(selectLatestPlace([upcoming, past], TODAY)?._id).toBe(past._id);
  });

  it('ignores an end before the start (bad data), ranking the place by its start', () => {
    const backwards = makePlace({ startDate: '2026-10-20', endDate: '2026-10-02' });
    const between = makePlace({ startDate: '2026-10-10' });

    expect(selectLatestPlace([between, backwards], TODAY)?._id).toBe(backwards._id);
  });

  it('is null when no visit is over by today', () => {
    expect(selectLatestPlace([makePlace({ startDate: null }), makePlace({})], '2026-01-01')).toBe(
      null,
    );
    const onNow = [
      makePlace({ startDate: TODAY }),
      makePlace({ startDate: '2026-11-01', endDate: '2026-11-09' }),
    ];
    expect(selectLatestPlace(onNow, TODAY)).toBe(null);
    expect(selectLatestPlace([], TODAY)).toBe(null);
  });
});

// Visits are stored as days, not times, so midnight in New York is too soon to call one over: an
// evening event may still be going, and west of New York the day is not over yet.
describe('placeCutoffDay', () => {
  it('waits until noon on the next New York day', () => {
    expect(PLACE_CUTOFF_HOUR_ET).toBe(12);
  });

  it.each([
    ['00:30 ET Nov 7', '2026-11-06', Date.UTC(2026, 10, 7, 5, 30)],
    ['11:59 ET Nov 7', '2026-11-06', Date.UTC(2026, 10, 7, 16, 59)],
    ['noon ET Nov 7', '2026-11-07', Date.UTC(2026, 10, 7, 17, 0)],
    ['11:59 PM ET Nov 7', '2026-11-07', Date.UTC(2026, 10, 8, 4, 59)],
    // Wall-clock noon, not 12 elapsed hours: Nov 1 has 25 hours in New York, Mar 8 has 23.
    ['11:30 EST Nov 1 (clocks went back)', '2026-10-31', Date.UTC(2026, 10, 1, 16, 30)],
    ['noon EST Nov 1 (clocks went back)', '2026-11-01', Date.UTC(2026, 10, 1, 17, 0)],
    ['11:59 EDT Mar 8 (clocks went forward)', '2026-03-07', Date.UTC(2026, 2, 8, 15, 59)],
    ['12:30 EDT Mar 8 (clocks went forward)', '2026-03-08', Date.UTC(2026, 2, 8, 16, 30)],
    ['00:30 EST Mar 1 (a month starts)', '2026-02-28', Date.UTC(2026, 2, 1, 5, 30)],
  ] as const)('at %s, a visit must have ended before %s', (_at, cutoff, now) => {
    expect(placeCutoffDay(now)).toBe(cutoff);
    expect(placeCutoffDay(new Date(now))).toBe(cutoff);
  });
});

describe('lastDayIfOver', () => {
  it('answers the last day of a visit over by the cutoff, and null for one that may be on', () => {
    expect(lastDayIfOver({ startDate: '2026-11-05' }, '2026-11-06')).toBe('2026-11-05');
    expect(lastDayIfOver({ startDate: '2026-10-20', endDate: '2026-11-05' }, '2026-11-06')).toBe(
      '2026-11-05',
    );
    expect(lastDayIfOver({ startDate: '2026-11-06' }, '2026-11-06')).toBe(null);
    expect(lastDayIfOver({ startDate: '2026-11-01', endDate: '2026-11-06' }, '2026-11-06')).toBe(
      null,
    );
    expect(lastDayIfOver({ startDate: '2026-12-01' }, '2026-11-06')).toBe(null);
    expect(lastDayIfOver({ startDate: null }, '2026-11-06')).toBe(null);
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

describe('parseGitHubPath', () => {
  it.each([
    ['https://github.com/WomB0ComB0/grepo', 'womb0comb0', 'grepo'],
    ['https://github.com/WomB0ComB0/grepo/', 'womb0comb0', 'grepo'],
    ['https://github.com/WomB0ComB0/grepo.git', 'womb0comb0', 'grepo'],
    ['http://www.GitHub.com/WomB0ComB0/Grepo.git/', 'womb0comb0', 'grepo'],
    ['https://github.com/WomB0ComB0/grepo/tree/main/src', 'womb0comb0', 'grepo'],
    ['  https://github.com/WomB0ComB0/grepo  ', 'womb0comb0', 'grepo'],
    ['https://github.com/ElysiumOSS', 'elysiumoss', null],
    ['https://github.com/ElysiumOSS/', 'elysiumoss', null],
  ])('reads %s as %s/%s', (url, owner, name) => {
    expect(parseGitHubPath(url)).toEqual({ owner, name });
  });

  it.each([
    'https://gitlab.com/WomB0ComB0/grepo',
    'https://bitbucket.org/WomB0ComB0/grepo',
    'https://gist.github.com/WomB0ComB0/abc',
    'https://github.com.evil.example/WomB0ComB0/grepo',
    'https://github.com/',
    'ftp://github.com/WomB0ComB0/grepo',
    'github.com/WomB0ComB0/grepo',
    'not a url',
    '',
  ])('is null for %j', (url) => {
    expect(parseGitHubPath(url)).toBe(null);
  });
});

/** 10:30 PM in New York on 2026-11-05 (already Nov 6 in UTC). */
const ACTIVITY_NOW = Date.UTC(2026, 10, 6, 3, 30);
const NY_TODAY = '2026-11-05';
const DAY_MS = 24 * 60 * 60_000;

/** The calendar day `days` before New York's today at ACTIVITY_NOW. */
const daysBefore = (days: number): string =>
  new Date(Date.parse(NY_TODAY) - days * DAY_MS).toISOString().slice(0, 10);

/** The owner's own commits to `nameWithOwner`, his newest `days` before today. */
const work = (nameWithOwner: string, days: number, commitsThatDay = 1): CommittedRepo => ({
  nameWithOwner,
  url: `https://github.com/${nameWithOwner}`,
  lastCommitDay: daysBefore(days),
  commitsThatDay,
});

describe('selectActiveProject', () => {
  const NOW = ACTIVITY_NOW;

  const grepo = makeProject({ title: 'grepo', githubUrl: 'https://github.com/WomB0ComB0/grepo' });
  const fraudGuard = makeProject({
    title: 'Fraud Guard',
    githubUrl: 'https://github.com/WomB0ComB0/fraud-guard',
  });
  const elysium = makeProject({ title: 'ElysiumOSS', githubUrl: 'https://github.com/ElysiumOSS' });
  const site = makeProject({
    title: 'Portfolio',
    githubUrl: `https://github.com/${SITE_REPOSITORY}`,
  });

  it('is the project of the repository he committed to, with the day of that commit', () => {
    const committed = work('WomB0ComB0/grepo', 1);

    expect(selectActiveProject([fraudGuard, grepo], [committed], NOW)).toEqual({
      project: grepo,
      repo: 'WomB0ComB0/grepo',
      lastCommitDay: '2026-11-04',
    });
  });

  it('matches whatever the case, a trailing slash, .git or www', () => {
    const shouty = makeProject({ githubUrl: 'https://www.GITHUB.com/womb0comb0/GREPO.git/' });

    expect(selectActiveProject([shouty], [work('WomB0ComB0/grepo', 0)], NOW)?.project).toBe(shouty);
  });

  it('lets the newest commit day win, whatever order the repositories come in', () => {
    const repos = [work('WomB0ComB0/fraud-guard', 5), work('WomB0ComB0/grepo', 0)];

    expect(selectActiveProject([fraudGuard, grepo], repos, NOW)?.project).toBe(grepo);
  });

  it('on one day, takes the repository with more of his commits that day', () => {
    const repos = [work('WomB0ComB0/grepo', 2, 1), work('WomB0ComB0/fraud-guard', 2, 6)];

    expect(selectActiveProject([grepo, fraudGuard], repos, NOW)?.project).toBe(fraudGuard);
    expect(selectActiveProject([grepo, fraudGuard], [...repos].reverse(), NOW)?.project).toBe(
      fraudGuard,
    );
  });

  it('passes over newer work on a repository no project names', () => {
    const repos = [work('WomB0ComB0/dotfiles', 0), work('WomB0ComB0/grepo', 1)];

    expect(selectActiveProject([grepo], repos, NOW)).toMatchObject({
      project: grepo,
      repo: 'WomB0ComB0/grepo',
    });
  });

  it("matches an org's root when no project names the repository", () => {
    expect(
      selectActiveProject([grepo, elysium], [work('ElysiumOSS/website', 0)], NOW),
    ).toMatchObject({ project: elysium, repo: 'ElysiumOSS/website' });
  });

  it("prefers the project naming the repository over its owner's root", () => {
    const website = makeProject({ githubUrl: 'https://github.com/ElysiumOSS/website' });

    expect(
      selectActiveProject([elysium, website], [work('ElysiumOSS/website', 0)], NOW)?.project,
    ).toBe(website);
  });

  it('matches a repository he collaborates on, owned by someone else', () => {
    const sparkMind = makeProject({ githubUrl: 'https://github.com/lluciiiia/SparkMind' });

    expect(
      selectActiveProject([grepo, sparkMind], [work('lluciiiia/SparkMind', 3)], NOW)?.project,
    ).toBe(sparkMind);
  });

  it('never matches a gitlab.com or bitbucket.org URL to a GitHub repository', () => {
    const gitlab = makeProject({ githubUrl: 'https://gitlab.com/WomB0ComB0/grepo' });
    const bitbucket = makeProject({ githubUrl: 'https://bitbucket.org/WomB0ComB0/grepo' });
    const gitlabRoot = makeProject({ githubUrl: 'https://gitlab.com/WomB0ComB0' });

    expect(
      selectActiveProject([gitlab, bitbucket, gitlabRoot], [work('WomB0ComB0/grepo', 0)], NOW),
    ).toBe(null);
  });

  it('never picks this site, even when it was committed to last or an owner root would match it', () => {
    const userRoot = makeProject({ githubUrl: 'https://github.com/WomB0ComB0' });
    const siteOnly = [work(SITE_REPOSITORY, 0)];

    expect(selectActiveProject([site, userRoot], siteOnly, NOW)).toBe(null);
    expect(selectActiveProject([site], [work('womb0comb0/PORTFOLIO', 0)], NOW)).toBe(null);
    expect(
      selectActiveProject([site, grepo], [...siteOnly, work('WomB0ComB0/grepo', 1)], NOW)?.project,
    ).toBe(grepo);
  });

  it(`counts commits from the last ${ACTIVE_PROJECT_WINDOW_DAYS} days only, by New York's calendar`, () => {
    expect(ACTIVE_PROJECT_WINDOW_DAYS).toBe(30);
    expect(
      selectActiveProject([grepo], [work('WomB0ComB0/grepo', ACTIVE_PROJECT_WINDOW_DAYS)], NOW)
        ?.project,
    ).toBe(grepo);
    expect(
      selectActiveProject([grepo], [work('WomB0ComB0/grepo', ACTIVE_PROJECT_WINDOW_DAYS + 1)], NOW),
    ).toBe(null);
    // 10:30 PM on Nov 5 in New York is Nov 6 in UTC: a day of Nov 5 is today, not yesterday.
    expect(selectActiveProject([grepo], [work('WomB0ComB0/grepo', 0)], NOW)?.project).toBe(grepo);
  });

  it('skips a day it cannot read, or one ahead of New York’s today', () => {
    const grepoOn = (lastCommitDay: string): CommittedRepo => ({
      ...work('WomB0ComB0/grepo', 0),
      lastCommitDay,
    });

    for (const day of ['not a date', '2026-11-05T00:00:00Z', '', '2026-11-06']) {
      expect(selectActiveProject([grepo], [grepoOn(day)], NOW), day).toBe(null);
    }
  });

  it('skips a project without a GitHub URL, or with one that is not a URL', () => {
    const none = makeProject({ githubUrl: null });
    const broken = makeProject({ githubUrl: 'WomB0ComB0/grepo' });

    expect(selectActiveProject([none, broken], [work('WomB0ComB0/grepo', 0)], NOW)).toBe(null);
  });

  it('takes the first project in list order when two name the same repository', () => {
    const later = makeProject({ featured: false, order: 0, githubUrl: grepo.githubUrl });
    const featured = makeProject({ featured: true, order: 5, githubUrl: grepo.githubUrl });

    expect(
      selectActiveProject([later, featured], [work('WomB0ComB0/grepo', 0)], NOW)?.project,
    ).toBe(featured);
  });

  it('is null without recent work', () => {
    expect(selectActiveProject([grepo], [], NOW)).toBe(null);
  });
});

describe('selectProjectPick', () => {
  const NOW = ACTIVITY_NOW;
  const featured = makeProject({ featured: true, order: 0, image: COVER });
  const grepo = makeProject({ githubUrl: 'https://github.com/WomB0ComB0/grepo' });

  it('is his latest work when a repository he committed to lately has a project', () => {
    expect(selectProjectPick([featured, grepo], [work('WomB0ComB0/grepo', 0)], NOW)).toEqual({
      source: 'activity',
      project: grepo,
      repo: 'WomB0ComB0/grepo',
      lastCommitDay: NY_TODAY,
    });
  });

  it('is the featured pick when none of his recent work has a project', () => {
    const siteOnly = [work(SITE_REPOSITORY, 0)];

    expect(selectProjectPick([featured, grepo], [], NOW)).toEqual({
      source: 'featured',
      project: featured,
    });
    expect(selectProjectPick([featured, grepo], siteOnly, NOW)).toEqual({
      source: 'featured',
      project: featured,
    });
  });

  it('is null with neither', () => {
    expect(selectProjectPick([grepo], [], NOW)).toBe(null);
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
