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
 * @file getGitHubStats pages through every repository, personal and organization, before it sums
 * the stars, counts the org's repositories and picks the top ten. The undercount it fixes: one
 * page of 100 per list gave 73 stars while the profile counted 324 repositories.
 *
 * - The lists are the public ones, with or without a token, so the stars are summed over the very
 *   repositories the count names (the profile's public count plus the org's public repos).
 * - The pages the profile's count implies are read at once; past them, pages are read one at a
 *   time until one comes back short (fewer than 100). Always in a stable order (by name), so a
 *   push between two reads can't shift a repository off one page and onto none.
 * - A page that fails (a rate limit, say) fails the whole refresh: the last good stats are served
 *   with a warning, never a partial total, and with nothing cached the call throws.
 * - More pages than the ceiling is a failure too, not a silent undercount.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
/** The env the handler reads; a test may add GITHUB_TOKEN (a placeholder, never a real one). */
const envValues = vi.hoisted((): Record<string, string | undefined> => ({ NODE_ENV: 'test' }));

vi.mock('@sentry/nextjs', () => sentry);
// t3-env validates on import.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (typeof key === 'string' ? envValues[key] : undefined),
  });
  return { env, default: env };
});

const T0 = new Date('2026-11-10T12:00:00Z').getTime();
const HOUR = 60 * 60 * 1_000;
const PER_PAGE = 100;

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

/** GitHub's answer once the hourly budget is spent: a 403 the fetcher never retries. */
const rateLimited = () =>
  jsonResponse({ message: 'API rate limit exceeded' }, 403, { 'x-ratelimit-remaining': '0' });

const urlOf = (input: RequestInfo | URL) => (input instanceof Request ? input.url : String(input));

interface RepoOptions {
  readonly stars?: number;
  readonly fork?: boolean;
}

/** `count` repositories named `<prefix>-<n>`, each with `stars` stars. */
const repos = (prefix: string, count: number, { stars = 1, fork = false }: RepoOptions = {}) =>
  Array.from({ length: count }, (_, index) => ({
    name: `${prefix}-${index}`,
    description: null,
    stargazers_count: stars,
    language: 'TypeScript',
    fork,
    html_url: `https://github.com/WomB0ComB0/${prefix}-${index}`,
  }));

const PROFILE = { public_repos: 224, followers: 190, avatar_url: 'https://example.com/a.png' };

type Pages = Readonly<Record<number, unknown[]>>;

/** Which list a URL asks for, and which page (1 when it names none). */
function parse(url: string): { list: 'user' | 'org' | 'profile'; page: number } {
  const parsed = new URL(url);
  const page = Number(parsed.searchParams.get('page') ?? '1');
  if (parsed.pathname.startsWith('/orgs/')) return { list: 'org', page };
  if (parsed.pathname.endsWith('/repos')) return { list: 'user', page };
  return { list: 'profile', page };
}

/** Answers the profile and each list's pages; a page past the last is empty, as GitHub's is. */
function gitHub(user: Pages, org: Pages) {
  return (url: string): Response => {
    const { list, page } = parse(url);
    if (list === 'profile') return jsonResponse(PROFILE);
    const pages = list === 'org' ? org : user;
    return jsonResponse(pages[page] ?? []);
  };
}

const stubFetch = (reply: (url: string) => Response) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) =>
    reply(urlOf(input)),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** The pages requested of one list, in order. */
const pagesAsked = (fetchMock: ReturnType<typeof stubFetch>, list: 'user' | 'org') =>
  fetchMock.mock.calls
    .map(([input]) => parse(urlOf(input as RequestInfo)))
    .filter((call) => call.list === list)
    .map((call) => call.page);

/** A fresh copy of the handler with an empty cache (it lives on globalThis). */
const loadHandler = async () => {
  vi.resetModules();
  const handlers = await import('@/app/api/v1/[[...route]]/github-stats/handlers');
  handlers.resetGitHubStatsCache();
  return handlers.getGitHubStats;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  sentry.captureException.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete envValues.GITHUB_TOKEN;
});

