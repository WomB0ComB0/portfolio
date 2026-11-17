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
 * GitHub Statistics API Handler
 *
 * Fetches combined GitHub statistics from every page of:
 * - Personal repositories (WomB0ComB0) - public repos
 * - Organization repositories (ElysiumOSS) - public repos
 *
 * Authentication:
 * GITHUB_TOKEN, when set, raises the rate limit (60 to 5,000 requests an hour). The counts are of
 * public repositories either way.
 */

import { Effect, pipe, Schema } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { ensureBaseError } from '@/classes/error';
import env from '@/env';
import { processGlobal, resetProcessGlobal } from '@/lib/cache/process-global';
import type { CachedValue } from '@/lib/cache/stale-cache';
import { FetcherError, get } from '@/lib/http-clients/effect-fetcher';
import { reportApiFailure } from '@/lib/observability/report';

/** The route's error-handler context, so stale-fallback warnings group with its errors. */
const REPORT_CONTEXT = 'fetching GitHub stats';

const GitHubUserSchema = Schema.Struct({
  public_repos: Schema.Number,
  followers: Schema.Number,
  avatar_url: Schema.String,
});

const GitHubRepoSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.Union([Schema.String, Schema.Null]),
  stargazers_count: Schema.Number,
  language: Schema.Union([Schema.String, Schema.Null]),
  fork: Schema.Boolean,
  html_url: Schema.String,
});

const GitHubReposArraySchema = Schema.Array(GitHubRepoSchema);

const TopRepoSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.Union([Schema.String, Schema.Null]),
  stars: Schema.Number,
  language: Schema.Union([Schema.String, Schema.Null]),
  url: Schema.String,
});

/** Mutable arrays, so the type fits the route's `github-stats.response` model as it is. */
const GitHubStatsDataSchema = Schema.Struct({
  user: Schema.Struct({
    repos: Schema.Number,
    followers: Schema.Number,
    avatar_url: Schema.String,
  }),
  stats: Schema.Struct({
    totalStars: Schema.Number,
    topLanguages: Schema.mutable(Schema.Array(Schema.String)),
  }),
  topRepos: Schema.mutable(Schema.Array(TopRepoSchema)),
});

export type GitHubStatsData = Schema.Schema.Type<typeof GitHubStatsDataSchema>;
export type TopRepo = Schema.Schema.Type<typeof TopRepoSchema>;
type GitHubRepo = Schema.Schema.Type<typeof GitHubRepoSchema>;
type GitHubUser = Schema.Schema.Type<typeof GitHubUserSchema>;

const CACHE_DURATION = 60 * 60 * 1_000; // 1 hour

interface CachedStats {
  readonly data: GitHubStatsData;
  readonly timestamp: number;
}

/**
 * What getGitHubStats keeps between calls. Next bundles this module once for the /stats page
 * (whose loaders in console-loaders.ts call getGitHubStats directly) and once for the /api/v1
 * route, so module state would give each its own cache. Kept in processGlobal instead, a /stats
 * load that misses its deadline (and carries on in the background) still fills the cache a request
 * to /api/v1/github-stats reads, or that request joins the load still running, rather than asking
 * GitHub a second time.
 */
interface GitHubStatsState {
  /** The last good stats and when they were fetched. */
  cache: CachedStats | null;
  /** The refresh running now; every caller that finds the cache expired joins it. */
  inFlight: Promise<GitHubStatsData> | null;
}

/**
 * Versioned: v2 sums every page of repositories. A process still holding the one-page totals (a
 * dev server across a reload) starts a cache of its own instead of serving the undercount for up
 * to an hour.
 */
const STATE_NAME = 'github-stats.cache.v2';

/** Looked up on every call, so a reset in a test takes effect without reloading this module. */
const sharedState = (): GitHubStatsState =>
  processGlobal<GitHubStatsState>(STATE_NAME, () => ({ cache: null, inFlight: null }));

/** Forgets the cached stats and any running refresh. Tests only. */
export function resetGitHubStatsCache(): void {
  resetProcessGlobal(STATE_NAME);
}

