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
 * @file src/lib/free-books/sweep.ts, phase by phase on stubbed clients, then week by week on an
 * in-memory Redis: the baseline is merged the way the site merges it, flags carry over and are
 * lifted only after two clean runs that actually checked them, owner pins are never lifted or
 * fetched, a Safe Browsing hit is never fetched, and an inspection hop that resolves to a private
 * address quarantines its link. A behaviour change shows up as a deliberate test change.
 */

import { describe, expect, it, vi } from 'vitest';
import { mergeSecurityManifests } from '@/lib/free-books/manifest-store';
import { createPinnedFetch } from '@/lib/free-books/pinned-fetch';
import {
  buildManifest,
  checkHosts,
  checkSafeBrowsing,
  detonateDeltas,
  hydrateBaseline,
  inspectFinalTarget,
  listTargets,
  probeUrls,
  runSweep,
  type SweepDependencies,
  type SweepOptions,
  type SweepRecords,
  startRecords,
  summarize,
} from '@/lib/free-books/sweep';
import type {
  DeltaDetonationRecord,
  FreeBooksSecurityManifest,
  UrlBaselineFingerprint,
} from '@/lib/free-books/types';
import type { PinnedGetRequest, PinnedResponse } from '@/lib/link-health/transport';
import type { LinkObservation } from '@/lib/link-health/types';
import { runCli } from '../../../scripts/free-books/verify';
import {
  EMPTY_MANIFEST,
  INDIE_GUIDE,
  inMemoryRedis,
  OLD_NOTES,
  observed,
  pageResponse,
  RUST_BOOK,
  SWEEP_NOW,
  stubSweepDependencies,
  sweepCatalog,
} from './sweep-fixture';

const NOW_ISO = SWEEP_NOW.toISOString();
const TARGETS = listTargets(sweepCatalog()).probeTargets;

const fingerprint = (finalHost: string, contentType: string): UrlBaselineFingerprint => ({
  finalHost,
  contentType,
  checkedAt: '2026-11-22T05:17:00.000Z',
});

const redirectTo = (location: string): Response =>
  new Response(null, { status: 301, headers: { location } });

/** probeUrls over the three fixture links, on clients that find nothing unless overridden. */
async function probeAll(
  overrides: Partial<SweepDependencies>,
  records: SweepRecords = startRecords(EMPTY_MANIFEST),
  blockedHosts: Record<string, string> = {},
) {
  const deps = stubSweepDependencies(overrides);
  const result = await probeUrls(
    TARGETS,
    blockedHosts,
    0,
    records,
    { dnsblOnly: false, maxUrls: 0 },
    deps,
    vi.fn(),
  );
  return { ...result, records };
}

