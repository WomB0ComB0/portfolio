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
 * @file What the weekly verify sweep checks in a book link's response, once the link has passed
 * the runtime gate (url-screen.ts): drive-by executable headers, active content in raw PDF bytes
 * (never rendered), redirect chains through too many external domains, and HTML that is a parked
 * domain, a cross-origin meta refresh, a ClickFix clipboard lure, an obfuscated script loader or a
 * hidden cross-origin iframe. Only the sweep (sweep.ts, run by scripts/free-books/verify.ts) and
 * the tests import it; the site never runs it. Pure, with no network access of its own. Guarded by
 * tests/unit/free-books/content-inspection.test.ts.
 */

import {
  classifyHostTrustTier,
  DOUBLE_EXT_REGEX,
  MALICIOUS_EXTENSIONS,
  registrableApex,
  screenExternalBookUrl,
} from './url-screen';

export interface HtmlSecurityInspection {
  readonly parked: boolean;
  readonly metaRefreshCrossOrigin: string | null;
  readonly clickFixLure: boolean;
  readonly obfuscatedScript: boolean;
  readonly hiddenCrossOriginIframe: boolean;
}

const DANGEROUS_CONTENT_TYPES = new Set([
  'application/x-msdownload',
  'application/x-dosexec',
  'application/x-msdos-program',
  'application/vnd.microsoft.portable-executable',
  'application/x-executable',
  'application/x-elf',
  'application/x-mach-binary',
  'application/x-sh',
  'application/x-shellscript',
  'application/x-bat',
  'application/x-msi',
  'application/x-ms-shortcut',
  'application/hta',
  'application/vnd.android.package-archive',
  'application/java-archive',
  'application/x-apple-diskimage',
  'application/x-iso9660-image',
  'application/vnd.ms-word.document.macroenabled.12',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.ms-powerpoint.presentation.macroenabled.12',
]);

/** Common expired-domain parking / hijacked-domain storefront fingerprints. */
const PARKED_DOMAIN_SIGNATURES: readonly RegExp[] = [
  /\bthis domain (?:is|may be) for sale\b/i,
  /\bbuy this domain\b/i,
  /\bdomain (?:is )?parked(?: free)?(?:, courtesy of)?\b/i,
  /\bsedoparking\.com\b/i,
  /\bparkingcrew\.net\b/i,
  /\bbodis\.com\b/i,
  /\bafternic\.com\/forsale\b/i,
  /\bhugedomains\.com\b/i,
  /\bdan\.com\/buy-domain\b/i,
  /\bdomainmarket\.com\b/i,
  /\bgodaddy\.com\/domainsearch\b/i,
];

/** Active PDF dictionary/action names capable of code execution, launch, or embedded payloads. */
const PDF_STREAM_BLOCK_RE = /\bstream\r?\n[\s\S]*?\bendstream\b/g;
const PDF_ACTIVE_OBJECT_RE =
  /\/(?:JavaScript|EmbeddedFile|RichMedia|XFA)\b|\/S\s*\/(?:JavaScript|JS|Launch|SubmitForm|ImportData)\b|\/OpenAction\s*<</;
const PDF_POLYGLOT_RE = /(?:<\s*script\b|<!doctype\s+html\b|<\?php\b)/i;

/** Benign analytics/consent noscript iframe hosts that legitimately render 0x0 hidden iframes. */
const BENIGN_HIDDEN_IFRAME_HOSTS = new Set([
  'googletagmanager.com',
  'consent.cookiebot.com',
  'vars.hotjar.com',
  'c.bing.com',
]);
const BENIGN_HIDDEN_IFRAME_SUFFIXES = [
  '.googletagmanager.com',
  '.doubleclick.net',
  '.googlesyndication.com',
] as const;

