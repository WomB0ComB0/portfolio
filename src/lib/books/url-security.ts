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
 * @file Synchronous, browser- and server-safe URL security screening, trust-tier classification,
 * raw PDF active-content inspection, and HTML/ClickFix/obfuscated-JS/parking heuristics
 * for external book links. Ported from link-shortener's 9-stage security pipeline
 * (`url-validator.ts`, `malware-checker.ts`, `phishing-detector.ts`, `http-security-checker.ts`).
 */

export type UrlBlockReason =
  | 'invalid_syntax'
  | 'disallowed_protocol'
  | 'embedded_credentials'
  | 'non_default_port'
  | 'private_or_literal_ip'
  | 'nested_scheme'
  | 'executable_payload'
  | 'double_extension_spoof'
  | 'punycode_homograph'
  | 'high_abuse_tld';

export type HostTrustTier = 'verified' | 'external';

export interface UrlSecurityVerdict {
  readonly safe: boolean;
  readonly normalizedUrl: string | null;
  readonly hostname: string | null;
  readonly insecureTransport: boolean;
  readonly trustTier: HostTrustTier;
  readonly blockReason: UrlBlockReason | null;
}

export interface HtmlSecurityInspection {
  readonly parked: boolean;
  readonly metaRefreshCrossOrigin: string | null;
  readonly clickFixLure: boolean;
  readonly obfuscatedScript: boolean;
  readonly hiddenCrossOriginIframe: boolean;
}

const MAX_URL_LENGTH = 2048;

const MALICIOUS_EXTENSIONS = [
  '.exe',
  '.scr',
  '.bat',
  '.cmd',
  '.pif',
  '.vbs',
  '.vbe',
  '.jse',
  '.wsf',
  '.wsh',
  '.ps1',
  '.psm1',
  '.msi',
  '.msp',
  '.dll',
  '.iso',
  '.img',
  '.lnk',
  '.hta',
  '.chm',
  '.apk',
  '.dmg',
  '.docm',
  '.xlsm',
  '.pptm',
] as const;

const DOUBLE_EXT_REGEX =
  /\.(pdf|epub|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|zip|rar|txt)\.(exe|scr|bat|cmd|vbs|js|ps1|msi|hta|lnk|jar|apk)$/i;

const HIGH_ABUSE_TLDS = new Set([
  '.tk',
  '.ml',
  '.ga',
  '.cf',
  '.gq',
  '.zip',
  '.mov',
  '.exe',
  '.click',
  '.cfd',
  '.loan',
  '.buzz',
  '.surf',
  '.rest',
]);

const NESTED_SCHEME_REGEX = /(?:javascript|vbscript|data|file|blob):/i;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
]);

/** High-trust publishers, versioned git hosts, standards bodies, and academic/doc platforms. */
const VERIFIED_EXACT_HOSTS = new Set([
  'github.com',
  'raw.githubusercontent.com',
  'gitlab.com',
  'codeberg.org',
  'bitbucket.org',
  'arxiv.org',
  'archive.org',
  'web.archive.org',
  'openstax.org',
  'mitpress.mit.edu',
  'doc.rust-lang.org',
  'docs.python.org',
  'go.dev',
  'pkg.go.dev',
  'developer.mozilla.org',
  'web.dev',
  'learn.microsoft.com',
  'docs.oracle.com',
  'kubernetes.io',
  'greenteapress.com',
  'ostep.org',
  'pages.cs.wisc.edu',
  'eloquentjavascript.net',
  'craftinginterpreters.com',
  'beej.us',
  'git-scm.com',
  'progit.org',
  'en.wikibooks.org',
  'leanpub.com',
  'cdn.mikeodnis.dev',
]);

const VERIFIED_HOST_SUFFIXES = [
  '.github.io',
  '.gitlab.io',
  '.readthedocs.io',
  '.readthedocs.org',
  '.oreilly.com',
  '.apache.org',
  '.gnu.org',
  '.w3.org',
  '.ietf.org',
  '.kernel.org',
  '.freebsd.org',
  '.debian.org',
  '.python.org',
  '.rust-lang.org',
  '.mozilla.org',
  '.edu',
  '.ac.uk',
  '.edu.au',
  '.gov',
] as const;

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
const PDF_ACTIVE_OBJECT_RE =
  /\/(?:JavaScript|JS|Launch|OpenAction|AA|EmbeddedFile|RichMedia|XFA|SubmitForm|ImportData|GoToR|GoToE|Rendition|Sound|Movie)\b/;
const PDF_POLYGLOT_RE = /(?:<\s*script\b|<!doctype\s+html\b|<\?php\b)/i;

