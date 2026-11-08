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
 * @file The API guard against a fake Redis: bans (IP, CIDR v4/v6, expiry), the slow list,
 * per-route-class limiters, /64 keying, exemptions, and failing open (timeout, error) with a
 * cooldown during which Redis is not called.
 */

import { FakeRedis } from '@tests/fixtures/fake-redis';
import type { Redis } from '@upstash/redis';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import {
  type ApiGuardOptions,
  type BanLookup,
  classifyRequest,
  createApiGuard,
  GuardTimeoutError,
  redisBanLookup,
  UNKNOWN_CLIENT_KEY,
} from '@/lib/security/api-guard';
import { BAN_KEYS, MAX_ACTIVE_CIDRS, PERMANENT_BAN_SCORE } from '@/lib/security/ban-keys';
import type { LimiterKind, RateLimiter, RateLimitResult } from '@/lib/security/rate-limit.types';

const NOW = 1_800_000_000_000;
const RESET = NOW + 42_000;

const ok: RateLimitResult = { success: true, limit: 30, remaining: 29, reset: RESET };
const denied = (limit: number): RateLimitResult => ({
  success: false,
  limit,
  remaining: 0,
  reset: RESET,
});

type FakeLimiter = RateLimiter & {
  limit: ReturnType<typeof vi.fn<(id: string) => Promise<RateLimitResult>>>;
};

function fakeLimiters(): Record<LimiterKind, FakeLimiter> {
  const make = (): FakeLimiter => ({ limit: vi.fn(async () => ok) });
  return { api: make(), apiv1: make(), auth: make(), guestbook: make(), slow: make() };
}

const request = (path: string, { ip, method = 'GET' }: { ip?: string; method?: string } = {}) =>
  new Request(`https://example.test${path}`, {
    method,
    headers: ip ? { 'x-real-ip': ip } : {},
  });

let redis: FakeRedis;
let limiters: Record<LimiterKind, FakeLimiter>;
let clock: number;
let report: ReturnType<typeof vi.fn<(error: unknown) => void>>;

function guardWith(overrides: Partial<ApiGuardOptions> = {}) {
  return createApiGuard({
    getBackend: () => ({ bans: redisBanLookup(redis as unknown as Redis), limiters }),
    now: () => clock,
    report,
    ...overrides,
  });
}

const limiterCalls = () =>
  Object.fromEntries(
    Object.entries(limiters).map(([kind, limiter]) => [kind, limiter.limit.mock.calls.length]),
  );

