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
 * @file The /api/v1/leetcode handler. Acceptance is accepted submissions over all submissions (it
 * used to divide solved by solved, so it always read 100%). LeetCode's reply is decoded with a
 * schema, so a malformed one is an error, and a failed refresh serves the last good stats.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock('@sentry/nextjs', () => sentry);
// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

const CACHE_DURATION = 6 * 60 * 60 * 1_000;
const T0 = new Date('2026-11-05T12:00:00Z').getTime();

/** The handler caches in module state, so each test loads a fresh copy of it. */
const loadGetLeetCodeStats = async () => {
  vi.resetModules();
  return (await import('@/app/api/v1/[[...route]]/leetcode/handlers')).getLeetCodeStats;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** LeetCode's reply for the profile, with the submission totals seen live on 2026-11-05. */
const leetCodeReply = ({ accepted = 1268, total = 1726 } = {}) => ({
  data: {
    matchedUser: {
      submitStatsGlobal: {
        acSubmissionNum: [
          { difficulty: 'All', count: 692, submissions: accepted },
          { difficulty: 'Easy', count: 215, submissions: 445 },
          { difficulty: 'Medium', count: 379, submissions: 655 },
          { difficulty: 'Hard', count: 98, submissions: 168 },
        ],
        totalSubmissionNum: [
          { difficulty: 'All', count: 708, submissions: total },
          { difficulty: 'Easy', count: 217, submissions: 579 },
          { difficulty: 'Medium', count: 387, submissions: 894 },
          { difficulty: 'Hard', count: 104, submissions: 253 },
        ],
      },
      profile: { ranking: 103_562 },
    },
  },
});

const stubFetch = (reply: () => Response) => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => reply());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  sentry.captureException.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('getLeetCodeStats', () => {
  it('computes acceptance as accepted over total submissions, not 100%', async () => {
    stubFetch(() => jsonResponse(leetCodeReply()));
    const getLeetCodeStats = await loadGetLeetCodeStats();

    await expect(getLeetCodeStats()).resolves.toEqual({
      totalSolved: 692,
      easySolved: 215,
      mediumSolved: 379,
      hardSolved: 98,
      // 1268 / 1726 = 73.4646...%
      acceptanceRate: 73.46,
      ranking: 103_562,
    });
  });

  it('asks LeetCode for the accepted and total submission counts', async () => {
    const fetchMock = stubFetch(() => jsonResponse(leetCodeReply()));
    const getLeetCodeStats = await loadGetLeetCodeStats();

    await getLeetCodeStats();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(input)).toBe('https://leetcode.com/graphql');
    const body = JSON.parse(new TextDecoder().decode(init?.body as Uint8Array)) as {
      query: string;
      variables: Record<string, unknown>;
    };
    expect(body.variables).toEqual({ username: 'WomB0ComB0' });
    expect(body.query).toMatch(/acSubmissionNum\s*{[^}]*\bsubmissions\b/);
    expect(body.query).toMatch(/totalSubmissionNum\s*{[^}]*\bsubmissions\b/);
  });

  it('reports 0% acceptance when there are no submissions', async () => {
    stubFetch(() => jsonResponse(leetCodeReply({ accepted: 0, total: 0 })));
    const getLeetCodeStats = await loadGetLeetCodeStats();

    expect((await getLeetCodeStats()).acceptanceRate).toBe(0);
  });

  it('rejects a malformed reply when nothing is cached', async () => {
    const reply = leetCodeReply();
    const [all, ...rest] = reply.data.matchedUser.submitStatsGlobal.acSubmissionNum;
    // Counts as strings: the old untyped access passed these straight through.
    const malformed = {
      data: {
        matchedUser: {
          ...reply.data.matchedUser,
          submitStatsGlobal: {
            ...reply.data.matchedUser.submitStatsGlobal,
            acSubmissionNum: [{ ...all, count: '692' }, ...rest],
          },
        },
      },
    };
    stubFetch(() => jsonResponse(malformed));
    const getLeetCodeStats = await loadGetLeetCodeStats();

    await expect(getLeetCodeStats()).rejects.toMatchObject({ command: 'leetcode:fetch' });
  });

  it('rejects when LeetCode has no such user', async () => {
    stubFetch(() =>
      jsonResponse({
        errors: [{ message: 'That user does not exist.' }],
        data: { matchedUser: null },
      }),
    );
    const getLeetCodeStats = await loadGetLeetCodeStats();

    await expect(getLeetCodeStats()).rejects.toMatchObject({ command: 'leetcode:fetch' });
  });

  it('serves cached stats for 6 hours without asking LeetCode again', async () => {
    const fetchMock = stubFetch(() => jsonResponse(leetCodeReply()));
    const getLeetCodeStats = await loadGetLeetCodeStats();

    const first = await getLeetCodeStats();
    vi.setSystemTime(T0 + CACHE_DURATION - 1);

    await expect(getLeetCodeStats()).resolves.toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves the last good stats when a refresh fails, and reports a warning', async () => {
    const fetchMock = stubFetch(() => jsonResponse(leetCodeReply()));
    const getLeetCodeStats = await loadGetLeetCodeStats();
    const first = await getLeetCodeStats();

    fetchMock.mockImplementation(async () => jsonResponse({ error: 'Forbidden' }, 403));
    vi.setSystemTime(T0 + CACHE_DURATION + 1);

    await expect(getLeetCodeStats()).resolves.toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'leetcode:fetch' }),
      expect.objectContaining({
        level: 'warning',
        tags: { 'api.context': 'fetch LeetCode stats' },
      }),
    );
  });
});