/** ClickFix / fake-CAPTCHA / fake-update clipboard-hijack lures on compromised blogs & doc sites. */
const CLICKFIX_CLIPBOARD_RE = /navigator\.clipboard\.writeText\s*\(/i;
const CLICKFIX_SHELL_PAYLOAD_RE =
  /\b(?:powershell(?:\.exe)?\s+-[a-z]*\s*(?:enc|encodedcommand|w\s+hidden|ep\s+bypass)|mshta(?:\.exe)?\s+https?:|cmd(?:\.exe)?\s+\/c\s+|curl\s+[^|\n]+\|\s*(?:ba)?sh\b|wget\s+[^|\n]+\|\s*(?:ba)?sh\b|iex\s*\(\s*(?:irm|iwr|new-object)\b)/i;
const CLICKFIX_LURE_COPY_RE =
  /\b(?:press\s+win(?:dows)?\s*\+\s*r|windows\s+key\s*\+\s*r)\b[\s\S]{0,240}\b(?:ctrl\s*\+\s*v|paste\s+and\s+(?:press\s+)?enter)\b/i;

/** High-signal obfuscated inline JS loader patterns (excludes legacy GA document.write(unescape)). */
const OBFUSCATED_SCRIPT_PATTERNS: readonly RegExp[] = [
  /\b(?:eval|Function)\s*\(\s*atob\s*\(/i,
  /\bString\.fromCharCode\s*\((?:\s*\d+\s*,){16,}/i,
  /\b(?:eval|new\s+Function)\s*\([\s\S]{0,80}\batob\s*\(\s*["'][A-Za-z0-9+/=]{160,}["']\s*\)/i,
];

/** Checks response `Content-Type` / `Content-Disposition` for drive-by executable payloads. */
export function isDangerousResponseHeaders(
  contentType?: string | null,
  contentDisposition?: string | null,
): string | null {
  const mime = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (mime && DANGEROUS_CONTENT_TYPES.has(mime)) {
    return `dangerous_mime:${mime}`;
  }

  if (contentDisposition) {
    const filenameMatch =
      /filename\*\s*=\s*(?:UTF-8'')?([^;\r\n]+)/i.exec(contentDisposition) ??
      /filename\s*=\s*"?([^";\r\n]+)"?/i.exec(contentDisposition);
    const filename = filenameMatch?.[1]?.trim().toLowerCase() ?? '';
    if (filename) {
      if (DOUBLE_EXT_REGEX.test(filename)) return 'dangerous_disposition_double_ext';
      if (MALICIOUS_EXTENSIONS.some((ext) => filename.endsWith(ext))) {
        return 'dangerous_disposition_ext';
      }
    }
  }
  return null;
}

/**
 * Pure, zero-execution raw PDF byte scanner (never renders PDFs).
 * Flags active scripting (`/JavaScript`, `/JS`), `/Launch`, `/OpenAction`, `/AA`, `/EmbeddedFile`,
 * `/RichMedia`, `/XFA`, hex-obfuscated PDF names (`/J#61vaScript`), and HTML/PHP polyglots.
 */
export function inspectPdfBytes(bytes: Uint8Array): string | null {
  if (bytes.byteLength < 5) return 'pdf_truncated';
  let header = '';
  for (let i = 0; i < 5; i += 1) {
    header += String.fromCharCode(bytes[i] ?? 0);
  }
  if (header !== '%PDF-') {
    return 'pdf_invalid_magic';
  }

  // Decode bounded window (up to 1 MiB) as latin1 so byte offsets stay 1:1.
  const limit = Math.min(bytes.byteLength, 1024 * 1024);
  let latin1 = '';
  const chunkSize = 8192;
  for (let offset = 0; offset < limit; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, limit);
    let piece = '';
    for (let i = offset; i < end; i += 1) {
      piece += String.fromCharCode(bytes[i] ?? 0);
    }
    latin1 += piece;
  }

  const metadataOnly = latin1.replace(PDF_STREAM_BLOCK_RE, ' ');
  const direct = PDF_ACTIVE_OBJECT_RE.exec(metadataOnly);
  if (direct) {
    return `pdf_active_object:${direct[0].replace(/\s+/g, ' ')}`;
  }

  const decoded = metadataOnly.replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
  const obfuscated = PDF_ACTIVE_OBJECT_RE.exec(decoded);
  if (obfuscated) {
    return `pdf_obfuscated_active_object:${obfuscated[0].replace(/\s+/g, ' ')}`;
  }

  if (PDF_POLYGLOT_RE.test(latin1.slice(0, 8192))) {
    return 'pdf_html_script_polyglot';
  }
  return null;
}

/**
 * Audits a multi-hop redirect chain for Traffic Direction Systems (TDS):
 * flags >2 distinct external registrable domains or any hop failing `screenExternalBookUrl()`.
 */
export function isSuspiciousRedirectChain(hops: readonly string[]): string | null {
  const distinctExternalApexes = new Set<string>();
  for (const hop of hops) {
    const verdict = screenExternalBookUrl(hop);
    if (!verdict.safe || !verdict.hostname) {
      return `unsafe_redirect_hop:${verdict.blockReason ?? 'invalid'}`;
    }
    if (classifyHostTrustTier(verdict.hostname) === 'external') {
      distinctExternalApexes.add(registrableApex(verdict.hostname));
    }
  }
  if (distinctExternalApexes.size > 2) {
    return `tds_redirect_chain:${distinctExternalApexes.size}_external_domains`;
  }
  return null;
}

/**
 * Inspects a bounded (<=64 KiB) HTML snippet for expired-domain parking storefronts,
 * cross-origin `<meta http-equiv="refresh">` cloaking, ClickFix clipboard lures,
 * obfuscated inline script loaders, and hidden `0x0` cross-origin iframes.
 */
export function inspectHtmlSnippet(
  htmlSnippet: string,
  pageOriginHost: string,
): HtmlSecurityInspection {
  const bounded = htmlSnippet.slice(0, 64 * 1024);
  const normalizedOrigin = pageOriginHost.toLowerCase().replace(/^www\./, '');
  const parked = PARKED_DOMAIN_SIGNATURES.some((pattern) => pattern.test(bounded));

  let metaRefreshCrossOrigin: string | null = null;
  const metaMatch =
    /<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]+content\s*=\s*["'][^"']*url\s*=\s*([^"'\s>]+)/i.exec(
      bounded,
    );
  if (metaMatch?.[1]) {
    try {
      const target = new URL(
        metaMatch[1].replace(/^['"]|['"]$/g, ''),
        `https://${normalizedOrigin}`,
      );
      if (target.hostname.toLowerCase().replace(/^www\./, '') !== normalizedOrigin) {
        metaRefreshCrossOrigin = target.href;
      }
    } catch {
      // Ignore unparseable refresh URLs.
    }
  }

  const clickFixLure =
    (CLICKFIX_CLIPBOARD_RE.test(bounded) && CLICKFIX_SHELL_PAYLOAD_RE.test(bounded)) ||
    CLICKFIX_LURE_COPY_RE.test(bounded);

  const obfuscatedScript = OBFUSCATED_SCRIPT_PATTERNS.some((pattern) => pattern.test(bounded));

  let hiddenCrossOriginIframe = false;
  for (const iframeMatch of bounded.matchAll(/<iframe\b([^>]*)>/gi)) {
    const attrs = iframeMatch[1] ?? '';
    const srcMatch = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!srcMatch?.[1]) continue;
    const isHidden =
      /\b(?:width|height)\s*=\s*["']?0(?:px)?["']?/i.test(attrs) ||
      /\bstyle\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0\b|(?:width|height)\s*:\s*0(?:px)?\b)/i.test(
        attrs,
      );
    if (!isHidden) continue;
    try {
      const target = new URL(srcMatch[1], `https://${normalizedOrigin}`);
      const targetHost = target.hostname.toLowerCase().replace(/^www\./, '');
      const isBenignTracker =
        BENIGN_HIDDEN_IFRAME_HOSTS.has(targetHost) ||
        BENIGN_HIDDEN_IFRAME_SUFFIXES.some((s) => targetHost.endsWith(s));
      if (
        (target.protocol === 'http:' || target.protocol === 'https:') &&
        targetHost !== normalizedOrigin &&
        !isBenignTracker
      ) {
        hiddenCrossOriginIframe = true;
        break;
      }
    } catch {
      // Ignore invalid iframe src.
    }
  }

  return {
    parked,
    metaRefreshCrossOrigin,
    clickFixLure,
    obfuscatedScript,
    hiddenCrossOriginIframe,
  };
}