beforeEach(() => {
  redis = new FakeRedis();
  redis.now = () => clock;
  limiters = fakeLimiters();
  clock = NOW;
  report = vi.fn<(error: unknown) => void>();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('classifyRequest', () => {
  it('maps each route class to its limiter and exempts health checks and preflights', () => {
    expect(classifyRequest('GET', '/api/v1/blog')).toEqual({ checkBans: true, limiter: 'apiv1' });
    expect(classifyRequest('POST', '/api/v1')).toEqual({ checkBans: true, limiter: 'apiv1' });
    expect(classifyRequest('GET', '/api/status')).toEqual({ checkBans: true, limiter: 'api' });
    expect(classifyRequest('POST', '/api/admin/ban')).toEqual({
      checkBans: false,
      limiter: 'auth',
    });
    expect(classifyRequest('GET', '/api/health')).toBeNull();
    expect(classifyRequest('GET', '/api/health/ready')).toBeNull();
    expect(classifyRequest('OPTIONS', '/api/v1/blog')).toBeNull();
  });

  it('gives a guestbook post its own, stricter limiter; reading the guestbook stays apiv1', () => {
    const post = { checkBans: true, limiter: 'guestbook' };
    expect(classifyRequest('POST', '/api/v1/messages')).toEqual(post);
    expect(classifyRequest('post', '/api/v1/messages/')).toEqual(post);
    expect(classifyRequest('GET', '/api/v1/messages')).toEqual({
      checkBans: true,
      limiter: 'apiv1',
    });
    expect(classifyRequest('POST', '/api/v1/messagesx')).toEqual({
      checkBans: true,
      limiter: 'apiv1',
    });
  });

  it('matches whole path segments only', () => {
    expect(classifyRequest('GET', '/api/healthz')).toEqual({ checkBans: true, limiter: 'api' });
    expect(classifyRequest('GET', '/api/administrator')).toEqual({
      checkBans: true,
      limiter: 'api',
    });
    expect(classifyRequest('GET', '/api/v10')).toEqual({ checkBans: true, limiter: 'api' });
  });
});

describe('createApiGuard: verdicts', () => {
  it('allows a clean client, issuing the ban read and the limiter before either resolves', async () => {
    const pending: Array<() => void> = [];
    const hold = <T>(value: T) =>
      new Promise<T>((resolve) => {
        pending.push(() => resolve(value));
      });
    const bans: BanLookup = {
      lookup: vi.fn(() => hold({ ipScore: null, slowScore: null, cidrs: [] })),
    };
    limiters.apiv1.limit.mockImplementation(() => hold(ok));
    const guard = createApiGuard({ getBackend: () => ({ bans, limiters }), now: () => clock });

    const verdict = guard.check(request('/api/v1/blog', { ip: '203.0.113.9' }));

    expect(bans.lookup).toHaveBeenCalledWith('203.0.113.9', NOW, MAX_ACTIVE_CIDRS);
    expect(limiters.apiv1.limit).toHaveBeenCalledWith('203.0.113.9');
    for (const release of pending) release();
    await expect(verdict).resolves.toEqual({ kind: 'allow' });
  });

  it('reads the IP, slow and active CIDR entries in one pipeline', async () => {
    await guardWith().check(request('/api/v1/blog', { ip: '203.0.113.9' }));
    expect(redis.pipelines).toBe(1);
    expect(redis.calls).toEqual([
      ['zscore', BAN_KEYS.ip, '203.0.113.9'],
      ['zscore', BAN_KEYS.slow, '203.0.113.9'],
      [
        'zrange',
        BAN_KEYS.cidr,
        `(${NOW}`,
        '+inf',
        { byScore: true, offset: 0, count: MAX_ACTIVE_CIDRS },
      ],
    ]);
  });

  it('bans an IP with a future or permanent score', async () => {
    await redis.zadd(BAN_KEYS.ip, { score: NOW + 60_000, member: '203.0.113.9' });
    await redis.zadd(BAN_KEYS.ip, { score: PERMANENT_BAN_SCORE, member: '198.51.100.7' });
    const guard = guardWith();
    await expect(guard.check(request('/api/status', { ip: '203.0.113.9' }))).resolves.toEqual({
      kind: 'ban',
    });
    await expect(guard.check(request('/api/v1/blog', { ip: '198.51.100.7' }))).resolves.toEqual({
      kind: 'ban',
    });
  });

  it('ignores an expired IP ban', async () => {
    await redis.zadd(BAN_KEYS.ip, { score: NOW - 1, member: '203.0.113.9' });
    await redis.zadd(BAN_KEYS.ip, { score: NOW, member: '203.0.113.10' });
    const guard = guardWith();
    for (const ip of ['203.0.113.9', '203.0.113.10']) {
      await expect(guard.check(request('/api/status', { ip }))).resolves.toEqual({ kind: 'allow' });
    }
  });

  it('matches the normalized address, so other spellings of a banned IPv6 are banned too', async () => {
    await redis.zadd(BAN_KEYS.ip, { score: PERMANENT_BAN_SCORE, member: '2001:db8::1' });
    const verdict = await guardWith().check(request('/api/status', { ip: '2001:DB8:0:0::1' }));
    expect(verdict).toEqual({ kind: 'ban' });
  });

  it('bans addresses inside an active IPv4 CIDR range and allows those outside', async () => {
    await redis.zadd(BAN_KEYS.cidr, { score: PERMANENT_BAN_SCORE, member: '203.0.113.0/24' });
    const guard = guardWith();
    await expect(guard.check(request('/api/v1/x', { ip: '203.0.113.200' }))).resolves.toEqual({
      kind: 'ban',
    });
    await expect(guard.check(request('/api/v1/x', { ip: '::ffff:203.0.113.5' }))).resolves.toEqual({
      kind: 'ban',
    });
    await expect(guard.check(request('/api/v1/x', { ip: '203.0.114.1' }))).resolves.toEqual({
      kind: 'allow',
    });
  });

  it('bans addresses inside an active IPv6 CIDR range and allows those outside', async () => {
    await redis.zadd(BAN_KEYS.cidr, { score: NOW + 1_000, member: '2001:db8::/32' });
    const guard = guardWith();
    await expect(guard.check(request('/api/status', { ip: '2001:db8:ffff::1' }))).resolves.toEqual({
      kind: 'ban',
    });
    await expect(guard.check(request('/api/status', { ip: '2001:db9::1' }))).resolves.toEqual({
      kind: 'allow',
    });
  });

  it('ignores an expired CIDR ban', async () => {
    await redis.zadd(BAN_KEYS.cidr, { score: NOW - 1, member: '203.0.113.0/24' });
    const verdict = await guardWith().check(request('/api/status', { ip: '203.0.113.9' }));
    expect(verdict).toEqual({ kind: 'allow' });
  });

  it('applies the slow-mode limiter to slowed IPs only, while their entry is active', async () => {
    await redis.zadd(BAN_KEYS.slow, { score: NOW + 60_000, member: '203.0.113.9' });
    await redis.zadd(BAN_KEYS.slow, { score: NOW - 60_000, member: '203.0.113.10' });
    limiters.slow.limit.mockResolvedValue(denied(1));
    const guard = guardWith();

    await expect(guard.check(request('/api/v1/x', { ip: '203.0.113.9' }))).resolves.toEqual({
      kind: 'limit',
      limit: 1,
      reset: RESET,
    });
    expect(limiters.slow.limit).toHaveBeenCalledWith('203.0.113.9');

    limiters.slow.limit.mockClear();
    await expect(guard.check(request('/api/v1/x', { ip: '203.0.113.10' }))).resolves.toEqual({
      kind: 'allow',
    });
    await expect(guard.check(request('/api/v1/x', { ip: '203.0.113.11' }))).resolves.toEqual({
      kind: 'allow',
    });
    expect(limiters.slow.limit).not.toHaveBeenCalled();
  });

  it('allows a slowed IP while the slow-mode limiter has room', async () => {
    await redis.zadd(BAN_KEYS.slow, { score: PERMANENT_BAN_SCORE, member: '203.0.113.9' });
    const verdict = await guardWith().check(request('/api/v1/x', { ip: '203.0.113.9' }));
    expect(verdict).toEqual({ kind: 'allow' });
    expect(limiters.slow.limit).toHaveBeenCalledTimes(1);
  });

  it('returns the limit and reset of the limiter that denied the request', async () => {
    limiters.api.limit.mockResolvedValue(denied(30));
    const verdict = await guardWith().check(request('/api/status', { ip: '203.0.113.9' }));
    expect(verdict).toEqual({ kind: 'limit', limit: 30, reset: RESET });
  });

  it('reports a ban rather than a limit when both apply', async () => {
    await redis.zadd(BAN_KEYS.ip, { score: PERMANENT_BAN_SCORE, member: '203.0.113.9' });
    limiters.api.limit.mockResolvedValue(denied(30));
    const verdict = await guardWith().check(request('/api/status', { ip: '203.0.113.9' }));
    expect(verdict).toEqual({ kind: 'ban' });
  });
});

describe('createApiGuard: route classes and keys', () => {
  it('uses the apiv1, api and auth limiters for their route classes', async () => {
    const guard = guardWith();
    await guard.check(request('/api/v1/blog', { ip: '203.0.113.9' }));
    expect(limiterCalls()).toEqual({ api: 0, apiv1: 1, auth: 0, guestbook: 0, slow: 0 });
    await guard.check(request('/api/status', { ip: '203.0.113.9' }));
    expect(limiterCalls()).toEqual({ api: 1, apiv1: 1, auth: 0, guestbook: 0, slow: 0 });
    await guard.check(request('/api/admin/ban', { ip: '203.0.113.9', method: 'POST' }));
    expect(limiterCalls()).toEqual({ api: 1, apiv1: 1, auth: 1, guestbook: 0, slow: 0 });
  });

  it('counts a guestbook post against the guestbook limiter only, and limits it there', async () => {
    const guard = guardWith();
    const post = () => request('/api/v1/messages', { ip: '203.0.113.9', method: 'POST' });

    await expect(guard.check(post())).resolves.toEqual({ kind: 'allow' });
    expect(limiterCalls()).toEqual({ api: 0, apiv1: 0, auth: 0, guestbook: 1, slow: 0 });
    expect(limiters.guestbook.limit).toHaveBeenCalledWith('203.0.113.9');

    limiters.guestbook.limit.mockResolvedValue(denied(5));
    await expect(guard.check(post())).resolves.toEqual({ kind: 'limit', limit: 5, reset: RESET });
  });

  it('does not apply bans or slow mode to /api/admin, only the auth limiter', async () => {
    await redis.zadd(BAN_KEYS.ip, { score: PERMANENT_BAN_SCORE, member: '203.0.113.9' });
    await redis.zadd(BAN_KEYS.slow, { score: PERMANENT_BAN_SCORE, member: '203.0.113.9' });
    await redis.zadd(BAN_KEYS.cidr, { score: PERMANENT_BAN_SCORE, member: '203.0.113.0/24' });
    const guard = guardWith();

    const verdict = await guard.check(
      request('/api/admin/ban', { ip: '203.0.113.9', method: 'POST' }),
    );
    expect(verdict).toEqual({ kind: 'allow' });
    expect(redis.calls).toEqual(redis.callsTo('zadd'));
    expect(limiters.auth.limit).toHaveBeenCalledWith('203.0.113.9');

    limiters.auth.limit.mockResolvedValue(denied(5));
    await expect(
      guard.check(request('/api/admin/ban', { ip: '203.0.113.9', method: 'POST' })),
    ).resolves.toEqual({ kind: 'limit', limit: 5, reset: RESET });
  });

  it('keys IPv6 clients by their /64 and IPv4 clients by their address', async () => {
    const guard = guardWith();
    await guard.check(request('/api/v1/x', { ip: '2001:db8:aa:bb:1:2:3:4' }));
    await guard.check(request('/api/v1/x', { ip: '2001:db8:aa:bb:ffff::9' }));
    await guard.check(request('/api/v1/x', { ip: '2001:db8:aa:bc::1' }));
    await guard.check(request('/api/v1/x', { ip: '198.51.100.7' }));
    expect(limiters.apiv1.limit.mock.calls.map(([key]) => key)).toEqual([
      '2001:db8:aa:bb::/64',
      '2001:db8:aa:bb::/64',
      '2001:db8:aa:bc::/64',
      '198.51.100.7',
    ]);
  });

  it('still bans by the exact IPv6 address, not the /64', async () => {
    await redis.zadd(BAN_KEYS.ip, { score: PERMANENT_BAN_SCORE, member: '2001:db8:aa:bb::1' });
    const guard = guardWith();
    await expect(guard.check(request('/api/x', { ip: '2001:db8:aa:bb::1' }))).resolves.toEqual({
      kind: 'ban',
    });
    await expect(guard.check(request('/api/x', { ip: '2001:db8:aa:bb::2' }))).resolves.toEqual({
      kind: 'allow',
    });
  });

  it('rate-limits clients with an unparseable IP header under one shared key, without ban lookups', async () => {
    const verdict = await guardWith().check(request('/api/v1/x', { ip: 'not-an-ip' }));
    expect(verdict).toEqual({ kind: 'allow' });
    expect(limiters.apiv1.limit).toHaveBeenCalledWith(UNKNOWN_CLIENT_KEY);
    expect(redis.calls).toEqual([]);
  });
});

describe('createApiGuard: exemptions', () => {
  it.each([
    ['a CORS preflight', request('/api/v1/x', { ip: '203.0.113.9', method: 'OPTIONS' })],
    ['/api/health', request('/api/health', { ip: '203.0.113.9' })],
    ['/api/health/ready', request('/api/health/ready', { ip: '203.0.113.9' })],
    ['a request without client IP headers', request('/api/v1/x')],
    ['IPv4 loopback', request('/api/v1/x', { ip: '127.0.0.1' })],
    ['IPv6 loopback', request('/api/v1/x', { ip: '::1' })],
  ])('allows %s without calling Redis', async (_label, req) => {
    await redis.zadd(BAN_KEYS.ip, { score: PERMANENT_BAN_SCORE, member: '203.0.113.9' });
    const getBackend = vi.fn(() => ({ bans: redisBanLookup(redis as unknown as Redis), limiters }));
    const verdict = await guardWith({ getBackend }).check(req);
    expect(verdict).toEqual({ kind: 'allow' });
    expect(getBackend).not.toHaveBeenCalled();
    expect(limiterCalls()).toEqual({ api: 0, apiv1: 0, auth: 0, guestbook: 0, slow: 0 });
  });

  it('allows everything when Redis is not configured', async () => {
    const guard = createApiGuard({ getBackend: () => null });
    await expect(guard.check(request('/api/v1/x', { ip: '203.0.113.9' }))).resolves.toEqual({
      kind: 'allow',
    });
  });
});

describe('createApiGuard: failing open', () => {
  it('allows and reports once when Redis rejects', async () => {
    redis.failWith = new Error('fetch failed');
    const verdict = await guardWith({ failureThreshold: 1 }).check(
      request('/api/v1/x', { ip: '203.0.113.9' }),
    );
    expect(verdict).toEqual({ kind: 'allow' });
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(redis.failWith);
  });

  it('allows when a limiter rejects', async () => {
    limiters.api.limit.mockRejectedValue(new Error('NOSCRIPT and then some'));
    const verdict = await guardWith({ failureThreshold: 1 }).check(
      request('/api/status', { ip: '203.0.113.9' }),
    );
    expect(verdict).toEqual({ kind: 'allow' });
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('keeps enforcing a ban when only the limiter fails', async () => {
    await redis.zadd(BAN_KEYS.ip, { score: PERMANENT_BAN_SCORE, member: '203.0.113.9' });
    limiters.apiv1.limit.mockRejectedValue(new Error('NOSCRIPT'));
    await expect(guardWith().check(request('/api/v1/x', { ip: '203.0.113.9' }))).resolves.toEqual({
      kind: 'ban',
    });
  });

  it('keeps enforcing the rate limit when only the ban read fails', async () => {
    limiters.apiv1.limit.mockResolvedValue(denied(60));
    const guard = createApiGuard({
      getBackend: () => ({
        bans: { lookup: () => Promise.reject(new Error('fetch failed')) },
        limiters,
      }),
      now: () => clock,
      report,
    });
    await expect(guard.check(request('/api/v1/x', { ip: '203.0.113.9' }))).resolves.toEqual({
      kind: 'limit',
      limit: 60,
      reset: RESET,
    });
  });

  it('lets one failed lookup through without skipping Redis, and skips it after consecutive failures', async () => {
    const guard = guardWith({ cooldownMs: 30_000 });

    // A single failure (e.g. a new instance's first connection) is not enough to stop checking.
    redis.failWith = new Error('fetch failed');
    await guard.check(request('/api/v1/x', { ip: '203.0.113.1' }));
    expect(report).not.toHaveBeenCalled();
    redis.failWith = null;
    await redis.zadd(BAN_KEYS.ip, { score: PERMANENT_BAN_SCORE, member: '203.0.113.9' });
    await expect(guard.check(request('/api/v1/x', { ip: '203.0.113.9' }))).resolves.toEqual({
      kind: 'ban',
    });

    // The success reset the count, so it takes two failures in a row to start the cooldown.
    redis.failWith = new Error('fetch failed');
    await guard.check(request('/api/v1/x', { ip: '203.0.113.2' }));
    expect(report).not.toHaveBeenCalled();
    await guard.check(request('/api/v1/x', { ip: '203.0.113.3' }));
    expect(report).toHaveBeenCalledTimes(1);

    redis.failWith = null;
    const calls = redis.calls.length;
    await expect(guard.check(request('/api/v1/x', { ip: '203.0.113.9' }))).resolves.toEqual({
      kind: 'allow',
    });
    expect(redis.calls.length).toBe(calls);
  });

  it('allows at the time budget when Redis never answers, not later', async () => {
    vi.useFakeTimers();
    const bans: BanLookup = { lookup: () => new Promise(() => undefined) };
    const guard = createApiGuard({
      getBackend: () => ({ bans, limiters }),
      now: () => clock,
      budgetMs: 300,
      failureThreshold: 1,
      report,
    });

    let settled = false;
    const verdict = guard.check(request('/api/v1/x', { ip: '203.0.113.9' })).finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(299);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    await expect(verdict).resolves.toEqual({ kind: 'allow' });
    expect(report).toHaveBeenCalledWith(expect.any(GuardTimeoutError));
  });

  it('skips Redis for the cooldown after a failure, then tries again', async () => {
    redis.failWith = new Error('fetch failed');
    const guard = guardWith({ cooldownMs: 30_000, failureThreshold: 1 });
    await guard.check(request('/api/v1/x', { ip: '203.0.113.9' }));
    const callsAfterFailure = redis.calls.length;
    const limiterCallsAfterFailure = limiters.apiv1.limit.mock.calls.length;

    redis.failWith = null;
    clock = NOW + 29_999;
    await expect(guard.check(request('/api/v1/x', { ip: '203.0.113.9' }))).resolves.toEqual({
      kind: 'allow',
    });
    expect(redis.calls.length).toBe(callsAfterFailure);
    expect(limiters.apiv1.limit.mock.calls.length).toBe(limiterCallsAfterFailure);

    await redis.zadd(BAN_KEYS.ip, { score: PERMANENT_BAN_SCORE, member: '203.0.113.9' });
    clock = NOW + 30_000;
    await expect(guard.check(request('/api/v1/x', { ip: '203.0.113.9' }))).resolves.toEqual({
      kind: 'ban',
    });
  });

  it('reports once per cooldown, however many lookups fail', async () => {
    redis.failWith = new Error('fetch failed');
    const guard = guardWith({ cooldownMs: 30_000, failureThreshold: 1 });
    await Promise.all(
      ['203.0.113.1', '203.0.113.2', '203.0.113.3'].map((ip) =>
        guard.check(request('/api/v1/x', { ip })),
      ),
    );
    expect(report).toHaveBeenCalledTimes(1);

    clock = NOW + 30_000;
    await guard.check(request('/api/v1/x', { ip: '203.0.113.4' }));
    expect(report).toHaveBeenCalledTimes(2);
  });

  it('allows when the backend itself cannot be created, and a failing reporter does not throw', async () => {
    const guard = createApiGuard({
      getBackend: () => {
        throw new Error('bad config');
      },
      now: () => clock,
    });
    await expect(guard.check(request('/api/v1/x', { ip: '203.0.113.9' }))).resolves.toEqual({
      kind: 'allow',
    });

    redis.failWith = new Error('fetch failed');
    const throwingReport = guardWith({
      failureThreshold: 1,
      report: () => {
        throw new Error('reporter down');
      },
    });
    await expect(
      throwingReport.check(request('/api/v1/x', { ip: '203.0.113.9' })),
    ).resolves.toEqual({ kind: 'allow' });
  });
});
