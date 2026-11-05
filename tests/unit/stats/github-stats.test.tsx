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
 * @file The /stats GitHub card. /api/v1/github-stats is answered by a stubbed fetch, so the
 * card's real query (shared with the server prefetch, in stats/_lib/stats-queries), fetcher and
 * schema run. A failed load says so in the card, with Try again, instead of leaving it out.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

// Try again also refreshes the route, which re-runs the server prefetch.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// The full '@/components' barrel initialises Firebase; StatCard only needs MagicCard.
vi.mock('@/components', async () => ({
  MagicCard: (await import('@/components/magicui')).MagicCard,
}));

import {
  GitHubStats,
  GitHubStatsSkeleton,
} from '@/app/(routes)/(dev)/stats/_components/github-stats';
import { githubStatsQuery } from '@/app/(routes)/(dev)/stats/_lib/stats-queries';

const GITHUB_STATS_PATH = '/api/v1/github-stats';
const QUERY_KEY = ['github-stats'];
const ERROR_TITLE = "Couldn't load GitHub stats";

const githubStats = {
  user: { repos: 40, followers: 12, avatar_url: 'https://avatars.githubusercontent.com/u/1' },
  stats: { totalStars: 13, topLanguages: ['TypeScript'] },
  topRepos: [
    {
      name: 'portfolio',
      description: 'Personal site',
      stars: 12,
      language: 'TypeScript',
      url: 'https://github.com/example/portfolio',
    },
    {
      name: 'dotfiles',
      description: null,
      stars: 1,
      language: null,
      url: 'https://github.com/example/dotfiles',
    },
  ],
};

const githubCalls: string[] = [];

type Reply = { status: number; body: unknown };

/** Answers /api/v1/github-stats with each reply in turn, the last one from then on. */
const stubGitHubStats = (...replies: [Reply, ...Reply[]]) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
      if (url.pathname !== GITHUB_STATS_PATH)
        throw new Error(`unexpected request: ${url.pathname}`);
      githubCalls.push(url.pathname);
      const { status, body } =
        replies[Math.min(githubCalls.length, replies.length) - 1] ?? replies[0];
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
};

const ok: Reply = { status: 200, body: githubStats };
const down: Reply = { status: 500, body: { error: 'GitHub is down' } };

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderCard = () => {
  const queryClient = newClient();
  render(
    <QueryClientProvider client={queryClient}>
      <GitHubStats />
    </QueryClientProvider>,
  );
  return queryClient;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  githubCalls.length = 0;
});

describe('GitHub card', () => {
  it('puts Top Repositories as an h3 under the card h2', async () => {
    stubGitHubStats(ok);
    renderCard();

    const subheading = await screen.findByRole('heading', { level: 3, name: 'Top Repositories' });
    const cardHeading = screen.getByRole('heading', { level: 2, name: 'GitHub Stats' });
    expect(
      cardHeading.compareDocumentPosition(subheading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('says what the star count is and that repo links open a new tab', async () => {
    stubGitHubStats(ok);
    renderCard();

    const portfolio = await screen.findByRole('link', { name: /^portfolio\b/ });
    expect(portfolio).toHaveAccessibleName(/\b12 stars\b/);
    expect(portfolio).toHaveAccessibleName(/\(opens in a new tab\)$/);
    expect(portfolio).toHaveAttribute('href', githubStats.topRepos[0]?.url);
    expect(portfolio).toHaveAttribute('target', '_blank');
    expect(portfolio).toHaveAttribute('rel', 'noopener noreferrer');

    const dotfiles = screen.getByRole('link', { name: /^dotfiles\b/ });
    expect(dotfiles).toHaveAccessibleName(/\b1 star\b/);
    expect(dotfiles).not.toHaveAccessibleName(/\b1 stars\b/);
  });

  it('keeps the decorative icons out of the link names', async () => {
    stubGitHubStats(ok);
    renderCard();

    const portfolio = await screen.findByRole('link', { name: /^portfolio\b/ });
    const icons = portfolio.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(within(portfolio).queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows the open-in-new-tab arrow on keyboard focus as well as hover', async () => {
    stubGitHubStats(ok);
    renderCard();

    const portfolio = await screen.findByRole('link', { name: /^portfolio\b/ });
    const arrow = portfolio.querySelector('svg.opacity-0');
    expect(arrow).toHaveClass('group-hover:opacity-100', 'group-focus-visible:opacity-100');
  });

  it('asks the API once per query attempt, leaving retries to TanStack Query', async () => {
    stubGitHubStats(down);
    const queryClient = renderCard();

    await waitFor(() => expect(queryClient.getQueryState(QUERY_KEY)?.status).toBe('error'), {
      timeout: 5_000,
    });
    expect(githubCalls).toHaveLength(1);
  });
});

describe('GitHub card when the load fails', () => {
  it('says it could not load the stats, without the raw error, and offers Try again', async () => {
    stubGitHubStats(down);
    renderCard();

    expect(await screen.findByRole('heading', { level: 2, name: ERROR_TITLE })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(screen.queryByText(/GitHub is down|500/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'GitHub Stats' })).not.toBeInTheDocument();
  });

  it('fetches again on Try again and then shows the stats', async () => {
    stubGitHubStats(down, ok);
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Top Repositories' }),
    ).toBeVisible();
    expect(screen.queryByRole('heading', { name: ERROR_TITLE })).not.toBeInTheDocument();
    expect(githubCalls).toHaveLength(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps showing stats it already has when a refetch fails', async () => {
    stubGitHubStats(down);
    const queryClient = newClient();
    queryClient.setQueryData(githubStatsQuery.queryKey, githubStats);
    render(
      <QueryClientProvider client={queryClient}>
        <GitHubStats />
      </QueryClientProvider>,
    );

    await queryClient.refetchQueries({ queryKey: QUERY_KEY });

    expect(queryClient.getQueryState(QUERY_KEY)?.status).toBe('error');
    expect(screen.getByRole('heading', { level: 3, name: 'Top Repositories' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: ERROR_TITLE })).not.toBeInTheDocument();
  });
});

describe('GitHub card with prefetched data', () => {
  it('renders it on the first render, from the shared query key, without fetching', () => {
    stubGitHubStats(ok);
    const queryClient = newClient();
    queryClient.setQueryData(githubStatsQuery.queryKey, githubStats);

    render(
      <QueryClientProvider client={queryClient}>
        <GitHubStats />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Top Repositories' })).toBeVisible();
    expect(githubCalls).toEqual([]);
  });

  it('server-renders the repository links visible, with no entrance that hides them', () => {
    const queryClient = newClient();
    queryClient.setQueryData(githubStatsQuery.queryKey, githubStats);

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <GitHubStats />
      </QueryClientProvider>,
    );

    const page = document.createElement('div');
    page.innerHTML = html;
    const links = Array.from(page.querySelectorAll('a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      githubStats.topRepos.map((repo) => repo.url),
    );
    for (const link of links) expect(link.getAttribute('style') ?? '').not.toMatch(/opacity:\s*0/);
  });
});

describe('GitHubStatsSkeleton', () => {
  it("has the card's frame and title, with placeholders for its numbers", () => {
    const { container } = render(<GitHubStatsSkeleton />);

    expect(screen.getByRole('heading', { level: 2, name: 'GitHub Stats' })).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
