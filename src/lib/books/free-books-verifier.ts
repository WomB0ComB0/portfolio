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
 * @file Multi-layer Threat Intelligence, RDAP Domain-Age Drift, and Outsourced Delta Detonation
 * helpers for Free Programming Books:
 *   - Layer 1: Cloudflare Security DNS (1.1.1.2 DoH), Quad9 (9.9.9.9), abuse.ch URLhaus host feed,
 *     and optional Google Safe Browsing API v4.
 *   - Layer 2: RDAP domain-registration age check (flags <90-day re-registered/hijacked domains).
 *   - Targeted Layer 3: Outsourced sandbox detonation via urlscan.io or Cloudflare URL Scanner
 *     ONLY for newly added or drifted external URLs (zero untrusted JS executed in our CI).
 */

import dns from 'node:dns/promises';
import securityManifest from '@/data/free-books-security.json';

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface ThreatIntelVerdict {
  readonly hostname: string;
  readonly blocked: boolean;
  readonly provider: string | null;
  readonly reason: string | null;
}

export interface UrlBaselineFingerprint {
  readonly finalHost: string;
  readonly contentType: string;
  readonly rdapRegisteredAt?: string | null;
  readonly checkedAt: string;
}

export interface DeltaDetonationRecord {
  readonly provider: 'urlscan.io' | 'cloudflare-url-scanner';
  readonly verdict: 'submitted' | 'clean' | 'malicious';
  readonly reportUrl: string | null;
  readonly scannedAt: string;
}

export interface FreeBooksSecurityManifest {
  readonly generatedAt: string;
  readonly checkedHosts: number;
  readonly checkedUrls: number;
  /** Hostnames blocked by Cloudflare 1.1.1.2, Quad9, URLhaus, or Safe Browsing. */
  readonly blockedHosts: Readonly<Record<string, string>>;
  /** Specific URLs quarantined for drive-by payloads, PDF exploits, ClickFix, parking, or drift. */
  readonly quarantinedUrls: Readonly<Record<string, string>>;
  /** Specific URLs confirmed unavailable (404/410) across two passes. */
  readonly unavailableUrls: Readonly<Record<string, string>>;
  /** Baseline host/MIME/RDAP fingerprints used to detect silent domain takeover or PDF->HTML flips. */
  readonly urlFingerprints?: Readonly<Record<string, UrlBaselineFingerprint>>;
  /** Outsourced sandbox detonation submissions for newly added / drifted external domains. */
  readonly deltaDetonations?: Readonly<Record<string, DeltaDetonationRecord>>;
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
  readonly Answer?: readonly { readonly type?: number; readonly data?: string }[];
  readonly Comment?: string | readonly string[];
}

