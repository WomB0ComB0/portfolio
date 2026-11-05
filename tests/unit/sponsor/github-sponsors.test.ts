// @vitest-environment node
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
 * @file getGitHubSponsors against a stubbed GitHub GraphQL endpoint, through the real fetcher and
 * schema. A sponsorship whose account GitHub won't show (`sponsorEntity: null`) is left out
 * instead of failing the whole list. The one-hour cache lives once per process: a second copy of
 * the module (Next bundles the page and the API route separately) answers from it, callers share a
 * fetch in flight, and a fetch that outlives its caller's deadline still fills the cache. An
 * expired list is served at once while it refreshes and kept when the refresh fails.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// t3-env validates every variable on import. The token is a placeholder: GitHub is stubbed.
vi.mock('@/env', () => {
  const env = { GITHUB_TOKEN: 'test-token', NODE_ENV: 'test' };
  return { env, default: env };
});

// Records reports instead of sending them; the module reports a failed GitHub load itself.
const report = vi.hoisted(() => ({ reportApiFailure: vi.fn() }));
vi.mock('@/lib/observability/report', () => report);

import {
  getGitHubSponsors,
  resetGitHubSponsorsCache,
} from '@/lib/api-integrations/github-sponsors';
import { DeadlineError, withDeadline } from '@/lib/async/deadline';

interface SponsorshipNodeFixture {
  sponsorEntity: Record<string, string> | null;
  tier: { name: string; monthlyPriceInDollars: number; monthlyPriceInCents: number } | null;
  createdAt: string;
  isActive: boolean;
  privacyLevel: string;
}

const sponsorshipNode = (
  login: string,
  overrides: Partial<SponsorshipNodeFixture> = {},
): SponsorshipNodeFixture => ({
  sponsorEntity: {
    __typename: 'User',
    login,
    name: `Name of ${login}`,
    avatarUrl: `https://avatars.githubusercontent.com/${login}`,
    url: `https://github.com/${login}`,
  },
  tier: { name: '$5 a month', monthlyPriceInDollars: 5, monthlyPriceInCents: 500 },
  createdAt: '2025-01-01T00:00:00Z',
  isActive: true,
  privacyLevel: 'PUBLIC',
  ...overrides,
});

