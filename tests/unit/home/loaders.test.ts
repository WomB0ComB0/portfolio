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
 * @file The home tiles' server loaders (src/app/_components/home/data/loaders.ts). None of them
 * ever rejects:
 * - The Sanity tiles (roles, place, project, counts) each fail only with their own collection.
 * - The project tile shows the project of the repository the owner's own commits went to last
 *   (readRecentCommits, never the GitHub tile's pushes), else the featured pick: GitHub failing,
 *   stale or slower than its 3 s budget never fails it (one warning each).
 * - GitHub and typing show a stale answer marked stale, with `asOf` and one warning; LeetCode's
 *   handler reports its own, which the tile shows marked stale with `asOf`.
 * - Past the 4 s deadline, GitHub, typing and each Sanity tile show the value their source last
 *   loaded (peeked, never awaited), marked stale with when it was loaded, and send the deadline's
 *   one warning (LeetCode too); with nothing loaded, the error state.
 * - Now playing shares one Spotify answer for 15 s, never shows a stale track (error instead),
 *   and turns a slow Spotify into 'timeout'.
 * - Status dates its snapshot from the check's `lastUpdated` and passes the whole answer through;
 *   past the 2.5 s live deadline it is Better Stack's last answer (peeked), else a timeout.
 * Every source and the reporter are mocked; React's cache() does nothing outside a server
 * render, so calls are counted on the mocked sources.
 */

import {
  makeCertification,
  makeExperience,
  makePlace,
  makeProject,
} from '@tests/fixtures/sanity-docs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadCurrentRoles,
  loadGitHubActivity,
  loadLatestPlace,
  loadLeetCode,
  loadNowPlaying,
  loadProjectPick,
  loadServiceStatus,
  loadSiteCounts,
  loadTyping,
  NOW_PLAYING_TTL_MS,
  PROJECT_ACTIVITY_BUDGET_MS,
  resetNowPlayingCache,
} from '@/app/_components/home/data/loaders';
import {
  LIVE_TILE_DEADLINE_MS,
  SERVER_TILE_DEADLINE_MS,
} from '@/app/_components/home/data/tile-result';
import type { ServiceStatus } from '@/app/api/[[...route]]/status/schema';
import type { LeetCodeStats } from '@/app/api/v1/[[...route]]/leetcode/handlers';
import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';
import type {
  CommittedRepo,
  GitHubActivity,
  RecentCommits,
} from '@/lib/api-integrations/github-activity';
import type { MonkeytypeProfile } from '@/lib/api-integrations/monkeytype';

const sanity = vi.hoisted(() => ({
  loadProjects: vi.fn(),
  loadExperiences: vi.fn(),
  loadCertifications: vi.fn(),
  loadPlaces: vi.fn(),
  peekProjects: vi.fn(),
  peekExperiences: vi.fn(),
  peekCertifications: vi.fn(),
  peekPlaces: vi.fn(),
}));
const github = vi.hoisted(() => ({
  readGitHubActivity: vi.fn(),
  peekGitHubActivity: vi.fn(),
  readRecentCommits: vi.fn(),
  peekRecentCommits: vi.fn(),
}));
const monkeytype = vi.hoisted(() => ({
  readMonkeytypeProfile: vi.fn(),
  peekMonkeytypeProfile: vi.fn(),
}));
const leetcode = vi.hoisted(() => ({ readLeetCodeStats: vi.fn(), peekLeetCodeStats: vi.fn() }));
const nowPlaying = vi.hoisted(() => ({ getNowPlaying: vi.fn() }));
const status = vi.hoisted(() => ({ handleStatusCheck: vi.fn(), peekServiceStatus: vi.fn() }));
const report = vi.hoisted(() => ({ reportApiFailure: vi.fn() }));

vi.mock('@/lib/sanity/loaders', () => sanity);
vi.mock('@/lib/api-integrations/github-activity', () => github);
vi.mock('@/lib/api-integrations/monkeytype', () => monkeytype);
vi.mock('@/app/api/v1/[[...route]]/leetcode/handlers', () => leetcode);
vi.mock('@/app/api/v1/[[...route]]/now-playing/handlers', () => nowPlaying);
vi.mock('@/app/api/[[...route]]/status/handlers', () => status);
vi.mock('@/lib/observability/report', () => report);

/** 10:30 PM in New York on 2026-11-05, already 2026-11-06 in UTC. */
const NOW = Date.UTC(2026, 10, 6, 3, 30);
const HOUR_MS = 60 * 60_000;

const never = <T>(): Promise<T> => new Promise<T>(() => {});

/** When a source last loaded the value a peek answers: ten minutes before NOW. */
const LOADED_AT = NOW - 10 * 60_000;
const LOADED_AT_ISO = new Date(LOADED_AT).toISOString();

