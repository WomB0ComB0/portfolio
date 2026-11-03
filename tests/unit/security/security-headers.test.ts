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
 * @file The static security headers must apply to every path. The previous rule's source ended in
 * '/', which Next compiles to a regex requiring a trailing slash, so normal pages never got them.
 * This compiles the source with Next's own route builder to catch that kind of mistake.
 */

import { buildCustomRoute } from 'next/dist/lib/build-custom-route';
import { describe, expect, it } from 'vitest';

import { SECURITY_HEADERS, SECURITY_HEADERS_SOURCE } from '@/config/security-headers';

const header = (key: string) => SECURITY_HEADERS.find((h) => h.key === key)?.value;

describe('static security headers', () => {
  const route = buildCustomRoute('header', {
    source: SECURITY_HEADERS_SOURCE,
    headers: [...SECURITY_HEADERS],
  });
  const matches = (path: string) => new RegExp(route.regex).test(path);

  it('applies to every path, with or without a trailing slash', () => {
    for (const path of [
      '/',
      '/projects',
      '/projects/',
      '/places/abc',
      '/api/health',
      '/_next/static/chunks/x.js',
      '/favicon.ico',
    ]) {
      expect(matches(path), path).toBe(true);
    }
  });

  it('sets the expected values', () => {
    expect(header('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains');
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(header('X-XSS-Protection')).toBe('0');
  });

  it('keeps Firebase sign-in popups working (COOP must allow popups)', () => {
    expect(header('Cross-Origin-Opener-Policy')).toBe('same-origin-allow-popups');
  });

  it('does not opt into the HSTS preload list or block the photo viewer fullscreen', () => {
    expect(header('Strict-Transport-Security')).not.toContain('preload');
    expect(header('Permissions-Policy')).not.toContain('fullscreen');
  });

  it('leaves the CSP and cross-origin isolation to other layers', () => {
    const keys = SECURITY_HEADERS.map((h) => h.key.toLowerCase());
    expect(keys).not.toContain('content-security-policy');
    expect(keys).not.toContain('content-security-policy-report-only');
    // COEP require-corp blocks the Places map and the résumé PDF; nothing needs isolation.
    expect(keys).not.toContain('cross-origin-embedder-policy');
  });
});
