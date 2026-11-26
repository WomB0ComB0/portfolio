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
 * 1. hydrateBaseline: the committed manifest (or an empty one), with the live Redis manifest and
 *    drift state laid over it;
 * 2. listTargets: each catalog link that passes the runtime gate (url-screen.ts), and its hosts;
 * 3. checkHosts: every host against the threat feeds, Cloudflare 1.1.1.2 and Quad9;
 * 4. checkSafeBrowsing: every link against Google Safe Browsing, when a key is set;
 * 5. probeUrls: two-pass reachability with probeLink, then inspectFinalTarget (target-inspection.ts)
 *    on each reachable link for dangerous content and drift; both are DNS-pinned in the CLI, and
 *    a hop that resolves to a non-public address quarantines the link;
 * 6. detonateDeltas: drifted external links sent to a sandbox, when asked for and keyed;
 * 7. buildManifest and summarize: the sorted manifest and the counts the CLI prints.
 * Two known bugs are kept as they are until their own PRs (todo cases in the test): a Safe
 * Browsing quarantine is deleted again in the same run when that link probes clean, and blocked
 * hosts start empty each run, so a block lasts one cycle.
 */

import type { LinkObservation } from '@/lib/link-health/types';
import type { loadFreeProgrammingBooks } from './loader';
import type {
  loadLiveSecurityManifestFromRedis,
  loadVerifierDriftStateFromRedis,
  publishSecurityManifestToRedis,
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

/** What the sweep needs from outside: the CLI passes the real clients, the tests pass stubs. */
export interface SweepDependencies {
  /** The committed manifest's text; a throw or bad JSON starts the sweep from an empty manifest. */
  readonly readManifest: () => string;
  readonly loadLiveManifest: typeof loadLiveSecurityManifestFromRedis;
  readonly loadDriftState: typeof loadVerifierDriftStateFromRedis;
  readonly publish: typeof publishSecurityManifestToRedis;
  readonly loadCatalog: typeof loadFreeProgrammingBooks;
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

/**
 * The manifest the sweep starts from: the committed one (an empty one when it cannot be read or
 * parsed), with the live Redis manifest laid over it and both drift records merged in. With no
 * Redis manifest, only the drift records are merged.
 */
export async function hydrateBaseline(
  deps: Pick<SweepDependencies, 'readManifest' | 'loadLiveManifest' | 'loadDriftState'>,
): Promise<FreeBooksSecurityManifest> {
  let existing: FreeBooksSecurityManifest = {
    generatedAt: new Date(0).toISOString(),
    checkedHosts: 0,
    checkedUrls: 0,
    blockedHosts: {},
    quarantinedUrls: {},
    unavailableUrls: {},
    urlFingerprints: {},
    deltaDetonations: {},
  };
  try {
    existing = JSON.parse(deps.readManifest()) as FreeBooksSecurityManifest;
  } catch {
    // Start fresh if manifest is missing.
  }

  // Consecutive CI runs share no files, so the previous run's state comes back from Redis.
  const [redisManifest, redisDrift] = await Promise.all([
    deps.loadLiveManifest(),
    deps.loadDriftState(),
  ]);
  if (redisManifest) {
    existing = {
      ...existing,
      ...redisManifest,
      urlFingerprints: {
        ...(existing.urlFingerprints ?? {}),
        ...(redisDrift?.urlFingerprints ?? {}),
      },
      deltaDetonations: {
        ...(existing.deltaDetonations ?? {}),
        ...(redisDrift?.deltaDetonations ?? {}),
      },
    };
  } else if (redisDrift) {
    existing = {
      ...existing,
      urlFingerprints: {
        ...(existing.urlFingerprints ?? {}),
        ...redisDrift.urlFingerprints,
      },
      deltaDetonations: {
        ...(existing.deltaDetonations ?? {}),
        ...redisDrift.deltaDetonations,
      },
    };
  }
  return existing;
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

/**
 * Loads the threat feeds, then checks every host against them, Cloudflare 1.1.1.2 and Quad9.
 * A blocked host is recorded as "provider: reason". The block list starts empty each run.
 */
export async function checkHosts(
  hostsList: readonly string[],
  urlhausAuthKey: string | undefined,
  deps: Pick<SweepDependencies, 'loadThreatFeeds' | 'resolvesNormally' | 'checkHost'>,
  log: Log,
): Promise<{
  readonly blockedHosts: Record<string, string>;
  readonly threatFeedHosts: ReadonlySet<string>;
}> {
  const blockedHosts: Record<string, string> = {};

  log('Loading HaGeZi TIF + OpenPhish (+ optional URLhaus) threat-intel feeds...');
  const urlhausHosts = await deps.loadThreatFeeds({ authKey: urlhausAuthKey });
  log(`Loaded ${urlhausHosts.size} threat-intel hosts.`);

  log(
    `Checking ${hostsList.length} unique hostnames against URLhaus + Cloudflare 1.1.1.2 + Quad9...`,
  );
  await runPool(hostsList, DNSBL_CONCURRENCY, async (hostname) => {
    const resolvedNormally = await deps.resolvesNormally(hostname);
    const verdict = await deps.checkHost(hostname, {
      domainResolvedNormally: resolvedNormally,
      urlhausHosts,
    });
    if (verdict.blocked) {
      blockedHosts[hostname] = `${verdict.provider}: ${verdict.reason}`;
    }
  });

  return { blockedHosts, threatFeedHosts: urlhausHosts };
}

/** Copies of the baseline's records, for the phases to update. */
export function startRecords(existing: FreeBooksSecurityManifest): SweepRecords {
  return {
    quarantinedUrls: { ...existing.quarantinedUrls },
    unavailableUrls: { ...existing.unavailableUrls },
    urlFingerprints: { ...(existing.urlFingerprints ?? {}) },
    deltaDetonations: { ...(existing.deltaDetonations ?? {}) },
  };
}

/** With an API key, quarantines every link Google Safe Browsing flags, with its threat type. */
export async function checkSafeBrowsing(
  probeTargets: readonly SweepTarget[],
  apiKey: string | undefined,
  records: SweepRecords,
  deps: Pick<SweepDependencies, 'checkSafeBrowsing'>,
  log: Log,
): Promise<void> {
  if (!apiKey) return;
  log(`Checking ${probeTargets.length} URLs against Google Safe Browsing v4...`);
  const gsbHits = await deps.checkSafeBrowsing(
    probeTargets.map((t) => t.url),
    apiKey,
  );
  for (const [hitUrl, reason] of Object.entries(gsbHits)) {
    records.quarantinedUrls[hitUrl] = reason;
  }
}

/**
 * Unless `dnsblOnly`, probes each link not on a blocked host (the first `maxUrls` when set): a
 * link missing on two probes is unavailable; a reachable one is inspected, quarantined for
 * dangerous content, a PDF that turned into HTML, or a host that changed to a domain registered
 * in the last 90 days, and otherwise un-quarantined and fingerprinted. An external link whose
 * host changed or whose PDF turned into HTML is queued for the sandbox (a new link is not).
 * Answers the URLs checked (the baseline's count when it probes nothing) and the queue.
 */
export async function probeUrls(
  probeTargets: readonly SweepTarget[],
  blockedHosts: Readonly<Record<string, string>>,
  baselineCheckedUrls: number,
  records: SweepRecords,
  options: Pick<SweepOptions, 'dnsblOnly' | 'maxUrls'>,
  deps: Pick<SweepDependencies, 'probe' | 'fetch' | 'checkDomainAge' | 'now'>,
  log: Log,
): Promise<{ readonly checkedUrls: number; readonly deltaCandidates: readonly string[] }> {
  const { quarantinedUrls, unavailableUrls, urlFingerprints } = records;
  let checkedUrls = baselineCheckedUrls;
  const deltaCandidates: string[] = [];
  if (options.dnsblOnly) return { checkedUrls, deltaCandidates };

  const targets = options.maxUrls > 0 ? probeTargets.slice(0, options.maxUrls) : probeTargets;
  log(`Probing ${targets.length} book URLs with SSRF-safe probe + PDF/ClickFix/drift scanners...`);
  checkedUrls = targets.length;
  const nowIso = (deps.now ?? (() => new Date()))().toISOString();

  await runPool(targets, PROBE_CONCURRENCY, async ({ url, hostname }) => {
    if (blockedHosts[hostname]) return;

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
      const inspected = await inspectFinalTarget(url, hostname, deps.fetch);
      if (inspected.danger) {
        quarantinedUrls[url] = inspected.danger;
        return;
      }

      const prev = urlFingerprints[url];
      const hostChanged = Boolean(prev && prev.finalHost !== inspected.finalHost);
      const pdfFlippedToHtml = Boolean(
        prev &&
          prev.contentType === 'application/pdf' &&
          inspected.contentType.includes('text/html'),
      );

      if (pdfFlippedToHtml) {
        quarantinedUrls[url] = `content_drift_pdf_to_html:${inspected.finalHost}`;
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
            quarantinedUrls[url] =
              `domain_re_registered_drift:${inspected.finalHost}(${rdap.ageDays}d)`;
            deltaCandidates.push(url);
            return;
          }
          deltaCandidates.push(url);
        }
      }

      delete quarantinedUrls[url];
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
}: {
  readonly generatedAt: string;
  readonly checkedHosts: number;
  readonly checkedUrls: number;
  readonly blockedHosts: Readonly<Record<string, string>>;
  readonly records: SweepRecords;
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
  const existing = await hydrateBaseline(deps);
  const catalog = await deps.loadCatalog();
  const { hostsList, probeTargets } = listTargets(catalog);
  const { blockedHosts, threatFeedHosts } = await checkHosts(
    hostsList,
    options.urlhausAuthKey,
    deps,
    log,
  );

  const records = startRecords(existing);
  await checkSafeBrowsing(probeTargets, options.safeBrowsingApiKey, records, deps, log);
  const { checkedUrls, deltaCandidates } = await probeUrls(
    probeTargets,
    blockedHosts,
    existing.checkedUrls,
    records,
    options,
    deps,
    log,
  );
  await detonateDeltas(deltaCandidates, records, options, deps, log);

  const manifest = buildManifest({
    generatedAt: now().toISOString(),
    checkedHosts: hostsList.length,
    checkedUrls,
    blockedHosts,
    records,
  });
  const redisPublishResult = options.shouldPublishRedis ? await deps.publish(manifest) : null;
  const summary = summarize(manifest, threatFeedHosts.size, redisPublishResult, options.dryRun);
  log(JSON.stringify(summary, null, 2));
  return summary;
}