const roles = [
  makeExperience({ current: true, order: 0, position: 'Founder & CEO' }),
  makeExperience({ current: false, order: 1 }),
  makeExperience({ current: true, order: 2 }),
];
/** The first is the last place: its visit was yesterday in New York (NOW is Nov 5 there). */
const places = [makePlace({ startDate: '2026-11-04' }), makePlace({ startDate: '2026-10-01' })];
const projects = [
  makeProject({ featured: true, order: 0, title: 'Fraud Guard' }),
  makeProject({ featured: false, order: 1 }),
];
const certifications = [makeCertification(), makeCertification(), makeCertification()];

const ACTIVITY: GitHubActivity = {
  weeks: Array.from({ length: 12 }, (_, index) => ({
    start: new Date(Date.UTC(2026, 7, 16 + index * 7)).toISOString().slice(0, 10),
    count: index,
  })),
  total: 66,
  latestCommit: null,
  fetchedAt: '2026-11-06T03:00:00.000Z',
};

/** The owner's own commits to `nameWithOwner`, his newest on `lastCommitDay`. */
const repo = (nameWithOwner: string, lastCommitDay: string): CommittedRepo => ({
  nameWithOwner,
  url: `https://github.com/${nameWithOwner}`,
  lastCommitDay,
  commitsThatDay: 1,
});

/** His recent commits as GitHub answers them, at 11 PM in New York on 2026-11-05. */
const commits = (repos: readonly CommittedRepo[]): RecentCommits => ({
  repos,
  fetchedAt: '2026-11-06T03:00:00.000Z',
});

const LEETCODE: LeetCodeStats = {
  totalSolved: 692,
  easySolved: 215,
  mediumSolved: 379,
  hardSolved: 98,
  acceptanceRate: 61.2,
  ranking: 81_234,
};

const PROFILE: MonkeytypeProfile = {
  personalBests: { time: { '60': [{ wpm: 121.6, acc: 97.34 }] } },
  typingStats: { completedTests: 412 },
};

const PLAYING: NowPlayingResponse = {
  isPlaying: true,
  songName: 'Windowlicker',
  artistName: 'Aphex Twin',
  songURL: 'https://open.spotify.com/track/abc',
};