/** Reads the last successful answer and its source timestamp without refreshing or requesting. */
export function peekGitHubStats(): CachedValue<GitHubStatsData> | undefined {
  const cached = sharedState().cache;
  return cached ? { data: cached.data, loadedAt: cached.timestamp } : undefined;
}

const isFresh = (cache: CachedStats | null): cache is CachedStats =>
  cache !== null && Date.now() - cache.timestamp < CACHE_DURATION;

/**
 * Upstream time budget. The /stats loaders (console-loaders.ts) stop waiting after their own short
 * deadline and let the load carry on, and the /api/v1 route answers what it settles to, so the
 * stale fallback (or the 500) has to be ready soon: one retry of a 3.5 s attempt fits in the
 * deadline.
 */
const ATTEMPT_TIMEOUT_MS = 3_500;
const RETRY_DELAY_MS = 500;
/** Caps the profile and both lists together, every page, retry and body read included. */
const UPSTREAM_DEADLINE_MS = 8_000;

/** GitHub's largest page of repositories. */
const PER_PAGE = 100;
/**
 * The most pages read of one list: 1,000 repositories. A list still full at its last page fails
 * the refresh (the last good stats are served) rather than sum part of it, which is the very
 * undercount paging fixes.
 */
const MAX_PAGES = 10;

/**
 * The public lists, so the stars are summed over the very repositories the count names (the
 * profile's public count plus the org's public repos) and no private name reaches the top ten.
 * The token, when set, still rides along for its rate limit. (The token's own /user/repos list,
 * private repos included, ran past 300 repos at 1 to 3 s a page: past the deadline.)
 *
 * In name order: stable, so a push between two page reads can't move a repository off one page
 * and onto none (the top ten is picked by stars, not by this order).
 */
const LIST_QUERY = `per_page=${PER_PAGE}&sort=full_name`;
const PERSONAL_REPOS_URL = `https://api.github.com/users/WomB0ComB0/repos?${LIST_QUERY}&type=owner`;
const ORG_REPOS_URL = `https://api.github.com/orgs/ElysiumOSS/repos?${LIST_QUERY}&type=public`;

interface RequestOptions {
  readonly retries: number;
  readonly retryDelay: number;
  readonly timeout: number;
  readonly headers: Record<string, string>;
}

const readPage = (listUrl: string, page: number, options: RequestOptions) =>
  get(`${listUrl}&page=${page}`, { ...options, schema: GitHubReposArraySchema });

/**
 * How many pages to read at once: as many as `expected` repositories fill (at least one, at most
 * {@link MAX_PAGES}). Without a count, one.
 */
const pagesFor = (expected: number | undefined): number =>
  Math.min(MAX_PAGES, Math.max(1, Math.ceil((expected ?? 0) / PER_PAGE)));

/**
 * Every repository in a list. The pages `expected` (a count GitHub gave) implies are read in
 * parallel; while the last page read is full, the next is read, one at a time, until one comes
 * back short (an empty page ends a list whose last page was full), so a count that lags the list
 * still loses nothing. Any page that fails, a rate limit included, fails the list; so does a list
 * still full after {@link MAX_PAGES} pages.
 */
const fetchEveryRepo = (listUrl: string, options: RequestOptions, expected?: number) =>
  Effect.gen(function* () {
    const first = pagesFor(expected);
    const pages = yield* Effect.all(
      Array.from({ length: first }, (_, index) => readPage(listUrl, index + 1, options)),
      { concurrency: 'unbounded' },
    );
    let repos: readonly GitHubRepo[] = pages.flat();
    let last = pages.at(-1) ?? [];
    for (let page = first + 1; last.length === PER_PAGE; page += 1) {
      if (page > MAX_PAGES) {
        return yield* Effect.fail(
          new FetcherError(`More than ${MAX_PAGES * PER_PAGE} repositories in one list`, listUrl),
        );
      }
      last = yield* readPage(listUrl, page, options);
      repos = [...repos, ...last];
    }
    return repos;
  });

function gitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Portfolio-Dashboard',
  };
  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }
  return headers;
}

/**
 * The profile, then every page of the personal repos (as many at once as its public count
 * fills), alongside every page of the org's. The first failure, or the deadline, interrupts the
 * rest and fails the whole effect, so a total is never summed from part of a list.
 */