describe('hydrateBaseline', () => {
  it('starts from an empty manifest when the committed one cannot be read', async () => {
    const existing = await hydrateBaseline({
      readManifest: () => {
        throw new Error('ENOENT');
      },
      loadLiveManifest: async () => null,
      loadDriftState: async () => null,
    });

    expect(existing).toEqual({
      generatedAt: '1970-01-01T00:00:00.000Z',
      checkedHosts: 0,
      checkedUrls: 0,
      blockedHosts: {},
      quarantinedUrls: {},
      unavailableUrls: {},
      urlFingerprints: {},
      deltaDetonations: {},
    });
  });

  it.each([
    { label: 'an older', generatedAt: '2026-10-01T00:00:00.000Z' },
    { label: 'a newer', generatedAt: '2026-11-20T00:00:00.000Z' },
  ])(
    "builds the baseline with the site's merge, for $label live manifest, and merges both drift records",
    async ({ generatedAt }) => {
      const committed: FreeBooksSecurityManifest = {
        ...EMPTY_MANIFEST,
        checkedUrls: 5,
        blockedHosts: { 'git-blocked.example': 'Manual block' },
        quarantinedUrls: { [OLD_NOTES]: 'parked_domain' },
        unavailableUrls: { [RUST_BOOK]: '2026-10-30T00:00:00.000Z' },
        urlFingerprints: { [RUST_BOOK]: fingerprint('doc.rust-lang.org', 'text/html') },
      };
      const live: FreeBooksSecurityManifest = {
        generatedAt,
        checkedHosts: 9,
        checkedUrls: 7,
        blockedHosts: { 'bad.example': 'Cloudflare Security DNS (1.1.1.2): dnsbl_sinkhole' },
        quarantinedUrls: { [INDIE_GUIDE]: 'clickfix_lure' },
        unavailableUrls: {},
      };
      const detonation: DeltaDetonationRecord = {
        provider: 'urlscan.io',
        verdict: 'submitted',
        reportUrl: null,
        scannedAt: '2026-11-20T00:00:00.000Z',
      };

      const existing = await hydrateBaseline({
        readManifest: () => JSON.stringify(committed),
        loadLiveManifest: async () => live,
        loadDriftState: async () => ({
          urlFingerprints: { [INDIE_GUIDE]: fingerprint('indie.example', 'text/html') },
          deltaDetonations: { [INDIE_GUIDE]: detonation },
        }),
      });

      const { urlFingerprints, deltaDetonations, ...runtime } = existing;
      expect(runtime).toEqual(mergeSecurityManifests(committed, live).manifest);
      expect(urlFingerprints).toEqual({
        [RUST_BOOK]: fingerprint('doc.rust-lang.org', 'text/html'),
        [INDIE_GUIDE]: fingerprint('indie.example', 'text/html'),
      });
      expect(deltaDetonations).toEqual({ [INDIE_GUIDE]: detonation });
    },
  );

  it('merges only the drift records when Redis has no manifest', async () => {
    const committed: FreeBooksSecurityManifest = {
      ...EMPTY_MANIFEST,
      quarantinedUrls: { [OLD_NOTES]: 'parked_domain' },
    };

    const existing = await hydrateBaseline({
      readManifest: () => JSON.stringify(committed),
      loadLiveManifest: async () => null,
      loadDriftState: async () => ({
        urlFingerprints: { [INDIE_GUIDE]: fingerprint('indie.example', 'text/html') },
        deltaDetonations: {},
      }),
    });

    expect(existing).toEqual({
      ...committed,
      urlFingerprints: { [INDIE_GUIDE]: fingerprint('indie.example', 'text/html') },
    });
  });
});

describe('listTargets', () => {
  it('keeps the links that pass the runtime gate, with their unique hosts sorted A to Z', () => {
    const catalog = sweepCatalog();
    const [first] = catalog.books;
    if (!first) throw new Error('empty fixture catalog');
    const { hostsList, probeTargets } = listTargets({
      ...catalog,
      books: [
        ...catalog.books,
        { ...first, url: 'https://doc.rust-lang.org/std/' },
        { ...first, url: 'http://127.0.0.1/admin' },
      ],
    });

    expect(hostsList).toEqual(['doc.rust-lang.org', 'indie.example', 'old.example']);
    expect(probeTargets.map(({ url }) => url)).toEqual([
      RUST_BOOK,
      INDIE_GUIDE,
      OLD_NOTES,
      'https://doc.rust-lang.org/std/',
    ]);
  });
});

describe('checkHosts', () => {
  it('records each blocked host as "provider: reason", from feeds loaded once with the auth key', async () => {
    const feed = new Set(['indie.example']);
    const loadThreatFeeds = vi.fn<SweepDependencies['loadThreatFeeds']>(async () => feed);
    const resolvesNormally = vi.fn(async (hostname: string) => hostname !== 'old.example');
    const checkHost = vi.fn<SweepDependencies['checkHost']>(async (hostname) =>
      hostname === 'indie.example'
        ? {
            hostname,
            blocked: true,
            provider: 'Threat Intel Feed (HaGeZi TIF / OpenPhish / URLhaus)',
            reason: 'threat_intel_feed_blocked_host',
          }
        : { hostname, blocked: false, provider: null, reason: null },
    );
    const log = vi.fn();

    const { blockedHosts, threatFeedHosts } = await checkHosts(
      ['doc.rust-lang.org', 'indie.example', 'old.example'],
      'auth-key',
      { loadThreatFeeds, resolvesNormally, checkHost },
      log,
    );

    expect(loadThreatFeeds).toHaveBeenCalledWith({ authKey: 'auth-key' });
    expect(blockedHosts).toEqual({
      'indie.example':
        'Threat Intel Feed (HaGeZi TIF / OpenPhish / URLhaus): threat_intel_feed_blocked_host',
    });
    expect(threatFeedHosts).toBe(feed);
    expect(checkHost).toHaveBeenCalledWith('old.example', {
      domainResolvedNormally: false,
      urlhausHosts: feed,
    });
    expect(log.mock.calls.map(([message]) => message)).toEqual([
      'Loading HaGeZi TIF + OpenPhish (+ optional URLhaus) threat-intel feeds...',
      'Loaded 1 threat-intel hosts.',
      'Checking 3 unique hostnames against URLhaus + Cloudflare 1.1.1.2 + Quad9...',
    ]);
  });
});