/** The options of every report sent, in order. */
const reportOptions = (): unknown[] => report.reportApiFailure.mock.calls.map((call) => call[1]);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(NOW);
  for (const mock of [
    ...Object.values(sanity),
    ...Object.values(github),
    ...Object.values(monkeytype),
    ...Object.values(leetcode),
    nowPlaying.getNowPlaying,
    ...Object.values(status),
    report.reportApiFailure,
  ]) {
    mock.mockReset();
  }
  sanity.loadExperiences.mockResolvedValue(roles);
  sanity.loadPlaces.mockResolvedValue(places);
  sanity.loadProjects.mockResolvedValue(projects);
  sanity.loadCertifications.mockResolvedValue(certifications);
  // GitHub answers with no recent commits unless a test says otherwise, so the project tile is
  // the featured pick and reports nothing.
  github.readGitHubActivity.mockResolvedValue({ stale: false, data: ACTIVITY });
  github.readRecentCommits.mockResolvedValue({ stale: false, data: commits([]) });
  resetNowPlayingCache();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the Sanity tiles', () => {
  it('pick from the pages’ lists and count them', async () => {
    await expect(loadCurrentRoles()).resolves.toEqual({
      status: 'ok',
      data: { roles: [roles[0], roles[2]], total: 2 },
      stale: false,
    });
    await expect(loadLatestPlace()).resolves.toMatchObject({ status: 'ok', data: places[0] });
    await expect(loadProjectPick()).resolves.toEqual({
      status: 'ok',
      data: { source: 'featured', project: projects[0] },
      stale: false,
    });
    await expect(loadSiteCounts()).resolves.toEqual({
      projects: 2,
      roles: 3,
      certifications: 3,
      places: 2,
    });
    expect(report.reportApiFailure).not.toHaveBeenCalled();
  });

  it.each([
    ['experiences', sanity.loadExperiences, 'roles', ['home counts tile', 'home roles tile']],
    ['places', sanity.loadPlaces, 'places', ['home counts tile', 'home place tile']],
    ['projects', sanity.loadProjects, 'projects', ['home counts tile', 'home project tile']],
    ['certifications', sanity.loadCertifications, 'certifications', ['home counts tile']],
  ] as const)(
    'only fail where %s is used when that collection rejects',
    async (_name, load, count, contexts) => {
      load.mockRejectedValue(new Error('Sanity 503'));

      const [rolesTile, placeTile, projectTile, counts] = await Promise.all([
        loadCurrentRoles(),
        loadLatestPlace(),
        loadProjectPick(),
        loadSiteCounts(),
      ]);

      expect(rolesTile.status).toBe(load === sanity.loadExperiences ? 'error' : 'ok');
      expect(placeTile.status).toBe(load === sanity.loadPlaces ? 'error' : 'ok');
      expect(projectTile.status).toBe(load === sanity.loadProjects ? 'error' : 'ok');
      expect(counts[count]).toBeNull();
      const others = Object.entries(counts).filter(([key]) => key !== count);
      expect(others.every(([, value]) => typeof value === 'number')).toBe(true);
      const reported = reportOptions().map((options) => (options as { context: string }).context);
      expect(reported.sort()).toEqual(contexts);
    },
  );

  it('send one counts-tile report per failed collection, and none for the others', async () => {
    sanity.loadProjects.mockRejectedValue(new Error('Sanity 503'));
    sanity.loadPlaces.mockRejectedValue(new Error('Sanity 503'));

    await expect(loadSiteCounts()).resolves.toEqual({
      projects: null,
      roles: 3,
      certifications: 3,
      places: null,
    });
    expect(reportOptions()).toEqual([
      { context: 'home counts tile', level: 'error' },
      { context: 'home counts tile', level: 'error' },
    ]);
  });

  it('give a collection that is still loading at the deadline a null count', async () => {
    sanity.loadCertifications.mockReturnValue(never());

    const counts = loadSiteCounts();
    await vi.advanceTimersByTimeAsync(SERVER_TILE_DEADLINE_MS);

    await expect(counts).resolves.toMatchObject({ certifications: null, projects: 2 });
    expect(reportOptions()).toEqual([{ context: 'home counts tile', level: 'warning' }]);
  });

  it('are empty, not errors, when there is nothing to show', async () => {
    sanity.loadExperiences.mockResolvedValue([makeExperience({ current: false })]);
    sanity.loadPlaces.mockResolvedValue([makePlace({ startDate: null })]);
    sanity.loadProjects.mockResolvedValue([makeProject({ featured: false })]);

    await expect(loadCurrentRoles()).resolves.toEqual({ status: 'empty' });
    await expect(loadLatestPlace()).resolves.toEqual({ status: 'empty' });
    await expect(loadProjectPick()).resolves.toEqual({ status: 'empty' });
    expect(report.reportApiFailure).not.toHaveBeenCalled();
  });

  it("take today from New York's calendar, so a visit on its today is not over yet", async () => {
    // UTC has reached Nov 6, New York has not: Nov 5 is still today there.
    const today = makePlace({ startDate: '2026-11-05', order: -99 });
    const yesterday = makePlace({ startDate: '2026-11-04' });
    sanity.loadPlaces.mockResolvedValue([today, yesterday]);

    await expect(loadLatestPlace()).resolves.toMatchObject({ status: 'ok', data: yesterday });
  });

  // Visits are days, not times: an evening party dated Nov 6 can still be going at 00:30 ET on
  // Nov 7 (and in San Francisco Nov 6 is not even over). It shows from noon ET the day after.
  it.each([
    ['00:30 ET', false, Date.UTC(2026, 10, 7, 5, 30)],
    ['11:59 ET', false, Date.UTC(2026, 10, 7, 16, 59)],
    ['12:00 ET', true, Date.UTC(2026, 10, 7, 17, 0)],
    ['12:30 ET', true, Date.UTC(2026, 10, 7, 17, 30)],
  ] as const)(
    'show a visit dated Nov 6 from noon ET on Nov 7: at %s, shown %s',
    async (_at, shown, now) => {
      vi.setSystemTime(now);
      const party = makePlace({ category: 'Event', startDate: '2026-11-06' });
      sanity.loadPlaces.mockResolvedValue([party]);

      const tile = await loadLatestPlace();

      expect(tile).toEqual(
        shown ? { status: 'ok', data: party, stale: false } : { status: 'empty' },
      );
    },
  );

  it('count only past places, as /places does, so the two figures never differ', async () => {
    // NOW is Nov 5 in New York: a visit on Nov 5, a run still on, one to come and an undated
    // place are all left out of the count.
    sanity.loadPlaces.mockResolvedValue([
      ...places,
      makePlace({ startDate: '2026-11-05' }),
      makePlace({ startDate: '2026-11-01', endDate: '2026-11-09' }),
      makePlace({ startDate: '2026-12-01' }),
      makePlace({ startDate: null }),
    ]);

    await expect(loadSiteCounts()).resolves.toMatchObject({ places: places.length });
  });

  it('are empty when every place is dated but none has ended before the cutoff day', async () => {
    // NOW is Nov 5 in New York: a visit on Nov 5 and a run from Nov 1 to Nov 9 are both on.
    sanity.loadPlaces.mockResolvedValue([
      makePlace({ startDate: '2026-11-05' }),
      makePlace({ startDate: '2026-11-01', endDate: '2026-11-09' }),
    ]);

    await expect(loadLatestPlace()).resolves.toEqual({ status: 'empty' });
  });
});

