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
 * @file The admin ban store (banlist.ts, banlist-cidr.ts) against a fake Redis: sorted-set
 * entries scored by expiry, metadata that expires with temporary entries, normalized members,
 * pruning, and rethrowing Redis failures (the admin route turns them into 503). Also checks that
 * what the store writes is what the API guard enforces.
 */

import type { FakeRedis } from '@tests/fixtures/fake-redis';
import type { Redis } from '@upstash/redis';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/observability/report', () => ({ reportError: vi.fn() }));
vi.mock('@/classes/redis', async () => {
  const { FakeRedis } = await import('@tests/fixtures/fake-redis');
  return { redis: new FakeRedis() };
});

import { BaseError } from '@/classes/error';
import { redis as mockedRedis } from '@/classes/redis';
import { reportError } from '@/lib/observability/report';
import { createApiGuard, redisBanLookup } from '@/lib/security/api-guard';
import { BAN_KEYS, MAX_ACTIVE_CIDRS, PERMANENT_BAN_SCORE } from '@/lib/security/ban-keys';
import {
  banIp,
  getBanMetadata,
  getBannedIps,
  getSlowedIps,
  slowIp,
  unbanIp,
  unslowIp,
} from '@/lib/security/banlist';
import { banCidr, getBannedCidrs, unbanCidr } from '@/lib/security/banlist-cidr';
import type { Limiters } from '@/lib/security/rate-limit.types';

const redis = mockedRedis as unknown as FakeRedis;
const NOW = 1_800_000_000_000;