describe('runSweep across weekly runs', () => {
  const SCHEDULED: SweepOptions = {
    dryRun: false,
    dnsblOnly: false,
    shouldPublishRedis: true,
    detonateDeltas: false,
    maxUrls: 0,
  };
  const PARKED = '<html><body>This domain is for sale</body></html>';
  const ACTIVE_PDF = '%PDF-1.7\n1 0 obj << /OpenAction << /S /JS >> >> endobj';
  const FEED_BLOCK = {
    blocked: true,
    provider: 'Threat Intel Feed (HaGeZi TIF / OpenPhish / URLhaus)',
    reason: 'threat_intel_feed_blocked_host',
  } as const;

  /** A checkHost that flags `flaggedHost` and passes every other host. */
  const flagging =
    (flaggedHost: string | null): SweepDependencies['checkHost'] =>
    async (hostname) =>
      hostname === flaggedHost
        ? { hostname, ...FEED_BLOCK }
        : { hostname, blocked: false, provider: null, reason: null };

  /**
   * A fetch that serves a page the inspection flags for `flaggedUrl` (parked HTML, or a PDF with
   * active content for a .pdf link) and a clean page for everything else.
   */
  const dangerousPage =
    (flaggedUrl: string | null): SweepDependencies['fetch'] =>
    async (input) => {
      if (flaggedUrl === null || String(input) !== flaggedUrl) return pageResponse();
      return flaggedUrl.endsWith('.pdf')
        ? pageResponse(ACTIVE_PDF, 'application/pdf')
        : pageResponse(PARKED);
    };

  /** Runs one week per entry on the same Redis, and answers the keys published after each. */
  async function weeks(
    redis: ReturnType<typeof inMemoryRedis>,
    runs: readonly {
      readonly options?: Partial<SweepOptions>;
      readonly deps?: Partial<SweepDependencies>;
    }[],
    field: 'blockedHosts' | 'quarantinedUrls',
  ): Promise<string[][]> {
    const after: string[][] = [];
    for (const run of runs) {
      await runSweep(
        { ...SCHEDULED, ...run.options },
        stubSweepDependencies({ ...redis.clients, ...run.deps }),
        vi.fn(),
      );
      after.push(Object.keys((await redis.clients.loadLiveManifest())?.[field] ?? {}));
    }
    return after;
  }

  it('carries a blocked host forward and lifts it only after two clean runs in a row', async () => {
    const redis = inMemoryRedis();

    const blocked = await weeks(
      redis,
      [
        { deps: { checkHost: flagging('indie.example') } },
        { deps: { checkHost: flagging(null) } },
        { deps: { checkHost: flagging(null) } },
      ],
      'blockedHosts',
    );

    expect(blocked).toEqual([['indie.example'], ['indie.example'], []]);
  });

  it('keeps the clean-run counts in the drift state, not in the manifest the site reads', async () => {
    const redis = inMemoryRedis();

    await weeks(
      redis,
      [
        { deps: { checkHost: flagging('indie.example'), fetch: dangerousPage(OLD_NOTES) } },
        { deps: { checkHost: flagging(null) } },
      ],
      'blockedHosts',
    );

    expect((await redis.clients.loadDriftState())?.cleanStreaks).toEqual({
      hosts: { 'indie.example': 1 },
      urls: { [OLD_NOTES]: 1 },
    });
    expect(await redis.clients.loadLiveManifest()).not.toHaveProperty('cleanStreaks');
  });

  it('lifts a quarantine only after two clean runs in a row', async () => {
    const redis = inMemoryRedis();

    const quarantined = await weeks(
      redis,
      [
        { deps: { fetch: dangerousPage(INDIE_GUIDE) } },
        { deps: { fetch: dangerousPage(null) } },
        { deps: { fetch: dangerousPage(null) } },
      ],
      'quarantinedUrls',
    );

    expect(quarantined).toEqual([[INDIE_GUIDE], [INDIE_GUIDE], []]);
  });

  it('a link flagged again resets its count', async () => {
    const redis = inMemoryRedis();

    const quarantined = await weeks(
      redis,
      [
        { deps: { fetch: dangerousPage(INDIE_GUIDE) } },
        { deps: { fetch: dangerousPage(null) } },
        { deps: { fetch: dangerousPage(INDIE_GUIDE) } },
        { deps: { fetch: dangerousPage(null) } },
        { deps: { fetch: dangerousPage(null) } },
      ],
      'quarantinedUrls',
    );

    expect(quarantined).toEqual([[INDIE_GUIDE], [INDIE_GUIDE], [INDIE_GUIDE], [INDIE_GUIDE], []]);
  });

  it('gives no credit in a run that could not check the link', async () => {
    const redis = inMemoryRedis();
    const temporaryForIndie: SweepDependencies['probe'] = async (url) =>
      observed(url === INDIE_GUIDE ? 'temporary' : 'reachable');

    const quarantined = await weeks(
      redis,
      [
        { deps: { fetch: dangerousPage(INDIE_GUIDE) } },
        { deps: { probe: temporaryForIndie } },
        { options: { maxUrls: 1 } },
        { options: { dnsblOnly: true } },
        {},
        {},
      ],
      'quarantinedUrls',
    );

    expect(quarantined).toEqual([
      [INDIE_GUIDE],
      [INDIE_GUIDE],
      [INDIE_GUIDE],
      [INDIE_GUIDE],
      [INDIE_GUIDE],
      [],
    ]);
  });

  it('drops a flag once its host or link has left the upstream catalog', async () => {
    const redis = inMemoryRedis();
    const onlyRust = async () => sweepCatalog([RUST_BOOK]);

    await weeks(
      redis,
      [{ deps: { checkHost: flagging('indie.example'), fetch: dangerousPage(OLD_NOTES) } }],
      'quarantinedUrls',
    );
    const before = await redis.clients.loadLiveManifest();
    await weeks(redis, [{ deps: { loadCatalog: onlyRust } }], 'quarantinedUrls');
    const after = await redis.clients.loadLiveManifest();

    expect(Object.keys(before?.blockedHosts ?? {})).toEqual(['indie.example']);
    expect(Object.keys(before?.quarantinedUrls ?? {})).toEqual([OLD_NOTES]);
    expect(after?.blockedHosts).toEqual({});
    expect(after?.quarantinedUrls).toEqual({});
    expect((await redis.clients.loadDriftState())?.cleanStreaks).toEqual({ hosts: {}, urls: {} });
  });

  it('never lifts or probes a pin the owner committed', async () => {
    const redis = inMemoryRedis();
    const pins = {
      ...EMPTY_MANIFEST,
      blockedHosts: { 'indie.example': 'Manual block' },
      quarantinedUrls: { [OLD_NOTES]: 'Manual quarantine' },
    };
    const probe = vi.fn(async (_url: string) => observed('reachable'));
    const run = { deps: { readManifest: () => JSON.stringify(pins), probe } };

    await weeks(redis, [run, run, run], 'blockedHosts');
    const live = await redis.clients.loadLiveManifest();

    expect(live?.blockedHosts).toEqual({ 'indie.example': 'Manual block' });
    expect(live?.quarantinedUrls).toEqual({ [OLD_NOTES]: 'Manual quarantine' });
    expect(probe.mock.calls.map(([url]) => url)).toEqual([RUST_BOOK, RUST_BOOK, RUST_BOOK]);
    expect((await redis.clients.loadDriftState())?.cleanStreaks).toEqual({ hosts: {}, urls: {} });
  });

  it('keeps a Safe Browsing flag, unprobed, in a run without the key; only keyed clean runs lift it', async () => {
    const redis = inMemoryRedis();
    const probe = vi.fn(async (_url: string) => observed('reachable'));
    const hit: Partial<SweepDependencies> = {
      probe,
      checkSafeBrowsing: async () => ({ [INDIE_GUIDE]: 'google_safe_browsing:MALWARE' }),
    };
    const keyed = { safeBrowsingApiKey: 'gsb-key' };

    const quarantined = await weeks(
      redis,
      [
        { options: keyed, deps: hit },
        { deps: { probe } },
        { deps: { probe } },
        { options: keyed, deps: { probe } },
        { options: keyed, deps: { probe } },
      ],
      'quarantinedUrls',
    );

    expect(quarantined).toEqual([[INDIE_GUIDE], [INDIE_GUIDE], [INDIE_GUIDE], [INDIE_GUIDE], []]);
    const indieProbes = probe.mock.calls.filter(([url]) => url === INDIE_GUIDE).length;
    expect(indieProbes).toBe(2);
  });

  it('refuses to run on an empty catalog, and leaves the overlay as it was', async () => {
    const redis = inMemoryRedis();
    await weeks(redis, [{ deps: { fetch: dangerousPage(INDIE_GUIDE) } }], 'quarantinedUrls');
    const before = [...redis.store.entries()];

    const code = await runCli({
      args: ['--publish-redis'],
      env: {},
      createDependencies: () =>
        stubSweepDependencies({
          ...redis.clients,
          loadCatalog: async () => {
            throw new Error(
              'the upstream langs list parsed to no books, so the catalog is incomplete',
            );
          },
        }),
      log: vi.fn(),
      error: vi.fn(),
    });

    expect(code).toBe(1);
    expect([...redis.store.entries()]).toEqual(before);
  });
});

