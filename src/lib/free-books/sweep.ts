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

import 'server-only';

/**
 * @file The weekly free-books verify sweep, as phases that take their network, DNS, Redis and file
 * access injected (the link-health/scheduled.ts pattern). Only scripts/free-books/verify.ts
 * imports it, with the real clients; tests/unit/free-books/sweep.test.ts runs it on stubs. In
 * order:
 * 1. hydrateBaseline: the committed manifest (or an empty one) merged with the live Redis manifest
 *    the way the site merges them (mergeSecurityManifests), plus the drift state;
 * 2. listTargets: each link in the raw upstream catalog that passes the runtime gate (url-screen.ts),
 *    and its hosts;
 * 3. checkHosts: every host against the threat feeds, Cloudflare 1.1.1.2 and Quad9, noting which
 *    checks completed, then the blocks are settled against the baseline's (host-checks.ts,
 *    flag-policy.ts);
 * 4. checkSafeBrowsing: every link against Google Safe Browsing, when a key is set, noting the
 *    links of any batch that failed;
 * 5. probeUrls: two-pass reachability with probeLink, then inspectFinalTarget (target-inspection.ts)
 *    on each reachable link for dangerous content and drift; both are DNS-pinned in the CLI, and
 *    a hop that resolves to a non-public address quarantines the link;
 * 6. detonateDeltas: drifted external links sent to a sandbox, when asked for and keyed;
 * 7. settleFlags on the quarantines, then buildManifest and summarize: the sorted manifest (with
 *    the clean-run counts for the drift key) and the counts the CLI prints.
 *
 * The flag policy: the committed security-manifest.json holds the owner's pins, which the sweep
 * never lifts or fetches and always publishes. Everything else lives in the Redis overlay and is
 * checked again every run against the raw catalog. A flag is lifted after two runs in a row that
 * checked it and found it clean (flag-policy.ts); a run that could not check it gives no credit:
 * a host block whose check (feed, Cloudflare or Quad9) did not complete, a probe that was not
 * reachable, a content inspection that did not finish (its stored fingerprint is kept), a link
 * past --limit, --dnsbl-only, a link on a blocked host, a link whose Safe Browsing batch failed,
 * or a Safe Browsing flag in a run without the key or whose lookup failed (such a link is not
 * fetched either).
 */

import type { LinkObservation } from '@/lib/link-health/types';
import { type FlagObservation, type FlagSettlement, settleFlags } from './flag-policy';
import { type HostCheck, observeHost } from './host-checks';
import type { loadSweepCatalog } from './loader';
import {
  type loadLiveSecurityManifestFromRedis,
  type loadVerifierDriftStateFromRedis,
  mergeSecurityManifests,
  type publishSecurityManifestToRedis,
} from './manifest-store';
import { inspectFinalTarget } from './target-inspection';
import type {
  checkGoogleSafeBrowsing,
  checkHostnameThreatIntel,
  checkRdapDomainAge,
  loadUrlhausHostBlocklist,
  submitDeltaDetonation,
} from './threat-intel';
import type {
  DeltaDetonationRecord,
  FetchLike,
  FlagCleanStreaks,
  FreeBooksSecurityManifest,
  FreeProgrammingBooksCatalog,
  UrlBaselineFingerprint,
} from './types';
import { classifyHostTrustTier, screenExternalBookUrl } from './url-screen';

export { inspectFinalTarget, type TargetInspectionResult } from './target-inspection';

/** Hosts checked against DNS at once. */
const DNSBL_CONCURRENCY = 20;
/** Links probed at once. */
const PROBE_CONCURRENCY = 16;
/** The most links sent to a sandbox in one run. */
const MAX_DELTA_DETONATIONS_PER_RUN = 25;
/** How a Safe Browsing quarantine's reason starts (threat-intel.ts checkGoogleSafeBrowsing). */
const SAFE_BROWSING_REASON = 'google_safe_browsing:';

