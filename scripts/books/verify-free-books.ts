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
 * Multi-layer security + reachability sweep for EbookFoundation/free-programming-books.
 *
 * Combines:
 *  - Layer 1 (Threat Intel): Cloudflare Security DNS (1.1.1.2 DoH) + Quad9 (9.9.9.9) +
 *    abuse.ch URLhaus active malware host feed + optional Google Safe Browsing API v4.
 *  - Layer 2 (Zero-Execution Static Scanners & Drift):
 *    * SSRF-safe, DNS-pinned 2-pass reachability probe (`probeLink`)
 *    * Manual redirect-chain auditing (blocks TDS >2 external hops or unsafe intermediate hops)
 *    * Raw PDF active-content & polyglot byte scan (`/JavaScript`, `/Launch`, `/OpenAction`, etc.)
 *    * Bounded 64 KiB HTML scan (parked domains, cross-origin meta-refresh, ClickFix lures,
 *      obfuscated inline script loaders, hidden 0x0 cross-origin iframes)
 *    * Baseline host/MIME drift + RDAP <90-day domain re-registration detection
 *  - Targeted Layer 3 (Outsourced Delta Detonation): submits ONLY newly-added or drifted external
 *    URLs to Cloudflare URL Scanner or urlscan.io when API credentials are configured (zero JS
 *    executed on our CI runner).
 *
 * Usage:
 *   bun --conditions=react-server run scripts/books/verify-free-books.ts --dry-run
 *   bun --conditions=react-server run scripts/books/verify-free-books.ts --dnsbl-only --write
 *   bun --conditions=react-server run scripts/books/verify-free-books.ts --write
 */

import dns from 'node:dns/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  checkGoogleSafeBrowsing,
  checkHostnameThreatIntel,
  checkRdapDomainAge,
  type DeltaDetonationRecord,
  type FreeBooksSecurityManifest,
  loadUrlhausHostBlocklist,
  submitDeltaDetonation,
  type UrlBaselineFingerprint,
} from '../../src/lib/books/free-books-verifier';
import { loadFreeProgrammingBooks } from '../../src/lib/books/free-programming-books';
import {
  classifyHostTrustTier,
  inspectHtmlSnippet,
  inspectPdfBytes,
  isDangerousResponseHeaders,
  isSuspiciousRedirectChain,
  screenExternalBookUrl,
} from '../../src/lib/books/url-security';
import { probeLink } from '../../src/lib/link-health/probe';

const MANIFEST_PATH = resolve(process.cwd(), 'src/data/free-books-security.json');
const DNSBL_CONCURRENCY = 20;
const PROBE_CONCURRENCY = 16;
const MAX_HTML_BYTES = 64 * 1024;
const MAX_PDF_SNIFF_BYTES = 1024 * 1024;
const MAX_DELTA_DETONATIONS_PER_RUN = 25;

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

async function resolveExists(hostname: string): Promise<boolean> {
  try {
    const addrs = await dns.resolve4(hostname);
    return addrs.length > 0;
  } catch {
    return false;
  }
}