describe('checkSafeBrowsing', () => {
  it('quarantines each link Safe Browsing flags with its threat type, and asks nothing without a key', async () => {
    const lookup = vi.fn<SweepDependencies['checkSafeBrowsing']>(async () => ({
      [INDIE_GUIDE]: 'google_safe_browsing:MALWARE',
    }));
    const records = startRecords(EMPTY_MANIFEST);

    await checkSafeBrowsing(TARGETS, undefined, records, { checkSafeBrowsing: lookup }, vi.fn());
    expect(lookup).not.toHaveBeenCalled();

    await checkSafeBrowsing(TARGETS, 'gsb-key', records, { checkSafeBrowsing: lookup }, vi.fn());
    expect(lookup).toHaveBeenCalledWith([RUST_BOOK, INDIE_GUIDE, OLD_NOTES], 'gsb-key');
    expect(records.quarantinedUrls).toEqual({ [INDIE_GUIDE]: 'google_safe_browsing:MALWARE' });
  });
});

describe('probeUrls', () => {
  it('marks a link unavailable only when two probes in a row find it missing', async () => {
    const answers: Record<string, LinkObservation['kind'][]> = {
      [RUST_BOOK]: ['missing', 'missing'],
      [INDIE_GUIDE]: ['missing', 'reachable'],
      [OLD_NOTES]: ['temporary'],
    };
    const probe = vi.fn(async (url: string) => observed(answers[url]?.shift() ?? 'unknown'));

    const { records, checkedUrls } = await probeAll({ probe });

    expect(records.unavailableUrls).toEqual({ [RUST_BOOK]: NOW_ISO });
    expect(records.urlFingerprints).toEqual({});
    expect(probe).toHaveBeenCalledTimes(5);
    expect(checkedUrls).toBe(3);
  });

  it('clears an earlier unavailable mark and fingerprints a reachable clean link, but one clean probe does not lift its quarantine', async () => {
    const records = startRecords({
      ...EMPTY_MANIFEST,
      unavailableUrls: { [INDIE_GUIDE]: '2026-11-22T05:17:00.000Z' },
      quarantinedUrls: { [INDIE_GUIDE]: 'parked_domain' },
    });

    const { deltaCandidates } = await probeAll({}, records);

    expect(records.unavailableUrls).toEqual({});
    // Lifting takes two clean runs in a row (settleFlags); this run only counts as one.
    expect(records.quarantinedUrls).toEqual({ [INDIE_GUIDE]: 'parked_domain' });
    expect(records.urlObservations.get(INDIE_GUIDE)).toBe('clean');
    expect(records.urlFingerprints[INDIE_GUIDE]).toEqual({
      finalHost: 'indie.example',
      contentType: 'text/html',
      rdapRegisteredAt: null,
      checkedAt: NOW_ISO,
    });
    // A new external link is fingerprinted, not sent to the sandbox.
    expect(deltaCandidates).toEqual([]);
  });

  it('quarantines a link whose page is dangerous, with the reason', async () => {
    const { records } = await probeAll({
      fetch: async (input) =>
        String(input) === INDIE_GUIDE
          ? pageResponse('<html><body>This domain is for sale</body></html>')
          : pageResponse(),
    });

    expect(records.quarantinedUrls).toEqual({ [INDIE_GUIDE]: 'parked_domain' });
    expect(records.urlFingerprints[INDIE_GUIDE]).toBeUndefined();
  });

  it('quarantines a PDF that now serves HTML, and queues its external host for the sandbox', async () => {
    const records = startRecords({
      ...EMPTY_MANIFEST,
      urlFingerprints: { [OLD_NOTES]: fingerprint('old.example', 'application/pdf') },
    });

    const { deltaCandidates } = await probeAll({}, records);

    expect(records.quarantinedUrls).toEqual({
      [OLD_NOTES]: 'content_drift_pdf_to_html:old.example',
    });
    expect(deltaCandidates).toEqual([OLD_NOTES]);
  });

  it('quarantines a link whose host moved to a domain registered under 90 days ago', async () => {
    const records = startRecords({
      ...EMPTY_MANIFEST,
      urlFingerprints: { [INDIE_GUIDE]: fingerprint('indie.example', 'text/html') },
    });
    const checkDomainAge = vi.fn<SweepDependencies['checkDomainAge']>(async () => ({
      registeredAt: '2026-11-01T00:00:00.000Z',
      ageDays: 28,
      newlyRegistered: true,
    }));

    const { deltaCandidates } = await probeAll(
      {
        fetch: async (input) =>
          String(input) === INDIE_GUIDE
            ? redirectTo('https://fresh.example/guide')
            : pageResponse(),
        checkDomainAge,
      },
      records,
    );

    expect(checkDomainAge).toHaveBeenCalledWith('fresh.example');
    expect(records.quarantinedUrls).toEqual({
      [INDIE_GUIDE]: 'domain_re_registered_drift:fresh.example(28d)',
    });
    expect(records.urlFingerprints[INDIE_GUIDE]).toEqual(fingerprint('indie.example', 'text/html'));
    expect(deltaCandidates).toEqual([INDIE_GUIDE]);
  });

  it('refingerprints a link whose host moved to an established domain, and still queues it', async () => {
    const records = startRecords({
      ...EMPTY_MANIFEST,
      urlFingerprints: { [INDIE_GUIDE]: fingerprint('indie.example', 'text/html') },
    });

    const { deltaCandidates } = await probeAll(
      {
        fetch: async (input) =>
          String(input) === INDIE_GUIDE
            ? redirectTo('https://moved.example/guide')
            : pageResponse(),
        checkDomainAge: async () => ({
          registeredAt: '2009-04-01T00:00:00.000Z',
          ageDays: 6086,
          newlyRegistered: false,
        }),
      },
      records,
    );

    expect(records.quarantinedUrls).toEqual({});
    expect(records.urlFingerprints[INDIE_GUIDE]).toEqual({
      finalHost: 'moved.example',
      contentType: 'text/html',
      rdapRegisteredAt: '2009-04-01T00:00:00.000Z',
      checkedAt: NOW_ISO,
    });
    expect(deltaCandidates).toEqual([INDIE_GUIDE]);
  });

  it('skips every link on a blocked host', async () => {
    const probe = vi.fn(async (_url: string) => observed('reachable'));

    await probeAll({ probe }, startRecords(EMPTY_MANIFEST), { 'indie.example': 'blocked' });

    expect(probe.mock.calls.map(([url]) => url)).toEqual([RUST_BOOK, OLD_NOTES]);
  });

  it('keeps a Safe Browsing quarantine when that link then probes clean', async () => {
    const records = startRecords(EMPTY_MANIFEST);
    await checkSafeBrowsing(
      TARGETS,
      'gsb-key',
      records,
      { checkSafeBrowsing: async () => ({ [INDIE_GUIDE]: 'google_safe_browsing:MALWARE' }) },
      vi.fn(),
    );
    const probe = vi.fn(async (_url: string) => observed('reachable'));

    await probeAll({ probe }, records);

    expect(records.quarantinedUrls).toEqual({ [INDIE_GUIDE]: 'google_safe_browsing:MALWARE' });
    expect(probe.mock.calls.map(([url]) => url)).not.toContain(INDIE_GUIDE);
  });
});