/** A GraphQL answer holding one (last) page of sponsorships. */
const sponsorshipsPage = (nodes: readonly SponsorshipNodeFixture[]) => ({
  data: {
    user: {
      sponsorshipsAsMaintainer: {
        totalCount: nodes.length,
        nodes,
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  },
});

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

/** GitHub answers every request with `body`. */
const stubGitHub = (body: unknown) => {
  const fetchMock = vi.fn(async () => jsonResponse(body));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** GitHub holds every request until `answer` is called. */
const stubSlowGitHub = () => {
  const waiting: Array<(response: Response) => void> = [];
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        waiting.push(resolve);
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const answer = (body: unknown): void => {
    for (const resolve of waiting.splice(0)) resolve(jsonResponse(body));
  };
  return { fetchMock, answer };
};

const loginsOf = (data: Awaited<ReturnType<typeof getGitHubSponsors>>): string[] =>
  data.sponsors.map((sponsor) => sponsor.login);

beforeEach(() => {
  resetGitHubSponsorsCache();
  report.reportApiFailure.mockClear();
  // The integration logs every fetch; keep the test output to the assertions.
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  resetGitHubSponsorsCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getGitHubSponsors decoding', () => {
  it('leaves out a sponsorship whose account GitHub will not show, and lists the rest', async () => {
    stubGitHub(
      sponsorshipsPage([
        sponsorshipNode('octocat'),
        sponsorshipNode('deleted-account', { sponsorEntity: null }),
        sponsorshipNode('former', { isActive: false, tier: null }),
      ]),
    );

    const data = await getGitHubSponsors();

    expect(loginsOf(data)).toEqual(['octocat', 'former']);
    // The hidden sponsorship's tier is not counted towards the visible monthly total.
    expect(data.totalMonthlyIncome).toBe(5);
  });

  it('leaves out an account of a type the query does not cover, which arrives without a login', async () => {
    stubGitHub(
      sponsorshipsPage([
        sponsorshipNode('octocat'),
        sponsorshipNode('unknown', { sponsorEntity: { __typename: 'Enterprise' } }),
      ]),
    );

    const data = await getGitHubSponsors();

    expect(loginsOf(data)).toEqual(['octocat']);
  });
});

describe('getGitHubSponsors cache', () => {
  it('answers a second copy of the module from the same cache, without calling GitHub again', async () => {
    const fetchMock = stubGitHub(sponsorshipsPage([sponsorshipNode('octocat')]));
    await getGitHubSponsors();

    // A fresh module instance, as Next loads one for pages and another for route handlers.
    vi.resetModules();
    const otherCopy = await import('@/lib/api-integrations/github-sponsors');
    expect(otherCopy.getGitHubSponsors).not.toBe(getGitHubSponsors);

    expect(loginsOf(await otherCopy.getGitHubSponsors())).toEqual(['octocat']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares one GitHub call between callers that arrive while it is in flight', async () => {
    const { fetchMock, answer } = stubSlowGitHub();

    const first = getGitHubSponsors();
    const second = getGitHubSponsors();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    answer(sponsorshipsPage([sponsorshipNode('octocat')]));

    expect(loginsOf(await first)).toEqual(['octocat']);
    expect(await second).toBe(await first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches an answer that arrives after the caller stopped waiting', async () => {
    const { fetchMock, answer } = stubSlowGitHub();

    await expect(withDeadline(getGitHubSponsors(), 10, 'github sponsors')).rejects.toBeInstanceOf(
      DeadlineError,
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    answer(sponsorshipsPage([sponsorshipNode('octocat')]));

    expect(loginsOf(await getGitHubSponsors())).toEqual(['octocat']);
    expect(loginsOf(await getGitHubSponsors())).toEqual(['octocat']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/** An answer the schema rejects at once (no retry), standing in for a GitHub failure. */
const BROKEN_ANSWER = { data: { user: { sponsorshipsAsMaintainer: { totalCount: 'many' } } } };

/** Moves `Date.now()` past the one-hour cache lifetime. */
const expireCache = (): void => {
  const later = Date.now() + 61 * 60 * 1_000;
  vi.spyOn(Date, 'now').mockReturnValue(later);
};

describe('getGitHubSponsors after the cache expires', () => {
  it('serves the expired list at once while it refreshes, then the fresh one', async () => {
    stubGitHub(sponsorshipsPage([sponsorshipNode('old-sponsor')]));
    await getGitHubSponsors();
    expireCache();
    const { fetchMock, answer } = stubSlowGitHub();

    // GitHub hasn't answered, yet the caller (and the page's 3 s deadline) gets the list at once.
    expect(loginsOf(await getGitHubSponsors())).toEqual(['old-sponsor']);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    answer(sponsorshipsPage([sponsorshipNode('new-sponsor')]));

    await vi.waitFor(async () =>
      expect(loginsOf(await getGitHubSponsors())).toEqual(['new-sponsor']),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the expired list when the refresh fails, reported as a warning', async () => {
    stubGitHub(sponsorshipsPage([sponsorshipNode('old-sponsor')]));
    await getGitHubSponsors();
    expireCache();
    stubGitHub(BROKEN_ANSWER);

    expect(loginsOf(await getGitHubSponsors())).toEqual(['old-sponsor']);
    await vi.waitFor(() =>
      expect(report.reportApiFailure).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ level: 'warning' }),
      ),
    );
    expect(loginsOf(await getGitHubSponsors())).toEqual(['old-sponsor']);
  });

  it('rejects, and reports one error, when GitHub fails with nothing cached', async () => {
    stubGitHub(BROKEN_ANSWER);

    const failure = await getGitHubSponsors().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(report.reportApiFailure).toHaveBeenCalledTimes(1);
    expect(report.reportApiFailure).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ level: 'error' }),
    );
  });
});

describe('resetGitHubSponsorsCache', () => {
  it('keeps a load that outlives the reset out of the new cache', async () => {
    const slow = stubSlowGitHub();
    const beforeReset = getGitHubSponsors();
    await vi.waitFor(() => expect(slow.fetchMock).toHaveBeenCalled());

    resetGitHubSponsorsCache();
    slow.answer(sponsorshipsPage([sponsorshipNode('from-before-reset')]));
    await beforeReset;

    const fetchMock = stubGitHub(sponsorshipsPage([sponsorshipNode('after-reset')]));
    expect(loginsOf(await getGitHubSponsors())).toEqual(['after-reset']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
