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
 * @file src/lib/free-books/manifest-store.ts against an in-memory Upstash REST stand-in: a
 * published manifest reads back, and merging it over the committed one keeps both sets of blocks.
 * The sweep's strict reads throw on anything they cannot trust (no credentials, an error status,
 * a timeout, bad JSON or the wrong shape) and answer null only for a key that is not there.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadLiveSecurityManifestFromRedis,
  loadVerifierDriftStateFromRedis,
  mergeSecurityManifests,
  publishSecurityManifestToRedis,
  REDIS_FINGERPRINTS_KEY,
  REDIS_RUNTIME_MANIFEST_KEY,
  RedisReadError,
} from '@/lib/free-books/manifest-store';
import type { FetchLike, FreeBooksSecurityManifest } from '@/lib/free-books/types';
import { inMemoryRedis } from './sweep-fixture';

const CREDENTIALS = { url: 'https://redis.example.upstash.io', token: 'test-token' };

/** An Upstash GET that answers `body` (JSON-encoded unless it is already a string) with `status`. */
const answering =
  (body: unknown, status = 200): FetchLike =>
  async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('manifest store', () => {
  it('publishes, loads, and merges live Redis manifests over bundled baseline without regressing blocks', async () => {
    const { store, fetcher: mockFetch, credentials } = inMemoryRedis();
    const liveManifest = {
      generatedAt: '2026-11-26T00:00:00.000Z',
      checkedHosts: 1312,
      checkedUrls: 2506,
      blockedHosts: { 'newly-bad.example': 'Cloudflare: dnsbl_sinkhole' },
      quarantinedUrls: { 'https://parked.example/book': 'parked_domain' },
      unavailableUrls: { 'https://dead.example/404': '2026-11-26T00:00:00.000Z' },
      urlFingerprints: {
        'https://doc.rust-lang.org/book/': {
          finalHost: 'doc.rust-lang.org',
          contentType: 'text/html',
          checkedAt: '2026-11-26T00:00:00.000Z',
        },
      },
    };

    const pub = await publishSecurityManifestToRedis(liveManifest, {
      credentials,
      fetcher: mockFetch,
    });
    expect(pub).toEqual({ runtimePublished: true, fingerprintsPublished: true });
    expect(store.has(REDIS_RUNTIME_MANIFEST_KEY)).toBe(true);

    const loaded = await loadLiveSecurityManifestFromRedis({ credentials, fetcher: mockFetch });
    expect(loaded?.blockedHosts['newly-bad.example']).toContain('dnsbl_sinkhole');

    const bundled = {
      generatedAt: '2026-11-25T00:00:00.000Z',
      checkedHosts: 1312,
      checkedUrls: 0,
      blockedHosts: { 'git-blocked.example': 'Manual block' },
      quarantinedUrls: {},
      unavailableUrls: {},
    };
    const merged = mergeSecurityManifests(bundled, loaded);
    expect(merged.source).toBe('redis');
    expect(merged.manifest.blockedHosts).toEqual({
      'git-blocked.example': 'Manual block',
      'newly-bad.example': 'Cloudflare: dnsbl_sinkhole',
    });
    expect(merged.manifest.quarantinedUrls['https://parked.example/book']).toBe('parked_domain');
  });
});

describe('publishing both keys as one transaction', () => {
  const week = (generatedAt: string, streak: number): FreeBooksSecurityManifest => ({
    generatedAt,
    checkedHosts: 3,
    checkedUrls: 3,
    blockedHosts: {},
    quarantinedUrls: { 'https://indie.example/guide': 'parked_domain' },
    unavailableUrls: {},
    urlFingerprints: {},
    deltaDetonations: {},
    cleanStreaks: { hosts: {}, urls: { 'https://indie.example/guide': streak } },
  });

  it('leaves the previous manifest and drift state in place when the drift write fails', async () => {
    const redis = inMemoryRedis();
    await redis.clients.publish(week('2026-11-22T05:17:00.000Z', 1));
    const before = new Map(redis.store);
    redis.failWritesTo(REDIS_FINGERPRINTS_KEY);

    const result = await redis.clients.publish(week('2026-11-29T05:17:00.000Z', 0));

    expect(result).toEqual({ runtimePublished: false, fingerprintsPublished: false });
    expect(redis.store).toEqual(before);
  });

  it('keeps the 30-day expiry on both keys', async () => {
    const redis = inMemoryRedis();

    await redis.clients.publish(week('2026-11-22T05:17:00.000Z', 1));

    expect(Object.fromEntries(redis.ttls)).toEqual({
      [REDIS_RUNTIME_MANIFEST_KEY]: 30 * 24 * 60 * 60,
      [REDIS_FINGERPRINTS_KEY]: 30 * 24 * 60 * 60,
    });
  });

  it.each<{ readonly name: string; readonly fetcher: FetchLike; readonly saved: boolean[] }>([
    {
      name: 'a discarded transaction',
      fetcher: answering({ error: 'ERR transaction discarded' }, 400),
      saved: [false, false],
    },
    {
      name: 'a timeout',
      fetcher: async () => {
        throw new DOMException('The operation timed out.', 'TimeoutError');
      },
      saved: [false, false],
    },
    {
      name: 'an answer that is not a list',
      fetcher: answering({ result: 'OK' }),
      saved: [false, false],
    },
    {
      name: 'one command that failed inside the transaction',
      fetcher: answering([{ result: 'OK' }, { error: 'ERR invalid expire time' }]),
      saved: [true, false],
    },
  ])('reports what Upstash saved after $name', async ({ fetcher, saved }) => {
    const result = await publishSecurityManifestToRedis(week('2026-11-22T05:17:00.000Z', 1), {
      credentials: CREDENTIALS,
      fetcher,
    });

    expect([result.runtimePublished, result.fingerprintsPublished]).toEqual(saved);
  });
});

