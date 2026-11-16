/**
 * Copyright 2026 Mike Odnis
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
 * @file One Lanyard read per process: the /stats page's Discord snapshot and GET /api/v1/lanyard
 * call getLanyardSnapshot from two copies of the handler module (Next bundles it once for pages
 * and once for route handlers), and both must answer the same read. Concurrent callers share the
 * one upstream request in flight, whether it succeeds or falls back to the held presence. A fake
 * fetch stands in for Lanyard; nothing leaves the process.
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

type Handlers = typeof import('@/app/api/v1/[[...route]]/lanyard/handlers');

const T0 = new Date('2026-11-05T12:00:00Z').getTime();
const MINUTE = 60 * 1_000;

const presence = {
  discord_user: { username: 'tester', discriminator: '0', avatar: 'abc123', id: '42' },
  activities: [],
  discord_status: 'online',
};

const lanyardReply = () =>
  new Response(JSON.stringify({ success: true, data: presence }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

/** A 4xx, which the fetcher does not retry, so a failing read answers at once. */
const lanyardDown = () =>
  new Response(JSON.stringify({ message: 'Forbidden' }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  });

/** A fake Lanyard whose answers wait until the test lets them go. */
function heldLanyard(reply: () => Response = lanyardReply) {
  const waiting: Array<() => void> = [];
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        waiting.push(() => resolve(reply()));
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    /** Answers every request asked so far. */
    release: () => {
      for (const answer of waiting.splice(0)) answer();
    },
  };
}

/** A fresh copy of the handler module, as Next loads one per bundle. */
async function freshCopy(): Promise<Handlers> {
  vi.resetModules();
  return import('@/app/api/v1/[[...route]]/lanyard/handlers');
}

/** Lets the fake fetch's waiting requests be registered before the test answers them. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  sentry.captureException.mockClear();
  (await freshCopy()).resetLanyardCache();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('getLanyardSnapshot shared across module copies', () => {
  it('answers the route’s copy from the read the page’s copy made', async () => {
    const fetchMock = vi.fn(async () => lanyardReply());
    vi.stubGlobal('fetch', fetchMock);
    const page = await freshCopy();
    await expect(page.getLanyardSnapshot()).resolves.toEqual({ data: presence, readAt: T0 });

    const route = await freshCopy();
    vi.setSystemTime(T0 + 20_000);
    await expect(route.getLanyardSnapshot()).resolves.toEqual({ data: presence, readAt: T0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lets the route’s copy join the page’s read still in flight', async () => {
    const lanyard = heldLanyard();
    const page = await freshCopy();
    const route = await freshCopy();

    const fromPage = page.getLanyardSnapshot();
    const fromRoute = route.getLanyardSnapshot();
    await settle();
    lanyard.release();

    const [a, b] = await Promise.all([fromPage, fromRoute]);
    expect(a).toEqual({ data: presence, readAt: T0 });
    expect(b).toEqual(a);
    expect(lanyard.fetchMock).toHaveBeenCalledTimes(1);
  });

  it('forgets the read on reset, in every copy', async () => {
    const fetchMock = vi.fn(async () => lanyardReply());
    vi.stubGlobal('fetch', fetchMock);
    const page = await freshCopy();
    await page.getLanyardSnapshot();

    const route = await freshCopy();
    route.resetLanyardCache();
    await page.getLanyardSnapshot();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('getLanyardSnapshot under concurrent loads', () => {
  it('makes one upstream read for ten concurrent callers', async () => {
    const lanyard = heldLanyard();
    const { getLanyardSnapshot } = await freshCopy();

    const loads = Array.from({ length: 10 }, () => getLanyardSnapshot());
    await settle();
    lanyard.release();

    const snapshots = await Promise.all(loads);
    expect(lanyard.fetchMock).toHaveBeenCalledTimes(1);
    expect(new Set(snapshots.map((snapshot) => snapshot.readAt))).toEqual(new Set([T0]));
  });

  it('asks again once the minute is up, still once for every caller', async () => {
    const fetchMock = vi.fn(async () => lanyardReply());
    vi.stubGlobal('fetch', fetchMock);
    const { getLanyardSnapshot } = await freshCopy();
    await getLanyardSnapshot();

    vi.setSystemTime(T0 + MINUTE);
    const snapshots = await Promise.all(Array.from({ length: 10 }, () => getLanyardSnapshot()));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(snapshots.every((snapshot) => snapshot.readAt === T0 + MINUTE)).toBe(true);
  });

  it('gives every concurrent caller the held presence from one failed read, reported once', async () => {
    const fetchMock = vi.fn(async () => lanyardReply());
    vi.stubGlobal('fetch', fetchMock);
    const { getLanyardSnapshot } = await freshCopy();
    await getLanyardSnapshot();

    const lanyard = heldLanyard(lanyardDown);
    vi.setSystemTime(T0 + 2 * MINUTE);
    const loads = Array.from({ length: 10 }, () => getLanyardSnapshot());
    await settle();
    lanyard.release();

    const snapshots = await Promise.all(loads);
    expect(lanyard.fetchMock).toHaveBeenCalledTimes(1);
    expect(snapshots.every((snapshot) => snapshot.readAt === T0)).toBe(true);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('starts a new read after a failed one, rather than replaying the failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => lanyardDown()),
    );
    const { getLanyardSnapshot } = await freshCopy();
    await expect(getLanyardSnapshot()).rejects.toMatchObject({ command: 'lanyard:fetch' });

    const fetchMock = vi.fn(async () => lanyardReply());
    vi.stubGlobal('fetch', fetchMock);
    await expect(getLanyardSnapshot()).resolves.toEqual({ data: presence, readAt: T0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
