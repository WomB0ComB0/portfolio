// @vitest-environment node

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
 * @file src/lib/free-books/sweep.ts week by week on an in-memory Redis, in runs where a check could
 * not finish: a host block earns a clean run only when the check behind it (the threat feeds,
 * Cloudflare 1.1.1.2 or Quad9) completed, a hit still counts when another check failed, and a
 * link whose Safe Browsing lookup failed earns no clean run (a Safe Browsing quarantine among them
 * is not even fetched), and a content inspection that did not finish gives a link no clean run and
 * keeps its fingerprint. One case runs the real Cloudflare client on stubbed DoH replies, to show
 * that a SERVFAIL reply is not a completed check. The stored reasons are spelled out, as the
 * format the sweep keeps in Redis.
 */

import { describe, expect, it, vi } from 'vitest';
import type { SweepDependencies } from '@/lib/free-books/sweep';
import { checkHostnameThreatIntel } from '@/lib/free-books/threat-intel';
import type { FetchLike } from '@/lib/free-books/types';
import {
  INDIE_GUIDE,
  inMemoryRedis,
  OLD_NOTES,
  observed,
  pageResponse,
  RUST_BOOK,
  runWeeks,
  SWEEP_NOW,
} from './sweep-fixture';

const HOST = 'indie.example';
const PROVIDERS = {
  threat_feeds: 'Threat Intel Feed (HaGeZi TIF / OpenPhish / URLhaus)',
  cloudflare: 'Cloudflare Security DNS (1.1.1.2)',
  quad9: 'Quad9 Threat Intelligence (9.9.9.9)',
} as const;
type Check = keyof typeof PROVIDERS;
const EVERY_CHECK: readonly Check[] = ['threat_feeds', 'cloudflare', 'quad9'];

/** One week's host clients: HOST blocked by `blockedBy` (or by nothing), with only `completed` finishing. */
function hostWeek({
  blockedBy = null,
  completed = EVERY_CHECK,
}: {
  readonly blockedBy?: Check | null;
  readonly completed?: readonly Check[];
} = {}): Partial<SweepDependencies> {
  const dnsCompleted = completed.filter((check) => check !== 'threat_feeds');
  return {
    loadThreatFeeds: async () => ({
      hosts: new Set<string>(),
      complete: completed.includes('threat_feeds'),
    }),
    checkHost: async (hostname) =>
      hostname === HOST && blockedBy
        ? {
            hostname,
            blocked: true,
            provider: PROVIDERS[blockedBy],
            reason: 'test_block',
            completedChecks: dnsCompleted,
          }
        : { hostname, blocked: false, provider: null, reason: null, completedChecks: dnsCompleted },
  };
}

/**
 * One week's host check through the real Cloudflare client: 1.1.1.2 gives HOST `reply` over DoH
 * and every other host NOERROR. No host resolves normally, so Quad9 is never asked.
 */
function cloudflareWeek(reply: object): Partial<SweepDependencies> {
  const doh: FetchLike = async (input) =>
    Response.json(new URL(String(input)).searchParams.get('name') === HOST ? reply : { Status: 0 });
  return {
    resolvesNormally: async () => false,
    checkHost: (hostname, options) =>
      checkHostnameThreatIntel(hostname, { ...options, fetcher: doh }),
  };
}

describe('host blocks in a run where a check could not finish', () => {
  it.each(EVERY_CHECK)(
    'gives a block from %s no clean run when that check did not finish',
    async (check) => {
      const redis = inMemoryRedis();

      const blocked = await runWeeks(
        redis,
        [
          { deps: hostWeek({ blockedBy: check }) },
          { deps: hostWeek() },
          { deps: hostWeek({ completed: EVERY_CHECK.filter((other) => other !== check) }) },
          { deps: hostWeek() },
        ],
        'blockedHosts',
      );

      expect(blocked).toEqual([[HOST], [HOST], [HOST], []]);
    },
  );

  it('counts a clean run when only checks that did not raise the block failed', async () => {
    const redis = inMemoryRedis();

    const blocked = await runWeeks(
      redis,
      [
        { deps: hostWeek({ blockedBy: 'threat_feeds' }) },
        { deps: hostWeek({ completed: ['threat_feeds'] }) },
        { deps: hostWeek({ completed: ['threat_feeds', 'quad9'] }) },
      ],
      'blockedHosts',
    );

    expect(blocked).toEqual([[HOST], [HOST], []]);
  });

  it('needs every check for a block whose reason names no provider it knows', async () => {
    const redis = inMemoryRedis();
    await redis.clients.publish({
      generatedAt: '2026-11-22T05:17:00.000Z',
      checkedHosts: 3,
      checkedUrls: 3,
      blockedHosts: { [HOST]: 'An older blocklist: listed' },
      quarantinedUrls: {},
      unavailableUrls: {},
    });

    const blocked = await runWeeks(
      redis,
      [
        { deps: hostWeek({ completed: ['threat_feeds', 'cloudflare'] }) },
        { deps: hostWeek() },
        { deps: hostWeek() },
      ],
      'blockedHosts',
    );

    expect(blocked).toEqual([[HOST], [HOST], []]);
  });

  it('gives a Cloudflare block no clean run in a week 1.1.1.2 answered SERVFAIL', async () => {
    const redis = inMemoryRedis();

    const blocked = await runWeeks(
      redis,
      [
        { deps: cloudflareWeek({ Status: 0, Answer: [{ type: 1, data: '0.0.0.0' }] }) },
        { deps: cloudflareWeek({ Status: 2 }) },
        { deps: cloudflareWeek({ Status: 0 }) },
        { deps: cloudflareWeek({ Status: 0 }) },
      ],
      'blockedHosts',
    );

    expect(blocked).toEqual([[HOST], [HOST], [HOST], []]);
  });

  it('records a hit even when the other checks failed, which resets the count', async () => {
    const redis = inMemoryRedis();

    const blocked = await runWeeks(
      redis,
      [
        { deps: hostWeek({ blockedBy: 'cloudflare' }) },
        { deps: hostWeek() },
        { deps: hostWeek({ blockedBy: 'cloudflare', completed: ['cloudflare'] }) },
        { deps: hostWeek() },
        { deps: hostWeek() },
      ],
      'blockedHosts',
    );

    expect(blocked).toEqual([[HOST], [HOST], [HOST], [HOST], []]);
  });
});

