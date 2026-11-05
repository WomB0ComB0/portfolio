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
 * @file Next bundles each /stats handler twice in one server process: once for the page, whose
 * prefetch calls it directly, and once for /api/v1, which the card falls back to in the browser.
 * The handlers keep their cache and running load in processGlobal, so both copies share them. A
 * copy loaded after vi.resetModules() stands in for the second bundle: it serves what the first
 * copy cached and joins a load the first copy still has running, so the upstream is asked once.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeadlineError, withDeadline } from '@/lib/async/deadline';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
const analytics = vi.hoisted(() => ({ getAnalytics: vi.fn() }));

vi.mock('@sentry/nextjs', () => sentry);
// The Google handler's only import from the lib barrel; the real one needs GA credentials.
vi.mock('@/lib', () => analytics);
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
// Keeps the Google handler's progress logs out of the test output.
vi.mock('@/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils')>()),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

const urlOf = (input: RequestInfo | URL) => (input instanceof Request ? input.url : String(input));

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

const leetCodeReply = () =>
  jsonResponse({
    data: {
      matchedUser: {
        submitStatsGlobal: {
          acSubmissionNum: [{ difficulty: 'All', count: 692, submissions: 1268 }],
          totalSubmissionNum: [{ difficulty: 'All', count: 708, submissions: 1726 }],
        },
        profile: { ranking: 103_562 },
      },
    },
  });

const wakaTimeReply = () =>
  jsonResponse({
    data: { text: '1,234 hrs', digital: '1234:05', decimal: '1234.08', total_seconds: 4_442_700 },
  });

/** One copy of a handler module, as one of Next's bundles holds it. */
interface HandlerCopy {
  handler: () => Promise<unknown>;
  reset: () => void;
}

interface HandlerCase {
  name: string;
  loadCopy: () => Promise<HandlerCopy>;
  /**
   * Answers the upstream once `released` settles, and returns how many times the handler has
   * loaded from it so far.
   */
  stubUpstream: (released: Promise<void>) => () => number;
}

/** Stubs fetch with `reply`, held until `released`; `callsPerLoad` fetches make one load. */
const stubFetchUpstream =
  (reply: (url: string) => Response, callsPerLoad: number) => (released: Promise<void>) => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      await released;
      return reply(urlOf(input));
    });
    vi.stubGlobal('fetch', fetchMock);
    return () => fetchMock.mock.calls.length / callsPerLoad;
  };

const cases: HandlerCase[] = [
  {
    name: 'getGitHubStats',
    loadCopy: async () => {
      const copy = await import('@/app/api/v1/[[...route]]/github-stats/handlers');
      return { handler: copy.getGitHubStats, reset: copy.resetGitHubStatsCache };
    },
    // The profile, personal repos and org repos.
    stubUpstream: stubFetchUpstream(gitHubReply, 3),
  },
  {
    name: 'getLeetCodeStats',
    loadCopy: async () => {
      const copy = await import('@/app/api/v1/[[...route]]/leetcode/handlers');
      return { handler: copy.getLeetCodeStats, reset: copy.resetLeetCodeCache };
    },
    stubUpstream: stubFetchUpstream(leetCodeReply, 1),
  },
  {
    name: 'getWakaTimeData',
    loadCopy: async () => {
      const copy = await import('@/app/api/v1/[[...route]]/wakatime/handlers');
      return { handler: copy.getWakaTimeData, reset: copy.resetWakaTimeCache };
    },
    stubUpstream: stubFetchUpstream(wakaTimeReply, 1),
  },
  {
    name: 'getGoogleAnalytics',
    loadCopy: async () => {
      const copy = await import('@/app/api/v1/[[...route]]/google/handlers');
      return { handler: copy.getGoogleAnalytics, reset: copy.resetGoogleAnalyticsCache };
    },
    stubUpstream: (released) => {
      analytics.getAnalytics.mockImplementation(async () => {
        await released;
        return { analytics: { total_pageviews: 4_321 }, response: {} };
      });
      return () => analytics.getAnalytics.mock.calls.length;
    },
  },
];

/** A promise the test settles by hand, to hold the upstream while a second caller arrives. */
const gate = () => {
  let open: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { released, open };
};

/** Loads the copy a second bundle would hold: same file, separate module instance. */
const loadSecondCopy = async (handlerCase: HandlerCase): Promise<HandlerCopy> => {
  vi.resetModules();
  return handlerCase.loadCopy();
};

/** The first copy, with the process-wide cache emptied so every test starts cold. */
const loadColdCopy = async (handlerCase: HandlerCase): Promise<HandlerCopy> => {
  const copy = await handlerCase.loadCopy();
  copy.reset();
  return copy;
};

beforeEach(() => {
  vi.resetModules();
  sentry.captureException.mockClear();
  analytics.getAnalytics.mockReset();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  for (const handlerCase of cases) (await handlerCase.loadCopy()).reset();
});

describe.each(cases)('$name shared by every bundled copy', (handlerCase) => {
  it("serves the first copy's cached value from a second copy without asking again", async () => {
    const loads = handlerCase.stubUpstream(Promise.resolve());
    const first = await loadColdCopy(handlerCase);
    const value = await first.handler();

    const second = await loadSecondCopy(handlerCase);

    expect(second.handler).not.toBe(first.handler);
    await expect(second.handler()).resolves.toEqual(value);
    expect(loads()).toBe(1);
  });

  it('lets a second copy join the load the first copy still has running', async () => {
    const { released, open } = gate();
    const loads = handlerCase.stubUpstream(released);
    const first = await loadColdCopy(handlerCase);
    const fromPage = first.handler();

    const second = await loadSecondCopy(handlerCase);
    const fromApi = second.handler();
    open();

    const [pageValue, apiValue] = await Promise.all([fromPage, fromApi]);
    expect(apiValue).toEqual(pageValue);
    expect(loads()).toBe(1);
  });

  it("fills the cache the API copy reads when the page's prefetch gave up waiting", async () => {
    const { released, open } = gate();
    const loads = handlerCase.stubUpstream(released);
    const page = await loadColdCopy(handlerCase);
    const pending = page.handler();

    // The prefetch's deadline passes; the load keeps running, as withDeadline documents.
    await expect(withDeadline(pending, 1, 'prefetch:test')).rejects.toBeInstanceOf(DeadlineError);
    open();
    const late = await pending;

    const api = await loadSecondCopy(handlerCase);
    await expect(api.handler()).resolves.toEqual(late);
    expect(loads()).toBe(1);
  });
});

describe('getGoogleAnalytics with a stalled report', () => {
  it('gives up after 8 s with the zero fallback, so the next caller starts a fresh report', async () => {
    vi.useFakeTimers();
    try {
      // runReport's own timeout is 60 s; every caller joins the shared load, so it must settle sooner.
      analytics.getAnalytics.mockImplementation(() => new Promise(() => undefined));
      const { getGoogleAnalytics, resetGoogleAnalyticsCache } = await import(
        '@/app/api/v1/[[...route]]/google/handlers'
      );
      resetGoogleAnalyticsCache();

      const stalled = getGoogleAnalytics();
      await vi.advanceTimersByTimeAsync(8_000);
      await expect(stalled).resolves.toEqual({ total_pageviews: 0 });

      analytics.getAnalytics.mockResolvedValue({ analytics: { total_pageviews: 7 }, response: {} });
      await expect(getGoogleAnalytics()).resolves.toEqual({ total_pageviews: 7 });
      expect(analytics.getAnalytics).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
