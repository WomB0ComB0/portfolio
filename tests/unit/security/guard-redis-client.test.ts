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
 * @file Configuration the API guard depends on: the guard's Upstash client gives every HTTP
 * request a fresh timeout signal and makes one attempt, so a slow Redis REJECTS within the budget
 * (checked against the real SDK with a stubbed fetch, to catch behaviour changes in SDK
 * upgrades); and the limiters have analytics and their own timeout off, with the expected
 * windows and key prefixes.
 */

import { Redis } from '@upstash/redis';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

const ratelimitConfigs = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    static slidingWindow = (tokens: number, window: string) => ({ tokens, window });
    readonly limit = vi.fn();
    constructor(config: Record<string, unknown>) {
      ratelimitConfigs.push(config);
    }
  }
  return { Ratelimit };
});

import { GUARD_BUDGET_MS, getGuardRedis, guardRedisConfig } from '@/classes/redis-guard';
import { redisBanLookup } from '@/lib/security/api-guard';
import { getLimiters, RATE_LIMITS } from '@/lib/security/rate-limit';

afterEach(() => {
  vi.unstubAllGlobals();
  ratelimitConfigs.length = 0;
});

describe('guard Redis client', () => {
  it('creates a fresh, unaborted timeout signal per request, one attempt, no extra headers', () => {
    const config = guardRedisConfig('https://example-redis.test', 'token');
    expect(typeof config.signal).toBe('function');
    const makeSignal = config.signal as () => AbortSignal;
    const first = makeSignal();
    const second = makeSignal();
    expect(first).toBeInstanceOf(AbortSignal);
    expect(first).not.toBe(second);
    expect(first.aborted).toBe(false);
    expect(config.retry).toEqual({ retries: 0 });
    expect(config.readYourWrites).toBe(false);
    expect(config.enableTelemetry).toBe(false);
  });

  it('is not created when the Upstash URL or token is missing', () => {
    expect(getGuardRedis()).toBeNull();
  });

  it('rejects with a TimeoutError within the budget when Redis does not answer (real SDK)', async () => {
    const fetchMock = vi.fn(
      (_url: unknown, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init.signal as AbortSignal;
          if (signal.aborted) {
            reject(signal.reason);
            return;
          }
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new Redis(guardRedisConfig('https://example-redis.test', 'token'));

    const started = performance.now();
    const [banRead, directRead] = await Promise.allSettled([
      redisBanLookup(client).lookup('203.0.113.9', Date.now(), 10),
      client.zscore('bans:ip', '203.0.113.9'),
    ]);
    const elapsed = performance.now() - started;

    for (const result of [banRead, directRead]) {
      expect(result?.status).toBe('rejected');
      expect((result as PromiseRejectedResult).reason).toMatchObject({ name: 'TimeoutError' });
    }
    // The three ban reads are one HTTP request; each request is attempted once, each with
    // its own signal.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [firstInit, secondInit] = fetchMock.mock.calls.map(([, init]) => init);
    expect(firstInit?.signal).not.toBe(secondInit?.signal);
    const pipelined = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/pipeline'));
    expect(JSON.parse(String(pipelined?.[1].body))).toHaveLength(3);
    expect(elapsed).toBeGreaterThanOrEqual(GUARD_BUDGET_MS - 50);
    expect(elapsed).toBeLessThan(GUARD_BUDGET_MS + 700);
  });
});

describe('getLimiters', () => {
  const redisA = {} as Redis;
  const redisB = {} as Redis;

  it('builds one sliding-window limiter per route class, without analytics or internal timeout', () => {
    const limiters = getLimiters(redisA);
    expect(Object.keys(limiters).sort()).toEqual(['api', 'apiv1', 'auth', 'slow']);
    expect(ratelimitConfigs).toHaveLength(4);
    for (const config of ratelimitConfigs) {
      expect(config).toMatchObject({ redis: redisA, analytics: false, timeout: 0 });
    }
    expect(ratelimitConfigs.map(({ prefix, limiter }) => ({ prefix, limiter }))).toEqual([
      { prefix: 'ratelimit:api', limiter: { tokens: 30, window: '60 s' } },
      { prefix: 'ratelimit:apiv1', limiter: { tokens: 60, window: '60 s' } },
      { prefix: 'ratelimit:auth', limiter: { tokens: 5, window: '10 s' } },
      { prefix: 'ratelimit:slowmode', limiter: { tokens: 1, window: '30 s' } },
    ]);
  });

  it('reuses the limiters for the same client', () => {
    expect(getLimiters(redisA)).toBe(getLimiters(redisA));
    expect(getLimiters(redisB)).not.toBe(getLimiters(redisA));
  });

  it('keeps the documented limits', () => {
    expect(RATE_LIMITS).toEqual({
      api: { tokens: 30, window: '60 s', prefix: 'ratelimit:api' },
      apiv1: { tokens: 60, window: '60 s', prefix: 'ratelimit:apiv1' },
      auth: { tokens: 5, window: '10 s', prefix: 'ratelimit:auth' },
      slow: { tokens: 1, window: '30 s', prefix: 'ratelimit:slowmode' },
    });
  });
});