describe('strict reads for the sweep', () => {
  const strictLive = (fetcher: FetchLike) =>
    loadLiveSecurityManifestFromRedis({ credentials: CREDENTIALS, fetcher, strict: true });

  it('refuses to read without credentials, and never sends a request', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    const fetcher = vi.fn<FetchLike>(answering({ result: null }));

    await expect(loadLiveSecurityManifestFromRedis({ fetcher, strict: true })).rejects.toThrow(
      new RedisReadError(
        'live manifest',
        'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set',
      ),
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each<{ readonly name: string; readonly fetcher: FetchLike; readonly reason: string }>([
    { name: 'an error status', fetcher: answering({ error: 'boom' }, 500), reason: 'HTTP 500' },
    {
      name: 'a timeout',
      fetcher: async () => {
        throw new DOMException('The operation timed out.', 'TimeoutError');
      },
      reason: 'timed out',
    },
    {
      name: 'a network failure',
      fetcher: async () => {
        throw new TypeError('fetch failed');
      },
      reason: 'the request failed',
    },
    {
      name: 'a body that is not JSON',
      fetcher: answering('<html>'),
      reason: 'the response was not JSON',
    },
    {
      name: 'a body with no result',
      fetcher: answering({}),
      reason: 'the response had no stored value',
    },
    {
      name: 'a stored value that is not JSON',
      fetcher: answering({ result: '{not json' }),
      reason: 'the stored value is not JSON',
    },
    {
      name: 'a stored value of the wrong shape',
      fetcher: answering({
        result: JSON.stringify({
          generatedAt: '2026-11-22T05:17:00.000Z',
          checkedHosts: 1,
          checkedUrls: 1,
          blockedHosts: 5,
          quarantinedUrls: {},
          unavailableUrls: {},
        }),
      }),
      reason: 'the stored value has the wrong shape at blockedHosts',
    },
  ])('throws on $name', async ({ fetcher, reason }) => {
    const read = strictLive(fetcher);

    await expect(read).rejects.toBeInstanceOf(RedisReadError);
    await expect(read).rejects.toThrow(`could not read the live manifest from Redis (${reason})`);
  });

  it('answers null only when the key is not there', async () => {
    expect(await strictLive(answering({ result: null }))).toBeNull();
  });

  it('reads back a manifest and drift state the sweep published', async () => {
    const { store, fetcher, credentials } = inMemoryRedis();
    const cleanStreaks = { hosts: { 'indie.example': 1 }, urls: {} };
    await publishSecurityManifestToRedis(
      {
        generatedAt: '2026-11-22T05:17:00.000Z',
        checkedHosts: 3,
        checkedUrls: 3,
        blockedHosts: { 'indie.example': 'Quad9: quad9_blocked' },
        quarantinedUrls: {},
        unavailableUrls: {},
        urlFingerprints: {},
        deltaDetonations: {},
        cleanStreaks,
      },
      { credentials, fetcher },
    );

    const live = await loadLiveSecurityManifestFromRedis({ credentials, fetcher, strict: true });
    const drift = await loadVerifierDriftStateFromRedis({ credentials, fetcher, strict: true });
    // The strict reader drops keys it does not know, so check what was stored for the site.
    const storedRuntime: unknown = JSON.parse(store.get(REDIS_RUNTIME_MANIFEST_KEY) ?? 'null');

    expect(live?.blockedHosts).toEqual({ 'indie.example': 'Quad9: quad9_blocked' });
    expect(storedRuntime).toMatchObject({ blockedHosts: live?.blockedHosts });
    expect(storedRuntime).not.toHaveProperty('cleanStreaks');
    expect(drift).toEqual({ urlFingerprints: {}, deltaDetonations: {}, cleanStreaks });
  });

  it('throws on a drift state whose clean-run counts are not whole numbers', async () => {
    const fetcher = answering({
      result: JSON.stringify({
        urlFingerprints: {},
        deltaDetonations: {},
        cleanStreaks: { hosts: { 'indie.example': 'two' }, urls: {} },
      }),
    });

    await expect(
      loadVerifierDriftStateFromRedis({ credentials: CREDENTIALS, fetcher, strict: true }),
    ).rejects.toThrow(
      'could not read the drift state from Redis (the stored value has the wrong shape at cleanStreaks.hosts.indie.example)',
    );
  });

  it('keeps the site read fail-open: the same failures answer null without strict', async () => {
    const timeout: FetchLike = async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError');
    };
    const read = (fetcher: FetchLike) =>
      loadLiveSecurityManifestFromRedis({ credentials: CREDENTIALS, fetcher });

    expect(await read(answering({ error: 'boom' }, 500))).toBeNull();
    expect(await read(timeout)).toBeNull();
    expect(await read(answering('<html>'))).toBeNull();
    expect(await read(answering({ result: '{not json' }))).toBeNull();
  });
});