describe('loadGitHubActivity', () => {
  it('is ok with asOf set to when GitHub answered', async () => {
    github.readGitHubActivity.mockResolvedValue({ stale: false, data: ACTIVITY });

    await expect(loadGitHubActivity()).resolves.toEqual({
      status: 'ok',
      data: ACTIVITY,
      stale: false,
      asOf: ACTIVITY.fetchedAt,
    });
    expect(report.reportApiFailure).not.toHaveBeenCalled();
  });

  it('shows a stale answer marked stale, with its old asOf and one warning', async () => {
    const outage = new Error('GitHub 502');
    github.readGitHubActivity.mockResolvedValue({
      stale: true,
      data: ACTIVITY,
      error: outage,
      loadedAt: Date.parse(ACTIVITY.fetchedAt),
    });

    await expect(loadGitHubActivity()).resolves.toEqual({
      status: 'ok',
      data: ACTIVITY,
      stale: true,
      asOf: ACTIVITY.fetchedAt,
    });
    expect(reportOptions()).toEqual([{ context: 'home github tile', level: 'warning' }]);
    expect(report.reportApiFailure.mock.calls[0]?.[0]).toMatchObject({
      command: 'github:activity',
      cause: outage,
    });
  });

  it('keeps zero contributions as data, not empty', async () => {
    const quiet = { ...ACTIVITY, total: 0, weeks: ACTIVITY.weeks.map((w) => ({ ...w, count: 0 })) };
    github.readGitHubActivity.mockResolvedValue({ stale: false, data: quiet });

    await expect(loadGitHubActivity()).resolves.toMatchObject({ status: 'ok', data: quiet });
  });

  it('is an error, reported, when nothing was ever loaded', async () => {
    github.readGitHubActivity.mockRejectedValue(new Error('GITHUB_TOKEN is not set'));

    await expect(loadGitHubActivity()).resolves.toEqual({ status: 'error' });
    expect(reportOptions()).toEqual([{ context: 'home github tile', level: 'error' }]);
  });
});

describe('loadProjectPick', () => {
  const grepo = makeProject({ title: 'grepo', githubUrl: 'https://github.com/WomB0ComB0/grepo' });
  const site = makeProject({
    title: 'Portfolio',
    githubUrl: 'https://github.com/WomB0ComB0/portfolio',
  });
  const featured = { source: 'featured', project: projects[0] } as const;
  /** Yesterday in New York (NOW is 10:30 PM on Nov 5 there). */
  const YESTERDAY = '2026-11-04';
  const ACTIVE_COMMITS = commits([repo('WomB0ComB0/grepo', YESTERDAY)]);
  const LATEST_WORK = {
    source: 'activity',
    project: grepo,
    repo: 'WomB0ComB0/grepo',
    lastCommitDay: YESTERDAY,
  } as const;
  const ACTIVITY_WARNING = { context: 'home project activity', level: 'warning' };

  beforeEach(() => {
    sanity.loadProjects.mockResolvedValue([...projects, grepo, site]);
  });

  it('is the project of the repository he committed to last, with that day', async () => {
    github.readRecentCommits.mockResolvedValue({ stale: false, data: ACTIVE_COMMITS });

    await expect(loadProjectPick()).resolves.toEqual({
      status: 'ok',
      data: LATEST_WORK,
      stale: false,
    });
    expect(report.reportApiFailure).not.toHaveBeenCalled();
  });

  it("follows his own commits only, never the GitHub tile's pushes", async () => {
    // The GitHub tile's answer plays no part: only readRecentCommits decides.
    github.readRecentCommits.mockResolvedValue({ stale: false, data: ACTIVE_COMMITS });
    github.readGitHubActivity.mockRejectedValue(new Error('GitHub 502'));

    await expect(loadProjectPick()).resolves.toMatchObject({ data: LATEST_WORK });
    expect(github.readGitHubActivity).not.toHaveBeenCalled();
    expect(github.peekGitHubActivity).not.toHaveBeenCalled();
  });

  it.each([
    ['no repository he committed to has a project', [repo('WomB0ComB0/dotfiles', YESTERDAY)]],
    ['he committed only to this site', [repo('WomB0ComB0/portfolio', YESTERDAY)]],
    ['his last commit was over 30 days ago', [repo('WomB0ComB0/grepo', '2026-10-05')]],
    ['he committed nothing lately', []],
  ])('is the featured pick when %s', async (_when, repos) => {
    github.readRecentCommits.mockResolvedValue({ stale: false, data: commits(repos) });

    await expect(loadProjectPick()).resolves.toEqual({
      status: 'ok',
      data: featured,
      stale: false,
    });
    expect(report.reportApiFailure).not.toHaveBeenCalled();
  });

  it('is the featured pick, with a warning, when GitHub fails with nothing cached', async () => {
    github.readRecentCommits.mockRejectedValue(new Error('GITHUB_TOKEN is not set'));

    await expect(loadProjectPick()).resolves.toEqual({
      status: 'ok',
      data: featured,
      stale: false,
    });
    expect(reportOptions()).toEqual([ACTIVITY_WARNING]);
    expect(report.reportApiFailure.mock.calls[0]?.[0]).toMatchObject({
      command: 'home:project-activity',
    });
  });

  it('still uses a stale GitHub answer, whose days are true, with a warning', async () => {
    const outage = new Error('GitHub 502');
    github.readRecentCommits.mockResolvedValue({
      stale: true,
      data: ACTIVE_COMMITS,
      error: outage,
      loadedAt: LOADED_AT,
    });

    await expect(loadProjectPick()).resolves.toEqual({
      status: 'ok',
      data: LATEST_WORK,
      stale: false,
    });
    expect(reportOptions()).toEqual([ACTIVITY_WARNING]);
    expect(report.reportApiFailure.mock.calls[0]?.[0]).toMatchObject({ cause: outage });
  });

  describe('when GitHub is slower than its budget', () => {
    /** Starts the load and lets GitHub's budget, not the tile's deadline, pass. */
    async function pastBudget() {
      github.readRecentCommits.mockReturnValue(never());
      const settled = vi.fn();
      const pick = loadProjectPick();
      void pick.then(settled);
      await vi.advanceTimersByTimeAsync(PROJECT_ACTIVITY_BUDGET_MS - 1);
      expect(settled).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      return pick;
    }

    it('uses the commits GitHub last answered, in time for the tile', async () => {
      github.peekRecentCommits.mockReturnValue({ data: ACTIVE_COMMITS, loadedAt: LOADED_AT });

      await expect(pastBudget()).resolves.toEqual({
        status: 'ok',
        data: LATEST_WORK,
        stale: false,
      });
      expect(PROJECT_ACTIVITY_BUDGET_MS).toBeLessThan(SERVER_TILE_DEADLINE_MS);
      expect(reportOptions()).toEqual([ACTIVITY_WARNING]);
    });

    it('is the featured pick when GitHub never answered', async () => {
      await expect(pastBudget()).resolves.toEqual({ status: 'ok', data: featured, stale: false });
      expect(github.peekRecentCommits).toHaveBeenCalledTimes(1);
      expect(reportOptions()).toEqual([ACTIVITY_WARNING]);
    });
  });

  it('fails as before when Sanity fails, whatever GitHub answers', async () => {
    sanity.loadProjects.mockRejectedValue(new Error('Sanity 503'));
    github.readRecentCommits.mockResolvedValue({ stale: false, data: ACTIVE_COMMITS });

    await expect(loadProjectPick()).resolves.toEqual({ status: 'error' });
    expect(reportOptions()).toEqual([{ context: 'home project tile', level: 'error' }]);
  });
});

