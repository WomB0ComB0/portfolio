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
 * Static security headers, sent on every response (pages, API routes, static files and 404s)
 * through next.config.ts `headers()`. They don't depend on the request, so they also survive any
 * error in the proxy.
 *
 * The page Content-Security-Policy is NOT here: it carries a per-request nonce, so src/proxy.ts
 * sets it. Keep the two sets of keys disjoint so neither layer overrides the other. The proxy
 * skips /api, so API responses get their CSP from API_SECURITY_HEADERS below instead.
 *
 * The Elysia API sets none of these headers itself: on Vercel a header set by the function
 * replaces the next.config.ts value for the same key.
 *
 * Kept free of imports so next.config.ts and the tests can load it directly.
 */

/** Path pattern for the global rule: every path, including `/` and nested paths. */
export const SECURITY_HEADERS_SOURCE = '/:path*';

export const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  // Two years. Every *.mikeodnis.dev host serves HTTPS (checked 2026-11-03), so includeSubDomains
  // is safe. `preload` is deliberately left out: submitting to the preload list is hard to undo.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Nothing embeds this site. The proxy's CSP adds frame-ancestors 'none' for modern browsers.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Features the site never uses. fullscreen keeps its default ('self') for the photo viewer.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
  // same-origin-allow-popups (not same-origin) keeps Firebase's Google/GitHub sign-in popups working.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  // The legacy XSS auditor is gone from browsers and could itself be abused; 0 disables it.
  { key: 'X-XSS-Protection', value: '0' },
];

/** Path pattern for the API rule: `/api` and every path under it. */
export const API_SECURITY_HEADERS_SOURCE = '/api/:path*';

/**
 * Extra headers for API responses, on top of SECURITY_HEADERS. The Elysia routes return JSON and
 * /api/og returns a PNG: none of them loads subresources or is meant to be framed, so the CSP
 * allows nothing. CORP same-origin stops other sites from loading these responses as no-cors
 * subresources (img/script tags). It does not affect CORS fetches, or link-preview crawlers, which
 * fetch server-side.
 * Keep the keys disjoint from SECURITY_HEADERS so the two next.config.ts rules never compete.
 */
export const API_SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'Content-Security-Policy', value: "default-src 'none'; frame-ancestors 'none'" },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];

/** Path pattern for the link-preview image route (`/api/og` and anything under it). */
export const OG_IMAGE_HEADERS_SOURCE = '/api/og/:path*';

/**
 * The link-preview images are meant to be embedded by other sites, including ones that render
 * previews in the browser, so they relax the API's same-origin CORP. next.config.ts lists this
 * rule after the API rule: for a key set by two matching rules, the later rule wins.
 */
export const OG_IMAGE_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
];
