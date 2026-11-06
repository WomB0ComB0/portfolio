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
 * @file The home GitHub tile's server source. One GraphQL POST, public non-fork repositories only,
 * weekly sums over twelve Sunday-start UTC weeks, the newest own non-merge commit, and a
 * stale-on-error cache shared by every copy of the module, which peekGitHubActivity reads without
 * asking GitHub. And the project tile's: the public repositories GitHub counts the owner's own
 * commits to over 30 days (never a bot's or teammate's push), private ones dropped unread, from a
 * query, cache and errors of its own. Only fetch, the clock and the env are faked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fakeEnv = vi.hoisted(() => ({
  values: {} as Record<string, string | undefined>,
}));

// t3-env validates on import; the fetcher also reads it for the Vercel bypass header.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (typeof key === 'string' ? fakeEnv.values[key] : undefined),
  });
  return { env, default: env };
});

import { makeProject } from '@tests/fixtures/sanity-docs';
import { nyToday } from '@/app/_components/home/data/format';
import {
  ACTIVE_PROJECT_WINDOW_DAYS,
  selectActiveProject,
} from '@/app/_components/home/data/selectors';
import { isBaseError } from '@/classes/error';
import {
  ACTIVITY_TTL_MS,
  ACTIVITY_WEEKS,
  GITHUB_LOGIN,
  peekGitHubActivity,
  peekRecentCommits,
  RECENT_COMMITS_DAYS,
  readGitHubActivity,
  readRecentCommits,
  resetGitHubActivityCache,
} from '@/lib/api-integrations/github-activity';

/** A Thursday. Its week started on Sunday 2026-11-01; eleven weeks before that is 2026-08-16. */
const T0 = new Date('2026-11-05T12:00:00Z').getTime();
const TEST_TOKEN = 'test-token';
const DAY_MS = 86_400_000;

const WEEK_STARTS = [
  '2026-08-16',
  '2026-08-23',
  '2026-08-30',
  '2026-09-06',
  '2026-09-13',
  '2026-09-20',
  '2026-09-27',
  '2026-10-04',
  '2026-10-11',
  '2026-10-18',
  '2026-10-25',
  '2026-11-01',
];

interface ContributionDayFixture {
  date: string;
  contributionCount: number;
}

interface CommitFixture {
  headline: string;
  committedDate: string;
  /** null: the author email belongs to no GitHub account. */
  login: string | null;
  sha?: string;
  url?: string;
}

const addDays = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** One day per count, starting at `start`. */
const daysFrom = (start: string, counts: readonly number[]): ContributionDayFixture[] =>
  counts.map((contributionCount, index) => ({ date: addDays(start, index), contributionCount }));

/** GitHub's calendar groups days by seven; these chunks need not match calendar weeks. */
const asCalendarWeeks = (days: readonly ContributionDayFixture[]) =>
  Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => ({
    contributionDays: days.slice(index * 7, index * 7 + 7),
  }));

const commitNode = (repo: string, { headline, committedDate, login, sha, url }: CommitFixture) => {
  const abbreviatedOid = sha ?? 'abc1234';
  return {
    messageHeadline: headline,
    committedDate,
    url: url ?? `https://github.com/${repo}/commit/${abbreviatedOid}`,
    abbreviatedOid,
    author: { user: login === null ? null : { login } },
  };
};

const repoNode = (nameWithOwner: string, commits: readonly CommitFixture[]) => ({
  nameWithOwner,
  url: `https://github.com/${nameWithOwner}`,
  defaultBranchRef: {
    target: { history: { nodes: commits.map((commit) => commitNode(nameWithOwner, commit)) } },
  },
});

/** A repository whose default branch is `defaultBranchRef` (null when it is empty). */
const bareRepoNode = (nameWithOwner: string, defaultBranchRef: unknown) => ({
  nameWithOwner,
  url: `https://github.com/${nameWithOwner}`,
  defaultBranchRef,
});

const ownCommit = (
  headline: string,
  committedDate: string,
  extra: Partial<CommitFixture> = {},
) => ({
  headline,
  committedDate,
  login: GITHUB_LOGIN,
  ...extra,
});

