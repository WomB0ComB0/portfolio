/**
 * Copyright 2025 Mike Odnis
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

import { isIP } from 'node:net';
import { findMatchingCidr, normalizeIp } from '@/lib/security/ip';

export interface PublicAddress {
  readonly address: string;
  readonly family: 4 | 6;
}

/** Conservative public-unicast policy, including IANA documentation/benchmark ranges. */
const BLOCKED_V4 = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.88.99.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
  // Azure's platform/WireServer address is public-looking but reaches host infrastructure.
  '168.63.129.16/32',
] as const;

/** Protocol assignments, tunnelling and documentation are not ordinary public web targets. */
const BLOCKED_V6 = ['2001::/23', '2001:db8::/32', '2002::/16', '3ffe::/16', '3fff::/20'];
const LOCAL_NAMES = ['localhost', 'local', 'localdomain', 'internal', 'home.arpa'];

/**
 * IPv4-mapped IPv6 is normalized first, so it cannot hide a private IPv4 address. Other
 * translation/tunnel ranges are excluded by the IPv6 global-unicast allowlist and exceptions.
 * Sources: https://www.iana.org/assignments/iana-ipv4-special-registry/
 * https://www.iana.org/assignments/iana-ipv6-special-registry/
 */
export function publicAddress(raw: string): PublicAddress | null {
  const address = normalizeIp(raw);
  if (!address) return null;
  const family = isIP(address);
  if (family === 4) return findMatchingCidr(address, BLOCKED_V4) ? null : { address, family };
  if (family !== 6 || !findMatchingCidr(address, ['2000::/3'])) return null;
  return findMatchingCidr(address, BLOCKED_V6) ? null : { address, family };
}

/** URL.hostname retains brackets around an IPv6 literal. */
export function probeHostname(url: URL): string {
  return url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname;
}

/** Skip local resolver namespaces before DNS, without excluding any public service host. */
export function publicHostname(hostname: string): boolean {
  if (isIP(hostname)) return publicAddress(hostname) !== null;
  const name = hostname.toLowerCase().replace(/\.$/u, '');
  return (
    name.includes('.') && !LOCAL_NAMES.some((local) => name === local || name.endsWith(`.${local}`))
  );
}