describe('detonateDeltas', () => {
  it('sends each queued link once, at most 25, and only when asked, keyed and not a dry run', async () => {
    const submitDetonation = vi.fn<SweepDependencies['submitDetonation']>(async (url) => ({
      provider: 'urlscan.io',
      verdict: 'submitted',
      reportUrl: `https://urlscan.io/result/${encodeURIComponent(url)}`,
      scannedAt: NOW_ISO,
    }));
    const queue = [
      INDIE_GUIDE,
      INDIE_GUIDE,
      ...Array.from({ length: 30 }, (_, i) => `https://drift-${i}.example/`),
    ];
    const records = startRecords(EMPTY_MANIFEST);
    const keyed = { detonateDeltas: true, dryRun: false, urlscanApiKey: 'scan-key' };
    const deps = { submitDetonation };

    await detonateDeltas(queue, records, { ...keyed, detonateDeltas: false }, deps, vi.fn());
    await detonateDeltas(queue, records, { ...keyed, dryRun: true }, deps, vi.fn());
    await detonateDeltas(
      queue,
      records,
      { detonateDeltas: true, dryRun: false, cloudflareAccountId: 'acct-1' },
      deps,
      vi.fn(),
    );
    expect(submitDetonation).not.toHaveBeenCalled();

    await detonateDeltas(queue, records, keyed, deps, vi.fn());
    expect(submitDetonation).toHaveBeenCalledTimes(25);
    expect(submitDetonation).toHaveBeenNthCalledWith(1, INDIE_GUIDE, {
      cloudflareAccountId: undefined,
      cloudflareToken: undefined,
      urlscanApiKey: 'scan-key',
    });
    expect(Object.keys(records.deltaDetonations)).toHaveLength(25);
  });
});