/** ClickFix / fake-CAPTCHA / fake-update clipboard-hijack lures on compromised blogs & doc sites. */
const CLICKFIX_CLIPBOARD_RE = /navigator\.clipboard\.writeText\s*\(/i;
const CLICKFIX_SHELL_PAYLOAD_RE =
  /\b(?:powershell(?:\.exe)?\s+-[a-z]*\s*(?:enc|encodedcommand|w\s+hidden|ep\s+bypass)|mshta(?:\.exe)?\s+https?:|cmd(?:\.exe)?\s+\/c\s+|curl\s+[^|\n]+\|\s*(?:ba)?sh\b|wget\s+[^|\n]+\|\s*(?:ba)?sh\b|iex\s*\(\s*(?:irm|iwr|new-object)\b)/i;
const CLICKFIX_LURE_COPY_RE =
  /\b(?:press\s+win(?:dows)?\s*\+\s*r|windows\s+key\s*\+\s*r)\b[\s\S]{0,240}\b(?:ctrl\s*\+\s*v|paste\s+and\s+(?:press\s+)?enter)\b/i;

/** High-signal obfuscated inline JS loader patterns (not triggered by normal docs/book pages). */
const OBFUSCATED_SCRIPT_PATTERNS: readonly RegExp[] = [
  /\b(?:eval|Function)\s*\(\s*atob\s*\(/i,
  /\bdocument\.write\s*\(\s*unescape\s*\(/i,
  /\bString\.fromCharCode\s*\((?:\s*\d+\s*,){10,}/i,
  /\b(?:eval|new\s+Function)\s*\([\s\S]{0,80}\batob\s*\(\s*["'][A-Za-z0-9+/=]{160,}["']\s*\)/i,
];

function hasControlOrBackslash(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f || code === 0x5c) {
      return true;
    }
  }
  return false;
}

function isLiteralIp(hostname: string): boolean {
  const bare = hostname.replace(/^\[|\]$/g, '');
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(bare)) return true;
  if (/^\d+$/.test(bare) || /^0x[0-9a-f]+$/i.test(bare)) return true;
  if (bare.includes(':')) return true;
  return false;
}

/** Classifies a hostname as a verified high-trust publisher/git/edu host vs an external domain. */
export function classifyHostTrustTier(hostname: string): HostTrustTier {
  const normalized = hostname
    .toLowerCase()
    .replace(/\.+$/, '')
    .replace(/^www\./, '');
  if (VERIFIED_EXACT_HOSTS.has(normalized)) return 'verified';
  if (VERIFIED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return 'verified';
  return 'external';
}

/**
 * Pure, synchronous URL security gate (runs at parse time on every external book URL).
 * Fails closed on invalid syntax, credentials, non-default ports, literal/private IPs,
 * executable payloads, double-extension spoofs, punycode homographs, and high-abuse TLDs.
 */
export function screenExternalBookUrl(rawUrl: string): UrlSecurityVerdict {
  const fail = (blockReason: UrlBlockReason): UrlSecurityVerdict => ({
    safe: false,
    normalizedUrl: null,
    hostname: null,
    insecureTransport: false,
    trustTier: 'external',
    blockReason,
  });

  if (
    typeof rawUrl !== 'string' ||
    rawUrl.length === 0 ||
    rawUrl.length > MAX_URL_LENGTH ||
    hasControlOrBackslash(rawUrl)
  ) {
    return fail('invalid_syntax');
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return fail('invalid_syntax');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return fail('disallowed_protocol');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return fail('embedded_credentials');
  }
  if (parsed.port !== '') {
    return fail('non_default_port');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  if (
    !hostname ||
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localdomain') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.home.arpa') ||
    isLiteralIp(hostname)
  ) {
    return fail('private_or_literal_ip');
  }

  if (NESTED_SCHEME_REGEX.test(parsed.pathname) || NESTED_SCHEME_REGEX.test(parsed.search)) {
    return fail('nested_scheme');
  }

  const lowerPath = parsed.pathname.toLowerCase();
  if (DOUBLE_EXT_REGEX.test(lowerPath)) {
    return fail('double_extension_spoof');
  }
  if (MALICIOUS_EXTENSIONS.some((ext) => lowerPath.endsWith(ext))) {
    return fail('executable_payload');
  }

  const labels = hostname.split('.');
  if (labels.some((label) => label.startsWith('xn--'))) {
    return fail('punycode_homograph');
  }
  const tld = labels.length >= 2 ? `.${labels.at(-1)}` : '';
  if (HIGH_ABUSE_TLDS.has(tld)) {
    return fail('high_abuse_tld');
  }

  return {
    safe: true,
    normalizedUrl: parsed.href,
    hostname,
    insecureTransport: parsed.protocol === 'http:',
    trustTier: classifyHostTrustTier(hostname),
    blockReason: null,
  };
}

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

  const direct = PDF_ACTIVE_OBJECT_RE.exec(latin1);
  if (direct) {
    return `pdf_active_object:${direct[0]}`;
  }

  const decoded = latin1.replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
  const obfuscated = PDF_ACTIVE_OBJECT_RE.exec(decoded);
  if (obfuscated) {
    return `pdf_obfuscated_active_object:${obfuscated[0]}`;
  }

  if (PDF_POLYGLOT_RE.test(latin1.slice(0, 8192))) {
    return 'pdf_html_script_polyglot';
  }
  return null;
}

/**
 * Audits a multi-hop redirect chain for Traffic Direction Systems (TDS):
 * flags >2 distinct external host hops or any hop failing `screenExternalBookUrl()`.
 */
export function isSuspiciousRedirectChain(hops: readonly string[]): string | null {
  const distinctHosts: string[] = [];
  for (const hop of hops) {
    const verdict = screenExternalBookUrl(hop);
    if (!verdict.safe || !verdict.hostname) {
      return `unsafe_redirect_hop:${verdict.blockReason ?? 'invalid'}`;
    }
    const bare = verdict.hostname.replace(/^www\./, '');
    if (distinctHosts.at(-1) !== bare) {
      distinctHosts.push(bare);
    }
  }
  const externalHops = distinctHosts.filter((h) => classifyHostTrustTier(h) === 'external');
  if (externalHops.length > 2) {
    return `tds_redirect_chain:${externalHops.length}_external_hosts`;
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
      if (
        (target.protocol === 'http:' || target.protocol === 'https:') &&
        target.hostname.toLowerCase().replace(/^www\./, '') !== normalizedOrigin
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
