import axios from 'axios';

interface GitHubUser {
  public_repos: number;
  followers: number;
  avatar_url: string;
}

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

const CACHE_DURATION = 60 * 60 * 1_000; // 1 hour
let cache: { data: GitHubStatsData; timestamp: number } | null = null;

export async function getGitHubStats(): Promise<GitHubStatsData> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const [meResponse, reposResponse] = await Promise.all([
    axios.get('https://api.github.com/users/WomB0ComB0'),
    axios.get('https://api.github.com/users/WomB0ComB0/repos?per_page=100&sort=updated'),
  ]);

  if (meResponse.status !== 200 || reposResponse.status !== 200) {
    throw new Error(
      `GitHub API responded with status ${meResponse.status} or ${reposResponse.status}`,
    );
  }

  const meJson: GitHubUser = meResponse.data;
  const reposJson: GitHubRepo[] = reposResponse.data;

  const topRepos = reposJson
    .filter((repo) => !repo.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 5);

  const totalStars = reposJson.reduce((acc, curr) => acc + curr.stargazers_count, 0);
  const languages = new Set(
    reposJson.map((repo) => repo.language).filter((lang): lang is string => lang !== null),
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
}
