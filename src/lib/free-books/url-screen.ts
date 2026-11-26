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
 * @file The runtime URL gate for external book links. The parser (parse.ts) runs
 * screenExternalBookUrl on every catalog entry, synchronously and without the network: it refuses
 * bad syntax, non-http(s) schemes, embedded credentials, non-default ports, private or literal IPs,
 * nested schemes, executable payloads, double-extension spoofs, punycode hosts and high-abuse TLDs,
 * and grades the host's trust tier. The CI-only response and page inspectors live in
 * content-inspection.ts, which reuses this file's extension lists and registrableApex. Ported from
 * link-shortener's URL checks. Pure and isomorphic; guarded by
 * tests/unit/free-books/url-screen.test.ts.
 */

import type { HostTrustTier } from './types';

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
  readonly trustTier: HostTrustTier;
  readonly blockReason: UrlBlockReason | null;
}

const MAX_URL_LENGTH = 2048;

/** Path endings that download a program or a macro document; content-inspection.ts reuses them. */
export const MALICIOUS_EXTENSIONS = [
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

/** A document extension followed by an executable one (`book.pdf.exe`). */
export const DOUBLE_EXT_REGEX =
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

/**
 * An approximate registrable apex domain (eTLD+1), handling the common two-level public suffixes
 * (co.uk, ac.uk, org.uk, com.au, edu.au, co.jp, com.br). The redirect-chain check and the RDAP
 * lookup both key on it.
 */
export function registrableApex(hostname: string): string {
  const parts = hostname.toLowerCase().replace(/\.+$/, '').split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  if (/^(?:co|ac|org|gov|edu|com|net)\.[a-z]{2}$/.test(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}