/** What the sweep needs from outside: the CLI passes the real clients, the tests pass stubs. */
export interface SweepDependencies {
  /** The committed manifest's text; a throw or bad JSON starts the sweep from an empty manifest. */
  readonly readManifest: () => string;
  readonly loadLiveManifest: typeof loadLiveSecurityManifestFromRedis;
  readonly loadDriftState: typeof loadVerifierDriftStateFromRedis;
  readonly publish: typeof publishSecurityManifestToRedis;
  /** The raw upstream catalog (no manifest applied), so flagged hosts and links are re-checked. */
  readonly loadCatalog: typeof loadSweepCatalog;
  readonly loadThreatFeeds: typeof loadUrlhausHostBlocklist;
  /** Whether a host resolves on the default resolver, so a Quad9 NXDOMAIN counts as a block. */
  readonly resolvesNormally: (hostname: string) => Promise<boolean>;
  readonly checkHost: typeof checkHostnameThreatIntel;
  readonly checkSafeBrowsing: typeof checkGoogleSafeBrowsing;
  readonly probe: (url: string) => Promise<LinkObservation>;
  /** The fetch inspectFinalTarget walks redirects with: the DNS-pinned one in the CLI. */
  readonly fetch: FetchLike;
  readonly checkDomainAge: typeof checkRdapDomainAge;
  readonly submitDetonation: typeof submitDeltaDetonation;
  /** The clock for the manifest and fingerprint dates; the real time when left out. */
  readonly now?: () => Date;
}

/** One run's flags and keys, which the CLI reads from its arguments and environment. */
export interface SweepOptions {
  readonly dryRun: boolean;
  readonly dnsblOnly: boolean;
  readonly shouldPublishRedis: boolean;
  readonly detonateDeltas: boolean;
  /** Probe only the first N links (`--limit=N`); 0 probes them all. */
  readonly maxUrls: number;
  readonly urlhausAuthKey?: string;
  readonly safeBrowsingApiKey?: string;
  readonly cloudflareAccountId?: string;
  readonly cloudflareToken?: string;
  readonly urlscanApiKey?: string;
}

/** A catalog link to probe: its normalised URL and its host. */
export interface SweepTarget {
  readonly url: string;
  readonly hostname: string;
}

/** The records the phases update in turn, starting from the hydrated baseline. */
export interface SweepRecords {
  readonly quarantinedUrls: Record<string, string>;
  readonly unavailableUrls: Record<string, string>;
  readonly urlFingerprints: Record<string, UrlBaselineFingerprint>;
  readonly deltaDetonations: Record<string, DeltaDetonationRecord>;
  /** Links Google Safe Browsing listed this run: they stay quarantined and are never fetched. */
  readonly safeBrowsingHits: Set<string>;
  /** Links in a keyed run whose Safe Browsing batch failed: they earn no clean run. */
  readonly safeBrowsingUnchecked: Set<string>;
  /** What this run saw for each link's quarantine; a link it did not check is not listed. */
  readonly urlObservations: Map<string, FlagObservation>;
}

/** The owner's pins: the committed manifest's blocks and quarantines, never lifted or fetched. */
export interface SweepPins {
  readonly blockedHosts: Readonly<Record<string, string>>;
  readonly quarantinedUrls: Readonly<Record<string, string>>;
}

/** The counts the CLI prints after a run. */
export interface SweepSummary {
  readonly checkedHosts: number;
  readonly checkedUrls: number;
  readonly urlhausFeedSize: number;
  readonly blockedHostsCount: number;
  readonly quarantinedUrlsCount: number;
  readonly quarantineBreakdown: Readonly<Record<string, number>>;
  readonly unavailableUrlsCount: number;
  readonly trackedFingerprintsCount: number;
  readonly deltaDetonationsCount: number;
  readonly redisPublished: boolean;
  readonly redisFingerprintsPublished: boolean;
  readonly dryRun: boolean;
}

type Log = (message: string) => void;
type RedisPublishResult = Awaited<ReturnType<typeof publishSecurityManifestToRedis>>;

/** Runs `worker` over `items`, at most `concurrency` at a time. */
async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) return;
      const item = items[idx];
      if (item !== undefined) {
        await worker(item);
      }
    }
  });
  await Promise.all(runners);
}

/** An empty manifest, for a committed one that cannot be read or parsed. */
const emptyManifest = (): FreeBooksSecurityManifest => ({
  generatedAt: new Date(0).toISOString(),
  checkedHosts: 0,
  checkedUrls: 0,
  blockedHosts: {},
  quarantinedUrls: {},
  unavailableUrls: {},
  urlFingerprints: {},
  deltaDetonations: {},
});

/** The committed manifest (the owner's pins), or an empty one when it cannot be read or parsed. */
function readCommittedManifest(readManifest: () => string): FreeBooksSecurityManifest {
  try {
    const parsed: unknown = JSON.parse(readManifest());
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as FreeBooksSecurityManifest)
      : emptyManifest();
  } catch {
    return emptyManifest();
  }
}

