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
 * @file The network clients the weekly verify sweep asks about each host and URL:
 * - Threat feeds: HaGeZi's threat-intelligence domains and OpenPhish, plus abuse.ch URLhaus when
 *   URLHAUS_AUTH_KEY is set (loadUrlhausHostBlocklist).
 * - Cloudflare Security DNS (1.1.1.2 over DoH) and Quad9 (9.9.9.9) per host
 *   (checkHostnameThreatIntel).
 * - Google Safe Browsing v4 for URLs, when GOOGLE_SAFE_BROWSING_API_KEY is set.
 * - RDAP registration dates, to catch a domain re-registered in the last 90 days.
 * - Outsourced sandbox scans (Cloudflare URL Scanner or urlscan.io) for drifted external URLs
 *   only, so no third-party script runs on the CI runner.
 * A failed provider never blocks a host, and it is reported rather than read as "nothing found":
 * a feed that did not load, or answered a page that lists no valid host (threat-feed-parse.ts),
 * makes the feed load incomplete, a DNS check that did not answer (for Cloudflare, also a reply
 * whose DNS status is not NOERROR or NXDOMAIN, such as SERVFAIL) is left out of the verdict's
 * completedChecks, and a Safe Browsing batch that failed lists its URLs as unchecked, so the sweep
 * gives no clean run on them (host-checks.ts). Each client takes an injectable fetcher; only the
 * sweep (scripts/free-books/verify.ts) and the tests import this module, which uses node:dns.
 * Guarded by tests/unit/free-books/threat-intel.test.ts.
 */

import dns from 'node:dns/promises';
import { HOST_CHECK_PROVIDERS, type HostCheck } from './host-checks';
import { parseFeedHosts } from './threat-feed-parse';
import type { DeltaDetonationRecord, FetchLike } from './types';
import { registrableApex } from './url-screen';

export interface ThreatIntelVerdict {
  readonly hostname: string;
  readonly blocked: boolean;
  readonly provider: string | null;
  readonly reason: string | null;
  /**
   * The DNS checks (Cloudflare, Quad9) that answered for this host. One that failed, timed out or
   * was not asked is left out; the threat feeds' completeness comes from loadUrlhausHostBlocklist.
   */
  readonly completedChecks: readonly HostCheck[];
}

/** The threat-feed hosts, and whether every feed asked for loaded with at least one host. */
export interface ThreatFeedLoad {
  readonly hosts: ReadonlySet<string>;
  readonly complete: boolean;
}

/** What Safe Browsing said: the URLs it lists, with their threat type, and those it was not asked. */
export interface SafeBrowsingLookup {
  readonly matches: Readonly<Record<string, string>>;
  /** URLs in a batch that failed, timed out or answered an error: not checked this run. */
  readonly uncheckedUrls: readonly string[];
}

/** One DNS check's answer for a host: a block or none, and whether it answered at all. */
interface DnsCheckAnswer {
  readonly block: { readonly provider: string; readonly reason: string } | null;
  readonly completed: boolean;
}

const CLOUDFLARE_SECURITY_DOH = 'https://security.cloudflare-dns.com/dns-query';
const QUAD9_DNS_SERVER = '9.9.9.9';
const HAGEZI_TIF_FEED_URL =
  'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/tif.mini-onlydomains.txt';
const OPENPHISH_FEED_URL =
  'https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt';
const URLHAUS_HOSTFILE_URL = 'https://urlhaus.abuse.ch/downloads/hostfile/';
const GOOGLE_SAFE_BROWSING_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';
const RDAP_BOOTSTRAP_URL = 'https://rdap.org/domain/';
const SINKHOLE_IPS = new Set(['0.0.0.0', '::', '0:0:0:0:0:0:0:0']);
const NEW_DOMAIN_AGE_DAYS = 90;
const USER_AGENT = 'mikeodnis-portfolio-verifier/1.0 (+https://mikeodnis.dev)';

interface DohJsonResponse {
  /** The DNS response code: 0 is NOERROR, 2 SERVFAIL, 3 NXDOMAIN, 5 REFUSED. */
  readonly Status?: number;
  readonly Answer?: readonly { readonly type?: number; readonly data?: string }[];
  readonly Comment?: string | readonly string[];
}

/** DNS response codes that are a real answer about the name: NOERROR and NXDOMAIN. */
const DNS_ANSWERED_STATUSES: ReadonlySet<number> = new Set([0, 3]);

