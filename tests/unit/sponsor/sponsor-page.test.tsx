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
 * @file /sponsor renders on the server. The header, benefits, platforms and contact card never
 * wait on GitHub: they are in the first HTML while the sponsors block still shows its skeleton.
 * The block itself, from getGitHubSponsors, says "Be the first sponsor!" only when nobody ever
 * sponsored, and a GitHub failure, or a GitHub slower than the deadline, costs only that block,
 * which names the failure in words instead of printing the error.
 */

import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GitHubSponsorsData, Sponsor } from '@/lib/api-integrations/github-sponsors';

const { getGitHubSponsors, reportApiFailure, refresh } = vi.hoisted(() => ({
  getGitHubSponsors: vi.fn<() => Promise<GitHubSponsorsData>>(),
  reportApiFailure: vi.fn(() => true),
  refresh: vi.fn(),
}));

vi.mock('@/lib/api-integrations/github-sponsors', () => ({ getGitHubSponsors }));

vi.mock('@/lib/observability/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/observability/report')>()),
  reportApiFailure,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { SPONSORS_DEADLINE_MS, Sponsors } from '@/app/(routes)/(dev)/sponsor/_components/sponsors';
import SponsorPage from '@/app/(routes)/(dev)/sponsor/page';

const PLATFORM_NAMES = ['GitHub Sponsors', 'Open Collective', 'Ko-fi', 'Buy Me a Coffee'] as const;
const BENEFIT_TITLES = [
  'Support Open Source',
  'Fuel Development',
  'Early Access',
  'Join the Community',
] as const;
const FIRST_SPONSOR = 'Be the first sponsor!';
const ERROR_TITLE = "Couldn't load sponsors";
const REPORT_CONTEXT = 'load sponsors for page';
/** A raw upstream failure, as the old page printed it. */
const RAW_ERROR = 'HTTP 502 Bad Gateway {"message":"Server Error"}';
/** Motion's hidden entrance state serialized into server HTML (but not opacity:0.8). */
const HIDDEN_ENTRANCE = /opacity:\s*0(?![.\d])/;

const makeSponsor = (overrides: Partial<Sponsor> = {}): Sponsor => ({
  login: 'octocat',
  name: 'The Octocat',
  avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
  url: 'https://github.com/octocat',
  tier: { name: '$5 a month', monthlyPriceInDollars: 5 },
  createdAt: '2025-01-01T00:00:00Z',
  isActive: true,
  type: 'User',
  ...overrides,
});

const sponsorsData = (sponsors: Sponsor[]): GitHubSponsorsData => ({
  sponsors,
  totalCount: sponsors.length,
  totalMonthlyIncome: sponsors
    .filter((sponsor) => sponsor.isActive)
    .reduce((sum, sponsor) => sum + (sponsor.tier?.monthlyPriceInDollars ?? 0), 0),
});

/** The sponsors block, as the page's async server child renders it once its data is in. */
const renderSponsors = async (): Promise<ReturnType<typeof render>> => render(await Sponsors());

/** The whole page's first server HTML (Suspense fallbacks included), parsed so it can be queried. */
const renderPageHtml = (): HTMLElement => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(<SponsorPage />);
  return container;
};

const textsOf = (root: HTMLElement, selector: string): string[] =>
  Array.from(root.querySelectorAll(selector), (element) => element.textContent?.trim() ?? '');

const currentSponsorsSection = (): HTMLElement =>
  screen.getByRole('region', { name: 'Current Sponsors' });

