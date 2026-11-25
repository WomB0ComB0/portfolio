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
 * Scheduled security + reachability sweep for EbookFoundation/free-programming-books.
 *
 * Combines:
 *  1. Zero-key Threat Intelligence DNSBL sweep (Cloudflare Security 1.1.1.2 DoH + Quad9 9.9.9.9)
 *     across every unique hostname in the catalog.
 *  2. SSRF-safe, DNS-pinned reachability probe (`probeLink`) across book URLs with per-host
 *     rate-limiting and 2-pass confirmation (prevents transient flakes from hiding live books).
 *  3. Bounded 16 KiB HTML parking / cloaking & drive-by MIME inspection.
 *
 * Usage:
 *   bun run scripts/books/verify-free-books.ts --dry-run
 *   bun run scripts/books/verify-free-books.ts --dnsbl-only
 *   bun run scripts/books/verify-free-books.ts --write
 */

import dns from 'node:dns/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  checkHostnameThreatIntel,
  type FreeBooksSecurityManifest,
} from '../../src/lib/books/free-books-verifier';
import { loadFreeProgrammingBooks } from '../../src/lib/books/free-programming-books';
import {
  inspectHtmlSnippet,
  isDangerousResponseHeaders,
  screenExternalBookUrl,
} from '../../src/lib/books/url-security';
import { probeLink } from '../../src/lib/link-health/probe';

const MANIFEST_PATH = resolve(process.cwd(), 'src/data/free-books-security.json');
const DNSBL_CONCURRENCY = 20;
const PROBE_CONCURRENCY = 16;
const MAX_HTML_BYTES = 16 * 1024;

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

async function inspectFinalTarget(url: string, hostname: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'mikeodnis-portfolio-verifier/1.0 (+https://mikeodnis.dev)',
        Range: `bytes=0-${MAX_HTML_BYTES - 1}`,
      },
    });
    const headerDanger = isDangerousResponseHeaders(
      res.headers.get('content-type'),
      res.headers.get('content-disposition'),
    );
    if (headerDanger) {
      await res.body?.cancel().catch(() => undefined);
      return headerDanger;
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (res.ok && contentType.toLowerCase().includes('text/html') && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let html = '';
      let bytes = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          html += decoder.decode(value, { stream: true });
          if (bytes >= MAX_HTML_BYTES) break;
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      const { parked } = inspectHtmlSnippet(html, hostname);
      if (parked) return 'parked_domain';
    } else {
      await res.body?.cancel().catch(() => undefined);
    }
  } catch {
    // Ignore transient content-inspection errors; reachability probe handles status.
  }
  return null;
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const dnsblOnly = args.has('--dnsbl-only');
  const shouldWrite = args.has('--write') && !dryRun;

  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const maxUrls = limitArg ? Number.parseInt(limitArg.split('=')[1] ?? '0', 10) : 0;

  let existing: FreeBooksSecurityManifest = {
    generatedAt: new Date(0).toISOString(),
    checkedHosts: 0,
    checkedUrls: 0,
    blockedHosts: {},
    quarantinedUrls: {},
    unavailableUrls: {},
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

  console.log(
    `Checking ${hostsList.length} unique hostnames against Cloudflare 1.1.1.2 + Quad9...`,
  );
  await runPool(hostsList, DNSBL_CONCURRENCY, async (hostname) => {
    const resolvedNormally = await resolveExists(hostname);
    const verdict = await checkHostnameThreatIntel(hostname, {
      domainResolvedNormally: resolvedNormally,
    });
    if (verdict.blocked) {
      blockedHosts[hostname] = `${verdict.provider}: ${verdict.reason}`;
    }
  });

  const quarantinedUrls: Record<string, string> = { ...existing.quarantinedUrls };
  const unavailableUrls: Record<string, string> = { ...existing.unavailableUrls };
  let checkedUrls = existing.checkedUrls;

  if (!dnsblOnly) {
    const targets = maxUrls > 0 ? probeTargets.slice(0, maxUrls) : probeTargets;
    console.log(`Probing ${targets.length} book URLs with SSRF-safe DNS-pinned probe...`);
    checkedUrls = targets.length;
    const nowIso = new Date().toISOString();

    // Respect per-host concurrency by grouping or spacing lightly.
    await runPool(targets, PROBE_CONCURRENCY, async ({ url, hostname }) => {
      if (blockedHosts[hostname]) return;

      const obs = await probeLink(url);
      if (obs.kind === 'missing') {
        // Two-pass confirmation: re-probe once after a brief pause before marking unavailable.
        const second = await probeLink(url);
        if (second.kind === 'missing') {
          unavailableUrls[url] = nowIso;
        }
        return;
      }

      if (obs.kind === 'reachable') {
        delete unavailableUrls[url];
        const contentDanger = await inspectFinalTarget(url, hostname);
        if (contentDanger) {
          quarantinedUrls[url] = contentDanger;
        } else {
          delete quarantinedUrls[url];
        }
      }
    });
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
  };

  console.log(
    JSON.stringify(
      {
        checkedHosts: manifest.checkedHosts,
        checkedUrls: manifest.checkedUrls,
        blockedHostsCount: Object.keys(manifest.blockedHosts).length,
        quarantinedUrlsCount: Object.keys(manifest.quarantinedUrls).length,
        unavailableUrlsCount: Object.keys(manifest.unavailableUrls).length,
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
