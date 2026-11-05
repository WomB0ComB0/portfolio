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
 * The site's Content-Security-Policy, built per request around a nonce (src/proxy.ts).
 *
 * The allowlists come from crawling every route of the live site in Chromium (2026-11-03) plus
 * sources the crawl could not trigger: YouTube thumbnails, the Firebase sign-in iframe and Google
 * Maps. App Router soft navigations keep the CSP of the first document, so there is one policy
 * for the whole site rather than one per route.
 *
 * Deliberately absent:
 * - Trusted Types: Next/Turbopack's chunk loader, next/script, Vercel Analytics, Speculation Rules
 *   and Google Maps all write to TT sinks without a policy, so enforcing it blanks the site.
 * - 'unsafe-eval' in production: nothing needs it. Zod's eval probe is turned off with
 *   z.config({ jitless: true }), and Google Maps only needs WebAssembly compilation, which
 *   'wasm-unsafe-eval' allows without allowing JavaScript eval (checked in Chromium on /places with
 *   the vector map, 2026-11-03).
 */

export type CspMode = 'report-only' | 'enforce';

/**
 * Enforced since 2026-11-04, after report-only from 2026-11-03 (#571, #572, #573) and an enforced
 * crawl of every route with no violations. This is the kill switch: set it back to 'report-only'
 * to stop blocking. Sampled violation reports reach Sentry in both modes.
 */
export const CSP_MODE: CspMode = 'enforce';

/**
 * The mode for one deployment. Preview deployments stay report-only: Vercel's preview toolbar
 * injects a script without our nonce, which an enforced policy would block.
 */
export function effectiveCspMode(vercelEnv: string | undefined): CspMode {
  return vercelEnv === 'preview' ? 'report-only' : CSP_MODE;
}

/** Share of responses that ask the browser to send violation reports, to bound Sentry volume. */
export const CSP_REPORT_SAMPLE_RATE = 0.1;

/**
 * The report sampling rate for one deployment: production only. Previews are report-only and
 * Vercel's toolbar there always violates the policy, and local runs must not reach Sentry.
 */
export function cspReportSampleRate(vercelEnv: string | undefined): number {
  return vercelEnv === 'production' ? CSP_REPORT_SAMPLE_RATE : 0;
}

export interface CspOptions {
  /** Base64 nonce, unique per request. */
  nonce: string;
  /** Development adds 'unsafe-eval' (React's dev build) and websocket HMR. */
  isDev: boolean;
  mode: CspMode;
  /** Firebase Auth domain, e.g. my-project.firebaseapp.com (its /__/auth/iframe is framed). */
  firebaseAuthDomain?: string;
  /** Where browsers POST violation reports; omit to send none. */
  reportUri?: string;
}

const GOOGLE_ANALYTICS = [
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
  'https://*.googletagmanager.com',
];
const GOOGLE_MAPS = ['https://maps.googleapis.com', 'https://maps.gstatic.com'];
/** The Maps JS bundle injects a Google Fonts stylesheet (InfoWindow, attribution). */
const GOOGLE_FONTS_STYLES = 'https://fonts.googleapis.com';
const GOOGLE_FONTS_FILES = 'https://fonts.gstatic.com';
const FIREBASE_AUTH_APIS = [
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
];