describe('Safe Browsing in a run whose lookup could not finish', () => {
  const KEYED = { safeBrowsingApiKey: 'gsb-key' };
  const MALWARE = { [INDIE_GUIDE]: 'google_safe_browsing:MALWARE' };
  const EVERY_LINK = [RUST_BOOK, INDIE_GUIDE, OLD_NOTES];

  /** A Safe Browsing client that lists `matches` and could not check `uncheckedUrls`. */
  const lookup =
    (
      matches: Readonly<Record<string, string>> = {},
      uncheckedUrls: readonly string[] = [],
    ): SweepDependencies['checkSafeBrowsing'] =>
    async () => ({ matches, uncheckedUrls });

  it('keeps a Safe Browsing quarantine, unprobed, in a keyed run whose lookup failed', async () => {
    const redis = inMemoryRedis();
    const probe = vi.fn(async (_url: string) => observed('reachable'));

    const quarantined = await runWeeks(
      redis,
      [
        { options: KEYED, deps: { probe, checkSafeBrowsing: lookup(MALWARE) } },
        { options: KEYED, deps: { probe, checkSafeBrowsing: lookup() } },
        { options: KEYED, deps: { probe, checkSafeBrowsing: lookup({}, EVERY_LINK) } },
        { options: KEYED, deps: { probe, checkSafeBrowsing: lookup() } },
      ],
      'quarantinedUrls',
    );

    expect(quarantined).toEqual([[INDIE_GUIDE], [INDIE_GUIDE], [INDIE_GUIDE], []]);
    expect(probe.mock.calls.filter(([url]) => url === INDIE_GUIDE)).toHaveLength(2);
  });

  it('still inspects a link whose lookup failed, but gives it no clean run', async () => {
    const redis = inMemoryRedis();
    const parked: SweepDependencies['fetch'] = async (input) =>
      String(input) === INDIE_GUIDE
        ? pageResponse('<html><body>This domain is for sale</body></html>')
        : pageResponse();
    const clean = vi.fn<SweepDependencies['fetch']>(async () => pageResponse());

    const quarantined = await runWeeks(
      redis,
      [
        { options: KEYED, deps: { fetch: parked, checkSafeBrowsing: lookup() } },
        { options: KEYED, deps: { checkSafeBrowsing: lookup() } },
        { options: KEYED, deps: { fetch: clean, checkSafeBrowsing: lookup({}, EVERY_LINK) } },
        { options: KEYED, deps: { checkSafeBrowsing: lookup() } },
      ],
      'quarantinedUrls',
    );

    expect(quarantined).toEqual([[INDIE_GUIDE], [INDIE_GUIDE], [INDIE_GUIDE], []]);
    expect(clean.mock.calls.map(([input]) => String(input))).toContain(INDIE_GUIDE);
    const drift = await redis.clients.loadDriftState();
    expect(drift?.urlFingerprints[INDIE_GUIDE]?.checkedAt).toBe(SWEEP_NOW.toISOString());
  });
});

describe('content inspection in a run where it could not finish', () => {
  const PARKED = '<html><body>This domain is for sale</body></html>';

  /** A fetch that answers INDIE_GUIDE with `indie` and every other link with a clean page. */
  const serving =
    (indie: () => Promise<Response>): SweepDependencies['fetch'] =>
    async (input) =>
      String(input) === INDIE_GUIDE ? indie() : pageResponse();

  it.each<{ readonly name: string; readonly unfinished: () => Promise<Response> }>([
    {
      name: 'timed out',
      unfinished: async () => {
        throw new DOMException('The operation timed out.', 'TimeoutError');
      },
    },
    {
      name: 'answered an error status',
      unfinished: async () =>
        new Response('Service unavailable', {
          status: 503,
          headers: { 'content-type': 'text/plain' },
        }),
    },
  ])(
    'keeps a quarantine and its fingerprint when the inspection $name in what would have been its lifting week',
    async ({ unfinished }) => {
      const redis = inMemoryRedis();

      const quarantined = await runWeeks(
        redis,
        [
          { deps: { fetch: serving(async () => pageResponse(PARKED)) } },
          {},
          { deps: { fetch: serving(unfinished) } },
        ],
        'quarantinedUrls',
      );
      const drift = await redis.clients.loadDriftState();
      const nextWeek = await runWeeks(redis, [{}], 'quarantinedUrls');

      expect(quarantined).toEqual([[INDIE_GUIDE], [INDIE_GUIDE], [INDIE_GUIDE]]);
      expect(drift?.cleanStreaks?.urls).toEqual({ [INDIE_GUIDE]: 1 });
      expect(drift?.urlFingerprints[INDIE_GUIDE]?.contentType).toBe('text/html');
      expect(nextWeek).toEqual([[]]);
    },
  );
});