describe('getGitHubStats pagination', () => {
  it('sums the stars of every page of both lists, stopping after a short page', async () => {
    const fetchMock = stubFetch(
      gitHub(
        { 1: repos('a', PER_PAGE), 2: repos('b', PER_PAGE), 3: repos('c', 24, { stars: 2 }) },
        { 1: repos('o', PER_PAGE, { stars: 0 }), 2: repos('p', 5, { stars: 3 }) },
      ),
    );
    const getGitHubStats = await loadHandler();

    const stats = await getGitHubStats();

    // 200 x 1 + 24 x 2 personal, 100 x 0 + 5 x 3 org.
    expect(stats.stats.totalStars).toBe(200 + 48 + 15);
    // The profile's public count plus every org repository, not just the first page of them.
    expect(stats.user.repos).toBe(PROFILE.public_repos + 105);
    expect(pagesAsked(fetchMock, 'user')).toEqual([1, 2, 3]);
    expect(pagesAsked(fetchMock, 'org')).toEqual([1, 2]);
  });

  it('asks for one empty page when the last full page ends the list exactly', async () => {
    const fetchMock = stubFetch(gitHub({ 1: repos('a', PER_PAGE), 2: repos('b', PER_PAGE) }, {}));
    const getGitHubStats = await loadHandler();

    const stats = await getGitHubStats();

    expect(stats.stats.totalStars).toBe(200);
    expect(pagesAsked(fetchMock, 'user')).toEqual([1, 2, 3]);
    expect(pagesAsked(fetchMock, 'org')).toEqual([1]);
  });

  it('reads every page in a stable order and at the largest page size', async () => {
    const fetchMock = stubFetch(gitHub({ 1: repos('a', PER_PAGE), 2: repos('b', 3) }, {}));
    const getGitHubStats = await loadHandler();

    await getGitHubStats();

    const listUrls = fetchMock.mock.calls
      .map(([input]) => new URL(urlOf(input as RequestInfo)))
      .filter((url) => url.pathname.endsWith('/repos'));
    expect(listUrls.length).toBeGreaterThan(0);
    for (const url of listUrls) {
      expect(url.searchParams.get('per_page')).toBe(String(PER_PAGE));
      expect(url.searchParams.get('sort')).toBe('full_name');
    }
  });

  it('reads the public lists with a token too, and still sends it for the rate limit', async () => {
    envValues.GITHUB_TOKEN = 'placeholder-token';
    const fetchMock = stubFetch(gitHub({ 1: repos('a', 3) }, { 1: repos('o', 2) }));
    const getGitHubStats = await loadHandler();

    await getGitHubStats();

    const requests = fetchMock.mock.calls.map(([input, init]) => ({
      url: new URL(urlOf(input as RequestInfo)),
      auth: (input instanceof Request
        ? input.headers
        : new Headers((init as RequestInit | undefined)?.headers)
      ).get('authorization'),
    }));
    const lists = requests.filter(({ url }) => url.pathname.endsWith('/repos'));
    expect([...new Set(lists.map(({ url }) => url.pathname))].sort()).toEqual([
      '/orgs/ElysiumOSS/repos',
      '/users/WomB0ComB0/repos',
    ]);
    expect(
      lists.find(({ url }) => url.pathname.startsWith('/users/'))?.url.searchParams.get('type'),
    ).toBe('owner');
    expect(
      lists.find(({ url }) => url.pathname.startsWith('/orgs/'))?.url.searchParams.get('type'),
    ).toBe('public');
    expect(requests.every(({ auth }) => auth === 'Bearer placeholder-token')).toBe(true);
  });

  it('picks the top repositories from every page, forks left out', async () => {
    stubFetch(
      gitHub(
        {
          1: [...repos('fork', 1, { stars: 99, fork: true }), ...repos('a', PER_PAGE - 1)],
          2: repos('late', 1, { stars: 50 }),
        },
        {},
      ),
    );
    const getGitHubStats = await loadHandler();

    const stats = await getGitHubStats();

    expect(stats.topRepos[0]).toMatchObject({ name: 'late-0', stars: 50 });
    expect(stats.topRepos.some((repo) => repo.name.startsWith('fork'))).toBe(false);
    expect(stats.topRepos).toHaveLength(10);
  });

  it('ranks the languages by how many repositories use them, across every page', async () => {
    const withLanguage = (prefix: string, count: number, language: string | null) =>
      repos(prefix, count).map((entry) => ({ ...entry, language }));
    stubFetch(
      gitHub(
        {
          1: [
            ...withLanguage('a', 2, 'Astro'),
            ...withLanguage('p', 40, 'Python'),
            ...withLanguage('n', 58, null),
          ],
          2: [...withLanguage('t', 30, 'TypeScript'), ...withLanguage('g', 5, 'Go')],
        },
        { 1: withLanguage('o', 12, 'TypeScript') },
      ),
    );
    const getGitHubStats = await loadHandler();

    const stats = await getGitHubStats();

    // Name order would give Astro first; counts give TypeScript (42), Python (40), Go, Astro.
    expect(stats.stats.topLanguages).toEqual(['TypeScript', 'Python', 'Go', 'Astro']);
  });

  it('serves the last good stats, never a partial total, when a later page is rate limited', async () => {
    const pages = { 1: repos('a', PER_PAGE), 2: repos('b', 10) };
    const fetchMock = stubFetch(gitHub(pages, {}));
    const getGitHubStats = await loadHandler();
    const first = await getGitHubStats();
    expect(first.stats.totalStars).toBe(110);

    // An hour on, page 1 answers again but page 2 hits the rate limit.
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      const { list, page } = parse(url);
      return list === 'user' && page === 2 ? rateLimited() : gitHub(pages, {})(url);
    });
    vi.setSystemTime(T0 + HOUR + 1);

    await expect(getGitHubStats()).resolves.toEqual(first);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'github:stats' }),
      expect.objectContaining({ level: 'warning' }),
    );
  });

  it('throws when a page is rate limited and nothing is cached', async () => {
    stubFetch((url) => {
      const { list, page } = parse(url);
      if (list === 'profile') return jsonResponse(PROFILE);
      return list === 'user' && page === 2 ? rateLimited() : jsonResponse(repos('a', PER_PAGE));
    });
    const getGitHubStats = await loadHandler();

    await expect(getGitHubStats()).rejects.toMatchObject({ command: 'github:stats' });
  });

  it('fails rather than undercount when a list runs past the page ceiling', async () => {
    const fetchMock = stubFetch((url) =>
      parse(url).list === 'profile' ? jsonResponse(PROFILE) : jsonResponse(repos('a', PER_PAGE)),
    );
    const getGitHubStats = await loadHandler();

    await expect(getGitHubStats()).rejects.toMatchObject({ command: 'github:stats' });
    // Bounded: it gave up at the ceiling instead of paging forever.
    expect(pagesAsked(fetchMock, 'user').length).toBeLessThanOrEqual(10);
  });
});
