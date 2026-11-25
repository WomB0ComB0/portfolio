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
 * @file Zero-key Threat Intelligence DNSBL & manifest loader for Free Programming Books.
 * Combines link-shortener's Cloudflare Security DNS (1.1.1.2 DoH) + Quad9 (9.9.9.9) DNSBL
 * verification with portfolio's fail-closed manifest design.
 */

import dns from 'node:dns/promises';
import securityManifest from '@/data/free-books-security.json';

export interface ThreatIntelVerdict {
  readonly hostname: string;
  readonly blocked: boolean;
  readonly provider: string | null;
  readonly reason: string | null;
}

export interface FreeBooksSecurityManifest {
  readonly generatedAt: string;
  readonly checkedHosts: number;
  readonly checkedUrls: number;
  /** Hostnames blocked by Cloudflare Security DNS (1.1.1.2) or Quad9 (9.9.9.9). */
  readonly blockedHosts: Readonly<Record<string, string>>;
  /** Specific URLs quarantined for drive-by payloads, parked domains, or cloaking. */
  readonly quarantinedUrls: Readonly<Record<string, string>>;
  /** Specific URLs confirmed unavailable (404/410) across two passes. */
  readonly unavailableUrls: Readonly<Record<string, string>>;
}

const CLOUDFLARE_SECURITY_DOH = 'https://security.cloudflare-dns.com/dns-query';
const QUAD9_DNS_SERVER = '9.9.9.9';
const SINKHOLE_IPS = new Set(['0.0.0.0', '::', '0:0:0:0:0:0:0:0']);

interface DohJsonResponse {
  readonly Answer?: readonly { readonly type?: number; readonly data?: string }[];
  readonly Comment?: string | readonly string[];
}

/**
 * Zero-key threat-intelligence DNSBL check for a single hostname:
 * 1. Cloudflare Security DNS (1.1.1.2 via DoH JSON) — flags sinkholed 0.0.0.0 or EDE 15/16/17.
 * 2. Quad9 (9.9.9.9) — flags domains that resolve normally on default DNS but return NXDOMAIN
 *    on Quad9's aggregated 20+ malware/phishing threat feeds.
 */
export async function checkHostnameThreatIntel(
  hostname: string,
  options: {
    readonly timeoutMs?: number;
    readonly domainResolvedNormally?: boolean;
    readonly fetcher?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  } = {},
): Promise<ThreatIntelVerdict> {
  const timeoutMs = options.timeoutMs ?? 2500;
  const fetcher = options.fetcher ?? fetch;
  const host = hostname.toLowerCase().replace(/\.+$/, '');

  // 1. Cloudflare Security DNS (1.1.1.2 DoH JSON)
  try {
    const res = await fetcher(
      `${CLOUDFLARE_SECURITY_DOH}?name=${encodeURIComponent(host)}&type=A`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/dns-json',
          'User-Agent': 'mikeodnis-portfolio-verifier/1.0 (+https://mikeodnis.dev)',
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

/** Returns the committed, auditable free-books security & reachability manifest. */
export function getFreeBooksSecurityManifest(): FreeBooksSecurityManifest {
  return securityManifest as FreeBooksSecurityManifest;
}