/** The owner's pins: the committed manifest's blocks and quarantines. */
export function readPins(readManifest: () => string): SweepPins {
  const committed = readCommittedManifest(readManifest);
  return {
    blockedHosts: { ...committed.blockedHosts },
    quarantinedUrls: { ...committed.quarantinedUrls },
  };
}

/**
 * The manifest the sweep starts from: the committed one (an empty one when it cannot be read or
 * parsed) merged with the live Redis manifest exactly as the site merges them
 * (mergeSecurityManifests: blocks and quarantines unite, unavailable links follow the newer one),
 * with both drift records merged in and the stored clean-run counts carried over. With `strict`
 * (a run that will publish), a Redis read it cannot trust throws instead of reading as "no state",
 * so the run never overwrites last week's overlay; a dry run reads leniently.
 */
export async function hydrateBaseline(
  deps: Pick<SweepDependencies, 'readManifest' | 'loadLiveManifest' | 'loadDriftState'>,
  { strict = false }: { readonly strict?: boolean } = {},
): Promise<FreeBooksSecurityManifest> {
  const committed = readCommittedManifest(deps.readManifest);
  // Consecutive CI runs share no files, so the previous run's state comes back from Redis.
  const [redisManifest, redisDrift] = await Promise.all([
    deps.loadLiveManifest({ strict }),
    deps.loadDriftState({ strict }),
  ]);
  return {
    ...mergeSecurityManifests(committed, redisManifest).manifest,
    urlFingerprints: {
      ...(committed.urlFingerprints ?? {}),
      ...(redisDrift?.urlFingerprints ?? {}),
    },
    deltaDetonations: {
      ...(committed.deltaDetonations ?? {}),
      ...(redisDrift?.deltaDetonations ?? {}),
    },
    ...(redisDrift?.cleanStreaks ? { cleanStreaks: redisDrift.cleanStreaks } : {}),
  };
}

/** The catalog links that pass the runtime gate, and their unique hosts sorted A to Z. */
export function listTargets(catalog: FreeProgrammingBooksCatalog): {
  readonly hostsList: readonly string[];
  readonly probeTargets: readonly SweepTarget[];
} {
  const uniqueHosts = new Set<string>();
  const probeTargets: SweepTarget[] = [];

  for (const book of catalog.books) {
    const verdict = screenExternalBookUrl(book.url);
    if (verdict.safe && verdict.hostname && verdict.normalizedUrl) {
      uniqueHosts.add(verdict.hostname);
      probeTargets.push({ url: verdict.normalizedUrl, hostname: verdict.hostname });
    }
  }

  return { hostsList: [...uniqueHosts].sort(), probeTargets };
}

/** This run's host checks: the hosts flagged, and the checks that completed for each host. */
export interface HostCheckResults {
  /** Each host flagged this run, as "provider: reason". */
  readonly blockedHosts: Readonly<Record<string, string>>;
  readonly completedChecks: ReadonlyMap<string, ReadonlySet<HostCheck>>;
  readonly threatFeedHosts: ReadonlySet<string>;
}

/**
 * Loads the threat feeds, then checks every host against them, Cloudflare 1.1.1.2 and Quad9.
 * Answers the hosts flagged this run and, per host, the checks that completed (the feeds count
 * only when every feed loaded); settleHostBlocks then carries them over the baseline's blocks.
 */
export async function checkHosts(
  hostsList: readonly string[],
  urlhausAuthKey: string | undefined,
  deps: Pick<SweepDependencies, 'loadThreatFeeds' | 'resolvesNormally' | 'checkHost'>,
  log: Log,
): Promise<HostCheckResults> {
  const blockedHosts: Record<string, string> = {};
  const completedChecks = new Map<string, ReadonlySet<HostCheck>>();

  log('Loading HaGeZi TIF + OpenPhish (+ optional URLhaus) threat-intel feeds...');
  const feeds = await deps.loadThreatFeeds({ authKey: urlhausAuthKey });
  log(`Loaded ${feeds.hosts.size} threat-intel hosts.`);
  if (!feeds.complete) log('A threat feed did not load; feed blocks get no clean run this time.');

  log(
    `Checking ${hostsList.length} unique hostnames against URLhaus + Cloudflare 1.1.1.2 + Quad9...`,
  );
  await runPool(hostsList, DNSBL_CONCURRENCY, async (hostname) => {
    const resolvedNormally = await deps.resolvesNormally(hostname);
    const verdict = await deps.checkHost(hostname, {
      domainResolvedNormally: resolvedNormally,
      urlhausHosts: feeds.hosts,
    });
    if (verdict.blocked) {
      blockedHosts[hostname] = `${verdict.provider}: ${verdict.reason}`;
    }
    const feedChecks: readonly HostCheck[] = feeds.complete ? ['threat_feeds'] : [];
    completedChecks.set(hostname, new Set([...feedChecks, ...verdict.completedChecks]));
  });

  return { blockedHosts, completedChecks, threatFeedHosts: feeds.hosts };
}