/** Builds the policy string (directives joined by '; '). */
export function buildContentSecurityPolicy(options: CspOptions): string {
  const { nonce, isDev, mode, firebaseAuthDomain, reportUri } = options;
  const firebaseFrame = firebaseAuthDomain ? [`https://${firebaseAuthDomain}`] : [];

  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    // 'strict-dynamic' lets nonce'd scripts load their dependencies (Next chunks, gtag, Maps,
    // Firebase); 'self' and https: are ignored by CSP3 browsers and only serve older ones.
    [
      'script-src',
      [
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        'https:',
        // Google Maps' vector renderer compiles WebAssembly (label placement, on the page and in its
        // blob: worker). Without this the map has no labels. It does not allow JavaScript eval.
        "'wasm-unsafe-eval'",
        ...(isDev ? ["'unsafe-eval'"] : []),
      ],
    ],
    // React, Motion and Maps set inline styles; nonce'ing styles isn't practical here.
    ['style-src', ["'self'", "'unsafe-inline'", GOOGLE_FONTS_STYLES]],
    [
      'img-src',
      [
        "'self'",
        'data:',
        'blob:',
        ...GOOGLE_ANALYTICS,
        ...GOOGLE_MAPS,
        'https://cdn.discordapp.com', // Discord avatar on /stats
        'https://img.youtube.com', // video thumbnails on /media (unoptimized)
      ],
    ],
    ['font-src', ["'self'", GOOGLE_FONTS_FILES]],
    [
      'connect-src',
      [
        "'self'",
        ...GOOGLE_ANALYTICS,
        'https://www.google.com', // GA collect beacons (Google Signals)
        'https://api.monkeytype.com', // /stats
        ...GOOGLE_MAPS,
        // Maps' vector renderer fetches its style set from www.gstatic.com/maps/res/; without it the
        // vector map renders blank.
        'https://www.gstatic.com',
        // Clicking a point-of-interest icon makes Maps fetch the place's details (Places API).
        'https://places.googleapis.com',
        'data:', // Maps (per Google's Maps CSP guide)
        'blob:',
        ...FIREBASE_AUTH_APIS,
        ...(isDev ? ['ws:', 'wss:'] : []),
      ],
    ],
    // Résumé PDF on /resume, and Firebase's sign-in helper iframe.
    ['frame-src', ['https://cdn.sanity.io', ...firebaseFrame]],
    ['worker-src', ["'self'", 'blob:']], // Maps renders tiles in a blob: worker
    ['manifest-src', ["'self'"]],
    ['media-src', ["'self'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'none'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
  ];

  // Browsers ignore (and warn about) upgrade-insecure-requests in a report-only policy.
  const flags = mode === 'enforce' ? ['upgrade-insecure-requests'] : [];
  const reporting = reportUri ? [`report-uri ${reportUri}`, 'report-to csp-endpoint'] : [];

  return [
    ...directives.map(([name, values]) => `${name} ${values.join(' ')}`),
    ...flags,
    ...reporting,
  ].join('; ');
}

/** The response/request header that carries the policy for the given mode. */
export function cspHeaderName(
  mode: CspMode,
): 'Content-Security-Policy' | 'Content-Security-Policy-Report-Only' {
  return mode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
}

/** Tags for CSP reports, so each violation is tied to the deploy that served the policy. */
export interface CspReportTags {
  /** Sentry environment, e.g. VERCEL_ENV. */
  environment?: string;
  /** Sentry release: SENTRY_RELEASE or the commit SHA, as for the SDK's own events. */
  release?: string;
}

/**
 * Sentry's CSP report endpoint for a DSN such as https://<key>@o123.ingest.us.sentry.io/456:
 * https://o123.ingest.us.sentry.io/api/456/security/?sentry_key=<key>, plus sentry_environment
 * and sentry_release when given. The DSN is public (it ships to browsers), so using it here
 * exposes nothing new. Returns undefined for a missing or malformed DSN.
 */
export function sentryCspReportEndpoint(
  dsn: string | undefined,
  { environment, release }: CspReportTags = {},
): string | undefined {
  if (!dsn) return undefined;
  try {
    const url = new URL(dsn);
    // Browsers only deliver reports to HTTP(S) endpoints.
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    const projectId = url.pathname.split('/').filter(Boolean).pop();
    if (!url.username || !projectId) return undefined;
    const endpoint = new URL(`${url.protocol}//${url.host}/api/${projectId}/security/`);
    endpoint.searchParams.set('sentry_key', url.username);
    if (environment) endpoint.searchParams.set('sentry_environment', environment);
    if (release) endpoint.searchParams.set('sentry_release', release);
    return endpoint.toString();
  } catch {
    return undefined;
  }
}

/** A fresh base64 nonce (128 bits) from the Web Crypto API, available in the proxy runtime. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
