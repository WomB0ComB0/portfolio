// @vitest-environment node
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
 * @file IP helpers behind the ban list and the API guard: one canonical form per address and
 * range (so ban, unban and lookups agree), in-memory CIDR matching, and /64 rate-limit keys.
 */

import { describe, expect, it } from 'vitest';
import {
  findMatchingCidr,
  isLoopbackIp,
  normalizeCidr,
  normalizeIp,
  rateLimitKey,
} from '@/lib/security/ip';

describe('normalizeIp', () => {
  it('keeps IPv4 addresses as they are', () => {
    expect(normalizeIp('203.0.113.9')).toBe('203.0.113.9');
  });

  it('lower-cases and zero-compresses IPv6 addresses', () => {
    expect(normalizeIp('2001:DB8:0::1')).toBe('2001:db8::1');
    expect(normalizeIp('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
  });

  it('turns IPv4-mapped IPv6 into the IPv4 address, in dotted and hex form', () => {
    expect(normalizeIp('::ffff:203.0.113.9')).toBe('203.0.113.9');
    expect(normalizeIp('::FFFF:cb00:7109')).toBe('203.0.113.9');
  });

  it.each([
    '',
    'not-an-ip',
    'anonymous',
    '999.1.1.1',
    '01.2.3.4',
    '1.2.3',
    ' 203.0.113.9',
    '203.0.113.9/24',
    'fe80::1%eth0',
    '2001:db8::1/64',
  ])('rejects %j', (value) => {
    expect(normalizeIp(value)).toBeNull();
  });

  it('rejects non-strings', () => {
    expect(normalizeIp(undefined)).toBeNull();
    expect(normalizeIp(42)).toBeNull();
  });
});

describe('normalizeCidr', () => {
  it('clears host bits', () => {
    expect(normalizeCidr('203.0.113.77/24')).toBe('203.0.113.0/24');
    expect(normalizeCidr('2001:db8:aa:bb:1:2:3:4/64')).toBe('2001:db8:aa:bb::/64');
  });

  it('canonicalizes IPv6 ranges', () => {
    expect(normalizeCidr('2001:DB8::/32')).toBe('2001:db8::/32');
  });

  it('accepts /0 and full-length prefixes', () => {
    expect(normalizeCidr('203.0.113.9/0')).toBe('0.0.0.0/0');
    expect(normalizeCidr('203.0.113.9/32')).toBe('203.0.113.9/32');
    expect(normalizeCidr('2001:db8::1/128')).toBe('2001:db8::1/128');
  });

  it('turns an IPv4-mapped IPv6 range into the IPv4 range', () => {
    expect(normalizeCidr('::ffff:203.0.113.0/120')).toBe('203.0.113.0/24');
  });

  it.each([
    '203.0.113.7',
    '10.0.0.0/33',
    '2001:db8::/129',
    '10.0.0.0/',
    '10.0.0.0/x',
    '10.0.0.0/024',
    '10.0.0.0/8/8',
    '/8',
    'not-a-cidr/8',
    'fe80::%eth0/64',
  ])('rejects %j', (value) => {
    expect(normalizeCidr(value)).toBeNull();
  });
});

describe('findMatchingCidr', () => {
  const cidrs = ['198.51.100.0/24', '203.0.113.0/24', '2001:db8::/32'];

  it('matches IPv4 addresses inside a range and not outside', () => {
    expect(findMatchingCidr('203.0.113.200', cidrs)).toBe('203.0.113.0/24');
    expect(findMatchingCidr('203.0.114.1', cidrs)).toBeNull();
  });

  it('matches IPv6 addresses inside a range and not outside', () => {
    expect(findMatchingCidr('2001:db8:ffff::1', cidrs)).toBe('2001:db8::/32');
    expect(findMatchingCidr('2001:db9::1', cidrs)).toBeNull();
  });

  it('matches an IPv4-mapped address against an IPv4 range', () => {
    expect(findMatchingCidr('::ffff:203.0.113.9', cidrs)).toBe('203.0.113.0/24');
  });

  it('skips ranges of the other family and entries that do not parse', () => {
    expect(findMatchingCidr('203.0.113.9', ['2001:db8::/32', 'garbage', 42])).toBeNull();
    expect(findMatchingCidr('2001:db8::1', ['0.0.0.0/0'])).toBeNull();
  });

  it('matches a range stored without its host bits cleared', () => {
    expect(findMatchingCidr('203.0.113.9', ['203.0.113.77/24'])).toBe('203.0.113.77/24');
  });

  it('returns null for an invalid address or an empty list', () => {
    expect(findMatchingCidr('not-an-ip', cidrs)).toBeNull();
    expect(findMatchingCidr('203.0.113.9', [])).toBeNull();
  });
});

describe('rateLimitKey', () => {
  it('keys IPv4 by the address', () => {
    expect(rateLimitKey('203.0.113.9')).toBe('203.0.113.9');
  });

  it('keys IPv6 by its /64', () => {
    expect(rateLimitKey('2001:db8:aa:bb:1:2:3:4')).toBe('2001:db8:aa:bb::/64');
    expect(rateLimitKey('2001:db8:aa:bb::9')).toBe('2001:db8:aa:bb::/64');
    expect(rateLimitKey('2001:db8:aa:bc::1')).toBe('2001:db8:aa:bc::/64');
  });
});

describe('isLoopbackIp', () => {
  it('recognises IPv4 and IPv6 loopback', () => {
    expect(isLoopbackIp('127.0.0.1')).toBe(true);
    expect(isLoopbackIp('127.8.9.10')).toBe(true);
    expect(isLoopbackIp('::1')).toBe(true);
    expect(isLoopbackIp('203.0.113.9')).toBe(false);
    expect(isLoopbackIp('2001:db8::1')).toBe(false);
  });
});