/**
 * The blocks that stand after this run's host checks: a host with a hit is flagged; one without
 * is clean only when the check behind its standing block completed (host-checks.ts), and
 * otherwise unchecked; settleFlags lifts a block after two clean runs in a row.
 */
export function settleHostBlocks(
  baseline: FreeBooksSecurityManifest,
  checks: Pick<HostCheckResults, 'blockedHosts' | 'completedChecks'>,
  hostsList: readonly string[],
  pins: SweepPins,
): FlagSettlement {
  const standing = baseline.blockedHosts;
  const observe = (host: string): FlagObservation =>
    observeHost(
      Object.hasOwn(checks.blockedHosts, host),
      Object.hasOwn(standing, host) ? standing[host] : undefined,
      checks.completedChecks.get(host) ?? new Set(),
    );
  return settleFlags({
    flags: { ...standing, ...checks.blockedHosts },
    observations: new Map(hostsList.map((host) => [host, observe(host)])),
    streaks: baseline.cleanStreaks?.hosts ?? {},
    pins: pins.blockedHosts,
    inCatalog: new Set(hostsList),
  });
}

/** Copies of the baseline's records, for the phases to update. */
export function startRecords(existing: FreeBooksSecurityManifest): SweepRecords {
  return {
    quarantinedUrls: { ...existing.quarantinedUrls },
    unavailableUrls: { ...existing.unavailableUrls },
    urlFingerprints: { ...(existing.urlFingerprints ?? {}) },
    deltaDetonations: { ...(existing.deltaDetonations ?? {}) },
    safeBrowsingHits: new Set(),
    safeBrowsingUnchecked: new Set(),
    urlObservations: new Map(),
  };
}

/** Quarantines `url` for `reason` and notes that this run flagged it. */
function quarantine(records: SweepRecords, url: string, reason: string): void {
  records.quarantinedUrls[url] = reason;
  records.urlObservations.set(url, 'flagged');
}

/**
 * Notes that this run checked `url` and found it clean, unless this run already flagged it or
 * its Safe Browsing lookup failed (then it stays unchecked).
 */
function markClean(records: SweepRecords, url: string): void {
  if (records.safeBrowsingUnchecked.has(url)) return;
  if (records.urlObservations.get(url) !== 'flagged') records.urlObservations.set(url, 'clean');
}

/**
 * Whether this run must not fetch `url` at all: an owner's pin, or a link quarantined by Safe
 * Browsing that this run could not ask about again, for want of a key or because its batch
 * failed (the content checks cannot clear such a flag).
 */
export function isHeldBack(
  url: string,
  records: Pick<SweepRecords, 'quarantinedUrls' | 'safeBrowsingUnchecked'>,
  pins: SweepPins,
  safeBrowsingApiKey: string | undefined,
): boolean {
  if (Object.hasOwn(pins.quarantinedUrls, url)) return true;
  const reason = Object.hasOwn(records.quarantinedUrls, url) ? records.quarantinedUrls[url] : '';
  const asked = Boolean(safeBrowsingApiKey) && !records.safeBrowsingUnchecked.has(url);
  return !asked && Boolean(reason?.startsWith(SAFE_BROWSING_REASON));
}

/**
 * With an API key, quarantines every link Google Safe Browsing flags, with its threat type, and
 * notes it as a hit so probeUrls never fetches it (the content checks cannot clear it). Links in a
 * batch that failed are noted as unchecked, so they earn no clean run.
 */