/**
 * Zero-key threat-intelligence DNSBL check for a single hostname:
 * 1. Optional pre-loaded URLhaus active malware host set (abuse.ch).
 * 2. Cloudflare Security DNS (1.1.1.2 via DoH JSON) — flags sinkholed 0.0.0.0 or EDE 15/16/17.
 * 3. Quad9 (9.9.9.9) — flags domains that resolve normally on default DNS but return NXDOMAIN
 *    on Quad9's aggregated 20+ malware/phishing threat feeds.
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
  const fetcher = options.fetcher ?? fetch;
  const host = hostname.toLowerCase().replace(/\.+$/, '');

  // 0. Threat-intel feed blocklist (HaGeZi TIF / OpenPhish / optional URLhaus) — O(1) lookup
  if (options.urlhausHosts?.has(host)) {
    return {
      hostname: host,
      blocked: true,
      provider: 'Threat Intel Feed (HaGeZi TIF / OpenPhish / URLhaus)',
      reason: 'threat_intel_feed_blocked_host',
    };
  }

  // 1. Cloudflare Security DNS (1.1.1.2 DoH JSON)
  try {
    const res = await fetcher(
      `${CLOUDFLARE_SECURITY_DOH}?name=${encodeURIComponent(host)}&type=A`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/dns-json',
          'User-Agent': USER_AGENT,
        },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (res.ok) {
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
      if (hasSinkhole || hasBlockComment) {
        return {
          hostname: host,
          blocked: true,
          provider: 'Cloudflare Security DNS (1.1.1.2)',
          reason: hasBlockComment ? `dnsbl_blocked:${comments.slice(0, 80)}` : 'dnsbl_sinkhole',
        };
      }
    }
  } catch {
    // Transient DoH failure never falsely quarantines a domain.
  }

  // 2. Quad9 Threat Intel DNS (only treat NXDOMAIN as a block when normal DNS resolved)
  if (options.domainResolvedNormally) {
    try {
      const resolver = new dns.Resolver({ timeout: timeoutMs, tries: 1 });
      resolver.setServers([QUAD9_DNS_SERVER]);
      await resolver.resolve4(host);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === 'ENOTFOUND' || code === 'NXDOMAIN') {
        return {
          hostname: host,
          blocked: true,
          provider: 'Quad9 Threat Intelligence (9.9.9.9)',
          reason: 'quad9_threat_blocked',
        };
      }
    }
  }

  return { hostname: host, blocked: false, provider: null, reason: null };
}

function parseHostsIntoSet(text: string, target: Set<string>): void {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('http://') || line.startsWith('https://')) {
      try {
        const parsed = new URL(line);
        const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
        if (host && host !== 'localhost') target.add(host);
      } catch {
        // Ignore unparseable feed entries.
      }
      continue;
    }
    // Supports both plain-domain lines (HaGeZi TIF) and hostfile format (`127.0.0.1 evil.example`)
    const parts = line.split(/\s+/);
    const host = (parts.length >= 2 ? parts[1] : parts[0])?.toLowerCase().replace(/\.+$/, '');
    if (host && host !== 'localhost' && host.includes('.')) {
      target.add(host);
    }
  }
}

/**
 * Downloads live zero-key malware/phishing host feeds (HaGeZi Threat Intelligence Feeds mini +
 * OpenPhish public feed) plus optional abuse.ch URLhaus when `authKey` is configured.
 * Fails open to whatever feeds succeed if any upstream feed is transiently unavailable.
 */
export async function loadUrlhausHostBlocklist(
  options: {
    readonly authKey?: string;
    readonly timeoutMs?: number;
    readonly fetcher?: FetchLike;
  } = {},
): Promise<ReadonlySet<string>> {
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

  await Promise.all(
    sources.map(async ({ url, headers }) => {
      try {
        const res = await fetcher(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) return;
        parseHostsIntoSet(await res.text(), hosts);
      } catch {
        // Fail open on transient feed fetch error.
      }
    }),
  );

  return hosts;
}

/**
 * Optional Google Safe Browsing API v4 batch lookup (runs when `GOOGLE_SAFE_BROWSING_API_KEY`
 * is provided). Returns a map of flagged URL -> threat type.
 */
export async function checkGoogleSafeBrowsing(
  urls: readonly string[],
  apiKey: string,
  options: { readonly timeoutMs?: number; readonly fetcher?: FetchLike } = {},
): Promise<Readonly<Record<string, string>>> {
  if (!apiKey || urls.length === 0) return {};
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const flagged: Record<string, string> = {};

  for (let i = 0; i < urls.length; i += 500) {
    const chunk = urls.slice(i, i + 500);
    try {
      const res = await fetcher(`${GOOGLE_SAFE_BROWSING_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
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
            threatEntries: chunk.map((url) => ({ url })),
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        readonly matches?: readonly {
          readonly threatType?: string;
          readonly threat?: { readonly url?: string };
        }[];
      };
      for (const match of json.matches ?? []) {
        const hitUrl = match.threat?.url;
        if (hitUrl) {
          flagged[hitUrl] = `google_safe_browsing:${match.threatType ?? 'THREAT'}`;
        }
      }
    } catch {
      // Ignore transient API failures.
    }
  }
  return flagged;
}

/** Extracts an approximate registrable apex domain (eTLD+1) for RDAP queries. */
function extractRegistrableDomain(hostname: string): string {
  const parts = hostname.toLowerCase().replace(/\.+$/, '').split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  // Handle common two-level public suffixes (co.uk, ac.uk, org.uk, com.au, edu.au, co.jp, com.br)
  if (/^(?:co|ac|org|gov|edu|com|net)\.[a-z]{2}$/.test(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
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
  const apex = extractRegistrableDomain(hostname);

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

/** Returns the committed, auditable free-books security & reachability manifest. */
export function getFreeBooksSecurityManifest(): FreeBooksSecurityManifest {
  return securityManifest as FreeBooksSecurityManifest;
}
