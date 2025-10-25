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

import { ensureBaseError } from '@/classes/error';
import env from '@/env';
import { get } from '@/lib/http-clients/effect-fetcher';
import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';

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
});

const GitHubStatsDataSchema = Schema.Struct({
  user: Schema.Struct({
    repos: Schema.Number,
    followers: Schema.Number,
    avatar_url: Schema.String,
  }),
  stats: Schema.Struct({
    totalStars: Schema.Number,
    topLanguages: Schema.Array(Schema.String),
  }),
  topRepos: Schema.Array(TopRepoSchema),
});

export type GitHubStatsData = Schema.Schema.Type<typeof GitHubStatsDataSchema>;
export type TopRepo = Schema.Schema.Type<typeof TopRepoSchema>;
export type GitHubRepo = Schema.Schema.Type<typeof GitHubRepoSchema>;

const CACHE_DURATION = 60 * 60 * 1_000; // 1 hour
let cache: { data: GitHubStatsData; timestamp: number } | null = null;

export async function getGitHubStats(): Promise<GitHubStatsData> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Portfolio-Dashboard',
  };

  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  const userEffect = pipe(
    get('https://api.github.com/users/WomB0ComB0', {
      schema: GitHubUserSchema,
      retries: 2,
      timeout: 10_000,
      headers,
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  const personalReposUrl = env.GITHUB_TOKEN
    ? 'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner'
    : 'https://api.github.com/users/WomB0ComB0/repos?per_page=100&sort=updated';

  const personalReposEffect = pipe(
    get(personalReposUrl, {
      schema: GitHubReposArraySchema,
      retries: 2,
      timeout: 10_000,
      headers,
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  const orgReposEffect = pipe(
    get('https://api.github.com/orgs/ElysiumOSS/repos?per_page=100&sort=updated', {
      schema: GitHubReposArraySchema,
      retries: 2,
      timeout: 10_000,
      headers,
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  try {
    const [meJson, personalReposJson, orgReposJson] = await Promise.all([
      Effect.runPromise(userEffect),
      Effect.runPromise(personalReposEffect),
      Effect.runPromise(orgReposEffect),
    ]);

    // Combine personal and organization repos
    const allRepos = [...personalReposJson, ...orgReposJson];

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

    const data: GitHubStatsData = {
      user: {
        repos: meJson.public_repos + orgReposJson.length, // Include org repos in count
        followers: meJson.followers,
        avatar_url: meJson.avatar_url,
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

    cache = { data, timestamp: Date.now() };

    return data;
  } catch (error) {
    throw ensureBaseError(error, 'github:stats', {
      username: 'WomB0ComB0',
      organization: 'ElysiumOSS',
      cacheExpired: !cache || Date.now() - cache.timestamp >= CACHE_DURATION,
    });
  }
}
