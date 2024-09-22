import { NextResponse } from 'next/server';
import superjson from 'superjson';
import { z } from 'zod';

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
let cache: { data: any; timestamp: number } | null = null;

const RepoSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  stargazers_count: z.number(),
  language: z.string().nullable(),
  fork: z.boolean(),
  html_url: z.string(),
});

const UserSchema = z.object({
  public_repos: z.number(),
  followers: z.number(),
  avatar_url: z.string(),
});

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(superjson.stringify(cache.data), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [meResponse, reposResponse] = await Promise.all([
      fetch('https://api.github.com/users/WomB0ComB0'),
      fetch('https://api.github.com/users/WomB0ComB0/repos?per_page=100&sort=updated'),
    ]);

    if (!meResponse.ok || !reposResponse.ok) {
      throw new Error(
        `GitHub API responded with status ${meResponse.status} or ${reposResponse.status}`,
      );
    }

    const meJson = UserSchema.parse(await meResponse.json());
    const reposJson = z.array(RepoSchema).parse(await reposResponse.json());

    const topRepos = reposJson
      .filter((repo) => !repo.fork)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 5);

    const totalStars = reposJson.reduce((acc, curr) => acc + curr.stargazers_count, 0);
    const languages = new Set(reposJson.map((repo) => repo.language).filter(Boolean));

    const data = {
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

    return NextResponse.json(superjson.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
      },
    });
  } catch (error) {
    console.error('Error fetching GitHub stats:', error);
    return NextResponse.json(
      superjson.stringify({
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