describe('loadLeetCode', () => {
  it('is ok with the handler’s stats', async () => {
    leetcode.readLeetCodeStats.mockResolvedValue({ data: LEETCODE, stale: false, loadedAt: NOW });

    await expect(loadLeetCode()).resolves.toEqual({ status: 'ok', data: LEETCODE, stale: false });
  });

  it('marks the handler’s stale fallback stale, dated when LeetCode gave it, reporting nothing more', async () => {
    const loadedAt = NOW - 7 * HOUR_MS;
    leetcode.readLeetCodeStats.mockResolvedValue({ data: LEETCODE, stale: true, loadedAt });

    await expect(loadLeetCode()).resolves.toEqual({
      status: 'ok',
      data: LEETCODE,
      stale: true,
      asOf: new Date(loadedAt).toISOString(),
    });
    // The handler already reported the failed refresh.
    expect(report.reportApiFailure).not.toHaveBeenCalled();
  });

  it('is an error when the handler rejects', async () => {
    leetcode.readLeetCodeStats.mockRejectedValue(new Error('LeetCode user not found'));

    await expect(loadLeetCode()).resolves.toEqual({ status: 'error' });
    expect(reportOptions()).toEqual([{ context: 'home leetcode tile', level: 'error' }]);
  });
});

describe('loadTyping', () => {
  it('is ok with the rounded 60 s best and no asOf when fresh', async () => {
    monkeytype.readMonkeytypeProfile.mockResolvedValue({ stale: false, data: PROFILE });

    await expect(loadTyping()).resolves.toEqual({
      status: 'ok',
      data: { best60: { wpm: 122, accuracy: 97.3 }, completedTests: 412 },
      stale: false,
    });
  });

  it('is empty when the profile has no 60 s entry', async () => {
    monkeytype.readMonkeytypeProfile.mockResolvedValue({
      stale: false,
      data: { ...PROFILE, personalBests: { time: { '15': [{ wpm: 150, acc: 99 }] } } },
    });

    await expect(loadTyping()).resolves.toEqual({ status: 'empty' });
  });

  it('marks a stale profile stale, dated when it was loaded, with one warning', async () => {
    const loadedAt = NOW - 2 * HOUR_MS;
    monkeytype.readMonkeytypeProfile.mockResolvedValue({
      stale: true,
      data: PROFILE,
      error: new Error('Monkeytype 429'),
      loadedAt,
    });

    await expect(loadTyping()).resolves.toMatchObject({
      status: 'ok',
      stale: true,
      asOf: new Date(loadedAt).toISOString(),
    });
    expect(reportOptions()).toEqual([{ context: 'home typing tile', level: 'warning' }]);
    expect(report.reportApiFailure.mock.calls[0]?.[0]).toMatchObject({
      command: 'monkeytype:profile',
    });
  });
});

