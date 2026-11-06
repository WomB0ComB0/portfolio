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
 * asking GitHub. Only fetch, the clock and the env are faked.
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

import {
  ACTIVITY_TTL_MS,
  ACTIVITY_WEEKS,
  GITHUB_LOGIN,
  peekGitHubActivity,
  readGitHubActivity,
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
