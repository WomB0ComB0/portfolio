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
 * @file A hanging upstream must not hold a /stats handler past its card's own timeout, or the
 * stale fallback never reaches the browser. The LeetCode, GitHub and WakaTime cards give up after
 * 10 s, so those handlers answer within 8 s. The Discord card's DataLoader waits 30 s, so Lanyard
 * answers within 20 s. A deadline hit takes the same path as any other failure: the cached value
 * and a warning when there is one, an error otherwise.
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
/** Comfortably inside the 10 s the LeetCode, GitHub and WakaTime cards wait. */
const CARD_BUDGET_MS = 8_000;
/** Comfortably inside the 30 s the Discord card's DataLoader waits. */
const LANYARD_BUDGET_MS = 20_000;

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

const urlOf = (input: RequestInfo | URL) => (input instanceof Request ? input.url : String(input));

/** A request that never answers; it only ends when the fetcher aborts it. */
const hang = (_input: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
  });

/**
 * Headers arrive but the body never ends. The fetcher's per-attempt timeout stops at the headers,
 * so only the handler's overall deadline ends this one.
 */
const stallBody = async () =>
  new Response(new ReadableStream<Uint8Array>(), {
    headers: { 'content-type': 'application/json' },
  });

const leetCodeReply = {
  data: {
    matchedUser: {
      submitStatsGlobal: {
        acSubmissionNum: [{ difficulty: 'All', count: 692, submissions: 1268 }],
        totalSubmissionNum: [{ difficulty: 'All', count: 708, submissions: 1726 }],
      },
      profile: { ranking: 103_562 },
    },
  },
};

const gitHubReply = (url: string) =>
  url.includes('/repos')
    ? jsonResponse([
        {
          name: 'portfolio',
          description: null,
          stargazers_count: 7,
          language: 'TypeScript',
          fork: false,
          html_url: 'https://github.com/WomB0ComB0/portfolio',
        },
      ])
    : jsonResponse({ public_repos: 40, followers: 10, avatar_url: 'https://example.com/a.png' });

const wakaTimeReply = {
  data: { text: '1,234 hrs', digital: '1234:05', decimal: '1234.08', total_seconds: 4_442_700 },
};

const lanyardReply = {
  success: true,
  data: {
    discord_user: { username: 'tester', discriminator: '0', avatar: 'abc123', id: '42' },
    activities: [],
    discord_status: 'online',
  },
};

interface HandlerCase {
  name: string;
  load: () => Promise<() => Promise<unknown>>;
  reply: (url: string) => Response;
  /** How long after a good fetch the handler asks the upstream again. */
  refreshAfterMs: number;
  budgetMs: number;
  command: string;
  context: string;
}

const cases: HandlerCase[] = [
  {
    name: 'getLeetCodeStats',
    load: async () =>
      (await import('@/app/api/v1/[[...route]]/leetcode/handlers')).getLeetCodeStats,
    reply: () => jsonResponse(leetCodeReply),
    refreshAfterMs: 6 * HOUR,
    budgetMs: CARD_BUDGET_MS,
    command: 'leetcode:fetch',
    context: 'fetch LeetCode stats',
  },
  {
    name: 'getGitHubStats',
    load: async () =>
      (await import('@/app/api/v1/[[...route]]/github-stats/handlers')).getGitHubStats,
    reply: gitHubReply,
    refreshAfterMs: HOUR,
    budgetMs: CARD_BUDGET_MS,
    command: 'github:stats',
    context: 'fetching GitHub stats',
  },
  {
    name: 'getWakaTimeData',
    load: async () => (await import('@/app/api/v1/[[...route]]/wakatime/handlers')).getWakaTimeData,
    reply: () => jsonResponse(wakaTimeReply),
    refreshAfterMs: HOUR,
    budgetMs: CARD_BUDGET_MS,
    command: 'wakatime:fetch',
    context: 'fetching WakaTime data',
  },
  {
    name: 'getLanyardData',
    load: async () => (await import('@/app/api/v1/[[...route]]/lanyard/handlers')).getLanyardData,
    reply: () => jsonResponse(lanyardReply),
    // Past the 60 s cache, well inside the 5-minute stale bound.
    refreshAfterMs: MINUTE,
    budgetMs: LANYARD_BUDGET_MS,
    command: 'lanyard:fetch',
    context: 'fetching Lanyard data',
  },
];

/** Each handler caches in module state, so every test loads a fresh copy. */
const loadHandler = async (handlerCase: HandlerCase) => {
  vi.resetModules();
  return handlerCase.load();
};

const stubFetch = (reply: (url: string) => Response) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) =>
    reply(urlOf(input)),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** Runs fake time forward by `ms` and says whether `pending` settled by then. */
const settlesWithin = async (pending: Promise<unknown>, ms: number): Promise<boolean> => {
  let settled = false;
  pending.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await vi.advanceTimersByTimeAsync(ms);
  return settled;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(T0);
  sentry.captureException.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe.each(cases)('$name with a hanging upstream', (handlerCase) => {
  it('serves the cached value within its budget and reports a warning', async () => {
    const fetchMock = stubFetch(handlerCase.reply);
    const handler = await loadHandler(handlerCase);
    const first = await handler();

    fetchMock.mockImplementation(hang);
    vi.setSystemTime(T0 + handlerCase.refreshAfterMs + 1);
    const pending = handler();

    expect(await settlesWithin(pending, handlerCase.budgetMs)).toBe(true);
    await expect(pending).resolves.toEqual(first);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ command: handlerCase.command }),
      expect.objectContaining({ level: 'warning', tags: { 'api.context': handlerCase.context } }),
    );
  });

  it('serves the cached value within its budget when the reply body stalls', async () => {
    const fetchMock = stubFetch(handlerCase.reply);
    const handler = await loadHandler(handlerCase);
    const first = await handler();

    fetchMock.mockImplementation(stallBody);
    vi.setSystemTime(T0 + handlerCase.refreshAfterMs + 1);
    const pending = handler();

    expect(await settlesWithin(pending, handlerCase.budgetMs)).toBe(true);
    await expect(pending).resolves.toEqual(first);
    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ command: handlerCase.command }),
      expect.objectContaining({ level: 'warning' }),
    );
  });

  it('fails within its budget when nothing is cached, so the route can answer 500', async () => {
    stubFetch(handlerCase.reply).mockImplementation(hang);
    const handler = await loadHandler(handlerCase);
    const pending = handler();

    expect(await settlesWithin(pending, handlerCase.budgetMs)).toBe(true);
    await expect(pending).rejects.toMatchObject({ command: handlerCase.command });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});