function fetchGitHubSources() {
  const options: RequestOptions = {
    retries: 1,
    retryDelay: RETRY_DELAY_MS,
    timeout: ATTEMPT_TIMEOUT_MS,
    headers: gitHubHeaders(),
  };
  const profileAndRepos = pipe(
    get('https://api.github.com/users/WomB0ComB0', { ...options, schema: GitHubUserSchema }),
    Effect.flatMap((me) =>
      pipe(
        fetchEveryRepo(PERSONAL_REPOS_URL, options, me.public_repos),
        Effect.map((personalRepos) => [me, personalRepos] as const),
      ),
    ),
  );

  return pipe(
    Effect.all([profileAndRepos, fetchEveryRepo(ORG_REPOS_URL, options)], {
      concurrency: 'unbounded',
    }),
    Effect.map(([[me, personalRepos], orgRepos]) => [me, personalRepos, orgRepos] as const),
    Effect.timeoutOrElse({
      duration: UPSTREAM_DEADLINE_MS,
      orElse: () =>
        Effect.fail(
          new FetcherError(
            `GitHub did not answer within ${UPSTREAM_DEADLINE_MS} ms`,
            'https://api.github.com',
          ),
        ),
    }),
    Effect.provide(FetchHttpClient.layer),
  );
}

/** How many languages the stats name. */
const TOP_LANGUAGES = 5;

/**
 * Every language the repositories use, the most used first (by how many repositories); a tie
 * keeps the order the languages first appear in. Without the ranking, the lists' name order (which
 * paging needs) would make the first five a matter of the alphabet.
 */
function rankLanguages(repos: readonly GitHubRepo[]): string[] {
  const counts = new Map<string, number>();
  for (const { language } of repos) {
    if (language !== null) counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([, a], [, b]) => b - a).map(([language]) => language);
}

function toStatsData(
  me: GitHubUser,
  personalRepos: readonly GitHubRepo[],
  orgRepos: readonly GitHubRepo[],
): GitHubStatsData {
  // Combine personal and organization repos
  const allRepos = [...personalRepos, ...orgRepos];

  // Filter out forks and sort by stars
  const topRepos = allRepos
    .filter((repo) => !repo.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 10);

  // Calculate total stars from all repos (personal + org)
  const totalStars = allRepos.reduce((acc, curr) => acc + curr.stargazers_count, 0);

  return {
    user: {
      repos: me.public_repos + orgRepos.length, // Include org repos in count
      followers: me.followers,
      avatar_url: me.avatar_url,
    },
    stats: {
      totalStars,
      topLanguages: rankLanguages(allRepos).slice(0, TOP_LANGUAGES),
    },
    topRepos: topRepos.map((repo) => ({
      name: repo.name,
      description: repo.description,
      stars: repo.stargazers_count,
      language: repo.language,
      url: repo.html_url,
    })),
  };
}

/**
 * Asks GitHub again and caches the answer in `state`, the store that was current when the refresh
 * started (so one that outlives a test's reset never fills the next test's cache).
 */
async function refreshGitHubStats(state: GitHubStatsState): Promise<GitHubStatsData> {
  try {
    const [me, personalRepos, orgRepos] = await Effect.runPromise(fetchGitHubSources());
    const data = toStatsData(me, personalRepos, orgRepos);
    state.cache = { data, timestamp: Date.now() };

    return data;
  } catch (error) {
    const { cache } = state;
    const failure = ensureBaseError(error, 'github:stats', {
      username: 'WomB0ComB0',
      organization: 'ElysiumOSS',
      cacheExpired: !isFresh(cache),
    });
    // Repo and star counts change slowly: the last good stats beat a 500.
    if (cache) {
      reportApiFailure(failure, { context: REPORT_CONTEXT, level: 'warning' });
      return cache.data;
    }
    throw failure;
  }
}

export async function getGitHubStats(): Promise<GitHubStatsData> {
  const state = sharedState();
  if (isFresh(state.cache)) {
    return state.cache.data;
  }

  // One refresh at a time: a /stats load and a request to the /api/v1 route share GitHub's answer.
  state.inFlight ??= refreshGitHubStats(state).finally(() => {
    state.inFlight = null;
  });
  return state.inFlight;
}
