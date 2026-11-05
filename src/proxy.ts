/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Next.js proxy (formerly "middleware"). Next 16 only detects `src/proxy.ts` / `src/proxy.tsx`
 * here; as `proxy.cts` this file was silently ignored from 2025-10-27 until this rename.
 *
 * It sets the per-request, nonce-based Content-Security-Policy. Static security headers (HSTS,
 * X-Frame-Options, nosniff, Referrer-Policy, ...) come from next.config.ts so they also cover API
 * routes and static files, and still apply if this proxy fails.
 *
 * IP bans and rate limits are not applied here. They run in the Elysia API's onRequest hook
 * (src/app/api/_elysia/shared/guard.ts) for /api and /api/v1, with a fixed latency budget, so
 * page requests make no Redis calls.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { env } from './env';
import {
  buildContentSecurityPolicy,
  createNonce,
  cspHeaderName,
  cspReportSampleRate,
  effectiveCspMode,
  sentryCspReportEndpoint,
} from './lib/security/csp';

/** Canonical path for the layout's <link rel="canonical">: no trailing slash except the root. */
function canonicalPath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * Builds the CSP and forwards it on the REQUEST as well as the response: App Router reads the
 * nonce for its own scripts only from the request's Content-Security-Policy(-Report-Only) header.
 * (`next start` copies response headers into the request and hides a response-only setup; Vercel
 * does not, so a response-only CSP would leave every framework script without a nonce.)
 */
export function proxy(request: NextRequest): NextResponse {
  try {
    const nonce = createNonce();
    const isProd = env.NODE_ENV === 'production';
    // VERCEL=1 marks a Vercel deployment, so a local `next start` with only a VERCEL_ENV in an
    // env file never asks for reports. (`vercel env pull` writes VERCEL="1" too, but with
    // VERCEL_ENV="development", whose sample rate is 0; `next dev` is excluded through NODE_ENV.)
    const onVercel = process.env.VERCEL === '1';
    const vercelEnv = process.env.VERCEL_ENV;
    // Sampled on Vercel production only (0 elsewhere), tagged like the SDK's own events: the
    // release follows the build's naming order (src/config/sentry-build.ts).
    const reportUri =
      isProd && onVercel && Math.random() < cspReportSampleRate(vercelEnv)
        ? sentryCspReportEndpoint(env.NEXT_PUBLIC_SENTRY_DSN, {
            environment: vercelEnv,
            release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
          })
        : undefined;

    const mode = effectiveCspMode(vercelEnv);
    const csp = buildContentSecurityPolicy({
      nonce,
      isDev: !isProd,
      mode,
      firebaseAuthDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      reportUri,
    });
    const cspHeader = cspHeaderName(mode);

    const requestHeaders = new Headers(request.headers);
    // Next takes the nonce from the first CSP request header it finds, so drop any the client sent.
    requestHeaders.delete('content-security-policy');
    requestHeaders.delete('content-security-policy-report-only');
    requestHeaders.set(cspHeader, csp);
    // Our own next/script tags in layout.tsx read this; Next itself uses the CSP header above.
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('x-url', canonicalPath(request.nextUrl.pathname));

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set(cspHeader, csp);
    if (reportUri) {
      response.headers.set('Reporting-Endpoints', `csp-endpoint="${reportUri}"`);
    }
    return response;
  } catch (error) {
    // Never fail the page because of the CSP. The static headers from next.config.ts still apply.
    console.error('[proxy] could not build the Content-Security-Policy', error);
    return NextResponse.next();
  }
}

/**
 * Runs on page documents and RSC navigations only. Skipped: API routes (next.config.ts sets their
 * headers, see API_SECURITY_HEADERS), Next and Vercel internals, the Sentry tunnel (/monitoring),
 * OG image routes, the actual static files (public/assets, public/pwa and the named root files),
 * and router prefetches.
 *
 * Static files are excluded by name, not by "contains a dot" or by extension: dynamic pages such
 * as /places/[placeId] also render HTML for URLs like /places/a.b or /places/x.png, and those
 * documents must still get the CSP. Keep this list in sync with public/ and the metadata routes.
 */
export const config = {
  matcher: [
    {
      source:
        '/((?!api(?:/|$)|_next/static|_next/image|_vercel|69a49a618619fab6|monitoring(?:/|$)|opengraph-image|twitter-image|assets/|pwa/|favicon\\.ico$|llms\\.txt$|robots\\.txt$|sitemap\\.xml$|manifest\\.webmanifest$|sw\\.js$).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};
