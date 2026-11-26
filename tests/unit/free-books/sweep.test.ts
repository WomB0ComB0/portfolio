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
 * @file src/lib/free-books/sweep.ts, phase by phase on stubbed clients. These pin what the sweep
 * does today, including how it merges the Redis state, so a later behaviour fix shows up as a
 * deliberate test change. The two known bugs are todo cases until their own PRs.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  buildManifest,
  checkHosts,
  checkSafeBrowsing,
  detonateDeltas,
  hydrateBaseline,
  inspectFinalTarget,
  listTargets,
  probeUrls,
  type SweepDependencies,
  type SweepRecords,
  startRecords,
  summarize,
} from '@/lib/free-books/sweep';
import type {
  DeltaDetonationRecord,
  FreeBooksSecurityManifest,
  UrlBaselineFingerprint,
} from '@/lib/free-books/types';
import type { LinkObservation } from '@/lib/link-health/types';
import {
  EMPTY_MANIFEST,
  INDIE_GUIDE,
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

  it('lays the live Redis manifest over the committed one, replacing its records, and merges both drift records', async () => {
    const committed: FreeBooksSecurityManifest = {
      ...EMPTY_MANIFEST,
      checkedUrls: 5,
      quarantinedUrls: { [OLD_NOTES]: 'parked_domain' },
      urlFingerprints: { [RUST_BOOK]: fingerprint('doc.rust-lang.org', 'text/html') },
    };
    const live: FreeBooksSecurityManifest = {
      generatedAt: '2026-11-20T00:00:00.000Z',
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

    expect(existing).toEqual({
      ...live,
      urlFingerprints: {
        [RUST_BOOK]: fingerprint('doc.rust-lang.org', 'text/html'),
        [INDIE_GUIDE]: fingerprint('indie.example', 'text/html'),
      },
      deltaDetonations: { [INDIE_GUIDE]: detonation },
    });
  });

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

  it.todo(
    'carries a blocked host into the next run (today the block list starts empty each run, so a block lasts one cycle; fixed in its own PR)',
  );
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

  it('clears an earlier mark and fingerprints a reachable link that inspects clean', async () => {
    const records = startRecords({
      ...EMPTY_MANIFEST,
      unavailableUrls: { [INDIE_GUIDE]: '2026-11-22T05:17:00.000Z' },
      quarantinedUrls: { [INDIE_GUIDE]: 'parked_domain' },
    });

    const { deltaCandidates } = await probeAll({}, records);

    expect(records.unavailableUrls).toEqual({});
    expect(records.quarantinedUrls).toEqual({});
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

  it.todo(
    'keeps a Safe Browsing quarantine when that link then probes clean (today the probe deletes it in the same run; fixed in its own PR)',
  );
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

  it('finds nothing when the request fails', async () => {
    const result = await inspectFinalTarget(INDIE_GUIDE, 'indie.example', async () => {
      throw new TypeError('fetch failed');
    });

    expect(result).toEqual({ danger: null, finalHost: 'indie.example', contentType: '' });
  });
});
