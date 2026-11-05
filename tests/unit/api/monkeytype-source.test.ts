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
 * @file The server's one Monkeytype source (/stats prefetch and the home page). It decodes the
 * profile leniently (a missing 60 s best still decodes), rejects a reply that does not match,
 * serves the last good profile for an hour, and after a failed reload serves it stale with one
 * Sentry warning. Only fetch, the env and Sentry are faked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock('@sentry/nextjs', () => sentry);
// t3-env validates on import; the fetcher only reads it for the Vercel bypass header.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import { MONKEYTYPE_PROFILE_URL as BROWSER_PROFILE_URL } from '@/app/(routes)/(dev)/stats/_lib/stats-queries';
import {
  getMonkeytypeProfile,
  MONKEYTYPE_CACHE_TTL_MS,
  MONKEYTYPE_PROFILE_URL,
  readMonkeytypeProfile,
  resetMonkeytypeCache,
} from '@/lib/api-integrations/monkeytype';
import { resetApiReportCooldowns } from '@/lib/observability/report';

const T0 = new Date('2026-11-05T12:00:00Z').getTime();

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Monkeytype's reply, trimmed to what the site reads plus a few keys it ignores. */
const profileReply = (time?: Record<string, { wpm: number; acc: number }[]>) => ({
  message: 'Profile retrieved',
  data: {
    name: 'WomB0ComB0',
    personalBests: { ...(time ? { time } : {}), words: {} },
    typingStats: { completedTests: 812, startedTests: 1_204, timeTyping: 36_000 },
  },
});

const stubFetch = (reply: () => Response) => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => reply());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

beforeEach(() => {
  // Only the clock is faked: the fetcher's retry delay still runs on real timers.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  resetMonkeytypeCache();
  resetApiReportCooldowns();
  sentry.captureException.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Monkeytype server source', () => {
  it('asks the same profile URL the /stats card fetches in the browser', async () => {
    const fetchMock = stubFetch(() => jsonResponse(profileReply({ '60': [] })));

    await getMonkeytypeProfile();

    expect(MONKEYTYPE_PROFILE_URL).toBe(BROWSER_PROFILE_URL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(MONKEYTYPE_PROFILE_URL);
  });

  it('decodes the profile, without its { data } envelope or the keys it does not use', async () => {
    stubFetch(() =>
      jsonResponse(
        profileReply({
          '15': [{ wpm: 140, acc: 99 }],
          '60': [
            { wpm: 118.4, acc: 97.2 },
            { wpm: 121, acc: 96.5 },
          ],
        }),
      ),
    );

    await expect(getMonkeytypeProfile()).resolves.toEqual({
      personalBests: {
        time: {
          '15': [{ wpm: 140, acc: 99 }],
          '60': [
            { wpm: 118.4, acc: 97.2 },
            { wpm: 121, acc: 96.5 },
          ],
        },
      },
      typingStats: { completedTests: 812 },
    });
  });

  it('decodes a profile with no 60 s best, or no timed bests at all', async () => {
    stubFetch(() => jsonResponse(profileReply({ '30': [{ wpm: 101, acc: 95 }] })));
    const withoutSixty = await getMonkeytypeProfile();
    expect(withoutSixty.personalBests.time).toEqual({ '30': [{ wpm: 101, acc: 95 }] });
    expect(withoutSixty.personalBests.time?.['60']).toBeUndefined();

    resetMonkeytypeCache();
    stubFetch(() => jsonResponse(profileReply()));
    const withoutTime = await getMonkeytypeProfile();
    expect(withoutTime.personalBests.time).toBeUndefined();
    expect(withoutTime.typingStats.completedTests).toBe(812);
  });

  it('rejects a reply that does not match the schema, with nothing cached', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({ data: { personalBests: {}, typingStats: { completedTests: 'many' } } }),
    );

    await expect(getMonkeytypeProfile()).rejects.toThrow();
    await expect(readMonkeytypeProfile()).rejects.toThrow();
    // A schema mismatch is not retried, and a failure is never cached as a value.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('serves the cached profile for an hour without asking Monkeytype again', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(profileReply({ '60': [{ wpm: 120, acc: 97 }] })),
    );

    await getMonkeytypeProfile();
    vi.setSystemTime(T0 + MONKEYTYPE_CACHE_TTL_MS - 1);
    await expect(readMonkeytypeProfile()).resolves.toMatchObject({ stale: false });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('after the TTL, serves the last good profile as stale when Monkeytype fails, with one warning', async () => {
    stubFetch(() => jsonResponse(profileReply({ '60': [{ wpm: 120, acc: 97 }] })));
    const good = await getMonkeytypeProfile();

    vi.setSystemTime(T0 + MONKEYTYPE_CACHE_TTL_MS + 1);
    const failing = stubFetch(() => jsonResponse({ message: 'Internal Server Error' }, 503));

    // The raw read marks the answer stale and reports nothing itself.
    await expect(readMonkeytypeProfile()).resolves.toMatchObject({ stale: true, data: good });
    // The reload made one attempt and one retry; the backoff keeps the next reads off Monkeytype.
    expect(failing).toHaveBeenCalledTimes(2);
    expect(sentry.captureException).not.toHaveBeenCalled();

    await expect(getMonkeytypeProfile()).resolves.toEqual(good);
    await expect(getMonkeytypeProfile()).resolves.toEqual(good);

    expect(failing).toHaveBeenCalledTimes(2);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'monkeytype:profile' }),
      expect.objectContaining({
        level: 'warning',
        tags: { 'api.context': 'fetch Monkeytype profile' },
      }),
    );
  });
});
