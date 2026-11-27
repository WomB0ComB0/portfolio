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
 * @file The verify sweep's content inspection of one reachable link: inspectFinalTarget walks its
 * redirects one hop at a time over an injected fetch (the DNS-pinned one in the CLI), audits the
 * chain, refuses to follow a hop the caller excludes, reads a bounded slice of what it ends on and
 * runs content-inspection.ts on it, and says whether the inspection finished, so a request that
 * failed is never read as a clean page. sweep.ts calls it from probeUrls and re-exports it.
 * Guarded by tests/unit/free-books/target-inspection.test.ts, and inside a run by sweep.test.ts
 * and sweep-checks.test.ts.
 */

import {
  inspectHtmlSnippet,
  inspectPdfBytes,
  isDangerousResponseHeaders,
  isSuspiciousRedirectChain,
} from './content-inspection';
import { UnsafeTargetError } from './pinned-fetch';
import type { FetchLike } from './types';
import { screenExternalBookUrl } from './url-screen';

/** The most HTML read from one page for inspectHtmlSnippet. */
const MAX_HTML_BYTES = 64 * 1024;
/** The most PDF bytes requested and read for inspectPdfBytes. */
const MAX_PDF_SNIFF_BYTES = 1024 * 1024;
/** The redirects inspectFinalTarget follows after the first request. */
const MAX_INSPECTED_REDIRECTS = 5;
/** Each inspection request gives up after 6 s. */
const INSPECT_TIMEOUT_MS = 6000;
/** Sent with every inspection request. */
const USER_AGENT = 'mikeodnis-portfolio-verifier/1.0 (+https://mikeodnis.dev)';
/** The danger of a redirect to a hop the caller excludes, which is never fetched. */
const EXCLUDED_HOP_DANGER = 'unsafe_redirect_hop:flagged_target';
/** The most characters of a Content-Encoding written into a danger reason. */
const MAX_ENCODING_IN_REASON = 32;

/**
 * What inspectFinalTarget found where a link's redirects end. `complete` is true when it reached
 * a verdict: a danger, an HTML or PDF body it read, or a type it does not read. It is false when
 * the inspection could not finish (the request failed or timed out, the page answered an error
 * status, a redirect had no Location or went past the cap); then `danger` is null but nothing
 * was checked.
 */
export interface TargetInspectionResult {
  readonly danger: string | null;
  readonly finalHost: string;
  readonly contentType: string;
  readonly complete: boolean;
}

/** A finished inspection's verdict: `danger`, or null when it found none. */
const verdict = (
  danger: string | null,
  finalHost: string,
  contentType: string,
): TargetInspectionResult => ({ danger, finalHost, contentType, complete: true });

/** An inspection that could not finish: no danger found, and nothing checked. */
const unfinished = (finalHost: string, contentType = ''): TargetInspectionResult => ({
  danger: null,
  finalHost,
  contentType,
  complete: false,
});

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

/**
 * The danger of a body still in a Content-Encoding, whose bytes cannot be inspected as the page
 * (the pinned transport decodes gzip, deflate and br and names only what it could not); null for
 * an identity body. The encoding is kept short in the reason.
 */
function undecodableEncodingDanger(contentEncoding: string | null): string | null {
  const encoding = contentEncoding?.trim().toLowerCase() ?? '';
  if (encoding === '' || encoding === 'identity') return null;
  return `undecodable_content_encoding:${encoding.slice(0, MAX_ENCODING_IN_REASON)}`;
}

/**
 * The danger in an HTML page: parked, a ClickFix lure, an obfuscated loader, a hidden
 * cross-origin iframe or an unsafe meta refresh; null when it has none.
 */
function htmlDanger(html: string, host: string): string | null {
  const inspection = inspectHtmlSnippet(html, host);
  if (inspection.parked) return 'parked_domain';
  if (inspection.clickFixLure) return 'clickfix_lure';
  if (inspection.obfuscatedScript) return 'obfuscated_inline_script';
  if (inspection.hiddenCrossOriginIframe) return 'hidden_cross_origin_iframe';
  if (inspection.metaRefreshCrossOrigin) {
    const refreshVerdict = screenExternalBookUrl(inspection.metaRefreshCrossOrigin);
    if (!refreshVerdict.safe) {
      return `unsafe_meta_refresh:${refreshVerdict.blockReason ?? 'invalid'}`;
    }
  }
  return null;
}

/**
 * Inspects the response a link's redirects end on: dangerous headers first, then (for an OK
 * answer) the bytes of a PDF or an HTML page. An OK answer of any other type is finished with no
 * danger; an error status is unfinished, since its body is not the page.
 */
