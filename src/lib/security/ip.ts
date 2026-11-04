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

/**
 * @file Pure IP helpers for the ban list and the request guard: canonical forms for IPs and
 * CIDRs (so one address always maps to one Redis member), in-memory CIDR matching, and the
 * rate-limit key (IPv6 is keyed by its /64, the usual size of one subscriber's allocation).
 */

import { isIP } from 'node:net';
import { Address4, Address6 } from 'ip-address';

type IpFamily = 4 | 6;

interface ParsedAddress {
  family: IpFamily;
  value: bigint;
}

interface ParsedCidr {
  family: IpFamily;
  network: bigint;
  mask: bigint;
}

/** ::ffff:0:0/96, the IPv4-mapped IPv6 range. Addresses in it are treated as IPv4. */
const MAPPED_V4 = new Address6('::ffff:0:0/96');
const MAPPED_V4_BITS = 96;
/** Longest textual IPv6 form (with an embedded IPv4 tail); anything longer is not an IP. */
const MAX_IP_LENGTH = 45;
const MAX_CIDR_LENGTH = MAX_IP_LENGTH + 4;
/** Prefix length without leading zeros: 0-999 here, range-checked per family below. */
const PREFIX_PATTERN = /^(?:0|[1-9]\d{0,2})$/;
/** IPv6 rate-limit keys cover the whole /64. */
const IPV6_KEY_BITS = 64;
/** Parsed CIDRs are cached per instance; the cache is dropped when it grows past this size. */
const CIDR_CACHE_LIMIT = 1024;

const cidrCache = new Map<string, ParsedCidr | null>();

const familyWidth = (family: IpFamily): bigint => (family === 4 ? 32n : 128n);

function prefixMask(family: IpFamily, prefix: number): bigint {
  const width = familyWidth(family);
  const hostBits = width - BigInt(prefix);
  return ((1n << width) - 1n) ^ ((1n << hostBits) - 1n);
}

/**
 * Canonical text form of an IP address, or null if the input is not a plain IP.
 *
 * IPv4 stays dotted-quad; IPv6 is lower-cased and zero-compressed (RFC 5952); IPv4-mapped IPv6
 * (::ffff:203.0.113.9) becomes the IPv4 address. Zone ids, CIDR suffixes, surrounding spaces and
 * IPv4 octets with leading zeros are rejected.
 *
 * @param {unknown} raw - Candidate address.
 * @returns {string | null} The canonical address, or null.
 * @example normalizeIp('2001:DB8:0::1'); // '2001:db8::1'
 */
export function normalizeIp(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_IP_LENGTH) return null;
  if (raw.includes('%')) return null;
  try {
    const family = isIP(raw);
    if (family === 4) return new Address4(raw).correctForm();
    if (family === 6) {
      const address = new Address6(raw);
      return address.isInSubnet(MAPPED_V4) ? address.to4().correctForm() : address.correctForm();
    }
  } catch {
    // Fall through: anything ip-address rejects is not a usable IP.
  }
  return null;
}

/**
 * Canonical text form of a CIDR range, or null if the input is not one.
 *
 * Host bits are cleared (203.0.113.77/24 becomes 203.0.113.0/24) so a range has one stored form
 * and unban matches ban. An IPv4-mapped IPv6 range of /96 or longer becomes the IPv4 range,
 * matching how {@link normalizeIp} treats mapped addresses. A bare IP (no prefix) is rejected.
 *
 * @param {unknown} raw - Candidate range, e.g. '203.0.113.0/24' or '2001:db8::/32'.
 * @returns {string | null} The canonical range, or null.
 */
