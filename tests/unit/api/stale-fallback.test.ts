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
 * @file When an upstream fails after its in-memory cache expired, the /stats handlers answer with
 * the last good value (and report a warning) instead of a 500. GitHub and WakaTime numbers change
 * slowly, so any cached value will do. Discord presence goes stale fast, so Lanyard's fallback
 * only lasts 5 minutes. With nothing cached, a failure still throws.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock('@sentry/nextjs', () => sentry);
// t3-env validates on import. WakaTime needs a token shaped like an OAuth token (not a real one).
vi.mock('@/env', () => {
  const values: Record<string, string> = {
    NODE_ENV: 'test',
    WAKA_TIME_API_KEY: 'waka_tok_example',
  };
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (typeof key === 'string' ? values[key] : undefined),
  });
  return { env, default: env };
});

const T0 = new Date('2026-11-05T12:00:00Z').getTime();
const MINUTE = 60 * 1_000;
const HOUR = 60 * MINUTE;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** A 4xx, which the fetcher does not retry, so a failing refresh answers at once. */
const upstreamDown = () => jsonResponse({ message: 'Forbidden' }, 403);

const urlOf = (input: RequestInfo | URL) => (input instanceof Request ? input.url : String(input));

/** Answers every request with `reply(url)` until the test swaps the implementation. */
const stubFetch = (reply: (url: string) => Response) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => reply(urlOf(input)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/**
 * Every test loads fresh copies (Lanyard caches in module state, and the report cooldowns reset
 * too). The GitHub and WakaTime caches live on globalThis, so a fresh import alone no longer
 * empties them; their resets do.
 */
const loadHandlers = async () => {
  vi.resetModules();
  const [github, wakatime, lanyard] = await Promise.all([
    import('@/app/api/v1/[[...route]]/github-stats/handlers'),
    import('@/app/api/v1/[[...route]]/wakatime/handlers'),
    import('@/app/api/v1/[[...route]]/lanyard/handlers'),
  ]);
  github.resetGitHubStatsCache();
  wakatime.resetWakaTimeCache();
  return {
    getGitHubStats: github.getGitHubStats,
    getWakaTimeData: wakatime.getWakaTimeData,
    getLanyardData: lanyard.getLanyardData,
  };
};

const expectWarning = (command: string, context: string) => {
  expect(sentry.captureException).toHaveBeenCalledTimes(1);
  expect(sentry.captureException).toHaveBeenCalledWith(
    expect.objectContaining({ command }),
    expect.objectContaining({ level: 'warning', tags: { 'api.context': context } }),
  );
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

describe('getGitHubStats', () => {
  const repo = {
    name: 'portfolio',
    description: null,
    stargazers_count: 7,
    language: 'TypeScript',
    fork: false,
    html_url: 'https://github.com/WomB0ComB0/portfolio',
  };
  const github = (url: string) =>
    url.includes('/repos')
      ? jsonResponse([repo])
      : jsonResponse({ public_repos: 40, followers: 10, avatar_url: 'https://example.com/a.png' });

  it('serves the last good stats when GitHub fails after the hour is up', async () => {
    const fetchMock = stubFetch(github);
    const { getGitHubStats } = await loadHandlers();
    const first = await getGitHubStats();
    expect(first.stats.totalStars).toBe(14);

    fetchMock.mockImplementation(async () => upstreamDown());
    vi.setSystemTime(T0 + HOUR + 1);

    await expect(getGitHubStats()).resolves.toEqual(first);
    expectWarning('github:stats', 'fetching GitHub stats');
  });

  it('throws when GitHub fails and nothing is cached', async () => {
    stubFetch(upstreamDown);
    const { getGitHubStats } = await loadHandlers();

    await expect(getGitHubStats()).rejects.toMatchObject({ command: 'github:stats' });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('getWakaTimeData', () => {
  const wakatime = {
    text: '1,234 hrs 5 mins',
    digital: '1234:05',
    decimal: '1234.08',
    total_seconds: 4_442_700,
  };

  it('serves the last good totals when WakaTime fails after the hour is up', async () => {
    const fetchMock = stubFetch(() => jsonResponse({ data: wakatime }));
    const { getWakaTimeData } = await loadHandlers();
    await expect(getWakaTimeData()).resolves.toEqual(wakatime);

    fetchMock.mockImplementation(async () => upstreamDown());
    vi.setSystemTime(T0 + HOUR + 1);

    await expect(getWakaTimeData()).resolves.toEqual(wakatime);
    expectWarning('wakatime:fetch', 'fetching WakaTime data');
  });

  it('throws when WakaTime fails and nothing is cached', async () => {
    stubFetch(upstreamDown);
    const { getWakaTimeData } = await loadHandlers();

    await expect(getWakaTimeData()).rejects.toMatchObject({ command: 'wakatime:fetch' });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('getLanyardData', () => {
  const presence = {
    discord_user: { username: 'tester', discriminator: '0', avatar: 'abc123', id: '42' },
    activities: [{ name: 'Visual Studio Code', type: 0, details: 'Editing stats.tsx' }],
    discord_status: 'online',
  };
  const loadAfterGoodFetch = async () => {
    const fetchMock = stubFetch(() => jsonResponse({ success: true, data: presence }));
    const { getLanyardData } = await loadHandlers();
    await expect(getLanyardData()).resolves.toEqual(presence);
    fetchMock.mockImplementation(async () => upstreamDown());
    return getLanyardData;
  };

  it('serves presence up to 5 minutes old when Lanyard fails', async () => {
    const getLanyardData = await loadAfterGoodFetch();

    vi.setSystemTime(T0 + 2 * MINUTE);
    await expect(getLanyardData()).resolves.toEqual(presence);
    vi.setSystemTime(T0 + 5 * MINUTE - 1);
    await expect(getLanyardData()).resolves.toEqual(presence);
    expectWarning('lanyard:fetch', 'fetching Lanyard data');
  });

  it('throws once the cached presence is 5 minutes old', async () => {
    const getLanyardData = await loadAfterGoodFetch();

    vi.setSystemTime(T0 + 5 * MINUTE);

    await expect(getLanyardData()).rejects.toMatchObject({ command: 'lanyard:fetch' });
  });

  it('throws when Lanyard fails and nothing is cached', async () => {
    stubFetch(upstreamDown);
    const { getLanyardData } = await loadHandlers();

    await expect(getLanyardData()).rejects.toMatchObject({ command: 'lanyard:fetch' });
  });
});
