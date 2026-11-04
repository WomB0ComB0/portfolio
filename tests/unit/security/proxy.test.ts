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
 * @file The proxy must put the CSP on the forwarded REQUEST (App Router reads the nonce from
 * there), and its matcher must cover pages but skip API routes, static files and prefetches.
 */

import * as pageStaticInfo from 'next/dist/build/analysis/get-page-static-info';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Next compiles `config.matcher` with this function. It isn't in Next's published type
// declarations, so it is typed here; the test fails loudly if it ever disappears.
const { getMiddlewareMatchers } = pageStaticInfo as unknown as {
  getMiddlewareMatchers: (
    matcher: unknown,
    nextConfig: { basePath: string; i18n: null },
  ) => Array<{ regexp: string; missing?: unknown[] }>;
};

vi.mock('@/env', () => {
  const env = {
    NODE_ENV: 'production',
    NEXT_PUBLIC_SENTRY_DSN: 'https://abc123@o42.ingest.us.sentry.io/7',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'example-app.firebaseapp.com',
  };
  return { env, default: env };
});

import { config, proxy } from '@/proxy';

const CSP = 'content-security-policy';
const REPORT_ONLY = 'content-security-policy-report-only';
/** NextResponse.next({ request: { headers } }) forwards request headers with this prefix. */
const forwarded = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('proxy', () => {
  it('sends the same nonce CSP on the response and the forwarded request', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const res = proxy(new NextRequest('https://mikeodnis.dev/projects'));

    const nonce = forwarded(res, 'x-nonce');
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(res.headers.get(CSP)).toContain(`'nonce-${nonce}'`);
    expect(forwarded(res, CSP)).toBe(res.headers.get(CSP));
    // Enforced: no report-only copy alongside it.
    expect(res.headers.get(REPORT_ONLY)).toBeNull();
    expect(forwarded(res, REPORT_ONLY)).toBeNull();
  });

  it('enforces, with upgrade-insecure-requests', () => {
    const csp = proxy(new NextRequest('https://mikeodnis.dev/')).headers.get(CSP) ?? '';
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).toContain("'strict-dynamic'");
  });

  it('keeps preview deployments report-only', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    const res = proxy(new NextRequest('https://mikeodnis.dev/'));
    expect(res.headers.get(CSP)).toBeNull();
    expect(res.headers.get(REPORT_ONLY)).toContain(`'nonce-${forwarded(res, 'x-nonce')}'`);
    expect(res.headers.get(REPORT_ONLY)).not.toContain('upgrade-insecure-requests');
  });

  it('uses a fresh nonce per request', () => {
    const a = forwarded(proxy(new NextRequest('https://mikeodnis.dev/')), 'x-nonce');
    const b = forwarded(proxy(new NextRequest('https://mikeodnis.dev/')), 'x-nonce');
    expect(a).not.toBe(b);
  });

  it('forwards a canonical path without a trailing slash', () => {
    expect(forwarded(proxy(new NextRequest('https://mikeodnis.dev/projects/')), 'x-url')).toBe(
      '/projects',
    );
    expect(forwarded(proxy(new NextRequest('https://mikeodnis.dev/')), 'x-url')).toBe('/');
    expect(forwarded(proxy(new NextRequest('https://mikeodnis.dev/places/abc?x=1')), 'x-url')).toBe(
      '/places/abc',
    );
  });

  it('asks for violation reports on a sampled share of responses', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const sampled = proxy(new NextRequest('https://mikeodnis.dev/'));
    expect(sampled.headers.get(CSP)).toContain(
      'report-uri https://o42.ingest.us.sentry.io/api/7/security/?sentry_key=abc123',
    );
    expect(sampled.headers.get('reporting-endpoints')).toMatch(
      /^csp-endpoint="https:\/\/o42\.ingest/,
    );

    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const unsampled = proxy(new NextRequest('https://mikeodnis.dev/'));
    expect(unsampled.headers.get(CSP)).not.toContain('report-uri');
    expect(unsampled.headers.get('reporting-endpoints')).toBeNull();
  });

  it('frames only the Firebase auth domain and Sanity', () => {
    const csp = proxy(new NextRequest('https://mikeodnis.dev/')).headers.get(CSP) ?? '';
    expect(csp).toContain('frame-src https://cdn.sanity.io https://example-app.firebaseapp.com');
  });

  it('replaces any CSP headers the client sent (Next reads the nonce from them)', () => {
    const res = proxy(
      new NextRequest('https://mikeodnis.dev/', {
        headers: {
          'content-security-policy': "script-src 'nonce-ATTACKER'",
          'content-security-policy-report-only': "script-src 'nonce-ATTACKER'",
        },
      }),
    );
    expect(forwarded(res, REPORT_ONLY)).toBeNull();
    expect(forwarded(res, CSP)).not.toContain('ATTACKER');
    expect(forwarded(res, CSP)).toContain(`'nonce-${forwarded(res, 'x-nonce')}'`);
  });
});

describe('proxy matcher', () => {
  const [matcher] = getMiddlewareMatchers(config.matcher, { basePath: '', i18n: null });
  if (!matcher) throw new Error('the proxy config has no matcher');
  const runsOn = (path: string) => new RegExp(matcher.regexp).test(path);

  it('runs on pages (App Router navigations fetch the same path with ?_rsc, so they match too)', () => {
    for (const path of [
      '/',
      '/projects',
      '/places/85e15937-eb9a-4fbb-99b9-c5425fe38ab5',
      '/stats',
      '/resume',
      // Dynamic pages render HTML for dotted URLs too, including ones that end in a file
      // extension, so neither a dot nor an extension may skip the CSP.
      '/places/a.b',
      '/places/item.png',
      '/projects/x.json',
      '/experience/1.2',
      '/apiary',
      '/assetsx',
    ]) {
      expect(runsOn(path), path).toBe(true);
    }
  });

  it('skips API routes, static files, internals, the Sentry tunnel and OG images', () => {
    for (const path of [
      '/api/v1/blog',
      '/api/health',
      '/_next/static/chunks/app.js',
      '/_next/image',
      '/_vercel/insights/script.js',
      '/69a49a618619fab6/script.js',
      '/monitoring',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml',
      '/manifest.webmanifest',
      '/assets/fonts/x.ttf',
      '/pwa/icon-192.png',
      '/sw.js',
      '/llms.txt',
      '/opengraph-image',
      '/opengraph-image.png',
      '/twitter-image',
      '/twitter-image.png',
    ]) {
      expect(runsOn(path), path).toBe(false);
    }
  });

  it('skips router prefetches', () => {
    expect(matcher.missing).toEqual([{ type: 'header', key: 'next-router-prefetch' }]);
  });
});