describe('the server tiles past their deadline', () => {
  /** Starts `load`, lets the 4 s deadline pass, and answers what it resolved. */
  async function pastDeadline<T>(load: () => Promise<T>): Promise<T> {
    const result = load();
    await vi.advanceTimersByTimeAsync(SERVER_TILE_DEADLINE_MS);
    return result;
  }

  it('show the GitHub activity last loaded, stale, dated when GitHub answered', async () => {
    github.readGitHubActivity.mockReturnValue(never());
    github.peekGitHubActivity.mockReturnValue({ data: ACTIVITY, loadedAt: LOADED_AT });

    await expect(pastDeadline(loadGitHubActivity)).resolves.toEqual({
      status: 'ok',
      data: ACTIVITY,
      stale: true,
      asOf: ACTIVITY.fetchedAt,
    });
    expect(reportOptions()).toEqual([{ context: 'home github tile', level: 'warning' }]);
  });

  it('are the GitHub error state when GitHub never answered', async () => {
    github.readGitHubActivity.mockReturnValue(never());

    await expect(pastDeadline(loadGitHubActivity)).resolves.toEqual({ status: 'error' });
    expect(github.peekGitHubActivity).toHaveBeenCalledTimes(1);
    expect(reportOptions()).toEqual([{ context: 'home github tile', level: 'warning' }]);
  });

  it('show the typing best last loaded, stale, dated when it was loaded', async () => {
    monkeytype.readMonkeytypeProfile.mockReturnValue(never());
    monkeytype.peekMonkeytypeProfile.mockReturnValue({ data: PROFILE, loadedAt: LOADED_AT });

    await expect(pastDeadline(loadTyping)).resolves.toEqual({
      status: 'ok',
      data: { best60: { wpm: 122, accuracy: 97.3 }, completedTests: 412 },
      stale: true,
      asOf: LOADED_AT_ISO,
    });
    expect(reportOptions()).toEqual([{ context: 'home typing tile', level: 'warning' }]);
  });

  it('are the typing empty state when the profile last loaded has no 60 s test', async () => {
    monkeytype.readMonkeytypeProfile.mockReturnValue(never());
    monkeytype.peekMonkeytypeProfile.mockReturnValue({
      data: { ...PROFILE, personalBests: {} },
      loadedAt: LOADED_AT,
    });

    await expect(pastDeadline(loadTyping)).resolves.toEqual({ status: 'empty' });
  });

  it('show the roles and their count from the experiences last loaded', async () => {
    sanity.loadExperiences.mockReturnValue(never());
    sanity.peekExperiences.mockReturnValue({ data: roles, loadedAt: LOADED_AT });

    const [rolesTile, counts, placeTile] = await pastDeadline(() =>
      Promise.all([loadCurrentRoles(), loadSiteCounts(), loadLatestPlace()]),
    );

    expect(rolesTile).toEqual({
      status: 'ok',
      data: { roles: [roles[0], roles[2]], total: 2 },
      stale: true,
      asOf: LOADED_AT_ISO,
    });
    expect(counts).toEqual({ projects: 2, roles: 3, certifications: 3, places: 2 });
    // The tiles whose collections answered are fresh, and peek nothing.
    expect(placeTile).toMatchObject({ status: 'ok', stale: false });
    expect(sanity.peekPlaces).not.toHaveBeenCalled();
    expect(reportOptions()).toEqual([
      { context: 'home roles tile', level: 'warning' },
      { context: 'home counts tile', level: 'warning' },
    ]);
  });

  it('show the place and project last loaded, stale', async () => {
    sanity.loadPlaces.mockReturnValue(never());
    sanity.loadProjects.mockReturnValue(never());
    sanity.peekPlaces.mockReturnValue({ data: places, loadedAt: LOADED_AT });
    sanity.peekProjects.mockReturnValue({ data: projects, loadedAt: LOADED_AT });

    const [placeTile, projectTile] = await pastDeadline(() =>
      Promise.all([loadLatestPlace(), loadProjectPick()]),
    );

    expect(placeTile).toEqual({ status: 'ok', data: places[0], stale: true, asOf: LOADED_AT_ISO });
    expect(projectTile).toEqual({
      status: 'ok',
      data: { source: 'featured', project: projects[0] },
      stale: true,
      asOf: LOADED_AT_ISO,
    });
  });

  it('show his latest work from the projects and commits last loaded, stale', async () => {
    const active = makeProject({ githubUrl: 'https://github.com/WomB0ComB0/grepo' });
    const lastCommitDay = '2026-11-05';
    sanity.loadProjects.mockReturnValue(never());
    sanity.peekProjects.mockReturnValue({ data: [...projects, active], loadedAt: LOADED_AT });
    github.peekRecentCommits.mockReturnValue({
      data: commits([repo('WomB0ComB0/grepo', lastCommitDay)]),
      loadedAt: LOADED_AT,
    });

    await expect(pastDeadline(loadProjectPick)).resolves.toEqual({
      status: 'ok',
      data: { source: 'activity', project: active, repo: 'WomB0ComB0/grepo', lastCommitDay },
      stale: true,
      asOf: LOADED_AT_ISO,
    });
    expect(reportOptions()).toEqual([{ context: 'home project tile', level: 'warning' }]);
  });

  it('fall back per collection: a count with nothing loaded is null, one with a list is counted', async () => {
    sanity.loadCertifications.mockReturnValue(never());
    sanity.loadPlaces.mockReturnValue(never());
    sanity.peekPlaces.mockReturnValue({ data: places, loadedAt: LOADED_AT });

    const [counts, placeTile] = await pastDeadline(() =>
      Promise.all([loadSiteCounts(), loadLatestPlace()]),
    );

    expect(counts).toEqual({ projects: 2, roles: 3, certifications: null, places: 2 });
    expect(placeTile).toMatchObject({ status: 'ok', data: places[0], stale: true });
    expect(sanity.peekCertifications).toHaveBeenCalledTimes(1);
  });

  it('count only past places in the list last loaded, too', async () => {
    sanity.loadPlaces.mockReturnValue(never());
    sanity.peekPlaces.mockReturnValue({
      data: [...places, makePlace({ startDate: '2026-12-01' }), makePlace({ startDate: null })],
      loadedAt: LOADED_AT,
    });

    await expect(pastDeadline(loadSiteCounts)).resolves.toMatchObject({ places: places.length });
  });

  it('show the LeetCode stats last fetched, stale, dated when they were fetched', async () => {
    leetcode.readLeetCodeStats.mockReturnValue(never());
    leetcode.peekLeetCodeStats.mockReturnValue({ data: LEETCODE, loadedAt: LOADED_AT });

    await expect(pastDeadline(loadLeetCode)).resolves.toEqual({
      status: 'ok',
      data: LEETCODE,
      stale: true,
      asOf: LOADED_AT_ISO,
    });
    expect(reportOptions()).toEqual([{ context: 'home leetcode tile', level: 'warning' }]);
  });

  it('are the LeetCode error state when LeetCode never answered', async () => {
    leetcode.readLeetCodeStats.mockReturnValue(never());

    await expect(pastDeadline(loadLeetCode)).resolves.toEqual({ status: 'error' });
    expect(leetcode.peekLeetCodeStats).toHaveBeenCalledTimes(1);
    expect(reportOptions()).toEqual([{ context: 'home leetcode tile', level: 'warning' }]);
  });

  it('peek nothing when LeetCode answers in time, or fails before the deadline', async () => {
    leetcode.readLeetCodeStats.mockResolvedValueOnce({
      data: LEETCODE,
      stale: false,
      loadedAt: NOW,
    });
    await expect(loadLeetCode()).resolves.toMatchObject({ status: 'ok', stale: false });

    leetcode.readLeetCodeStats.mockRejectedValueOnce(new Error('LeetCode user not found'));
    await expect(loadLeetCode()).resolves.toEqual({ status: 'error' });

    expect(leetcode.peekLeetCodeStats).not.toHaveBeenCalled();
  });
});

