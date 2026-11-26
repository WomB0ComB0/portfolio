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
 */

import { describe, expect, it } from 'vitest';
import {
  loadLiveSecurityManifestFromRedis,
  mergeSecurityManifests,
  publishSecurityManifestToRedis,
  REDIS_RUNTIME_MANIFEST_KEY,
} from '@/lib/free-books/manifest-store';
import { requestUrl } from './free-books-fixture';

describe('manifest store', () => {
  it('publishes, loads, and merges live Redis manifests over bundled baseline without regressing blocks', async () => {
    const store = new Map<string, string>();
    const mockFetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = requestUrl(input);
      if (init?.method === 'POST') {
        const [, key, value] = JSON.parse(String(init.body)) as [string, string, string];
        store.set(key, value);
        return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
      }
      const key = decodeURIComponent(url.split('/get/')[1] ?? '');
      return new Response(JSON.stringify({ result: store.get(key) ?? null }), { status: 200 });
    };

    const credentials = { url: 'https://redis.example.upstash.io', token: 'test-token' };
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