export async function checkSafeBrowsing(
  probeTargets: readonly SweepTarget[],
  apiKey: string | undefined,
  records: SweepRecords,
  deps: Pick<SweepDependencies, 'checkSafeBrowsing'>,
  log: Log,
): Promise<void> {
  if (!apiKey) return;
  log(`Checking ${probeTargets.length} URLs against Google Safe Browsing v4...`);
  const lookup = await deps.checkSafeBrowsing(
    probeTargets.map((t) => t.url),
    apiKey,
  );
  for (const [hitUrl, reason] of Object.entries(lookup.matches)) {
    quarantine(records, hitUrl, reason);
    records.safeBrowsingHits.add(hitUrl);
  }
  for (const url of lookup.uncheckedUrls) records.safeBrowsingUnchecked.add(url);
  if (lookup.uncheckedUrls.length > 0) {
    log(
      `Safe Browsing could not check ${lookup.uncheckedUrls.length} URLs; they get no clean run.`,
    );
  }
}

/** What probeUrls never fetches, as a catalog link or as a redirect hop. */
export interface ProbeExclusions {
  /** The blocks that stand after this run's host checks, the owner's pinned hosts among them. */
  readonly blockedHosts: Readonly<Record<string, string>>;
  /**
   * Whether a link is held back this run (isHeldBack): an owner's pin, or a Safe Browsing
   * quarantine the run could not ask about again.
   */
  readonly isHeldBack: (url: string) => boolean;
}

/**
 * Whether a redirect hop leads to a target this run will not fetch: a Safe Browsing hit, a link
 * held back (an owner's pin, or a Safe Browsing quarantine the run could not ask about again), or
 * a link on a blocked host. A hop that fails the URL screen is left to the redirect-chain audit,
 * which refuses it first.
 */
function excludedHopCheck(
  exclusions: ProbeExclusions,
  records: Pick<SweepRecords, 'safeBrowsingHits'>,
): (hopUrl: string) => boolean {
  return (hopUrl) => {
    const { normalizedUrl, hostname } = screenExternalBookUrl(hopUrl);
    if (!normalizedUrl || !hostname) return false;
    return (
      records.safeBrowsingHits.has(normalizedUrl) ||
      exclusions.isHeldBack(normalizedUrl) ||
      Object.hasOwn(exclusions.blockedHosts, hostname)
    );
  };
}

/**
 * Unless `dnsblOnly`, probes each link not on a blocked host and not a Safe Browsing hit this run
 * (the first `maxUrls` when set): a link missing on two probes is unavailable; a reachable one is
 * inspected, quarantined for dangerous content, a redirect to a target this run will not fetch
 * (excludedHopCheck), a PDF that turned into HTML, or a host that changed to a domain registered
 * in the last 90 days, and otherwise noted as clean (one clean run toward lifting an earlier
 * quarantine) and fingerprinted. A link it does not probe, that is not reachable, or whose
 * inspection did not finish is left unchecked, with its fingerprint as it was. An external link
 * whose host changed or whose PDF turned into HTML is queued for the sandbox (a new link is not).
 * Answers the URLs checked (the baseline's count when it probes nothing) and the queue.
 */