describe('loadNowPlaying', () => {
  it('is data, dated when Spotify answered', async () => {
    nowPlaying.getNowPlaying.mockResolvedValue(PLAYING);

    await expect(loadNowPlaying()).resolves.toEqual({
      kind: 'data',
      data: PLAYING,
      fetchedAt: NOW,
    });
  });

  it('shares one Spotify answer for 15 s, keeping its original date', async () => {
    nowPlaying.getNowPlaying.mockResolvedValue(PLAYING);

    await loadNowPlaying();
    vi.setSystemTime(NOW + 14_999);
    const again = await loadNowPlaying();

    expect(NOW_PLAYING_TTL_MS).toBe(15_000);
    expect(nowPlaying.getNowPlaying).toHaveBeenCalledTimes(1);
    expect(again).toEqual({ kind: 'data', data: PLAYING, fetchedAt: NOW });
  });

  it('is an error, never the old track, when Spotify fails after 15 s', async () => {
    nowPlaying.getNowPlaying.mockResolvedValueOnce(PLAYING);
    await loadNowPlaying();

    vi.setSystemTime(NOW + 15_000);
    nowPlaying.getNowPlaying.mockRejectedValueOnce(new Error('Spotify 503'));

    await expect(loadNowPlaying()).resolves.toEqual({ kind: 'error' });
    expect(nowPlaying.getNowPlaying).toHaveBeenCalledTimes(2);
    expect(reportOptions()).toEqual([{ context: 'home now-playing tile', level: 'warning' }]);
  });

  it('is an error, with a warning, when Spotify fails with nothing cached', async () => {
    nowPlaying.getNowPlaying.mockRejectedValue(new Error('Spotify 401'));

    await expect(loadNowPlaying()).resolves.toEqual({ kind: 'error' });
    expect(reportOptions()).toEqual([{ context: 'home now-playing tile', level: 'warning' }]);
  });

  it('is a timeout, unreported, when Spotify takes longer than 2.5 s', async () => {
    nowPlaying.getNowPlaying.mockReturnValue(never());
    const settled = vi.fn();

    const snapshot = loadNowPlaying();
    void snapshot.then(settled);
    await vi.advanceTimersByTimeAsync(2_499);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    await expect(snapshot).resolves.toEqual({ kind: 'timeout' });
    expect(LIVE_TILE_DEADLINE_MS).toBe(2_500);
    expect(report.reportApiFailure).not.toHaveBeenCalled();
  });
});

