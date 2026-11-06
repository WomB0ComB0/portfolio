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
 * @file The status check counts the active Better Stack monitors that are up, caches that with
 * the state, and /api/status answers it in `data.monitors`; the 'unknown' fallbacks carry no
 * counts. The cache and the running check live in processGlobal, so the home page and /api/status
 * (two bundles of the module) share them. After a failure the last answer is served flagged
 * `stale: true` for a 30 s backoff without asking Better Stack (the failure reported once, as a
 * warning), and one check never takes more than 8 s. Only fetch, the clock (and, for the time cap, timers), the env and Sentry are faked.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // Skips the OTLP exporter the shared constants create off Vercel.
  process.env.VERCEL = '1';
});

// t3-env validates on import.
vi.mock('@/env', () => {
  const values: Record<string, string> = { NODE_ENV: 'test', BETTERSTACK_API_KEY: 'test-key' };
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (typeof key === 'string' ? values[key] : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/observability/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/observability/report')>()),
  nameApiTransaction: vi.fn(),
  reportApiFailure: vi.fn(),
  reportApiServerError: vi.fn(),
}));
// The status middleware logs to Better Stack.
vi.mock('@/lib/better-stack', () => ({ logAPIRequest: vi.fn() }));

import { statusRoute } from '@/app/api/[[...route]]/status';
import {
  type BetterStackMonitor,
  handleStatusCheck,
  peekServiceStatus,
  resetStatusCache,
} from '@/app/api/[[...route]]/status/handlers';
import { reportApiFailure } from '@/lib/observability/report';

type MonitorStatus = BetterStackMonitor['attributes']['status'];

const T0 = new Date('2026-11-05T12:00:00Z').getTime();
const CACHE_MS = 60_000;
const FALLBACK_MS = 10_000;
const BACKOFF_MS = 30_000;
/** One check's cap: one retry of a 3.5 s attempt fits inside it. */
const CHECK_BUDGET_MS = 8_000;
const STALE_MESSAGE = 'Using cached status data due to API error';

const monitor = (id: string, status: MonitorStatus): BetterStackMonitor => ({
  id,
  type: 'monitor',
  attributes: {
    url: `https://${id}.example.com`,
    pronounceable_name: id,
    monitor_type: 'status',
    status,
    paused: status === 'paused',
    last_checked_at: '2026-11-05T11:59:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-11-05T11:59:00Z',
  },
});

const monitors = (...statuses: MonitorStatus[]) =>
  statuses.map((status, index) => monitor(`m${index}`, status));

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const stubFetch = (reply: () => Response | Promise<Response>) => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => reply());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const stubMonitors = (...statuses: MonitorStatus[]) =>
  stubFetch(() => jsonResponse({ data: monitors(...statuses) }));

/** A 401 is final, so the fetcher answers it without retrying. */
const stubFailure = () => stubFetch(() => jsonResponse({ errors: ['Unauthorized'] }, 401));

/** A request that never answers; it only ends when the fetcher aborts it. */
const hang = (_input: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
  });

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

const getStatus = async () => {
  const res = await statusRoute.handle(new Request('http://localhost/status'));
  return { status: res.status, body: (await res.json()) as { data: Record<string, unknown> } };
};

