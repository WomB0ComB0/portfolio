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
 * card's real query, fetcher and schema run.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

import { GitHubStats } from '@/app/(routes)/(dev)/stats/_components/github-stats';

const GITHUB_STATS_PATH = '/api/v1/github-stats';
const QUERY_KEY = ['github-stats'];

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

const stubGitHubStats = (status: number, body: unknown) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
      if (url.pathname !== GITHUB_STATS_PATH)
        throw new Error(`unexpected request: ${url.pathname}`);
      githubCalls.push(url.pathname);
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
};

const renderCard = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
  githubCalls.length = 0;
});

describe('GitHub card', () => {
  it('puts Top Repositories as an h3 under the card h2', async () => {
    stubGitHubStats(200, githubStats);
    renderCard();

    const subheading = await screen.findByRole('heading', { level: 3, name: 'Top Repositories' });
    const cardHeading = screen.getByRole('heading', { level: 2, name: 'GitHub Stats' });
    expect(
      cardHeading.compareDocumentPosition(subheading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('says what the star count is and that repo links open a new tab', async () => {
    stubGitHubStats(200, githubStats);
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
    stubGitHubStats(200, githubStats);
    renderCard();

    const portfolio = await screen.findByRole('link', { name: /^portfolio\b/ });
    const icons = portfolio.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(within(portfolio).queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows the open-in-new-tab arrow on keyboard focus as well as hover', async () => {
    stubGitHubStats(200, githubStats);
    renderCard();

    const portfolio = await screen.findByRole('link', { name: /^portfolio\b/ });
    const arrow = portfolio.querySelector('svg.opacity-0');
    expect(arrow).toHaveClass('group-hover:opacity-100', 'group-focus-visible:opacity-100');
  });

  it('asks the API once per query attempt, leaving retries to TanStack Query', async () => {
    stubGitHubStats(500, { error: 'GitHub is down' });
    const queryClient = renderCard();

    await waitFor(() => expect(queryClient.getQueryState(QUERY_KEY)?.status).toBe('error'), {
      timeout: 5_000,
    });
    expect(githubCalls).toHaveLength(1);
  });
});