export function normalizeCidr(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > MAX_CIDR_LENGTH) return null;
  const slash = raw.indexOf('/');
  if (slash <= 0 || slash !== raw.lastIndexOf('/')) return null;
  const host = raw.slice(0, slash);
  const bits = raw.slice(slash + 1);
  if (!PREFIX_PATTERN.test(bits) || host.includes('%')) return null;
  const prefix = Number(bits);

  try {
    const family = isIP(host);
    if (family === 4 && prefix <= 32) {
      return `${new Address4(`${host}/${prefix}`).startAddress().correctForm()}/${prefix}`;
    }
    if (family === 6 && prefix <= 128) {
      const range = new Address6(`${host}/${prefix}`);
      if (prefix >= MAPPED_V4_BITS && range.isInSubnet(MAPPED_V4)) {
        const v4Prefix = prefix - MAPPED_V4_BITS;
        const v4Host = range.to4().correctForm();
        return `${new Address4(`${v4Host}/${v4Prefix}`).startAddress().correctForm()}/${v4Prefix}`;
      }
      return `${range.startAddress().correctForm()}/${prefix}`;
    }
  } catch {
    // Fall through: not a valid range.
  }
  return null;
}

/** Numeric form of an address already in {@link normalizeIp} form. */
function parseAddress(ip: string): ParsedAddress | null {
  try {
    const family = isIP(ip);
    if (family === 4) return { family, value: new Address4(ip).bigInt() };
    if (family === 6) return { family, value: new Address6(ip).bigInt() };
  } catch {
    // Not an address.
  }
  return null;
}

function parseCidr(cidr: string): ParsedCidr | null {
  if (cidrCache.has(cidr)) return cidrCache.get(cidr) ?? null;

  let parsed: ParsedCidr | null = null;
  const normalized = normalizeCidr(cidr);
  if (normalized) {
    const [host = '', bits = ''] = normalized.split('/');
    const network = parseAddress(host);
    if (network) {
      const mask = prefixMask(network.family, Number(bits));
      parsed = { family: network.family, network: network.value & mask, mask };
    }
  }

  if (cidrCache.size >= CIDR_CACHE_LIMIT) cidrCache.clear();
  cidrCache.set(cidr, parsed);
  return parsed;
}

/**
 * First range in `cidrs` that contains `ip`, or null. Ranges of the other address family and
 * entries that do not parse are skipped. Parsed ranges are cached per instance.
 *
 * @param {string} ip - The client address (any form {@link normalizeIp} accepts).
 * @param {readonly unknown[]} cidrs - Candidate ranges, typically the active ban list.
 * @returns {string | null} The matching range as given in `cidrs`, or null.
 */
export function findMatchingCidr(ip: string, cidrs: readonly unknown[]): string | null {
  if (cidrs.length === 0) return null;
  const normalized = normalizeIp(ip);
  const address = normalized ? parseAddress(normalized) : null;
  if (!address) return null;

  for (const entry of cidrs) {
    const cidr = String(entry);
    const range = parseCidr(cidr);
    if (
      range &&
      range.family === address.family &&
      (address.value & range.mask) === range.network
    ) {
      return cidr;
    }
  }
  return null;
}

/**
 * Identifier for the rate limiter: the IPv4 address itself, or the /64 network of an IPv6
 * address (one subscriber usually holds a whole /64, so per-address keys would be trivial to
 * rotate through).
 *
 * @param {string} ip - An address in {@link normalizeIp} form.
 * @returns {string} The rate-limit key, e.g. '203.0.113.9' or '2001:db8:aa:bb::/64'.
 */
export function rateLimitKey(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  try {
    return `${new Address6(`${ip}/${IPV6_KEY_BITS}`).startAddress().correctForm()}/${IPV6_KEY_BITS}`;
  } catch {
    return ip;
  }
}

/**
 * True for loopback addresses (127.0.0.0/8 and ::1).
 *
 * @param {string} ip - An address in {@link normalizeIp} form.
 * @returns {boolean} Whether the address is loopback.
 */
export function isLoopbackIp(ip: string): boolean {
  return ip === '::1' || (isIP(ip) === 4 && ip.startsWith('127.'));
}
