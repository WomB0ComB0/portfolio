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

import { describe, expect, it } from 'vitest';
import { normalizeLinkUrl } from '@/lib/link-health/url';

describe('normalizeLinkUrl', () => {
  it.each([
    ['HTTPS://Example.COM:443/docs/../guide?q=a%20b#part', 'https://example.com/guide?q=a%20b'],
    [' http://example.com:80/ ', 'http://example.com/'],
    ['https://example.com/?tag=b&tag=a', 'https://example.com/?tag=b&tag=a'],
    ['https://bücher.de/read#one', 'https://xn--bcher-kva.de/read'],
    ['https://github.com/owner/repository', 'https://github.com/owner/repository'],
    ['https://youtube.com/watch?v=abcdef12345', 'https://youtube.com/watch?v=abcdef12345'],
    ['https://[2606:4700:4700::1111]/#one', 'https://[2606:4700:4700::1111]/'],
  ])('canonicalizes %s without changing path/query semantics', (input, expected) => {
    expect(normalizeLinkUrl(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    42,
    {},
    '',
    '/relative',
    '//example.com/path',
    'https:example.com',
    'ftp://example.com/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'https://user:password@example.com/',
    'https://user@example.com/',
    'https://example.com:8443/',
    'http://example.com:443/',
    'https://example.com:80/',
    'https://exa\nmple.com/',
    'https://example.com/\tpath',
    'https://example.com/\\path',
    'https://[fe80::1%25eth0]/',
    'https://',
    `https://example.com/${'a'.repeat(2048)}`,
  ])('rejects malformed, credentialed or unsupported targets: %s', (input) => {
    expect(normalizeLinkUrl(input)).toBeNull();
  });

  it('uses WHATWG host canonicalization; the server probe owns IP safety', () => {
    expect(normalizeLinkUrl('http://0x7f000001/')).toBe('http://127.0.0.1/');
    expect(normalizeLinkUrl('http://2130706433/')).toBe('http://127.0.0.1/');
  });
});