async function inspectResponse(
  res: Response,
  currentUrl: string,
  currentHost: string,
): Promise<TargetInspectionResult> {
  const rawCt = res.headers.get('content-type') ?? '';
  const normalizedCt = rawCt.split(';')[0]?.trim().toLowerCase() ?? '';
  const headerDanger =
    isDangerousResponseHeaders(rawCt, res.headers.get('content-disposition')) ??
    (res.ok ? undecodableEncodingDanger(res.headers.get('content-encoding')) : null);
  if (headerDanger || !res.ok || !res.body) {
    await res.body?.cancel().catch(() => undefined);
    if (headerDanger) return verdict(headerDanger, currentHost, normalizedCt);
    return res.ok
      ? verdict(null, currentHost, normalizedCt)
      : unfinished(currentHost, normalizedCt);
  }
  if (normalizedCt === 'application/pdf' || /\.pdf(?:$|[?#])/i.test(currentUrl)) {
    const pdfBytes = await readBoundedBytes(res.body, MAX_PDF_SNIFF_BYTES);
    // Only inspect real PDF bytes, so an HTML landing page behind a .pdf link is not flagged.
    if (pdfBytes.byteLength >= 5 && pdfBytes[0] === 0x25 && pdfBytes[1] === 0x50) {
      const pdfDanger = inspectPdfBytes(pdfBytes);
      if (pdfDanger) return verdict(pdfDanger, currentHost, 'application/pdf');
    }
    return verdict(null, currentHost, normalizedCt);
  }
  if (normalizedCt.includes('text/html')) {
    const htmlBytes = await readBoundedBytes(res.body, MAX_HTML_BYTES);
    const html = new TextDecoder('utf-8', { fatal: false }).decode(htmlBytes);
    return verdict(htmlDanger(html, currentHost), currentHost, normalizedCt);
  }
  await res.body.cancel().catch(() => undefined);
  return verdict(null, currentHost, normalizedCt);
}

/**
 * Follows a reachable link's redirects by hand (auditing the chain) and inspects what it ends
 * on: dangerous headers, active PDF content, or HTML that is parked, a ClickFix lure, an
 * obfuscated loader, a hidden cross-origin iframe or an unsafe meta refresh. The CLI passes the
 * DNS-pinned fetch (pinned-fetch.ts), which vets every hop's addresses before it connects: a hop
 * that is or resolves to a non-public address is `unsafe_address:<host>`, which quarantines the
 * link. A redirect to a hop the caller excludes (`isExcludedHop`, e.g. a link already known to be
 * bad) is never fetched and is `unsafe_redirect_hop:flagged_target`, since the link sends visitors
 * there. A reachable body still in a Content-Encoding is `undecodable_content_encoding:<encoding>`,
 * never read as the page. Any other network error or timeout, an error status, a redirect with no
 * Location or one past the cap finds nothing and reports the inspection as unfinished
 * (`complete: false`), so the caller does not take it as a clean check.
 */
export async function inspectFinalTarget(
  url: string,
  hostname: string,
  fetcher: FetchLike,
  isExcludedHop: (hopUrl: string) => boolean = () => false,
): Promise<TargetInspectionResult> {
  const hops: string[] = [url];
  let currentUrl = url;
  let currentHost = hostname;

  try {
    for (let hop = 0; hop <= MAX_INSPECTED_REDIRECTS; hop += 1) {
      const res = await fetcher(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(INSPECT_TIMEOUT_MS),
        headers: {
          'User-Agent': USER_AGENT,
          Range: `bytes=0-${MAX_PDF_SNIFF_BYTES - 1}`,
        },
      });
      if (res.status < 300 || res.status >= 400) {
        return await inspectResponse(res, currentUrl, currentHost);
      }

      const loc = res.headers.get('location');
      await res.body?.cancel().catch(() => undefined);
      if (!loc) break;
      const nextUrl = new URL(loc, currentUrl).href;
      hops.push(nextUrl);
      const hopCheck =
        isSuspiciousRedirectChain(hops) ?? (isExcludedHop(nextUrl) ? EXCLUDED_HOP_DANGER : null);
      if (hopCheck) return verdict(hopCheck, currentHost, '');
      currentUrl = nextUrl;
      currentHost = new URL(nextUrl).hostname.toLowerCase();
    }
  } catch (error) {
    if (error instanceof UnsafeTargetError) {
      return verdict(`unsafe_address:${error.hostname}`, currentHost, '');
    }
    // Any other error (a timeout, a reset, a malformed Location) leaves the inspection unfinished.
  }

  return unfinished(currentHost);
}
