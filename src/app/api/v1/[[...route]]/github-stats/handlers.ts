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
 * Fetches combined GitHub statistics from:
 * - Personal repositories (WomB0ComB0) - includes private repos if GITHUB_TOKEN is set
 * - Organization repositories (ElysiumOSS) - public repos
 *
 * Authentication:
 * Set the GITHUB_TOKEN environment variable to include private repositories.
 * Without authentication, only public repositories will be counted.
 *
 * To create a GitHub token:
 * 1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
 * 2. Generate new token with 'repo' scope (for private repo access)
 * 3. Add to .env.local: GITHUB_TOKEN=your_token_here
 */

import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { ensureBaseError } from '@/classes/error';
import env from '@/env';
import { processGlobal, resetProcessGlobal } from '@/lib/cache/process-global';
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
  description: Schema.Union(Schema.String, Schema.Null),
  stargazers_count: Schema.Number,
  language: Schema.Union(Schema.String, Schema.Null),
  fork: Schema.Boolean,
  html_url: Schema.String,
});

const GitHubReposArraySchema = Schema.Array(GitHubRepoSchema);

const TopRepoSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.Union(Schema.String, Schema.Null),
  stars: Schema.Number,
  language: Schema.Union(Schema.String, Schema.Null),
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
export type GitHubRepo = Schema.Schema.Type<typeof GitHubRepoSchema>;
type GitHubUser = Schema.Schema.Type<typeof GitHubUserSchema>;

const CACHE_DURATION = 60 * 60 * 1_000; // 1 hour

interface CachedStats {
  readonly data: GitHubStatsData;
  readonly timestamp: number;
}

/**
 * What getGitHubStats keeps between calls. Next bundles this module once for the /stats page
 * (whose prefetch calls getGitHubStats directly) and once for /api/v1, so module state would give
 * each its own cache. Kept in processGlobal instead, a prefetch that misses its deadline still
 * fills the cache the card's fallback request to /api/v1/github-stats reads, or that request joins
 * the load still running, rather than asking GitHub a second time.
 */
interface GitHubStatsState {
  /** The last good stats and when they were fetched. */
  cache: CachedStats | null;
  /** The refresh running now; every caller that finds the cache expired joins it. */
  inFlight: Promise<GitHubStatsData> | null;
}

const STATE_NAME = 'github-stats.cache';

/** Looked up on every call, so a reset in a test takes effect without reloading this module. */
const sharedState = (): GitHubStatsState =>
  processGlobal<GitHubStatsState>(STATE_NAME, () => ({ cache: null, inFlight: null }));

/** Forgets the cached stats and any running refresh. Tests only. */
export function resetGitHubStatsCache(): void {
  resetProcessGlobal(STATE_NAME);
}

const isFresh = (cache: CachedStats | null): cache is CachedStats =>
  cache !== null && Date.now() - cache.timestamp < CACHE_DURATION;

/**
 * Upstream time budget. The GitHub card's fetch gives up after 10 s, so the stale fallback (or the
 * 500) has to be ready well before that: one retry of a 3.5 s attempt fits in the deadline.
 */
const ATTEMPT_TIMEOUT_MS = 3_500;
const RETRY_DELAY_MS = 500;
/** Caps the three parallel calls together, retries and body reads included. */
const UPSTREAM_DEADLINE_MS = 8_000;

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
 * The profile, personal repos and org repos, fetched in parallel. The first failure, or the
 * deadline, interrupts the other calls and fails the whole effect.
 */
function fetchGitHubSources() {
  const options = {
    retries: 1,
    retryDelay: RETRY_DELAY_MS,
    timeout: ATTEMPT_TIMEOUT_MS,
    headers: gitHubHeaders(),
  };
  const personalReposUrl = env.GITHUB_TOKEN
    ? 'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner'
    : 'https://api.github.com/users/WomB0ComB0/repos?per_page=100&sort=updated';

  return pipe(
    Effect.all(
      [
        get('https://api.github.com/users/WomB0ComB0', { ...options, schema: GitHubUserSchema }),
        get(personalReposUrl, { ...options, schema: GitHubReposArraySchema }),
        get('https://api.github.com/orgs/ElysiumOSS/repos?per_page=100&sort=updated', {
          ...options,
          schema: GitHubReposArraySchema,
        }),
      ],
      { concurrency: 'unbounded' },
    ),
    Effect.timeoutFail({
      duration: UPSTREAM_DEADLINE_MS,
      onTimeout: () =>
        new FetcherError(
          `GitHub did not answer within ${UPSTREAM_DEADLINE_MS} ms`,
          'https://api.github.com',
        ),
    }),
    Effect.provide(FetchHttpClient.layer),
  );
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

  // Get unique languages from all repos
  const languages = new Set(
    allRepos.map((repo) => repo.language).filter((lang): lang is string => lang !== null),
  );

  return {
    user: {
      repos: me.public_repos + orgRepos.length, // Include org repos in count
      followers: me.followers,
      avatar_url: me.avatar_url,
    },
    stats: {
      totalStars,
      topLanguages: Array.from(languages).slice(0, 5),
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

  // One refresh at a time: a late prefetch and the card's own request share GitHub's answer.
  state.inFlight ??= refreshGitHubStats(state).finally(() => {
    state.inFlight = null;
  });
  return state.inFlight;
}