describe('buildManifest', () => {
  it('sorts every record by key, so the committed JSON diffs cleanly', () => {
    const records = startRecords({
      ...EMPTY_MANIFEST,
      quarantinedUrls: {
        'https://b.example/': 'parked_domain',
        'https://a.example/': 'clickfix_lure',
      },
      unavailableUrls: { 'https://d.example/': NOW_ISO, 'https://c.example/': NOW_ISO },
    });

    const manifest = buildManifest({
      generatedAt: NOW_ISO,
      checkedHosts: 2,
      checkedUrls: 4,
      blockedHosts: { 'z.example': 'x', 'y.example': 'y' },
      records,
    });

    expect(Object.keys(manifest.blockedHosts)).toEqual(['y.example', 'z.example']);
    expect(Object.keys(manifest.quarantinedUrls)).toEqual([
      'https://a.example/',
      'https://b.example/',
    ]);
    expect(Object.keys(manifest.unavailableUrls)).toEqual([
      'https://c.example/',
      'https://d.example/',
    ]);
    expect(manifest).toMatchObject({ generatedAt: NOW_ISO, checkedHosts: 2, checkedUrls: 4 });
  });
});

describe('summarize', () => {
  it('breaks quarantines down by the reason before the colon, and reports no publish as false', () => {
    const manifest: FreeBooksSecurityManifest = {
      ...EMPTY_MANIFEST,
      checkedHosts: 3,
      checkedUrls: 3,
      quarantinedUrls: {
        'https://a.example/': 'parked_domain',
        'https://b.example/': 'content_drift_pdf_to_html:b.example',
        'https://c.example/': 'content_drift_pdf_to_html:c.example',
      },
    };

    expect(summarize(manifest, 12, null, true)).toEqual({
      checkedHosts: 3,
      checkedUrls: 3,
      urlhausFeedSize: 12,
      blockedHostsCount: 0,
      quarantinedUrlsCount: 3,
      quarantineBreakdown: { parked_domain: 1, content_drift_pdf_to_html: 2 },
      unavailableUrlsCount: 0,
      trackedFingerprintsCount: 0,
      deltaDetonationsCount: 0,
      redisPublished: false,
      redisFingerprintsPublished: false,
      dryRun: true,
    });
  });
});