beforeEach(() => {
  // Only the clock is faked: the fetcher's timers still run for real.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  resetStatusCache();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

afterAll(() => {
  Reflect.deleteProperty(process.env, 'VERCEL');
});

describe('handleStatusCheck monitor counts', () => {
  it.each([
    ['2 up, 1 down, 1 paused', monitors('up', 'up', 'down', 'paused'), 'down', { up: 2, total: 3 }],
    ['all up', monitors('up', 'up', 'up'), 'operational', { up: 3, total: 3 }],
    ['no active monitors', monitors('paused'), 'operational', { up: 0, total: 0 }],
    ['no monitors at all', [], 'operational', { up: 0, total: 0 }],
    ['one in maintenance', monitors('up', 'maintenance'), 'degraded', { up: 1, total: 2 }],
    ['one still validating', monitors('up', 'validating'), 'degraded', { up: 1, total: 2 }],
  ])('%s', async (_case, data, state, counts) => {
    stubFetch(() => jsonResponse({ data }));

    await expect(handleStatusCheck()).resolves.toEqual({
      state,
      lastUpdated: new Date(T0).toISOString(),
      monitors: counts,
    });
  });
});

describe('handleStatusCheck cache', () => {
  it('serves the cached check for a minute, to this copy and to a second one', async () => {
    const fetchMock = stubMonitors('up', 'down');
    const first = await handleStatusCheck();

    vi.setSystemTime(T0 + CACHE_MS - 1);
    await expect(handleStatusCheck()).resolves.toEqual(first);
    // Next bundles the module for the home page and for /api/status; both read one cache.
    vi.resetModules();
    const copy = await import('@/app/api/[[...route]]/status/handlers');
    await expect(copy.handleStatusCheck()).resolves.toEqual(first);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('runs one check for callers that arrive while it is running', async () => {
    let answer: (response: Response) => void = () => {};
    const fetchMock = stubFetch(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );

    const first = handleStatusCheck();
    const second = handleStatusCheck();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    answer(jsonResponse({ data: monitors('up') }));

    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('after a minute, answers the last check (counts included) flagged stale when Better Stack fails', async () => {
    stubMonitors('up', 'up', 'down');
    const good = await handleStatusCheck();
    expect(good).not.toHaveProperty('stale');

    vi.setSystemTime(T0 + CACHE_MS + 1);
    stubFailure();

    await expect(handleStatusCheck()).resolves.toEqual({
      state: 'down',
      lastUpdated: good.lastUpdated,
      monitors: { up: 2, total: 3 },
      message: STALE_MESSAGE,
      stale: true,
    });
  });

  it('after a failure, serves the stale answer for 30 s without asking Better Stack', async () => {
    stubMonitors('up');
    const good = await handleStatusCheck();
    const failed = T0 + CACHE_MS + 1;
    vi.setSystemTime(failed);
    const fetchMock = stubFailure();
    await handleStatusCheck();

    for (const offset of [1, 10_000, BACKOFF_MS - 1]) {
      vi.setSystemTime(failed + offset);
      await expect(handleStatusCheck()).resolves.toMatchObject({
        lastUpdated: good.lastUpdated,
        stale: true,
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(failed + BACKOFF_MS);
    await handleStatusCheck();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports the failure behind a stale answer once, as a warning, not again during the backoff', async () => {
    stubMonitors('up');
    await handleStatusCheck();
    const failed = T0 + CACHE_MS + 1;
    vi.setSystemTime(failed);
    stubFailure();

    await handleStatusCheck();
    vi.setSystemTime(failed + BACKOFF_MS - 1);
    await handleStatusCheck();

    expect(reportApiFailure).toHaveBeenCalledTimes(1);
    expect(reportApiFailure).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'status:fetch' }),
      { context: 'fetch system status', level: 'warning' },
    );
  });

  it('serves a good answer again, unflagged, once Better Stack recovers after the backoff', async () => {
    stubMonitors('up');
    await handleStatusCheck();
    vi.setSystemTime(T0 + CACHE_MS + 1);
    stubFailure();
    await handleStatusCheck();

    vi.setSystemTime(T0 + CACHE_MS + 1 + BACKOFF_MS);
    stubMonitors('up', 'down');
    const recovered = await handleStatusCheck();

    expect(recovered).toEqual({
      state: 'down',
      lastUpdated: new Date(T0 + CACHE_MS + 1 + BACKOFF_MS).toISOString(),
      monitors: { up: 1, total: 2 },
    });
    await expect(handleStatusCheck()).resolves.toEqual(recovered);
  });

  it('with nothing cached, rejects, then answers the unknown fallback (no counts) for 10 s', async () => {
    const fetchMock = stubFailure();

    await expect(handleStatusCheck()).rejects.toThrow();
    vi.setSystemTime(T0 + FALLBACK_MS - 1);
    const fallback = await handleStatusCheck();

    expect(fallback).toMatchObject({ state: 'unknown' });
    expect(fallback).not.toHaveProperty('monitors');
    expect(fallback).not.toHaveProperty('stale');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('with nothing cached, asks Better Stack once per 10 s however many callers fail', async () => {
    const fetchMock = stubFailure();

    for (const at of [0, 1_000, FALLBACK_MS, FALLBACK_MS + 1_000, 2 * FALLBACK_MS]) {
      vi.setSystemTime(T0 + at);
      await handleStatusCheck().catch(() => undefined);
    }

    // At 0, 10 s and 20 s; the callers in between get the fallback.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('handleStatusCheck with a hanging Better Stack', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(T0);
  });

  it('answers the cached check, flagged stale, within 8 s', async () => {
    const fetchMock = stubMonitors('up');
    const good = await handleStatusCheck();

    fetchMock.mockImplementation(hang);
    vi.setSystemTime(T0 + CACHE_MS + 1);
    const pending = handleStatusCheck();

    expect(await settlesWithin(pending, CHECK_BUDGET_MS)).toBe(true);
    await expect(pending).resolves.toEqual({ ...good, message: STALE_MESSAGE, stale: true });
    // One retry of the timed-out attempt, no more.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails within 8 s when nothing is cached, so callers fall back in time', async () => {
    stubFetch(() => jsonResponse({ data: [] })).mockImplementation(hang);
    const pending = handleStatusCheck();

    expect(await settlesWithin(pending, CHECK_BUDGET_MS)).toBe(true);
    await expect(pending).rejects.toThrow();
  });
});

describe('peekServiceStatus', () => {
  it('is undefined before Better Stack ever answered, the unknown fallback included', async () => {
    const fetchMock = stubFailure();
    expect(peekServiceStatus()).toBeUndefined();

    await expect(handleStatusCheck()).rejects.toThrow();

    expect(peekServiceStatus()).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('answers the check unflagged within its minute', async () => {
    stubMonitors('up', 'down');
    const good = await handleStatusCheck();
    vi.setSystemTime(T0 + CACHE_MS - 1);

    expect(peekServiceStatus()).toEqual(good);
  });

  it('answers the last check flagged stale at once while a later check hangs, asking nothing', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(T0);
    const fetchMock = stubMonitors('up', 'up');
    const good = await handleStatusCheck();
    fetchMock.mockImplementation(hang);
    vi.setSystemTime(T0 + CACHE_MS + 1);
    const pending = handleStatusCheck();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(peekServiceStatus()).toEqual({ ...good, stale: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The check gives up within its budget, so it never outlives the test.
    expect(await settlesWithin(pending, CHECK_BUDGET_MS)).toBe(true);
  });
});

describe('GET /status', () => {
  it('answers the monitor counts in data.monitors', async () => {
    stubMonitors('up', 'up', 'down', 'paused');

    const { status, body } = await getStatus();

    expect(status).toBe(200);
    expect(body.data).toEqual({
      state: 'down',
      lastUpdated: new Date(T0).toISOString(),
      monitors: { up: 2, total: 3 },
    });
  });

  it('answers the stale flag on the cached check after Better Stack fails', async () => {
    stubMonitors('up', 'up');
    await handleStatusCheck();
    vi.setSystemTime(T0 + CACHE_MS + 1);
    stubFailure();

    const { status, body } = await getStatus();

    expect(status).toBe(200);
    expect(body.data).toEqual({
      state: 'operational',
      lastUpdated: new Date(T0).toISOString(),
      monitors: { up: 2, total: 2 },
      message: STALE_MESSAGE,
      stale: true,
    });
  });

  it('still answers 200 with the unknown fallback, without counts, when Better Stack fails', async () => {
    stubFailure();

    const { status, body } = await getStatus();

    expect(status).toBe(200);
    expect(body.data).toMatchObject({ state: 'unknown' });
    expect(body.data).not.toHaveProperty('monitors');
  });
});
