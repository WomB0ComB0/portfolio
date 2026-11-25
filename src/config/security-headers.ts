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
  // Two years. Every *.mikeodnis.dev host serves HTTPS and .dev is HSTS-preloaded at the TLD
  // level, so includeSubDomains and preload are safe across the entire constellation.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
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
  // Protect documents and first-party chunks from cross-site no-cors reads while keeping
  // *.mikeodnis.dev companion properties working; API routes tighten this to same-origin and
  // public social-preview/icon routes relax it to cross-origin below.
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  // The legacy XSS auditor is gone from browsers and could itself be abused; 0 disables it.
  { key: 'X-XSS-Protection', value: '0' },
];

/** Path pattern for the API rule: `/api` and every path under it. */
export const API_SECURITY_HEADERS_SOURCE = '/api/:path*';

/**
 * Extra headers for API responses, on top of SECURITY_HEADERS. The Elysia routes return JSON and
 * /api/og returns a PNG: none of them loads subresources or is meant to be framed, so the CSP
 * allows nothing. CORP same-origin tightens the global same-site default so other sites cannot
 * load API responses as no-cors subresources (img/script tags). It does not affect CORS fetches,
 * or link-preview crawlers, which fetch server-side.
 */
export const API_SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'Content-Security-Policy', value: "default-src 'none'; frame-ancestors 'none'" },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];

/** Path pattern for the link-preview image route (`/api/og` and anything under it). */
export const OG_IMAGE_HEADERS_SOURCE = '/api/og/:path*';

/**
 * Public routes intended to be embedded or fetched cross-origin (social cards, icons, PWA
 * assets, and RFC 9116 security.txt). Listed after the global and API rules in next.config.ts so
 * their cross-origin CORP wins.
 */
export const CROSS_ORIGIN_RESOURCE_SOURCES: ReadonlyArray<string> = [
  OG_IMAGE_HEADERS_SOURCE,
  '/opengraph-image',
  '/twitter-image',
  '/favicon.ico',
  '/pwa/:path*',
  '/assets/:path*',
  '/.well-known/security.txt',
];

/**
 * The link-preview images and public icon assets are meant to be embedded by other sites,
 * including ones that render previews in the browser, so they relax CORP to cross-origin.
 */
export const OG_IMAGE_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
];

/**
 * Bookshelf routes contain outbound links to hundreds of external book hosts and never invoke
 * Firebase OAuth popups, so they tighten COOP to strict `same-origin` process/browsing-context
 * isolation (protecting against cross-origin window/spectre side-channels).
 */
export const BOOKSHELF_COOP_SOURCES: ReadonlyArray<string> = ['/bookshelf', '/bookshelf/:path*'];

export const BOOKSHELF_COOP_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];
