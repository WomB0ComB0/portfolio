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
 * @file Synchronous, browser- and server-safe URL security screening & content/parking heuristics
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

export interface UrlSecurityVerdict {
  readonly safe: boolean;
  readonly normalizedUrl: string | null;
  readonly hostname: string | null;
  readonly insecureTransport: boolean;
  readonly blockReason: UrlBlockReason | null;
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
 * Inspects a bounded (<=16 KiB) HTML snippet for expired-domain parking storefronts or
 * cross-origin `<meta http-equiv="refresh">` cloaking.
 */
export function inspectHtmlSnippet(
  htmlSnippet: string,
  pageOriginHost: string,
): { readonly parked: boolean; readonly metaRefreshCrossOrigin: string | null } {
  const bounded = htmlSnippet.slice(0, 16 * 1024);
  const parked = PARKED_DOMAIN_SIGNATURES.some((pattern) => pattern.test(bounded));

  let metaRefreshCrossOrigin: string | null = null;
  const metaMatch =
    /<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]+content\s*=\s*["'][^"']*url\s*=\s*([^"'\s>]+)/i.exec(
      bounded,
    );
  if (metaMatch?.[1]) {
    try {
      const target = new URL(metaMatch[1].replace(/^['"]|['"]$/g, ''), `https://${pageOriginHost}`);
      if (
        target.hostname.toLowerCase().replace(/^www\./, '') !==
        pageOriginHost.toLowerCase().replace(/^www\./, '')
      ) {
        metaRefreshCrossOrigin = target.href;
      }
    } catch {
      // Ignore unparseable refresh URLs.
    }
  }

  return { parked, metaRefreshCrossOrigin };
}
