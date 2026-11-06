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
 * @file The project tile end to end: the real home loaders, the real GitHub sources and the real
 * reporter, with only fetch, the clock, the env, Sanity's project list and Sentry faked. GitHub's
 * replies are shaped like the live ones of 2026-11-06 (synthetic values).
 * - A push the owner did not make (a Dependabot branch, a teammate, an author with no account,
 *   a bot in an org) never makes a project his latest work: only his own commits count.
 * - His commits count however far down the recently pushed list the repository is, past the
 *   ten the GitHub tile reads, and on a repository he only collaborates on.
 * - With GitHub down and nothing cached, the GitHub tile's own error still reaches Sentry beside
 *   the project tile's warning: neither report stands in for the other.
 */

import { makeProject } from '@tests/fixtures/sanity-docs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  captureException: vi.fn(),
  loadProjects: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({ captureException: h.captureException }));
// t3-env validates on import; the fetcher also reads it for the Vercel bypass header.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (typeof key === 'string' ? h.env[key] : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/loaders', () => ({
  loadProjects: h.loadProjects,
  peekProjects: vi.fn(),
  loadExperiences: vi.fn(),
  peekExperiences: vi.fn(),
  loadCertifications: vi.fn(),
  peekCertifications: vi.fn(),
  loadPlaces: vi.fn(),
  peekPlaces: vi.fn(),
}));
vi.mock('@/lib/api-integrations/monkeytype', () => ({
  readMonkeytypeProfile: vi.fn(),
  peekMonkeytypeProfile: vi.fn(),
}));
vi.mock('@/app/api/v1/[[...route]]/leetcode/handlers', () => ({
  readLeetCodeStats: vi.fn(),
  peekLeetCodeStats: vi.fn(),
}));
vi.mock('@/app/api/v1/[[...route]]/now-playing/handlers', () => ({ getNowPlaying: vi.fn() }));
vi.mock('@/app/api/[[...route]]/status/handlers', () => ({
  handleStatusCheck: vi.fn(),
  peekServiceStatus: vi.fn(),
}));

import { loadGitHubActivity, loadProjectPick } from '@/app/_components/home/data/loaders';
import { resetGitHubActivityCache } from '@/lib/api-integrations/github-activity';
import { resetApiReportCooldowns } from '@/lib/observability/report';

/** Noon in New York on Friday 2026-11-06. */
const NOW = Date.parse('2026-11-06T17:00:00Z');
const LOGIN = 'WomB0ComB0';

const FEATURED = makeProject({
  title: 'Fraud Guard',
  featured: true,
  order: 0,
  githubUrl: 'https://gitlab.com/WomB0ComB0/fraud-guard',
  image: { _type: 'image', asset: { _ref: 'image-cover-1600x1000-png', _type: 'reference' } },
});
const GENIE = makeProject({
  title: 'Genie',
  githubUrl: 'https://github.com/WomB0ComB0/hacknyu-25',
});
const KAPPA = makeProject({
  title: 'Kappa Theta Pi National Website',
  githubUrl: 'https://github.com/ktpnational/kappa-theta-pi',
});
const ELYSIUM = makeProject({ title: 'ElysiumOSS', githubUrl: 'https://github.com/ElysiumOSS' });
const GREPO = makeProject({ title: 'grepo', githubUrl: 'https://github.com/ElysiumOSS/grepo' });
const SPARKMIND = makeProject({
  title: 'SparkMind',
  githubUrl: 'https://github.com/lluciiiia/SparkMind',
});
const SITE = makeProject({
  title: 'Portfolio',
  githubUrl: 'https://github.com/WomB0ComB0/portfolio',
});

const PROJECTS = [FEATURED, GENIE, KAPPA, ELYSIUM, GREPO, SPARKMIND, SITE];

interface CommitFixture {
  readonly at: string;
  /** null: the author email belongs to no GitHub account. */
  readonly login: string | null;
  readonly headline?: string;
}

/** A repository as the GitHub tile's query returns it, pushed at `pushedAt`. */
const pushedRepo = (nameWithOwner: string, pushedAt: string, commits: CommitFixture[] = []) => ({
  nameWithOwner,
  url: `https://github.com/${nameWithOwner}`,
  pushedAt,
  defaultBranchRef: {
    target: {
      history: {
        nodes: commits.map(({ at, login, headline }) => ({
          messageHeadline: headline ?? 'chore: update',
          committedDate: at,
          url: `https://github.com/${nameWithOwner}/commit/abc1234`,
          abbreviatedOid: 'abc1234',
          author: { user: login === null ? null : { login } },
        })),
      },
    },
  },
});

/** The GitHub tile's reply: an empty calendar and `repositories`, most recently pushed first. */
const activityReply = (repositories: unknown[]) => ({
  data: {
    user: {
      contributionsCollection: { contributionCalendar: { weeks: [] } },
      repositories: { nodes: repositories },
    },
  },
});

/** His own commits to `nameWithOwner`, his newest on `day` (GitHub's Pacific day start). */
const committed = (nameWithOwner: string, day: string, isPrivate = false) => ({
  repository: { isPrivate, nameWithOwner, url: `https://github.com/${nameWithOwner}` },
  contributions: { nodes: [{ occurredAt: `${day}T07:00:00Z`, commitCount: 2 }] },
});

const commitsReply = (entries: unknown[]) => ({
  data: { user: { contributionsCollection: { commitContributionsByRepository: entries } } },
});

