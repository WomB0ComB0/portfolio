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
 * @file Reads the text of one threat feed into the hosts it lists. It accepts only the entry
 * formats the sweep's feeds use, one entry per line (blank lines and lines starting with `#` are
 * skipped):
 * - a plain domain (HaGeZi TIF): `evil.example`;
 * - a URL (OpenPhish), whose host is taken: `https://evil.example/login`;
 * - a hostfile line (URLhaus): an address, then the domain: `127.0.0.1 evil.example`.
 * A host is a domain name of two labels or more (letters, digits, hyphens and underscores, no
 * label starting or ending with a hyphen, a last label that starts with a letter) or an IPv4
 * address, lowercased and without trailing dots; any other line is skipped. A body with a line
 * that starts with `<` is markup, never a feed, and yields no host. So a page that is not a feed
 * (an HTML maintenance or placeholder page, a JSON error, a sentence) lists nothing, and
 * threat-intel.ts loadUrlhausHostBlocklist counts its feed as not loaded. Guarded by
 * tests/unit/free-books/threat-intel.test.ts.
 */

import { isIP, isIPv4 } from 'node:net';

/** The longest domain name DNS allows. */
const MAX_HOSTNAME_LENGTH = 253;
/** A domain label: letters, digits, hyphens and underscores, with no hyphen at either end. */
const LABEL = /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/;
/** The last label of a domain: it starts with a letter, so `1.2.3` is not a domain. */
const LAST_LABEL = /^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/** A line whose first character after any spaces is `<`: markup, never a feed entry. */
const MARKUP_LINE = /^\s*</m;

/** `token` as a feed host (lowercased, trailing dots dropped), or null when it is not one. */
function feedHost(token: string): string | null {
  const host = token.toLowerCase().replace(/\.+$/, '');
  if (isIPv4(host)) return host;
  if (host.length > MAX_HOSTNAME_LENGTH) return null;
  const labels = host.split('.');
  const isDomain =
    labels.length >= 2 &&
    LAST_LABEL.test(labels.at(-1) ?? '') &&
    labels.slice(0, -1).every((label) => LABEL.test(label));
  return isDomain ? host : null;
}

/** The host one feed line lists, or null for a blank line, a comment or a line that is no entry. */
function lineHost(rawLine: string): string | null {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) return null;
  if (line.startsWith('http://') || line.startsWith('https://')) {
    try {
      return feedHost(new URL(line).hostname);
    } catch {
      return null;
    }
  }
  const [first = '', second] = line.split(/\s+/);
  if (second === undefined) return feedHost(first);
  return isIP(first) ? feedHost(second) : null;
}

/** The hosts a feed's text lists; none when the text is markup rather than a feed. */
export function parseFeedHosts(text: string): Set<string> {
  const hosts = new Set<string>();
  if (MARKUP_LINE.test(text)) return hosts;
  for (const line of text.split(/\r?\n/)) {
    const host = lineHost(line);
    if (host) hosts.add(host);
  }
  return hosts;
}