async function readBoundedBytes(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = maxBytes - total;
      if (remaining <= 0) break;
      const slice = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      chunks.push(slice);
      total += slice.byteLength;
      if (total >= maxBytes) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

interface TargetInspectionResult {
  readonly danger: string | null;
  readonly finalHost: string;
  readonly contentType: string;
}

async function inspectFinalTarget(url: string, hostname: string): Promise<TargetInspectionResult> {
  const hops: string[] = [url];
  let currentUrl = url;
  let currentHost = hostname;

  try {
    for (let hop = 0; hop <= 5; hop += 1) {
      const res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(6000),
        headers: {
          'User-Agent': 'mikeodnis-portfolio-verifier/1.0 (+https://mikeodnis.dev)',
          Range: `bytes=0-${MAX_PDF_SNIFF_BYTES - 1}`,
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        await res.body?.cancel().catch(() => undefined);
        if (!loc) break;
        const nextUrl = new URL(loc, currentUrl).href;
        hops.push(nextUrl);
        const hopCheck = isSuspiciousRedirectChain(hops);
        if (hopCheck) {
          return { danger: hopCheck, finalHost: currentHost, contentType: '' };
        }
        currentUrl = nextUrl;
        currentHost = new URL(nextUrl).hostname.toLowerCase();
        continue;
      }

      const rawCt = res.headers.get('content-type') ?? '';
      const normalizedCt = rawCt.split(';')[0]?.trim().toLowerCase() ?? '';
      const headerDanger = isDangerousResponseHeaders(
        rawCt,
        res.headers.get('content-disposition'),
      );
      if (headerDanger) {
        await res.body?.cancel().catch(() => undefined);
        return { danger: headerDanger, finalHost: currentHost, contentType: normalizedCt };
      }

      if (res.ok && res.body) {
        if (normalizedCt === 'application/pdf' || /\.pdf(?:$|[?#])/i.test(currentUrl)) {
          const pdfBytes = await readBoundedBytes(res.body, MAX_PDF_SNIFF_BYTES);
          // Only inspect when server actually returned PDF bytes (avoid flagging HTML landing pages for .pdf links).
          if (pdfBytes.byteLength >= 5 && pdfBytes[0] === 0x25 && pdfBytes[1] === 0x50) {
            const pdfDanger = inspectPdfBytes(pdfBytes);
            if (pdfDanger) {
              return { danger: pdfDanger, finalHost: currentHost, contentType: 'application/pdf' };
            }
          }
          return { danger: null, finalHost: currentHost, contentType: normalizedCt };
        }

        if (normalizedCt.includes('text/html')) {
          const htmlBytes = await readBoundedBytes(res.body, MAX_HTML_BYTES);
          const html = new TextDecoder('utf-8', { fatal: false }).decode(htmlBytes);
          const inspection = inspectHtmlSnippet(html, currentHost);
          if (inspection.parked) {
            return { danger: 'parked_domain', finalHost: currentHost, contentType: normalizedCt };
          }
          if (inspection.clickFixLure) {
            return { danger: 'clickfix_lure', finalHost: currentHost, contentType: normalizedCt };
          }
          if (inspection.obfuscatedScript) {
            return {
              danger: 'obfuscated_inline_script',
              finalHost: currentHost,
              contentType: normalizedCt,
            };
          }
          if (inspection.hiddenCrossOriginIframe) {
            return {
              danger: 'hidden_cross_origin_iframe',
              finalHost: currentHost,
              contentType: normalizedCt,
            };
          }
          if (inspection.metaRefreshCrossOrigin) {
            const refreshVerdict = screenExternalBookUrl(inspection.metaRefreshCrossOrigin);
            if (!refreshVerdict.safe) {
              return {
                danger: `unsafe_meta_refresh:${refreshVerdict.blockReason ?? 'invalid'}`,
                finalHost: currentHost,
                contentType: normalizedCt,
              };
            }
          }
          return { danger: null, finalHost: currentHost, contentType: normalizedCt };
        }
      }

      await res.body?.cancel().catch(() => undefined);
      return { danger: null, finalHost: currentHost, contentType: normalizedCt };
    }
  } catch {
    // Ignore transient content-inspection errors; reachability probe handles status.
  }

  return { danger: null, finalHost: currentHost, contentType: '' };
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const dnsblOnly = args.has('--dnsbl-only');
  const shouldWrite = args.has('--write') && !dryRun;
  const detonateDeltas = args.has('--detonate-deltas');

  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const maxUrls = limitArg ? Number.parseInt(limitArg.split('=')[1] ?? '0', 10) : 0;

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
    existing = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as FreeBooksSecurityManifest;
  } catch {
    // Start fresh if manifest is missing.
  }

  const catalog = await loadFreeProgrammingBooks();
  const uniqueHosts = new Set<string>();
  const probeTargets: Array<{ url: string; hostname: string }> = [];

  for (const book of catalog.books) {
    const verdict = screenExternalBookUrl(book.url);
    if (verdict.safe && verdict.hostname && verdict.normalizedUrl) {
      uniqueHosts.add(verdict.hostname);
      probeTargets.push({ url: verdict.normalizedUrl, hostname: verdict.hostname });
    }
  }

  const hostsList = [...uniqueHosts].sort();
  const blockedHosts: Record<string, string> = {};

  console.log('Loading HaGeZi TIF + OpenPhish (+ optional URLhaus) threat-intel feeds...');
  const urlhausHosts = await loadUrlhausHostBlocklist({
    authKey: process.env.URLHAUS_AUTH_KEY?.trim(),
  });
  console.log(`Loaded ${urlhausHosts.size} threat-intel hosts.`);

  console.log(
    `Checking ${hostsList.length} unique hostnames against URLhaus + Cloudflare 1.1.1.2 + Quad9...`,
  );
  await runPool(hostsList, DNSBL_CONCURRENCY, async (hostname) => {
    const resolvedNormally = await resolveExists(hostname);
    const verdict = await checkHostnameThreatIntel(hostname, {
      domainResolvedNormally: resolvedNormally,
      urlhausHosts,
    });
    if (verdict.blocked) {
      blockedHosts[hostname] = `${verdict.provider}: ${verdict.reason}`;
    }
  });

  const quarantinedUrls: Record<string, string> = { ...existing.quarantinedUrls };
  const unavailableUrls: Record<string, string> = { ...existing.unavailableUrls };
  const urlFingerprints: Record<string, UrlBaselineFingerprint> = {
    ...(existing.urlFingerprints ?? {}),
  };
  const deltaDetonations: Record<string, DeltaDetonationRecord> = {
    ...(existing.deltaDetonations ?? {}),
  };

  // Optional Layer 1: Google Safe Browsing API v4 batch sweep when API key is configured.
  const gsbApiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY?.trim();
  if (gsbApiKey) {
    console.log(`Checking ${probeTargets.length} URLs against Google Safe Browsing v4...`);
    const gsbHits = await checkGoogleSafeBrowsing(
      probeTargets.map((t) => t.url),
      gsbApiKey,
    );
    for (const [hitUrl, reason] of Object.entries(gsbHits)) {
      quarantinedUrls[hitUrl] = reason;
    }
  }

  let checkedUrls = existing.checkedUrls;
  const deltaCandidates: string[] = [];

  if (!dnsblOnly) {
    const targets = maxUrls > 0 ? probeTargets.slice(0, maxUrls) : probeTargets;
    console.log(
      `Probing ${targets.length} book URLs with SSRF-safe probe + PDF/ClickFix/drift scanners...`,
    );
    checkedUrls = targets.length;
    const nowIso = new Date().toISOString();

    await runPool(targets, PROBE_CONCURRENCY, async ({ url, hostname }) => {
      if (blockedHosts[hostname]) return;

      const obs = await probeLink(url);
      if (obs.kind === 'missing') {
        const second = await probeLink(url);
        if (second.kind === 'missing') {
          unavailableUrls[url] = nowIso;
        }
        return;
      }

      if (obs.kind === 'reachable') {
        delete unavailableUrls[url];
        const inspected = await inspectFinalTarget(url, hostname);
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
            const rdap = await checkRdapDomainAge(inspected.finalHost);
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
  }

  // Targeted Layer 3: submit only drifted external URLs to outsourced sandbox (Cloudflare/urlscan.io).
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const cfToken = process.env.CLOUDFLARE_URL_SCANNER_TOKEN?.trim();
  const urlscanKey = process.env.URLSCAN_API_KEY?.trim();
  if (
    detonateDeltas &&
    !dryRun &&
    deltaCandidates.length > 0 &&
    ((cfAccountId && cfToken) || urlscanKey)
  ) {
    const batch = [...new Set(deltaCandidates)].slice(0, MAX_DELTA_DETONATIONS_PER_RUN);
    console.log(`Submitting ${batch.length} drifted external URL(s) to outsourced URL sandbox...`);
    for (const candidateUrl of batch) {
      const record = await submitDeltaDetonation(candidateUrl, {
        cloudflareAccountId: cfAccountId,
        cloudflareToken: cfToken,
        urlscanApiKey: urlscanKey,
      });
      if (record) {
        deltaDetonations[candidateUrl] = record;
      }
    }
  }

  const manifest: FreeBooksSecurityManifest = {
    generatedAt: new Date().toISOString(),
    checkedHosts: hostsList.length,
    checkedUrls,
    blockedHosts: Object.fromEntries(
      Object.entries(blockedHosts).sort(([a], [b]) => a.localeCompare(b)),
    ),
    quarantinedUrls: Object.fromEntries(
      Object.entries(quarantinedUrls).sort(([a], [b]) => a.localeCompare(b)),
    ),
    unavailableUrls: Object.fromEntries(
      Object.entries(unavailableUrls).sort(([a], [b]) => a.localeCompare(b)),
    ),
    urlFingerprints: Object.fromEntries(
      Object.entries(urlFingerprints).sort(([a], [b]) => a.localeCompare(b)),
    ),
    deltaDetonations: Object.fromEntries(
      Object.entries(deltaDetonations).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };

  console.log(
    JSON.stringify(
      {
        checkedHosts: manifest.checkedHosts,
        checkedUrls: manifest.checkedUrls,
        urlhausFeedSize: urlhausHosts.size,
        blockedHostsCount: Object.keys(manifest.blockedHosts).length,
        quarantinedUrlsCount: Object.keys(manifest.quarantinedUrls).length,
        unavailableUrlsCount: Object.keys(manifest.unavailableUrls).length,
        trackedFingerprintsCount: Object.keys(manifest.urlFingerprints ?? {}).length,
        deltaDetonationsCount: Object.keys(manifest.deltaDetonations ?? {}).length,
        dryRun,
      },
      null,
      2,
    ),
  );

  if (shouldWrite) {
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`Wrote updated security manifest to ${MANIFEST_PATH}`);
  }
}

await main();
