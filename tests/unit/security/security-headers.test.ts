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
import { describe, expect, it, vi } from 'vitest';

import {
  API_SECURITY_HEADERS,
  API_SECURITY_HEADERS_SOURCE,
  SECURITY_HEADERS,
  SECURITY_HEADERS_SOURCE,
} from '@/config/security-headers';
import nextConfig from '../../../next.config';

// next.config.ts is loaded for its headers() only: stub the env validation and the build wrappers.
vi.mock('@/env', () => ({ env: {} }));
vi.mock('@ducanh2912/next-pwa', () => ({ default: () => (config: unknown) => config }));
vi.mock('@million/lint', () => ({ default: { next: () => (config: unknown) => config } }));
vi.mock('@next/bundle-analyzer', () => ({ default: () => (config: unknown) => config }));
vi.mock('@sentry/nextjs/config', () => ({ withSentryConfig: (config: unknown) => config }));

const header = (key: string) => SECURITY_HEADERS.find((h) => h.key === key)?.value;
const apiHeader = (key: string) => API_SECURITY_HEADERS.find((h) => h.key === key)?.value;

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

describe('API security headers', () => {
  const route = buildCustomRoute('header', {
    source: API_SECURITY_HEADERS_SOURCE,
    headers: [...API_SECURITY_HEADERS],
  });
  const matches = (path: string) => new RegExp(route.regex).test(path);

  it('applies to /api and everything under it', () => {
    for (const path of [
      '/api',
      '/api/',
      '/api/health',
      '/api/status',
      '/api/does-not-exist',
      '/api/admin/ban',
      '/api/v1/sanity/places',
      '/api/og',
    ]) {
      expect(matches(path), path).toBe(true);
    }
  });

  it('does not apply to pages whose path only starts with "api"', () => {
    for (const path of ['/', '/apiary', '/places', '/projects/api']) {
      expect(matches(path), path).toBe(false);
    }
  });

  it('allows no subresources, no framing and same-origin embedding only', () => {
    expect(apiHeader('Content-Security-Policy')).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(apiHeader('Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(API_SECURITY_HEADERS).toHaveLength(2);
  });

  it('shares no header with the global rule, so the two rules never compete', () => {
    const globalKeys = new Set(SECURITY_HEADERS.map((h) => h.key.toLowerCase()));
    for (const { key } of API_SECURITY_HEADERS) {
      expect(globalKeys.has(key.toLowerCase()), key).toBe(false);
    }
  });
});

describe('next.config.ts headers()', () => {
  /** The headers Next would send for a path: every matching rule, later rules winning per key. */
  const headersFor = async (path: string) => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const out = new Map<string, string>();
    for (const rule of rules) {
      if (!new RegExp(buildCustomRoute('header', rule).regex).test(path)) continue;
      for (const { key, value } of rule.headers) out.set(key.toLowerCase(), value);
    }
    return out;
  };

  it('sends the API headers next to the CORS and no-store headers on /api', async () => {
    for (const path of ['/api/health', '/api/v1/sanity/places', '/api/does-not-exist']) {
      const headers = await headersFor(path);
      for (const { key, value } of [...SECURITY_HEADERS, ...API_SECURITY_HEADERS]) {
        expect(headers.get(key.toLowerCase()), `${path} ${key}`).toBe(value);
      }
      expect(headers.get('access-control-allow-credentials'), path).toBe('true');
      expect(headers.get('access-control-allow-origin'), path).toBeTruthy();
      expect(headers.get('cache-control'), path).toContain('no-store');
    }
  });

  it('lets other sites embed the link-preview images, and nothing else under /api', async () => {
    for (const path of ['/api/og', '/api/og/']) {
      const headers = await headersFor(path);
      expect(headers.get('cross-origin-resource-policy'), path).toBe('cross-origin');
      expect(headers.get('content-security-policy'), path).toBe(
        "default-src 'none'; frame-ancestors 'none'",
      );
    }
    for (const path of ['/api/health', '/api/v1/og', '/api/ogx']) {
      expect((await headersFor(path)).get('cross-origin-resource-policy'), path).toBe(
        'same-origin',
      );
    }
  });

  it('keeps the API-only headers off pages', async () => {
    for (const path of ['/', '/places', '/apiary']) {
      const headers = await headersFor(path);
      expect(headers.get('strict-transport-security'), path).toBeTruthy();
      expect(headers.has('content-security-policy'), path).toBe(false);
      expect(headers.has('cross-origin-resource-policy'), path).toBe(false);
    }
  });
});