describe('loadServiceStatus', () => {
  const STATUS: ServiceStatus = {
    state: 'operational',
    lastUpdated: '2026-11-06T03:29:00.000Z',
    monitors: { up: 6, total: 6 },
  };

  it('is data dated from the check’s lastUpdated', async () => {
    status.handleStatusCheck.mockResolvedValue(STATUS);

    await expect(loadServiceStatus()).resolves.toEqual({
      kind: 'data',
      data: STATUS,
      fetchedAt: Date.parse(STATUS.lastUpdated),
    });
  });

  it('passes the whole answer through, a stale flag included, without reading the clock', async () => {
    const cached = { ...STATUS, stale: true, message: 'Serving cached status' };
    status.handleStatusCheck.mockResolvedValue(cached);

    const snapshot = await loadServiceStatus();

    expect(snapshot).toEqual({
      kind: 'data',
      data: cached,
      fetchedAt: Date.parse(STATUS.lastUpdated),
    });
    expect(snapshot.kind === 'data' && snapshot.data).toBe(cached);
  });

  it('is dated now when lastUpdated is not a date', async () => {
    status.handleStatusCheck.mockResolvedValue({ ...STATUS, lastUpdated: 'unknown' });

    await expect(loadServiceStatus()).resolves.toMatchObject({ kind: 'data', fetchedAt: NOW });
  });

  it('is an error, with a warning, when the check fails', async () => {
    status.handleStatusCheck.mockRejectedValue(new Error('Better Stack 500'));

    await expect(loadServiceStatus()).resolves.toEqual({ kind: 'error' });
    expect(reportOptions()).toEqual([{ context: 'home status tile', level: 'warning' }]);
  });

  it('is a timeout when the check is slower than the live deadline and nothing was cached', async () => {
    status.handleStatusCheck.mockReturnValue(never());

    const snapshot = loadServiceStatus();
    await vi.advanceTimersByTimeAsync(LIVE_TILE_DEADLINE_MS);

    await expect(snapshot).resolves.toEqual({ kind: 'timeout' });
    expect(status.peekServiceStatus).toHaveBeenCalledTimes(1);
    expect(report.reportApiFailure).not.toHaveBeenCalled();
  });

  it('is Better Stack’s last answer, as the handler flags it, past the live deadline', async () => {
    const lastKnown = { ...STATUS, lastUpdated: '2026-11-06T03:20:00.000Z', stale: true };
    status.handleStatusCheck.mockReturnValue(never());
    status.peekServiceStatus.mockReturnValue(lastKnown);

    const snapshot = loadServiceStatus();
    await vi.advanceTimersByTimeAsync(LIVE_TILE_DEADLINE_MS);

    await expect(snapshot).resolves.toEqual({
      kind: 'data',
      data: lastKnown,
      fetchedAt: Date.parse(lastKnown.lastUpdated),
    });
    expect(report.reportApiFailure).not.toHaveBeenCalled();
  });

  it('peeks nothing when the check fails before the deadline: that is an error', async () => {
    status.handleStatusCheck.mockRejectedValue(new Error('Better Stack 500'));
    status.peekServiceStatus.mockReturnValue({ ...STATUS, stale: true });

    await expect(loadServiceStatus()).resolves.toEqual({ kind: 'error' });
    expect(status.peekServiceStatus).not.toHaveBeenCalled();
  });
});