/**
 * Cloudflare Security DNS (1.1.1.2 over DoH JSON): a sinkholed 0.0.0.0 answer or an EDE 15/16/17
 * comment is a block, whatever the DNS status. With no block, the check completed only when the
 * reply's DNS status is NOERROR or NXDOMAIN. Any other status (SERVFAIL, REFUSED, or none at all),
 * an HTTP error, a timeout or a body that is not JSON never blocks a host; it leaves the check
 * incomplete.
 */
async function askCloudflareSecurityDns(
  host: string,
  fetcher: FetchLike,
  timeoutMs: number,
): Promise<DnsCheckAnswer> {
  try {
    const res = await fetcher(
      `${CLOUDFLARE_SECURITY_DOH}?name=${encodeURIComponent(host)}&type=A`,
      {
        method: 'GET',
        headers: { Accept: 'application/dns-json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) return { block: null, completed: false };
    const data = (await res.json()) as DohJsonResponse;
    const comments = Array.isArray(data.Comment)
      ? data.Comment.join(' ')
      : String(data.Comment ?? '');
    const hasSinkhole = (data.Answer ?? []).some(
      (ans) => ans.type === 1 && ans.data && SINKHOLE_IPS.has(ans.data.trim()),
    );
    const hasBlockComment = /\b(?:blocked|censored|ede\(15\)|ede\(16\)|ede\(17\))\b/i.test(
      comments,
    );
    if (!hasSinkhole && !hasBlockComment) {
      return { block: null, completed: DNS_ANSWERED_STATUSES.has(data.Status ?? -1) };
    }
    const reason = hasBlockComment ? `dnsbl_blocked:${comments.slice(0, 80)}` : 'dnsbl_sinkhole';
    return { block: { provider: HOST_CHECK_PROVIDERS.cloudflare, reason }, completed: true };
  } catch {
    return { block: null, completed: false };
  }
}

/**
 * Quad9 (9.9.9.9), asked only about a host that resolves normally: NXDOMAIN there is a block, an
 * address or "no data" is an answer with no block, and any other failure leaves it incomplete.
 */
async function askQuad9(host: string, timeoutMs: number): Promise<DnsCheckAnswer> {
  try {
    const resolver = new dns.Resolver({ timeout: timeoutMs, tries: 1 });
    resolver.setServers([QUAD9_DNS_SERVER]);
    await resolver.resolve4(host);
    return { block: null, completed: true };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOTFOUND' || code === 'NXDOMAIN') {
      return {
        block: { provider: HOST_CHECK_PROVIDERS.quad9, reason: 'quad9_threat_blocked' },
        completed: true,
      };
    }
    return { block: null, completed: code === 'ENODATA' };
  }
}

/**
 * Zero-key threat-intelligence DNSBL check for a single hostname, stopping at the first block:
 * 1. The threat-feed host set loaded once per sweep (HaGeZi, OpenPhish, optional URLhaus).
 * 2. Cloudflare Security DNS (1.1.1.2 via DoH JSON).
 * 3. Quad9 (9.9.9.9), for a domain that resolves normally on default DNS, against its aggregated
 *    malware and phishing feeds.
 * The verdict lists the DNS checks that answered, so the sweep can tell "no block" from "not
 * asked".
 */
export async function checkHostnameThreatIntel(
  hostname: string,
  options: {
    readonly timeoutMs?: number;
    readonly domainResolvedNormally?: boolean;
    readonly urlhausHosts?: ReadonlySet<string>;
    readonly fetcher?: FetchLike;
  } = {},
): Promise<ThreatIntelVerdict> {
  const timeoutMs = options.timeoutMs ?? 2500;
  const host = hostname.toLowerCase().replace(/\.+$/, '');
  const unblocked = { hostname: host, blocked: false, provider: null, reason: null };

  if (options.urlhausHosts?.has(host)) {
    return {
      hostname: host,
      blocked: true,
      provider: HOST_CHECK_PROVIDERS.threat_feeds,
      reason: 'threat_intel_feed_blocked_host',
      completedChecks: [],
    };
  }

  const cloudflare = await askCloudflareSecurityDns(host, options.fetcher ?? fetch, timeoutMs);
  const afterCloudflare: readonly HostCheck[] = cloudflare.completed ? ['cloudflare'] : [];
  if (cloudflare.block) {
    return { hostname: host, blocked: true, ...cloudflare.block, completedChecks: afterCloudflare };
  }
  if (!options.domainResolvedNormally) return { ...unblocked, completedChecks: afterCloudflare };

  const quad9 = await askQuad9(host, timeoutMs);
  const completedChecks: readonly HostCheck[] = quad9.completed
    ? [...afterCloudflare, 'quad9']
    : afterCloudflare;
  return quad9.block
    ? { hostname: host, blocked: true, ...quad9.block, completedChecks }
    : { ...unblocked, completedChecks };
}

/**
 * Downloads live zero-key malware/phishing host feeds (HaGeZi Threat Intelligence Feeds mini +
 * OpenPhish public feed) plus optional abuse.ch URLhaus when `authKey` is configured. Answers the
 * hosts of every feed that loaded, and `complete: false` when any feed failed, timed out or listed
 * no valid host (threat-feed-parse.ts: an HTML maintenance or placeholder page lists none), so a
 * host missing from the set is not taken as cleared.
 */
export async function loadUrlhausHostBlocklist(
  options: {
    readonly authKey?: string;
    readonly timeoutMs?: number;
    readonly fetcher?: FetchLike;
  } = {},
): Promise<ThreatFeedLoad> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const hosts = new Set<string>();

  const sources: Array<{ readonly url: string; readonly headers: Record<string, string> }> = [
    { url: HAGEZI_TIF_FEED_URL, headers: { 'User-Agent': USER_AGENT } },
    { url: OPENPHISH_FEED_URL, headers: { 'User-Agent': USER_AGENT } },
  ];
  if (options.authKey) {
    sources.push({
      url: URLHAUS_HOSTFILE_URL,
      headers: { 'User-Agent': USER_AGENT, 'Auth-Key': options.authKey },
    });
  }

  const loaded = await Promise.all(
    sources.map(async ({ url, headers }) => {
      try {
        const res = await fetcher(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) return false;
        const feedHosts = parseFeedHosts(await res.text());
        for (const host of feedHosts) hosts.add(host);
        return feedHosts.size > 0;
      } catch {
        // A feed that did not load blocks nothing; it makes the load incomplete.
        return false;
      }
    }),
  );

  return { hosts, complete: loaded.every(Boolean) };
}

/** URLs sent to Safe Browsing in one request. */
const SAFE_BROWSING_BATCH_SIZE = 500;

/**
 * One Safe Browsing request for `batch`: the URLs it lists with their threat type, or null when
 * the request failed, timed out, answered an error status or a body that is not JSON.
 */
async function lookupSafeBrowsingBatch(
  batch: readonly string[],
  apiKey: string,
  fetcher: FetchLike,
  timeoutMs: number,
): Promise<Record<string, string> | null> {
  try {
    const res = await fetcher(`${GOOGLE_SAFE_BROWSING_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify({
        client: { clientId: 'mikeodnis-portfolio', clientVersion: '1.0.0' },
        threatInfo: {
          threatTypes: [
            'MALWARE',
            'SOCIAL_ENGINEERING',
            'UNWANTED_SOFTWARE',
            'POTENTIALLY_HARMFUL_APPLICATION',
          ],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: batch.map((url) => ({ url })),
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      readonly matches?: readonly {
        readonly threatType?: string;
        readonly threat?: { readonly url?: string };
      }[];
    };
    const flagged: Record<string, string> = {};
    for (const match of json.matches ?? []) {
      const hitUrl = match.threat?.url;
      if (hitUrl) flagged[hitUrl] = `google_safe_browsing:${match.threatType ?? 'THREAT'}`;
    }
    return flagged;
  } catch {
    return null;
  }
}

/**
 * Optional Google Safe Browsing API v4 lookup in batches of 500 (runs when
 * `GOOGLE_SAFE_BROWSING_API_KEY` is provided). Answers the flagged URLs with their threat type,
 * and the URLs of every batch that could not be checked, so a failure never reads as "no match".
 */
export async function checkGoogleSafeBrowsing(
  urls: readonly string[],
  apiKey: string,
  options: { readonly timeoutMs?: number; readonly fetcher?: FetchLike } = {},
): Promise<SafeBrowsingLookup> {
  if (!apiKey) return { matches: {}, uncheckedUrls: [...urls] };
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  let matches: Record<string, string> = {};
  const uncheckedUrls: string[] = [];

  for (let i = 0; i < urls.length; i += SAFE_BROWSING_BATCH_SIZE) {
    const batch = urls.slice(i, i + SAFE_BROWSING_BATCH_SIZE);
    const flagged = await lookupSafeBrowsingBatch(batch, apiKey, fetcher, timeoutMs);
    if (flagged) matches = { ...matches, ...flagged };
    else uncheckedUrls.push(...batch);
  }
  return { matches, uncheckedUrls };
}

/**
 * Checks domain registration date via free RDAP (`rdap.org`) to spot expired-domain takeovers
 * (domains registered or re-registered within the last 90 days).
 */
export async function checkRdapDomainAge(
  hostname: string,
  options: {
    readonly timeoutMs?: number;
    readonly nowMs?: number;
    readonly fetcher?: FetchLike;
  } = {},
): Promise<{
  readonly registeredAt: string | null;
  readonly ageDays: number | null;
  readonly newlyRegistered: boolean;
}> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 4000;
  const nowMs = options.nowMs ?? Date.now();
  const apex = registrableApex(hostname);

  try {
    const res = await fetcher(`${RDAP_BOOTSTRAP_URL}${encodeURIComponent(apex)}`, {
      method: 'GET',
      headers: { Accept: 'application/rdap+json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { registeredAt: null, ageDays: null, newlyRegistered: false };
    const data = (await res.json()) as {
      readonly events?: readonly { readonly eventAction?: string; readonly eventDate?: string }[];
    };
    const regEvent = data.events?.find(
      (evt) => evt.eventAction?.toLowerCase() === 'registration' && evt.eventDate,
    );
    if (!regEvent?.eventDate) {
      return { registeredAt: null, ageDays: null, newlyRegistered: false };
    }
    const parsedMs = Date.parse(regEvent.eventDate);
    if (!Number.isFinite(parsedMs)) {
      return { registeredAt: null, ageDays: null, newlyRegistered: false };
    }
    const ageDays = Math.floor((nowMs - parsedMs) / (24 * 60 * 60 * 1000));
    return {
      registeredAt: new Date(parsedMs).toISOString(),
      ageDays,
      newlyRegistered: ageDays >= 0 && ageDays < NEW_DOMAIN_AGE_DAYS,
    };
  } catch {
    return { registeredAt: null, ageDays: null, newlyRegistered: false };
  }
}

/**
 * Targeted Layer 3: submits a single newly-added or drifted external URL to an outsourced
 * browser sandbox (Cloudflare URL Scanner or urlscan.io) so our CI runner never executes
 * untrusted third-party JS.
 */
export async function submitDeltaDetonation(
  url: string,
  options: {
    readonly cloudflareAccountId?: string;
    readonly cloudflareToken?: string;
    readonly urlscanApiKey?: string;
    readonly timeoutMs?: number;
    readonly fetcher?: FetchLike;
  },
): Promise<DeltaDetonationRecord | null> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const scannedAt = new Date().toISOString();

  if (options.cloudflareAccountId && options.cloudflareToken) {
    try {
      const res = await fetcher(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(options.cloudflareAccountId)}/urlscanner/v2/scan`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.cloudflareToken}`,
            'Content-Type': 'application/json',
            'User-Agent': USER_AGENT,
          },
          body: JSON.stringify({ url, visibility: 'Unlisted' }),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      if (res.ok) {
        const json = (await res.json()) as {
          readonly uuid?: string;
          readonly result?: { readonly uuid?: string };
        };
        const uuid = json.uuid ?? json.result?.uuid ?? null;
        return {
          provider: 'cloudflare-url-scanner',
          verdict: 'submitted',
          reportUrl: uuid ? `https://radar.cloudflare.com/scan/${uuid}` : null,
          scannedAt,
        };
      }
    } catch {
      // Fall through to urlscan.io if configured.
    }
  }

  if (options.urlscanApiKey) {
    try {
      const res = await fetcher('https://urlscan.io/api/v1/scan/', {
        method: 'POST',
        headers: {
          'API-Key': options.urlscanApiKey,
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({ url, visibility: 'unlisted' }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) {
        const json = (await res.json()) as { readonly result?: string };
        return {
          provider: 'urlscan.io',
          verdict: 'submitted',
          reportUrl: json.result ?? null,
          scannedAt,
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}