beforeEach(() => {
  getGitHubSponsors.mockReset();
  reportApiFailure.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('/sponsor page', () => {
  it('renders the static sections at once while GitHub is still answering', () => {
    getGitHubSponsors.mockReturnValue(new Promise(() => {}));

    const page = renderPageHtml();

    expect(textsOf(page, 'h1')).toEqual(['Sponsor My Work']);
    expect(textsOf(page, 'h2')).toEqual(['Why Sponsor?', 'Ways to Sponsor']);
    expect(textsOf(page, 'h3')).toEqual(
      expect.arrayContaining([
        ...BENEFIT_TITLES,
        ...PLATFORM_NAMES,
        'Questions About Sponsorship?',
      ]),
    );
    // Each platform tile is a link: the page's call to action never waits on GitHub.
    expect(textsOf(page, 'a[href] h3')).toEqual([...PLATFORM_NAMES]);
    // Only the sponsors block waits, behind its skeleton.
    expect(page.querySelector('output[aria-label="Loading sponsors"]')).not.toBeNull();
    expect(page.textContent).not.toContain('Current Sponsors');
  });

  it('has no hidden entrance state in its server HTML', () => {
    getGitHubSponsors.mockReturnValue(new Promise(() => {}));

    expect(renderToString(<SponsorPage />)).not.toMatch(HIDDEN_ENTRANCE);
  });
});

describe('/sponsor sponsors block', () => {
  it('lists a past sponsor without inviting a first sponsor when nobody sponsors right now', async () => {
    const past = makeSponsor({ login: 'former', name: 'Former Friend', isActive: false });
    getGitHubSponsors.mockResolvedValue(sponsorsData([past]));

    await renderSponsors();

    expect(screen.getByRole('heading', { level: 2, name: 'Past Sponsors' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Former Friend/ })).toHaveAttribute('href', past.url);
    expect(screen.queryByText(FIRST_SPONSOR)).not.toBeInTheDocument();
    expect(within(currentSponsorsSection()).getByText(/No active sponsors/)).toBeInTheDocument();
  });

  it('invites a first sponsor when nobody has ever sponsored', async () => {
    getGitHubSponsors.mockResolvedValue(sponsorsData([]));

    await renderSponsors();

    expect(within(currentSponsorsSection()).getByText(FIRST_SPONSOR)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Past Sponsors' })).not.toBeInTheDocument();
  });

  it('lists current sponsors with their count and monthly total, skipping entries with no login', async () => {
    const current = makeSponsor();
    const ghost = makeSponsor({ login: '', name: null, url: 'https://github.com/ghost' });
    getGitHubSponsors.mockResolvedValue(sponsorsData([current, ghost]));

    await renderSponsors();

    const section = currentSponsorsSection();
    expect(within(section).getByRole('link', { name: /The Octocat/ })).toHaveAttribute(
      'href',
      current.url,
    );
    expect(within(section).getByText('1 Sponsor')).toBeInTheDocument();
    expect(within(section).getByText('$10')).toBeInTheDocument();
    expect(document.querySelector('a[href="https://github.com/ghost"]')).toBeNull();
    expect(screen.queryByText(FIRST_SPONSOR)).not.toBeInTheDocument();
  });

  it('shows a worded error with a retry when GitHub fails', async () => {
    const error = new Error(RAW_ERROR);
    getGitHubSponsors.mockRejectedValue(error);

    await renderSponsors();

    const section = currentSponsorsSection();
    expect(within(section).getByRole('heading', { name: ERROR_TITLE })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/HTTP|Bad Gateway|Server Error|[{}]/);
    expect(screen.queryByText(FIRST_SPONSOR)).not.toBeInTheDocument();
    expect(reportApiFailure).toHaveBeenCalledTimes(1);
    expect(reportApiFailure).toHaveBeenCalledWith(error, {
      context: REPORT_CONTEXT,
      level: 'error',
    });
  });

  it('gives up on a GitHub slower than the deadline, with the same contained error', async () => {
    vi.useFakeTimers();
    getGitHubSponsors.mockReturnValue(new Promise(() => {}));

    const pending = Sponsors();
    await vi.advanceTimersByTimeAsync(SPONSORS_DEADLINE_MS);
    render(await pending);

    const section = currentSponsorsSection();
    expect(within(section).getByRole('heading', { name: ERROR_TITLE })).toBeVisible();
    expect(within(section).getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(reportApiFailure).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'DeadlineError' }),
      { context: REPORT_CONTEXT, level: 'warning' },
    );
  });

  it('puts the sponsors in the server HTML, with no hidden entrance state', async () => {
    getGitHubSponsors.mockResolvedValue(
      sponsorsData([makeSponsor({ login: 'former', name: 'Former Friend', isActive: false })]),
    );

    const html = renderToString(await Sponsors());

    expect(html).toContain('Current Sponsors');
    expect(html).toContain('Former Friend');
    expect(html).not.toMatch(HIDDEN_ENTRANCE);
  });
});