describe('inspectFinalTarget', () => {
  it('asks for at most 1 MiB without following redirects, and flags a chain through three external domains', async () => {
    const fetcher = vi.fn<SweepDependencies['fetch']>(async (input) => {
      const url = String(input);
      if (url === 'https://hop1.example/a') return redirectTo('https://hop2.example/b');
      if (url === 'https://hop2.example/b') return redirectTo('https://hop3.example/c');
      return pageResponse();
    });

    const result = await inspectFinalTarget('https://hop1.example/a', 'hop1.example', fetcher);

    expect(result).toEqual({
      danger: 'tds_redirect_chain:3_external_domains',
      finalHost: 'hop2.example',
      contentType: '',
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://hop1.example/a',
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'mikeodnis-portfolio-verifier/1.0 (+https://mikeodnis.dev)',
          Range: 'bytes=0-1048575',
        },
      }),
    );
  });

  it('flags an executable download by its headers', async () => {
    const result = await inspectFinalTarget(INDIE_GUIDE, 'indie.example', async () =>
      pageResponse('MZ', 'application/x-msdownload'),
    );

    expect(result).toEqual({
      danger: 'dangerous_mime:application/x-msdownload',
      finalHost: 'indie.example',
      contentType: 'application/x-msdownload',
    });
  });

  it('flags active content in real PDF bytes, but not an HTML page behind a .pdf link', async () => {
    const activePdf = await inspectFinalTarget(OLD_NOTES, 'old.example', async () =>
      pageResponse('%PDF-1.7\n1 0 obj << /OpenAction << /S /JS >> >> endobj', 'application/pdf'),
    );
    const landingPage = await inspectFinalTarget(OLD_NOTES, 'old.example', async () =>
      pageResponse(),
    );

    expect(activePdf.danger).toContain('pdf_active_object');
    expect(activePdf.contentType).toBe('application/pdf');
    expect(landingPage).toEqual({
      danger: null,
      finalHost: 'old.example',
      contentType: 'text/html',
    });
  });

  describe('over the DNS-pinned fetch', () => {
    const METADATA_HOP = 'http://169.254.169.254.nip.io/latest/meta-data/';

    /** createPinnedFetch on injected DNS `answers` and a transport that always redirects there. */
    function pinned(answers: Readonly<Record<string, readonly string[]>>) {
      const resolve = vi.fn(async (host: string, _signal: AbortSignal) => answers[host] ?? []);
      const request = vi.fn(
        async (_target: PinnedGetRequest): Promise<PinnedResponse> => ({
          status: 302,
          headers: { location: METADATA_HOP },
          body: new Blob([]).stream(),
        }),
      );
      return { resolve, request, fetcher: createPinnedFetch({ resolve, request }) };
    }

    it('quarantines a link whose redirect resolves to a private address, and never connects there', async () => {
      const h = pinned({
        'indie.example': ['93.184.216.34'],
        '169.254.169.254.nip.io': ['169.254.169.254'],
      });

      const result = await inspectFinalTarget(INDIE_GUIDE, 'indie.example', h.fetcher);

      expect(result).toEqual({
        danger: 'unsafe_address:169.254.169.254.nip.io',
        finalHost: '169.254.169.254.nip.io',
        contentType: '',
      });
      expect(h.resolve.mock.calls.map(([host]) => host)).toEqual([
        'indie.example',
        '169.254.169.254.nip.io',
      ]);
      expect(h.request).toHaveBeenCalledOnce();
      expect(h.request.mock.calls[0]?.[0].url.href).toBe(INDIE_GUIDE);
    });

    it('quarantines a link whose own name now resolves to a private address (rebound after the probe)', async () => {
      const h = pinned({ 'indie.example': ['127.0.0.1'] });

      const result = await inspectFinalTarget(INDIE_GUIDE, 'indie.example', h.fetcher);

      expect(result.danger).toBe('unsafe_address:indie.example');
      expect(h.request).not.toHaveBeenCalled();
    });
  });

  it('refuses a reachable body in an encoding it cannot read, naming the encoding', async () => {
    const zstdPage = new Response('(zstd frame)', {
      status: 200,
      headers: { 'content-type': 'text/html', 'content-encoding': 'zstd' },
    });

    const result = await inspectFinalTarget(INDIE_GUIDE, 'indie.example', async () => zstdPage);

    expect(result).toEqual({
      danger: 'undecodable_content_encoding:zstd',
      finalHost: 'indie.example',
      contentType: 'text/html',
    });
  });

  it('finds nothing when the request fails', async () => {
    const result = await inspectFinalTarget(INDIE_GUIDE, 'indie.example', async () => {
      throw new TypeError('fetch failed');
    });

    expect(result).toEqual({ danger: null, finalHost: 'indie.example', contentType: '' });
  });
});