beforeEach(() => {
  redis.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('IP bans', () => {
  it('stores a temporary ban scored by its expiry, with metadata that expires with it', async () => {
    await banIp('203.0.113.7', 'spam', 3600, 'ops');

    expect(redis.zsetEntries(BAN_KEYS.ip)).toEqual([['203.0.113.7', NOW + 3_600_000]]);
    expect(redis.stringEntry(BAN_KEYS.meta('ip', '203.0.113.7'))).toEqual({
      value: { ts: NOW, expiresAt: NOW + 3_600_000, reason: 'spam', bannedBy: 'ops' },
      pxat: NOW + 3_600_000,
    });
  });

  it('stores a permanent ban with the permanent score and metadata without a TTL', async () => {
    await banIp('203.0.113.7');

    expect(redis.zsetEntries(BAN_KEYS.ip)).toEqual([['203.0.113.7', PERMANENT_BAN_SCORE]]);
    expect(redis.stringEntry(BAN_KEYS.meta('ip', '203.0.113.7'))).toEqual({
      value: { ts: NOW, expiresAt: null },
    });
  });

  it('turns a temporary ban into a permanent one, clearing the metadata TTL', async () => {
    await banIp('203.0.113.7', undefined, 60);
    await banIp('203.0.113.7');
    expect(redis.zsetEntries(BAN_KEYS.ip)).toEqual([['203.0.113.7', PERMANENT_BAN_SCORE]]);
    expect(redis.stringEntry(BAN_KEYS.meta('ip', '203.0.113.7'))?.pxat).toBeUndefined();
  });

  it('stores IPv6 in canonical form, so unban and metadata lookups match any spelling', async () => {
    await banIp('2001:DB8:0::1', 'scan');
    expect(redis.zsetEntries(BAN_KEYS.ip)).toEqual([['2001:db8::1', PERMANENT_BAN_SCORE]]);
    await expect(getBanMetadata('2001:db8:0:0::1')).resolves.toMatchObject({ reason: 'scan' });

    await unbanIp('2001:0db8::1');
    expect(redis.zsetEntries(BAN_KEYS.ip)).toEqual([]);
    expect(redis.stringEntry(BAN_KEYS.meta('ip', '2001:db8::1'))).toBeUndefined();
  });

  it('lists only active bans and prunes expired ones', async () => {
    await banIp('203.0.113.1', undefined, 60);
    await banIp('203.0.113.2');
    vi.setSystemTime(NOW + 61_000);

    await expect(getBannedIps()).resolves.toEqual(['203.0.113.2']);
    expect(redis.callsTo('zremrangebyscore')).toContainEqual([
      'zremrangebyscore',
      BAN_KEYS.ip,
      '-inf',
      NOW + 61_000,
    ]);
    expect(redis.zsetEntries(BAN_KEYS.ip)).toEqual([['203.0.113.2', PERMANENT_BAN_SCORE]]);
  });

  it('returns null metadata once a temporary ban has expired', async () => {
    await banIp('203.0.113.7', 'spam', 60);
    vi.setSystemTime(NOW + 60_001);
    redis.now = () => Date.now();
    await expect(getBanMetadata('203.0.113.7')).resolves.toBeNull();
  });

  it('rejects invalid IPs with a BaseError before touching Redis', async () => {
    for (const ip of ['not-an-ip', '999.1.1.1', '203.0.113.0/24', '']) {
      await expect(banIp(ip)).rejects.toBeInstanceOf(BaseError);
    }
    await expect(unbanIp('nope')).rejects.toBeInstanceOf(BaseError);
    await expect(getBanMetadata('nope')).rejects.toBeInstanceOf(BaseError);
    expect(redis.calls).toEqual([]);
  });

  it('ignores loopback addresses', async () => {
    await banIp('127.0.0.1');
    await slowIp('::1');
    expect(redis.calls).toEqual([]);
  });
});

describe('slow mode', () => {
  it('stores slowed IPs in their own sorted set, with an optional lifetime', async () => {
    await slowIp('198.51.100.10', 'abuse', 600, 'ops');
    expect(redis.zsetEntries(BAN_KEYS.slow)).toEqual([['198.51.100.10', NOW + 600_000]]);
    expect(redis.zsetEntries(BAN_KEYS.ip)).toEqual([]);
    expect(redis.stringEntry(BAN_KEYS.meta('slow', '198.51.100.10'))?.value).toMatchObject({
      reason: 'abuse',
      bannedBy: 'ops',
    });
    await expect(getSlowedIps()).resolves.toEqual(['198.51.100.10']);

    await unslowIp('198.51.100.10');
    await expect(getSlowedIps()).resolves.toEqual([]);
    expect(redis.stringEntry(BAN_KEYS.meta('slow', '198.51.100.10'))).toBeUndefined();
  });
});

describe('CIDR bans', () => {
  it('stores ranges with host bits cleared, so unban matches any form of the range', async () => {
    await banCidr('203.0.113.77/24', 'scanner', 3600, 'ops');
    expect(redis.zsetEntries(BAN_KEYS.cidr)).toEqual([['203.0.113.0/24', NOW + 3_600_000]]);
    expect(redis.stringEntry(BAN_KEYS.meta('cidr', '203.0.113.0/24'))?.value).toMatchObject({
      reason: 'scanner',
      bannedBy: 'ops',
      expiresAt: NOW + 3_600_000,
    });
    await expect(getBannedCidrs()).resolves.toEqual(['203.0.113.0/24']);

    await unbanCidr('203.0.113.9/24');
    await expect(getBannedCidrs()).resolves.toEqual([]);
  });

  it('stores IPv6 ranges canonically and drops expired ranges from the list', async () => {
    await banCidr('2001:DB8::/32');
    await banCidr('198.51.100.0/24', undefined, 1);
    vi.setSystemTime(NOW + 1_001);
    await expect(getBannedCidrs()).resolves.toEqual(['2001:db8::/32']);
  });

  it('refuses a new range once the guard would no longer read it, but still renews a listed one', async () => {
    for (let i = 0; i < MAX_ACTIVE_CIDRS; i++) {
      await redis.zadd(BAN_KEYS.cidr, {
        score: PERMANENT_BAN_SCORE,
        member: `10.${Math.floor(i / 256)}.${i % 256}.0/24`,
      });
    }
    await expect(banCidr('203.0.113.0/24')).rejects.toBeInstanceOf(BaseError);
    expect(redis.zsetEntries(BAN_KEYS.cidr)).toHaveLength(MAX_ACTIVE_CIDRS);

    // Re-banning a range already on the list doesn't add an entry, so it is allowed.
    await expect(banCidr('10.0.0.0/24', 'renewed', 60)).resolves.toBeUndefined();
    expect(redis.zsetEntries(BAN_KEYS.cidr)).toHaveLength(MAX_ACTIVE_CIDRS);
  });

  it('rejects invalid ranges with a BaseError before touching Redis', async () => {
    for (const cidr of ['203.0.113.7', '10.0.0.0/33', 'nope/8']) {
      await expect(banCidr(cidr)).rejects.toBeInstanceOf(BaseError);
    }
    await expect(unbanCidr('nope')).rejects.toBeInstanceOf(BaseError);
    expect(redis.calls).toEqual([]);
  });
});

describe('pruning expired entries', () => {
  const seedExpired = async () => {
    await banIp('203.0.113.1', undefined, 60);
    await slowIp('203.0.113.2', undefined, 60);
    await banCidr('198.51.100.0/24', undefined, 60);
    vi.setSystemTime(NOW + 61_000);
  };
  const remaining = () => ({
    ip: redis.zsetEntries(BAN_KEYS.ip).map(([member]) => member),
    slow: redis.zsetEntries(BAN_KEYS.slow).map(([member]) => member),
    cidr: redis.zsetEntries(BAN_KEYS.cidr).map(([member]) => member),
  });

  it.each([
    ['adding an entry to another list', () => banCidr('2001:db8::/32'), ['2001:db8::/32']],
    ['removing an unrelated entry', () => unbanIp('192.0.2.1'), []],
    ['listing another list', () => getBannedCidrs(), []],
  ])('deletes expired addresses from every list when %s', async (_label, run, cidr) => {
    await seedExpired();
    expect(remaining()).toEqual({
      ip: ['203.0.113.1'],
      slow: ['203.0.113.2'],
      cidr: ['198.51.100.0/24'],
    });
    await run();
    expect(remaining()).toEqual({ ip: [], slow: [], cidr });
  });
});

describe('Redis failures', () => {
  const failure = new Error('fetch failed');

  it.each([
    ['getBannedIps', () => getBannedIps()],
    ['getSlowedIps', () => getSlowedIps()],
    ['getBannedCidrs', () => getBannedCidrs()],
    ['getBanMetadata', () => getBanMetadata('203.0.113.7')],
    ['banIp', () => banIp('203.0.113.7')],
    ['unbanIp', () => unbanIp('203.0.113.7')],
    ['slowIp', () => slowIp('203.0.113.7')],
    ['unslowIp', () => unslowIp('203.0.113.7')],
    ['banCidr', () => banCidr('203.0.113.0/24')],
    ['unbanCidr', () => unbanCidr('203.0.113.0/24')],
  ])(
    '%s rethrows and reports the error instead of returning an empty result',
    async (_name, run) => {
      redis.failWith = failure;
      await expect(run()).rejects.toBe(failure);
      expect(reportError).toHaveBeenCalledWith(failure);
    },
  );
});

describe('store and guard together', () => {
  const allowAll: Limiters = {
    api: { limit: async () => ({ success: true, limit: 30, remaining: 29, reset: 0 }) },
    apiv1: { limit: async () => ({ success: true, limit: 60, remaining: 59, reset: 0 }) },
    auth: { limit: async () => ({ success: true, limit: 5, remaining: 4, reset: 0 }) },
    slow: { limit: async () => ({ success: true, limit: 1, remaining: 0, reset: 0 }) },
  };
  const guard = createApiGuard({
    getBackend: () => ({ bans: redisBanLookup(redis as unknown as Redis), limiters: allowAll }),
  });
  const check = (ip: string) =>
    guard.check(new Request('https://example.test/api/v1/blog', { headers: { 'x-real-ip': ip } }));

  it('enforces what the admin store writes, until it expires or is lifted', async () => {
    await banIp('203.0.113.7', 'spam', 60);
    await banCidr('2001:db8::/32');
    await expect(check('203.0.113.7')).resolves.toEqual({ kind: 'ban' });
    await expect(check('2001:db8::42')).resolves.toEqual({ kind: 'ban' });
    await expect(check('203.0.113.8')).resolves.toEqual({ kind: 'allow' });

    vi.setSystemTime(NOW + 60_001);
    await expect(check('203.0.113.7')).resolves.toEqual({ kind: 'allow' });

    await unbanCidr('2001:DB8::/32');
    await expect(check('2001:db8::42')).resolves.toEqual({ kind: 'allow' });
  });
});