const activityReply = ({
  days = [],
  repositories = [],
}: {
  days?: readonly ContributionDayFixture[];
  repositories?: readonly unknown[];
}) => ({
  data: {
    user: {
      contributionsCollection: { contributionCalendar: { weeks: asCalendarWeeks(days) } },
      repositories: { nodes: repositories },
    },
  },
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const stubFetch = (reply: () => Response) => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => reply());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** What the source sent on the `call`-th fetch. */
const sentRequest = async (fetchMock: ReturnType<typeof stubFetch>, call = 0) => {
  const [input, init] = fetchMock.mock.calls[call] ?? [];
  const body = JSON.parse(await new Response(init?.body).text()) as {
    query: string;
    variables: Record<string, unknown>;
  };
  return {
    url: String(input),
    method: init?.method,
    authorization: new Headers(init?.headers).get('authorization'),
    body,
  };
};

const readData = async () => (await readGitHubActivity()).data;

/** `error` and the errors it wraps, through `cause`. */
function causeChain(error: unknown): Error[] {
  const chain: Error[] = [];
  let link: unknown = error;
  while (link instanceof Error && chain.length < 5) {
    chain.push(link);
    link = link.cause;
  }
  return chain;
}

const causeMessages = (error: unknown): string[] => causeChain(error).map((link) => link.message);

beforeEach(() => {
  // Only the clock is faked: the fetcher's retry delay still runs on real timers.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  fakeEnv.values = { NODE_ENV: 'test', GITHUB_TOKEN: TEST_TOKEN };
  resetGitHubActivityCache();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('GitHub activity: contributions', () => {
  it('sums twelve calendar weeks, oldest to newest, however GitHub chunks the days', async () => {
    // Week i has `i` contributions a day; the current week has five days (Sunday to Thursday).
    const counts = [
      ...Array.from({ length: ACTIVITY_WEEKS - 1 }, (_, week) => Array(7).fill(week)).flat(),
      ...Array(5).fill(ACTIVITY_WEEKS - 1),
    ];
    // A Saturday before the first week: outside the twelve weeks, so it is not counted.
    const days = [{ date: '2026-08-15', contributionCount: 50 }, ...daysFrom('2026-08-16', counts)];
    stubFetch(() => jsonResponse(activityReply({ days })));

    const activity = await readData();

    expect(activity.weeks).toEqual([
      { start: '2026-08-16', count: 0 },
      { start: '2026-08-23', count: 7 },
      { start: '2026-08-30', count: 14 },
      { start: '2026-09-06', count: 21 },
      { start: '2026-09-13', count: 28 },
      { start: '2026-09-20', count: 35 },
      { start: '2026-09-27', count: 42 },
      { start: '2026-10-04', count: 49 },
      { start: '2026-10-11', count: 56 },
      { start: '2026-10-18', count: 63 },
      { start: '2026-10-25', count: 70 },
      { start: '2026-11-01', count: 55 },
    ]);
    expect(activity.total).toBe(440);
    expect(activity.fetchedAt).toBe(new Date(T0).toISOString());
  });

  it('counts a week GitHub left out as zero, so there are always twelve', async () => {
    stubFetch(() => jsonResponse(activityReply({ days: daysFrom('2026-11-01', [2, 3]) })));

    const activity = await readData();

    expect(activity.weeks.map((week) => week.start)).toEqual(WEEK_STARTS);
    expect(activity.weeks.map((week) => week.count)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5]);
    expect(activity.total).toBe(5);
  });

  it('answers zero activity with a total of 0 and no commit', async () => {
    stubFetch(() =>
      jsonResponse(activityReply({ days: daysFrom('2026-08-16', Array(82).fill(0)) })),
    );

    await expect(readGitHubActivity()).resolves.toEqual({
      stale: false,
      data: {
        weeks: WEEK_STARTS.map((start) => ({ start, count: 0 })),
        total: 0,
        latestCommit: null,
        fetchedAt: new Date(T0).toISOString(),
      },
    });
  });

  it('rejects a calendar date in another format instead of counting it as zero', async () => {
    stubFetch(() =>
      jsonResponse(
        activityReply({ days: [{ date: '2026-11-01T00:00:00Z', contributionCount: 4 }] }),
      ),
    );

    await expect(readGitHubActivity()).rejects.toThrow();
  });
});

describe('GitHub activity: request', () => {
  it('POSTs one GraphQL query for public, non-fork repositories with the token', async () => {
    const fetchMock = stubFetch(() => jsonResponse(activityReply({})));

    await readGitHubActivity();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = await sentRequest(fetchMock);
    expect(request.url).toBe('https://api.github.com/graphql');
    expect(request.method).toBe('POST');
    expect(request.authorization).toBe(`bearer ${TEST_TOKEN}`);
    expect(request.body.query).toContain('privacy: PUBLIC');
    expect(request.body.query).toContain('isFork: false');
    expect(request.body.query).toContain('ownerAffiliations: [OWNER, ORGANIZATION_MEMBER]');
    expect(request.body.query).toContain('orderBy: { field: PUSHED_AT, direction: DESC }');
    expect(request.body.variables).toEqual({
      login: GITHUB_LOGIN,
      from: '2026-08-16T00:00:00.000Z',
      to: new Date(T0).toISOString(),
    });
  });

  it('reads the newest 20 commits of the ten most recently pushed repositories', async () => {
    // Bots and teammates push to these too, so five let their pushes crowd out his commits.
    const fetchMock = stubFetch(() => jsonResponse(activityReply({})));

    await readGitHubActivity();

    const { query } = (await sentRequest(fetchMock)).body;
    expect(query).toMatch(/repositories\(\s*first: 10\s/);
    expect(query).toMatch(/history\(first: 20\)/);
  });

  it("leaves the project tile's question out of the GitHub tile's query", async () => {
    // Its own, separate query: the 30-day commit contributions never slow this one down.
    const fetchMock = stubFetch(() => jsonResponse(activityReply({})));

    await readGitHubActivity();

    const { query } = (await sentRequest(fetchMock)).body;
    expect(query).not.toMatch(/pushedAt|commitContributionsByRepository/);
  });

  it.each([
    ['early on a Sunday', '2026-11-01T00:30:00Z', '2026-08-16T00:00:00.000Z'],
    ['late on a Saturday', '2026-11-07T23:59:59Z', '2026-08-16T00:00:00.000Z'],
    ['at the next Sunday 00:00Z', '2026-11-08T00:00:00Z', '2026-08-23T00:00:00.000Z'],
  ])('starts at Sunday 00:00Z eleven weeks before this week, %s', async (_when, now, from) => {
    vi.setSystemTime(new Date(now));
    const fetchMock = stubFetch(() => jsonResponse(activityReply({})));

    await readGitHubActivity();

    const { variables } = (await sentRequest(fetchMock)).body;
    expect(variables.from).toBe(from);
    expect(variables.to).toBe(new Date(now).toISOString());
  });
});

describe('GitHub activity: latest commit', () => {
  it('is the newest own commit across repositories, skipping others and merges', async () => {
    const repositories = [
      repoNode('WomB0ComB0/portfolio', [
        { headline: 'chore(deps): bump', committedDate: '2026-11-05T11:00:00Z', login: 'renovate' },
        { headline: 'unlinked author', committedDate: '2026-11-05T10:30:00Z', login: null },
        ownCommit('Merge pull request #12', '2026-11-05T10:00:00Z'),
        ownCommit('feat: older work', '2026-11-04T09:00:00Z'),
      ]),
      null,
      bareRepoNode('WomB0ComB0/empty', null),
      // A default branch pointing at a tag: `... on Commit` selects nothing.
      bareRepoNode('WomB0ComB0/tagged', { target: {} }),
      repoNode('ElysiumOSS/website', [
        // The login matches case-insensitively.
        ownCommit('fix: newest own', '2026-11-04T18:00:00Z', {
          login: 'womb0comb0',
          sha: 'def5678',
        }),
      ]),
    ];
    stubFetch(() => jsonResponse(activityReply({ repositories })));

    await expect(readData()).resolves.toMatchObject({
      latestCommit: {
        repo: 'ElysiumOSS/website',
        repoUrl: 'https://github.com/ElysiumOSS/website',
        headline: 'fix: newest own',
        url: 'https://github.com/ElysiumOSS/website/commit/def5678',
        sha: 'def5678',
        committedAt: '2026-11-04T18:00:00.000Z',
      },
    });
  });

  it('is the newest merge when the user has only merges', async () => {
    const repositories = [
      repoNode('WomB0ComB0/portfolio', [
        ownCommit('Merge branch main', '2026-11-03T09:00:00Z'),
        ownCommit('Merge pull request #13', '2026-11-04T09:00:00Z', { sha: 'aaa1111' }),
      ]),
    ];
    stubFetch(() => jsonResponse(activityReply({ repositories })));

    const { latestCommit } = await readData();

    expect(latestCommit).toMatchObject({ headline: 'Merge pull request #13', sha: 'aaa1111' });
  });

  it('is null when no commit read is by the user', async () => {
    const repositories = [
      repoNode('ElysiumOSS/website', [
        { headline: 'docs: teammate', committedDate: '2026-11-04T09:00:00Z', login: 'teammate' },
        { headline: 'no account', committedDate: '2026-11-04T08:00:00Z', login: null },
      ]),
    ];
    stubFetch(() => jsonResponse(activityReply({ repositories })));

    await expect(readData()).resolves.toMatchObject({ latestCommit: null });
  });

  it('never links outside github.com', async () => {
    const repositories = [
      repoNode('WomB0ComB0/portfolio', [
        ownCommit('odd link', '2026-11-05T09:00:00Z', { url: 'javascript:alert(1)' }),
        ownCommit('feat: real', '2026-11-04T09:00:00Z'),
      ]),
    ];
    stubFetch(() => jsonResponse(activityReply({ repositories })));

    await expect(readData()).resolves.toMatchObject({ latestCommit: { headline: 'feat: real' } });
  });
});

/** GitHub's start of `day` in Pacific time, as a commit contribution's occurredAt carries it. */
const pacificDayStart = (day: string): string =>
  `${day}T${day < '2026-11-01' ? '07' : '08'}:00:00Z`;

interface ContributionFixture {
  readonly day: string;
  readonly commits: number;
}

/** One repository's entry in commitContributionsByRepository, as GitHub sends it. */
const committedNode = (
  nameWithOwner: string,
  days: readonly ContributionFixture[],
  repository: Record<string, unknown> = {},
) => ({
  repository: {
    isPrivate: false,
    nameWithOwner,
    url: `https://github.com/${nameWithOwner}`,
    ...repository,
  },
  contributions: {
    nodes: days.map(({ day, commits }) => ({
      occurredAt: pacificDayStart(day),
      commitCount: commits,
    })),
  },
});

const commitsReply = (entries: unknown) => ({
  data: { user: { contributionsCollection: { commitContributionsByRepository: entries } } },
});

const readCommits = async () => (await readRecentCommits()).data;

/** True when the project tile's selector takes a commit on `day` as recent work at `now`. */
const tileAcceptsDay = (day: string, now: number): boolean => {
  const repo = 'WomB0ComB0/grepo';
  const url = `https://github.com/${repo}`;
  const committed = { nameWithOwner: repo, url, lastCommitDay: day, commitsThatDay: 1 };
  return selectActiveProject([makeProject({ githubUrl: url })], [committed], now) !== null;
};

describe("recent commits (the project tile's source)", () => {
  it('asks its own query: his commit contributions of the last 30 days and one more, privacy first', async () => {
    const fetchMock = stubFetch(() => jsonResponse(commitsReply([])));

    await readRecentCommits();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = await sentRequest(fetchMock);
    expect(request.url).toBe('https://api.github.com/graphql');
    expect(request.authorization).toBe(`bearer ${TEST_TOKEN}`);
    expect(request.body.query).toMatch(
      /commitContributionsByRepository\(maxRepositories: 100\)\s*{\s*repository\s*{\s*isPrivate\s/,
    );
    expect(request.body.query).toContain('orderBy: { field: OCCURRED_AT, direction: DESC }');
    expect(request.body.query).not.toMatch(/pushedAt|contributionCalendar|history/);
    // The tile's selector applies the same window again, as a cached answer ages.
    expect(RECENT_COMMITS_DAYS).toBe(30);
    expect(ACTIVE_PROJECT_WINDOW_DAYS).toBe(RECENT_COMMITS_DAYS);
    expect(request.body.variables).toEqual({
      login: GITHUB_LOGIN,
      from: new Date(T0 - 31 * DAY_MS).toISOString(),
      to: new Date(T0).toISOString(),
    });
  });

  // The selector accepts every day up to ACTIVE_PROJECT_WINDOW_DAYS back from New York's today;
  // GitHub dates a contribution by its day's start in Pacific time. A query starting after that
  // start never fetches a commit made earlier on the oldest day, so the tile would miss it.
  it.each([
    ['7 AM in New York', '2026-11-05T12:00:00Z'],
    ['9 PM in New York, already the next day in UTC', '2026-11-03T02:00:00Z'],
    ['a minute to midnight in New York', '2026-11-03T04:59:00Z'],
    ['a minute after midnight in New York', '2026-11-03T05:01:00Z'],
  ])('asks from before the oldest day the tile accepts starts, at %s', async (_at, nowIso) => {
    const now = Date.parse(nowIso);
    vi.setSystemTime(now);
    const fetchMock = stubFetch(() => jsonResponse(commitsReply([])));

    await readRecentCommits();

    const oldest = addDays(nyToday(now), -ACTIVE_PROJECT_WINDOW_DAYS);
    expect(tileAcceptsDay(oldest, now)).toBe(true);
    expect(tileAcceptsDay(addDays(oldest, -1), now)).toBe(false);
    const { from } = (await sentRequest(fetchMock)).body.variables;
    expect(Date.parse(String(from))).toBeLessThan(Date.parse(pacificDayStart(oldest)));
  });

  it('lists public repositories by his newest commit day, newest first; on one day, more commits first', async () => {
    const entries = [
      committedNode('WomB0ComB0/ralph', [{ day: '2026-10-20', commits: 2 }]),
      // Whatever order the days come in, the newest is the one that counts.
      committedNode('WomB0ComB0/grepo', [
        { day: '2026-10-20', commits: 9 },
        { day: '2026-11-03', commits: 1 },
      ]),
      committedNode('ElysiumOSS/website', [{ day: '2026-11-05', commits: 1 }]),
      committedNode('resq-software/.github', [{ day: '2026-11-05', commits: 4 }]),
    ];
    stubFetch(() => jsonResponse(commitsReply(entries)));

    await expect(readCommits()).resolves.toEqual({
      repos: [
        {
          nameWithOwner: 'resq-software/.github',
          url: 'https://github.com/resq-software/.github',
          lastCommitDay: '2026-11-05',
          commitsThatDay: 4,
        },
        {
          nameWithOwner: 'ElysiumOSS/website',
          url: 'https://github.com/ElysiumOSS/website',
          lastCommitDay: '2026-11-05',
          commitsThatDay: 1,
        },
        {
          nameWithOwner: 'WomB0ComB0/grepo',
          url: 'https://github.com/WomB0ComB0/grepo',
          lastCommitDay: '2026-11-03',
          commitsThatDay: 1,
        },
        {
          nameWithOwner: 'WomB0ComB0/ralph',
          url: 'https://github.com/WomB0ComB0/ralph',
          lastCommitDay: '2026-10-20',
          commitsThatDay: 2,
        },
      ],
      fetchedAt: new Date(T0).toISOString(),
    });
  });

  it('drops every private repository, and any not plainly public, before reading it', async () => {
    const day = [{ day: '2026-11-05', commits: 3 }];
    const entries = [
      committedNode('WomB0ComB0/secret-plan', day, { isPrivate: true }),
      committedNode('WomB0ComB0/secret-null', day, { isPrivate: null }),
      committedNode('WomB0ComB0/secret-text', day, { isPrivate: 'false' }),
      {
        repository: { nameWithOwner: 'WomB0ComB0/secret-unsaid', url: 'https://github.com/x/y' },
        contributions: { nodes: [{ occurredAt: pacificDayStart('2026-11-05'), commitCount: 1 }] },
      },
      committedNode('WomB0ComB0/grepo', [{ day: '2026-11-01', commits: 1 }]),
    ];
    stubFetch(() => jsonResponse(commitsReply(entries)));

    const commits = await readCommits();

    expect(commits.repos.map((repo) => repo.nameWithOwner)).toEqual(['WomB0ComB0/grepo']);
    expect(JSON.stringify(commits)).not.toContain('secret');
    expect(JSON.stringify(peekRecentCommits())).not.toContain('secret');
  });

  it('leaves out one it cannot link or date, without failing the rest', async () => {
    const entries = [
      null,
      'WomB0ComB0/not-an-entry',
      committedNode('WomB0ComB0/elsewhere', [{ day: '2026-11-05', commits: 1 }], {
        url: 'https://gitlab.com/WomB0ComB0/elsewhere',
      }),
      committedNode('WomB0ComB0/no-days', []),
      { ...committedNode('WomB0ComB0/null-days', []), contributions: { nodes: null } },
      {
        ...committedNode('WomB0ComB0/undated', []),
        contributions: { nodes: [{ occurredAt: 'yesterday', commitCount: 1 }] },
      },
      committedNode('WomB0ComB0/no-name', [{ day: '2026-11-05', commits: 1 }], {
        nameWithOwner: 42,
      }),
      committedNode('WomB0ComB0/grepo', [{ day: '2026-11-02', commits: 1 }]),
    ];
    stubFetch(() => jsonResponse(commitsReply(entries)));

    const { repos } = await readCommits();

    expect(repos.map((repo) => repo.nameWithOwner)).toEqual(['WomB0ComB0/grepo']);
  });

  it('rejects a reply in another shape without repeating anything from it', async () => {
    stubFetch(() => jsonResponse(commitsReply({ 'WomB0ComB0/secret-plan': { isPrivate: true } })));

    const error = await readRecentCommits().then(
      () => undefined,
      (reason: unknown) => reason,
    );

    expect(isBaseError(error)).toBe(true);
    expect(error).toMatchObject({ command: 'github:recent-commits' });
    const messages = causeMessages(error);
    expect(messages).toContain("GitHub's commit contributions did not have the expected shape");
    expect(messages.join(' ')).not.toContain('secret');
  });

  it("rejects with GitHub's message on GraphQL errors, and when there is no such user", async () => {
    stubFetch(() => jsonResponse({ errors: [{ message: 'Something went wrong' }] }));
    await expect(readRecentCommits()).rejects.toThrow(
      'GitHub GraphQL errors: Something went wrong',
    );

    resetGitHubActivityCache();
    stubFetch(() => jsonResponse({ data: { user: null } }));
    await expect(readRecentCommits()).rejects.toThrow(`GitHub has no user ${GITHUB_LOGIN}`);
  });

  it('rejects without asking GitHub when GITHUB_TOKEN is not set, as its own source', async () => {
    fakeEnv.values = { NODE_ENV: 'test' };
    const fetchMock = stubFetch(() => jsonResponse(commitsReply([])));

    const error = await readRecentCommits().then(
      () => undefined,
      (reason: unknown) => reason,
    );

    expect(error).toMatchObject({ command: 'github:recent-commits' });
    expect(causeMessages(error)).toContain('GITHUB_TOKEN is not set');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves its last answer, stale, when GitHub fails past the TTL; peek answers it at once', async () => {
    const entries = [committedNode('WomB0ComB0/grepo', [{ day: '2026-11-04', commits: 2 }])];
    stubFetch(() => jsonResponse(commitsReply(entries)));
    const first = await readCommits();
    expect(peekRecentCommits()).toEqual({ data: first, loadedAt: T0 });

    vi.setSystemTime(T0 + ACTIVITY_TTL_MS + 1);
    const failing = stubFetch(() => jsonResponse({ message: 'Bad credentials' }, 401));

    await expect(readRecentCommits()).resolves.toMatchObject({ stale: true, data: first });
    expect(failing).toHaveBeenCalledTimes(1);
  });
});

describe('the two GitHub sources', () => {
  /** Answers each query with its own reply, by what it asks for; lists which were asked. */
  function stubBoth(activity: unknown, commits: unknown): string[] {
    const asked: string[] = [];
    stubFetch(() => jsonResponse(activity)).mockImplementation(async (_input, init) => {
      const { query } = JSON.parse(await new Response(init?.body).text()) as { query: string };
      const isCommits = query.includes('commitContributionsByRepository');
      asked.push(isCommits ? 'commits' : 'activity');
      return jsonResponse(isCommits ? commits : activity);
    });
    return asked;
  }

  it('ask GitHub separately: reading one never asks for the other', async () => {
    const asked = stubBoth(activityReply({}), commitsReply([]));

    await readGitHubActivity();
    expect(asked).toEqual(['activity']);
    await readRecentCommits();
    expect(asked).toEqual(['activity', 'commits']);
  });

  it('fail with errors of their own, so neither report can stand in for the other', async () => {
    fakeEnv.values = { NODE_ENV: 'test' };

    const [activityError, commitsError] = await Promise.all(
      [readGitHubActivity(), readRecentCommits()].map((read) =>
        read.then(
          () => undefined,
          (reason: unknown) => reason,
        ),
      ),
    );

    expect(activityError).toMatchObject({ command: 'github:activity' });
    expect(commitsError).toMatchObject({ command: 'github:recent-commits' });
    expect(causeChain(activityError)).not.toContain(commitsError);
    expect(causeChain(commitsError)).not.toContain(activityError);
  });

  it('keep their own caches: one failing leaves the other fresh', async () => {
    stubBoth(activityReply({ days: daysFrom('2026-11-01', [2]) }), commitsReply([]));
    const activity = await readData();
    await readCommits();

    vi.setSystemTime(T0 + ACTIVITY_TTL_MS + 1);
    stubBoth(activityReply({ days: daysFrom('2026-11-01', [5]) }), { errors: [{ message: 'x' }] });

    await expect(readRecentCommits()).resolves.toMatchObject({ stale: true });
    const reloaded = await readGitHubActivity();
    expect(reloaded.stale).toBe(false);
    expect(reloaded.data.total).not.toBe(activity.total);
  });
});

describe('GitHub activity: failures and cache', () => {
  it('rejects without asking GitHub when GITHUB_TOKEN is not set', async () => {
    fakeEnv.values = { NODE_ENV: 'test' };
    const fetchMock = stubFetch(() => jsonResponse(activityReply({})));

    await expect(readGitHubActivity()).rejects.toThrow('GITHUB_TOKEN is not set');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with the GraphQL error message when the query has errors', async () => {
    stubFetch(() =>
      jsonResponse({
        data: { user: null },
        errors: [{ message: "Could not resolve to a User with the login of 'WomB0ComB0'." }],
      }),
    );

    await expect(readGitHubActivity()).rejects.toThrow('Could not resolve to a User');
  });

  it('rejects when GitHub has no such user', async () => {
    stubFetch(() => jsonResponse({ data: { user: null } }));

    await expect(readGitHubActivity()).rejects.toThrow(`GitHub has no user ${GITHUB_LOGIN}`);
  });

  it('serves the cached answer until the TTL, then the old one, stale, when GitHub fails', async () => {
    const good = stubFetch(() =>
      jsonResponse(activityReply({ days: daysFrom('2026-11-01', [3]) })),
    );
    const first = await readData();
    vi.setSystemTime(T0 + ACTIVITY_TTL_MS - 1);
    await expect(readGitHubActivity()).resolves.toEqual({ stale: false, data: first });
    expect(good).toHaveBeenCalledTimes(1);

    vi.setSystemTime(T0 + ACTIVITY_TTL_MS + 1);
    // A 401 is final, so the fetcher does not retry it.
    const failing = stubFetch(() => jsonResponse({ message: 'Bad credentials' }, 401));
    const result = await readGitHubActivity();

    expect(result).toMatchObject({ stale: true, data: first });
    expect(result.data.fetchedAt).toBe(new Date(T0).toISOString());
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it('shares the cache with a second copy of the module, as Next bundles one per layer', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(activityReply({ days: daysFrom('2026-11-01', [1]) })),
    );
    const first = await readData();

    vi.resetModules();
    const copy = await import('@/lib/api-integrations/github-activity');

    await expect(copy.readGitHubActivity()).resolves.toEqual({ stale: false, data: first });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('peekGitHubActivity', () => {
  it('is undefined before GitHub ever answered, and asks GitHub nothing', () => {
    const fetchMock = stubFetch(() => jsonResponse(activityReply({})));

    expect(peekGitHubActivity()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers the last activity at once while a reload past the TTL is still running', async () => {
    stubFetch(() => jsonResponse(activityReply({ days: daysFrom('2026-11-01', [4]) })));
    const first = await readData();
    vi.setSystemTime(T0 + ACTIVITY_TTL_MS + 1);
    const hanging = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', hanging);

    void readGitHubActivity();
    await vi.waitFor(() => expect(hanging).toHaveBeenCalledTimes(1));

    expect(peekGitHubActivity()).toEqual({ data: first, loadedAt: T0 });
    expect(hanging).toHaveBeenCalledTimes(1);
  });

  it('reads the cache every copy of the module shares', async () => {
    stubFetch(() => jsonResponse(activityReply({ days: daysFrom('2026-11-01', [2]) })));
    const first = await readData();

    vi.resetModules();
    const copy = await import('@/lib/api-integrations/github-activity');

    expect(copy.peekGitHubActivity()).toEqual({ data: first, loadedAt: T0 });
  });
});
