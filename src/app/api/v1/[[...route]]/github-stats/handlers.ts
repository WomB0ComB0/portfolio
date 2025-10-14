import { Effect, pipe, Schema } from 'effect';
import { FetchHttpClient } from '@effect/platform';
import { get } from '@/lib/http-clients/effect-fetcher';

interface GitHubRepo {
  name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  fork: boolean;
  html_url: string;
}

interface TopRepo {
  name: string;
  description: string | null;
  stars: number;
  language: string | null;
  url: string;
}

interface GitHubStatsData {
  user: {
    repos: number;
    followers: number;
    avatar_url: string;
  };
  stats: {
    totalStars: number;
    topLanguages: string[];
  };
  topRepos: TopRepo[];
}

// Schemas for GitHub API responses
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

const CACHE_DURATION = 60 * 60 * 1_000; // 1 hour
let cache: { data: GitHubStatsData; timestamp: number } | null = null;

export async function getGitHubStats(): Promise<GitHubStatsData> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const userEffect = pipe(
    get('https://api.github.com/users/WomB0ComB0', {
      schema: GitHubUserSchema,
      retries: 2,
      timeout: 10_000,
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  const reposEffect = pipe(
    get('https://api.github.com/users/WomB0ComB0/repos?per_page=100&sort=updated', {
      schema: GitHubReposArraySchema,
      retries: 2,
      timeout: 10_000,
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  try {
    const [meJson, reposJson] = await Promise.all([
      Effect.runPromise(userEffect),
      Effect.runPromise(reposEffect),
    ]);

    const topRepos = (reposJson as any as GitHubRepo[])
      .filter((repo) => !repo.fork)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 5);

    const totalStars = (reposJson as any as GitHubRepo[]).reduce(
      (acc, curr) => acc + curr.stargazers_count,
      0,
    );
    const languages = new Set(
      (reposJson as any as GitHubRepo[])
        .map((repo) => repo.language)
        .filter((lang): lang is string => lang !== null),
    );

    const data: GitHubStatsData = {
      user: {
        repos: meJson.public_repos,
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
    console.error('Error fetching GitHub stats:', error);
    throw error;
  }
}