export async function probeUrls(
  probeTargets: readonly SweepTarget[],
  exclusions: ProbeExclusions,
  baselineCheckedUrls: number,
  records: SweepRecords,
  options: Pick<SweepOptions, 'dnsblOnly' | 'maxUrls'>,
  deps: Pick<SweepDependencies, 'probe' | 'fetch' | 'checkDomainAge' | 'now'>,
  log: Log,
): Promise<{ readonly checkedUrls: number; readonly deltaCandidates: readonly string[] }> {
  const { unavailableUrls, urlFingerprints } = records;
  let checkedUrls = baselineCheckedUrls;
  const deltaCandidates: string[] = [];
  if (options.dnsblOnly) return { checkedUrls, deltaCandidates };

  const targets = options.maxUrls > 0 ? probeTargets.slice(0, options.maxUrls) : probeTargets;
  log(`Probing ${targets.length} book URLs with SSRF-safe probe + PDF/ClickFix/drift scanners...`);
  checkedUrls = targets.length;
  const nowIso = (deps.now ?? (() => new Date()))().toISOString();
  const isExcludedHop = excludedHopCheck(exclusions, records);

  await runPool(targets, PROBE_CONCURRENCY, async ({ url, hostname }) => {
    if (exclusions.blockedHosts[hostname] || records.safeBrowsingHits.has(url)) return;

    const obs = await deps.probe(url);
    if (obs.kind === 'missing') {
      const second = await deps.probe(url);
      if (second.kind === 'missing') {
        unavailableUrls[url] = nowIso;
      }
      return;
    }

    if (obs.kind === 'reachable') {
      delete unavailableUrls[url];
      const inspected = await inspectFinalTarget(url, hostname, deps.fetch, isExcludedHop);
      if (inspected.danger) {
        quarantine(records, url, inspected.danger);
        return;
      }
      // An unfinished inspection checked nothing: no clean run, and the stored fingerprint stays.
      if (!inspected.complete) return;

      const prev = urlFingerprints[url];
      const hostChanged = Boolean(prev && prev.finalHost !== inspected.finalHost);
      const pdfFlippedToHtml = Boolean(
        prev &&
          prev.contentType === 'application/pdf' &&
          inspected.contentType.includes('text/html'),
      );

      if (pdfFlippedToHtml) {
        quarantine(records, url, `content_drift_pdf_to_html:${inspected.finalHost}`);
        if (classifyHostTrustTier(inspected.finalHost) === 'external') {
          deltaCandidates.push(url);
        }
        return;
      }

      let rdapRegisteredAt: string | null = prev?.rdapRegisteredAt ?? null;
      if ((hostChanged || !prev) && classifyHostTrustTier(inspected.finalHost) === 'external') {
        if (hostChanged) {
          const rdap = await deps.checkDomainAge(inspected.finalHost);
          rdapRegisteredAt = rdap.registeredAt;
          if (rdap.newlyRegistered) {
            quarantine(
              records,
              url,
              `domain_re_registered_drift:${inspected.finalHost}(${rdap.ageDays}d)`,
            );
            deltaCandidates.push(url);
            return;
          }
          deltaCandidates.push(url);
        }
      }

      markClean(records, url);
      urlFingerprints[url] = {
        finalHost: inspected.finalHost,
        contentType: inspected.contentType,
        rdapRegisteredAt,
        checkedAt: nowIso,
      };
    }
  });

  return { checkedUrls, deltaCandidates };
}

/**
 * With `--detonate-deltas`, outside a dry run, and with Cloudflare URL Scanner or urlscan.io
 * keys, sends up to 25 queued links (each once) to the sandbox and records each submission.
 */
export async function detonateDeltas(
  deltaCandidates: readonly string[],
  records: SweepRecords,
  options: Pick<
    SweepOptions,
    'detonateDeltas' | 'dryRun' | 'cloudflareAccountId' | 'cloudflareToken' | 'urlscanApiKey'
  >,
  deps: Pick<SweepDependencies, 'submitDetonation'>,
  log: Log,
): Promise<void> {
  const { cloudflareAccountId, cloudflareToken, urlscanApiKey } = options;
  if (
    !options.detonateDeltas ||
    options.dryRun ||
    deltaCandidates.length === 0 ||
    !((cloudflareAccountId && cloudflareToken) || urlscanApiKey)
  ) {
    return;
  }
  const batch = [...new Set(deltaCandidates)].slice(0, MAX_DELTA_DETONATIONS_PER_RUN);
  log(`Submitting ${batch.length} drifted external URL(s) to outsourced URL sandbox...`);
  for (const candidateUrl of batch) {
    const record = await deps.submitDetonation(candidateUrl, {
      cloudflareAccountId,
      cloudflareToken,
      urlscanApiKey,
    });
    if (record) {
      records.deltaDetonations[candidateUrl] = record;
    }
  }
}