/**
 * The top of his recently pushed list as GitHub orders it, none of it his own work on a project:
 * Dependabot on Genie's repository, an author with no account on Kappa Theta Pi's, a bot in
 * ElysiumOSS, and org bots everywhere else.
 */
const BOT_PUSHES = [
  pushedRepo('WomB0ComB0/portfolio', '2026-11-06T16:55:19Z', [
    { at: '2026-11-06T16:54:55Z', login: LOGIN },
  ]),
  pushedRepo('hackforla/website', '2026-11-06T11:10:04Z', [
    { at: '2026-11-06T11:10:00Z', login: 'HackforLABot' },
  ]),
  pushedRepo('ElysiumOSS/grepo', '2026-11-06T10:40:00Z', [
    { at: '2026-06-16T19:57:38Z', login: 'dependabot[bot]' },
  ]),
  pushedRepo('resq-software/npm', '2026-11-06T10:29:21Z'),
  pushedRepo('hackforla/tdm-calculator', '2026-11-06T00:58:14Z'),
  pushedRepo('resq-software/crates', '2026-11-03T02:55:10Z'),
  pushedRepo('resq-software/dotnet', '2026-11-02T06:45:35Z'),
  pushedRepo('ktpnational/kappa-theta-pi', '2026-10-26T23:37:48Z', [
    { at: '2026-10-26T23:37:48Z', login: null, headline: 'added new board members' },
  ]),
  // Pushed by Dependabot to its own branch; his last commit there is from February 2025.
  pushedRepo('WomB0ComB0/hacknyu-25', '2026-10-19T08:28:56Z', [
    { at: '2025-02-09T20:00:00Z', login: LOGIN },
  ]),
  pushedRepo('hackforla/data-science', '2026-10-17T02:44:05Z'),
];

/** Answers each of the two queries with its own reply. */
function stubGitHub(activity: unknown, commits: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const { query } = JSON.parse(await new Response(init?.body).text()) as { query: string };
      const reply = query.includes('commitContributionsByRepository') ? commits : activity;
      return new Response(JSON.stringify(reply), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

/** Every Sentry event, as its level and context. */
const sentryEvents = (): unknown[] =>
  h.captureException.mock.calls.map(([, context]) => ({
    level: (context as { level?: string }).level,
    context: (context as { tags?: Record<string, string> }).tags?.['api.context'],
  }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  h.env = { NODE_ENV: 'test', GITHUB_TOKEN: 'test-token' };
  h.captureException.mockReset();
  h.loadProjects.mockReset();
  h.loadProjects.mockResolvedValue(PROJECTS);
  resetGitHubActivityCache();
  resetApiReportCooldowns();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the project tile follows his own commits', () => {
  it('never credits him with a push he did not make: Dependabot, a teammate, an org bot', async () => {
    // His own commits went only to this site and to an org's repository no project names.
    stubGitHub(
      activityReply(BOT_PUSHES),
      commitsReply([
        committed('WomB0ComB0/portfolio', '2026-11-06'),
        committed('resq-software/.github', '2026-11-05'),
      ]),
    );

    await expect(loadProjectPick()).resolves.toEqual({
      status: 'ok',
      data: { source: 'featured', project: FEATURED },
      stale: false,
    });
    expect(h.captureException).not.toHaveBeenCalled();
  });

  it('finds his work past the ten repositories the GitHub tile reads', async () => {
    // Ten newer pushes by others crowd grepo out of the GitHub tile's list.
    stubGitHub(
      activityReply(BOT_PUSHES.filter((repo) => repo.nameWithOwner !== 'ElysiumOSS/grepo')),
      commitsReply([
        committed('WomB0ComB0/portfolio', '2026-11-06'),
        committed('ElysiumOSS/grepo', '2026-10-26'),
      ]),
    );

    await expect(loadProjectPick()).resolves.toMatchObject({
      status: 'ok',
      data: { source: 'activity', project: GREPO, lastCommitDay: '2026-10-26' },
    });
  });

  it('counts a repository he only collaborates on, newest commit day first', async () => {
    stubGitHub(
      activityReply(BOT_PUSHES),
      commitsReply([
        committed('ElysiumOSS/grepo', '2026-10-26'),
        committed('lluciiiia/SparkMind', '2026-11-03'),
      ]),
    );

    await expect(loadProjectPick()).resolves.toMatchObject({
      data: { source: 'activity', project: SPARKMIND, repo: 'lluciiiia/SparkMind' },
    });
  });

  it('never uses a private repository, even one a project names', async () => {
    stubGitHub(
      activityReply([]),
      commitsReply([committed('WomB0ComB0/hacknyu-25', '2026-11-06', true)]),
    );

    await expect(loadProjectPick()).resolves.toMatchObject({
      data: { source: 'featured', project: FEATURED },
    });
  });
});

describe('with GitHub down and nothing cached', () => {
  it.each([
    ['GitHub tile first', () => Promise.all([loadGitHubActivity(), loadProjectPick()])],
    ['project tile first', () => Promise.all([loadProjectPick(), loadGitHubActivity()])],
  ])("still sends the GitHub tile's error to Sentry (%s)", async (_order, loadBoth) => {
    h.env = { NODE_ENV: 'test' };

    const [first, second] = await loadBoth();

    expect([first.status, second.status].sort()).toEqual(['error', 'ok']);
    expect(sentryEvents()).toEqual(
      expect.arrayContaining([
        { level: 'error', context: 'home github tile' },
        { level: 'warning', context: 'home project activity' },
      ]),
    );
    expect(h.captureException).toHaveBeenCalledTimes(2);
  });
});
