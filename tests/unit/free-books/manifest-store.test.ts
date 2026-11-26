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
  REDIS_RUNTIME_MANIFEST_KEY,
  RedisReadError,
} from '@/lib/free-books/manifest-store';
import type { FetchLike } from '@/lib/free-books/types';
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
    const { fetcher, credentials } = inMemoryRedis();
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

    expect(live?.blockedHosts).toEqual({ 'indie.example': 'Quad9: quad9_blocked' });
    expect(live).not.toHaveProperty('cleanStreaks');
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