/** A copy of `record` with its keys in A to Z order, so the published JSON diffs cleanly. */
function sortedRecord<T>(record: Readonly<Record<string, T>>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

/** The manifest this run publishes, every record sorted by key. */
export function buildManifest({
  generatedAt,
  checkedHosts,
  checkedUrls,
  blockedHosts,
  records,
  cleanStreaks,
}: {
  readonly generatedAt: string;
  readonly checkedHosts: number;
  readonly checkedUrls: number;
  readonly blockedHosts: Readonly<Record<string, string>>;
  readonly records: Pick<
    SweepRecords,
    'quarantinedUrls' | 'unavailableUrls' | 'urlFingerprints' | 'deltaDetonations'
  >;
  /** The clean-run counts, published only in the drift key. */
  readonly cleanStreaks?: FlagCleanStreaks;
}): FreeBooksSecurityManifest {
  return {
    generatedAt,
    checkedHosts,
    checkedUrls,
    blockedHosts: sortedRecord(blockedHosts),
    quarantinedUrls: sortedRecord(records.quarantinedUrls),
    unavailableUrls: sortedRecord(records.unavailableUrls),
    urlFingerprints: sortedRecord(records.urlFingerprints),
    deltaDetonations: sortedRecord(records.deltaDetonations),
    ...(cleanStreaks
      ? {
          cleanStreaks: {
            hosts: sortedRecord(cleanStreaks.hosts),
            urls: sortedRecord(cleanStreaks.urls),
          },
        }
      : {}),
  };
}

/** The counts the CLI prints, with quarantines broken down by reason (the text before `:`). */
export function summarize(
  manifest: FreeBooksSecurityManifest,
  threatFeedSize: number,
  redisPublishResult: RedisPublishResult | null,
  dryRun: boolean,
): SweepSummary {
  const quarantineBreakdown: Record<string, number> = {};
  for (const reason of Object.values(manifest.quarantinedUrls)) {
    const category = reason.split(':')[0] ?? reason;
    quarantineBreakdown[category] = (quarantineBreakdown[category] ?? 0) + 1;
  }

  return {
    checkedHosts: manifest.checkedHosts,
    checkedUrls: manifest.checkedUrls,
    urlhausFeedSize: threatFeedSize,
    blockedHostsCount: Object.keys(manifest.blockedHosts).length,
    quarantinedUrlsCount: Object.keys(manifest.quarantinedUrls).length,
    quarantineBreakdown,
    unavailableUrlsCount: Object.keys(manifest.unavailableUrls).length,
    trackedFingerprintsCount: Object.keys(manifest.urlFingerprints ?? {}).length,
    deltaDetonationsCount: Object.keys(manifest.deltaDetonations ?? {}).length,
    redisPublished: redisPublishResult?.runtimePublished ?? false,
    redisFingerprintsPublished: redisPublishResult?.fingerprintsPublished ?? false,
    dryRun,
  };
}

/**
 * One sweep, phase by phase. Publishes to Redis when asked, then prints the summary and returns
 * it, so the CLI can fail the run when a requested publish did not finish. It never writes the
 * committed manifest.
 */
export async function runSweep(
  options: SweepOptions,
  deps: SweepDependencies,
  log: Log,
): Promise<SweepSummary> {
  const now = deps.now ?? (() => new Date());
  const existing = await hydrateBaseline(deps, { strict: options.shouldPublishRedis });
  const pins = readPins(deps.readManifest);
  const catalog = await deps.loadCatalog();
  const { hostsList, probeTargets } = listTargets(catalog);
  const hostChecks = await checkHosts(hostsList, options.urlhausAuthKey, deps, log);
  const hosts = settleHostBlocks(existing, hostChecks, hostsList, pins);

  const records = startRecords(existing);
  await checkSafeBrowsing(probeTargets, options.safeBrowsingApiKey, records, deps, log);
  const heldBack = (url: string) => isHeldBack(url, records, pins, options.safeBrowsingApiKey);
  const { checkedUrls, deltaCandidates } = await probeUrls(
    probeTargets.filter(({ url }) => !heldBack(url)),
    { blockedHosts: hosts.flags, isHeldBack: heldBack },
    existing.checkedUrls,
    records,
    options,
    deps,
    log,
  );
  await detonateDeltas(deltaCandidates, records, options, deps, log);
  const urls = settleFlags({
    flags: records.quarantinedUrls,
    observations: records.urlObservations,
    streaks: existing.cleanStreaks?.urls ?? {},
    pins: pins.quarantinedUrls,
    inCatalog: new Set(probeTargets.map(({ url }) => url)),
  });

  const manifest = buildManifest({
    generatedAt: now().toISOString(),
    checkedHosts: hostsList.length,
    checkedUrls,
    blockedHosts: hosts.flags,
    records: { ...records, quarantinedUrls: urls.flags },
    cleanStreaks: { hosts: hosts.streaks, urls: urls.streaks },
  });
  const redisPublishResult = options.shouldPublishRedis ? await deps.publish(manifest) : null;
  const summary = summarize(
    manifest,
    hostChecks.threatFeedHosts.size,
    redisPublishResult,
    options.dryRun,
  );
  log(JSON.stringify(summary, null, 2));
  return summary;
}
