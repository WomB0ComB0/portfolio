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
 * @file src/lib/free-books/url-screen.ts: the runtime gate every catalog link passes, and the trust
 * tier it gives each host.
 */

import { describe, expect, it } from 'vitest';
import { classifyHostTrustTier, screenExternalBookUrl } from '@/lib/free-books/url-screen';

describe('screenExternalBookUrl', () => {
  it('blocks unsafe URLs (SSRF/IP, credentials, executables, double extensions, punycode, abuse TLDs)', () => {
    expect(screenExternalBookUrl('https://doc.rust-lang.org/book/')).toMatchObject({
      safe: true,
      insecureTransport: false,
      blockReason: null,
    });
    expect(screenExternalBookUrl('http://example.com/book.pdf')).toMatchObject({
      safe: true,
      insecureTransport: true,
    });

    expect(screenExternalBookUrl('https://user:pass@example.com/book.pdf').blockReason).toBe(
      'embedded_credentials',
    );
    expect(screenExternalBookUrl('https://example.com:8443/book.pdf').blockReason).toBe(
      'non_default_port',
    );
    expect(screenExternalBookUrl('http://127.0.0.1/admin').blockReason).toBe(
      'private_or_literal_ip',
    );
    expect(screenExternalBookUrl('http://169.254.169.254/latest/meta-data').blockReason).toBe(
      'private_or_literal_ip',
    );
    expect(screenExternalBookUrl('https://example.com/manual.pdf.exe').blockReason).toBe(
      'double_extension_spoof',
    );
    expect(screenExternalBookUrl('https://example.com/installer.dmg').blockReason).toBe(
      'executable_payload',
    );
    expect(screenExternalBookUrl('https://xn--pple-43d.com/book').blockReason).toBe(
      'punycode_homograph',
    );
    expect(screenExternalBookUrl('https://freebooks.tk/rust').blockReason).toBe('high_abuse_tld');
  });
});

describe('classifyHostTrustTier', () => {
  it('trusts known publishers, git hosts and academic domains, and nothing else', () => {
    expect(classifyHostTrustTier('github.com')).toBe('verified');
    expect(classifyHostTrustTier('cdn.mikeodnis.dev')).toBe('verified');
    expect(classifyHostTrustTier('ocw.mit.edu')).toBe('verified');
    expect(classifyHostTrustTier('random-independent-blog.org')).toBe('external');
  });
});
