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
 * @file Every page document passes through the proxy (src/proxy.ts), whatever headers the client
 * sends, so it gets the CSP and the proxy's own x-url (the canonical link's path) and x-nonce.
 *
 * The matcher skipped any request with the router's prefetch header, so a page load that sent
 * `Next-Router-Prefetch: 1` without `RSC: 1` was answered as HTML with no CSP, its own x-url in
 * the canonical link and its own x-nonce on the scripts. A real router prefetch always sends both
 * headers and still skips the proxy, as before: it fetches a flight payload, not a document.
 * unstable_doesMiddlewareMatch is Next's own test helper for a proxy's `config.matcher`.
 */

import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: 'production',
  NEXT_PUBLIC_SENTRY_DSN: 'https://abc123@o42.ingest.us.sentry.io/7',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'example-app.firebaseapp.com',
}));
vi.mock('@/env', () => ({ env: mockEnv, default: mockEnv }));

import { config, proxy } from '@/proxy';

const SITE = 'https://mikeodnis.dev';

/** Whether the proxy runs for a GET of `path` with these request headers. */
const runsFor = (path: string, headers: Record<string, string> = {}): boolean =>
  unstable_doesMiddlewareMatch({ config, url: `${SITE}${path}`, headers });

const PREFETCH = { 'next-router-prefetch': '1' };
const RSC = { rsc: '1' };

describe('which requests pass through the proxy', () => {
  it('runs on a plain page load', () => {
    expect(runsFor('/media')).toBe(true);
    expect(runsFor('/projects/some-id')).toBe(true);
  });

  it('runs on a page load that sends the prefetch header without RSC: an HTML document', () => {
    expect(runsFor('/media', PREFETCH)).toBe(true);
    expect(runsFor('/', PREFETCH)).toBe(true);
    expect(runsFor('/places/a.b', { ...PREFETCH, 'x-url': '/elsewhere', 'x-nonce': 'n' })).toBe(
      true,
    );
  });

  it('runs on a client navigation, which sends RSC without the prefetch header', () => {
    expect(runsFor('/media?_rsc=1x2y3', RSC)).toBe(true);
  });

  // Next answers a flight payload only when RSC is exactly '1' (is-rsc-request.js); any other
  // value gets the HTML document, which must carry the CSP and the proxy's own headers.
  it('runs on a page load whose RSC header is not 1, with or without the prefetch header', () => {
    for (const rsc of ['0', 'true', '2', 'yes']) {
      expect(runsFor('/media', { ...PREFETCH, rsc }), `rsc ${rsc}`).toBe(true);
      expect(runsFor('/media', { 'next-router-prefetch': '0', rsc }), `rsc ${rsc}`).toBe(true);
      expect(runsFor('/projects', { rsc }), `rsc ${rsc}`).toBe(true);
    }
  });

  it('still skips a router prefetch, which sends RSC and the prefetch header together', () => {
    expect(runsFor('/media?_rsc=1x2y3', { ...RSC, ...PREFETCH })).toBe(false);
    expect(runsFor('/media?_rsc=1x2y3', { ...RSC, 'next-router-prefetch': '2' })).toBe(false);
    expect(runsFor('/media?_rsc=1x2y3', { ...RSC, 'next-router-prefetch': '3' })).toBe(false);
    expect(
      runsFor('/projects?_rsc=9z', {
        ...RSC,
        ...PREFETCH,
        'next-router-segment-prefetch': '/_tree',
      }),
    ).toBe(false);
  });

  // Any prefetch value skipped the proxy. Next counts only '1', '2' and '3' as a prefetch
  // (parse-request-headers.js) and renders the full payload for any other, which must carry the
  // proxy's own x-url and x-nonce, not the ones the client sent.
  it('runs on a flight request whose prefetch header is not one the router sends', () => {
    for (const prefetch of ['0', 'true', '4', '12', ' 1', '1, 1', '']) {
      expect(
        runsFor('/media?_rsc=1x2y3', { ...RSC, 'next-router-prefetch': prefetch }),
        prefetch,
      ).toBe(true);
      expect(
        runsFor('/projects', { ...RSC, 'next-router-prefetch': prefetch, 'x-url': '/x' }),
        prefetch,
      ).toBe(true);
    }
  });

  // Next reads `config` statically, so the source is written out twice: it must not drift.
  it('gives both matchers the one source, each skipping one of the two prefetch headers', () => {
    const [first, second] = config.matcher;

    expect(config.matcher).toHaveLength(2);
    expect(second?.source).toBe(first?.source);
    expect([first?.missing, second?.missing]).toEqual([
      [{ type: 'header', key: 'next-router-prefetch', value: '[123]' }],
      [{ type: 'header', key: 'rsc', value: '1' }],
    ]);
  });

  it('skips API routes and static files with or without either header', () => {
    for (const headers of [{}, PREFETCH, RSC, { ...RSC, ...PREFETCH }]) {
      for (const path of ['/api/v1/blog', '/_next/static/chunks/app.js', '/robots.txt', '/sw.js']) {
        expect(runsFor(path, headers), `${path} ${JSON.stringify(headers)}`).toBe(false);
      }
    }
  });
});

describe('what the proxy forwards for a page load', () => {
  it('replaces the path and nonce headers the client sent with its own', () => {
    const res = proxy(
      new NextRequest(`${SITE}/media/`, {
        headers: { ...PREFETCH, 'x-url': '/zqx7"><script>', 'x-nonce': 'client-nonce' },
      }),
    );
    const forwarded = (name: string) => res.headers.get(`x-middleware-request-${name}`);
    const nonce = forwarded('x-nonce');

    expect(forwarded('x-url')).toBe('/media');
    expect(nonce).toMatch(/^[A-Za-z0-9+/=_-]{16,}$/);
    expect(nonce).not.toBe('client-nonce');
    expect(res.headers.get('content-security-policy')).toContain(`'nonce-${nonce}'`);
  });

  // The canonical path's trailing slashes were dropped by '/+$', whose time grows with the square
  // of a slash run in the path; the request line is the client's to write. It is a loop now.
  it('drops trailing slashes from a path with a long slash run fast', () => {
    const run = '/'.repeat(100_000);
    const start = performance.now();
    const inside = proxy(new NextRequest(`${SITE}/media${run}x`));
    const atEnd = proxy(new NextRequest(`${SITE}/media${run}`));
    const root = proxy(new NextRequest(`${SITE}/`));
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(250);
    expect(inside.headers.get('x-middleware-request-x-url')).toBe(`/media${run}x`);
    expect(atEnd.headers.get('x-middleware-request-x-url')).toBe('/media');
    expect(root.headers.get('x-middleware-request-x-url')).toBe('/');
  });
});
