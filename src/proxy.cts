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

import { type NextRequest, NextResponse } from 'next/server';
import { env } from './env';
import type { RateLimitHelper } from './lib/security/rate-limit.types';

/**
 * @readonly
 * @private
 * @description A Set containing paths that are considered public assets and should bypass certain middleware logic (like rate limiting or authentication).
 * @author Mike Odnis
 * @version 1.0.0
 */
const publicAssetPaths = new Set<string>([
  '/assets/',
  '/pwa/',
  '/images/',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/sw.js',
]);

/**
 * @readonly
 * @private
 * @description An array of paths that are explicitly exempt from rate limiting. It includes public assets and Next.js internal paths.
 * @author Mike Odnis
 * @version 1.0.0
 */
const rateLimitExemptPaths = [...publicAssetPaths, '/_next', '/api/health'];

// Helper for logging (replaces Logger)
const safeLog = (
  level: 'log' | 'warn' | 'error',
  message: string,
  data: Record<string, unknown> = {},
) => {
  if (env.NODE_ENV !== 'production' || level === 'error' || level === 'warn') {
    // Only log essential info in prod, but always log warnings/errors.
    console[level](`[Proxy Middleware] ${message}`, JSON.stringify(data));
  }
};

/**
 * @private
 * @description Checks if an IP is banned and returns a 403 response if banned.
 */
async function checkBannedIP(request: NextRequest): Promise<NextResponse | null> {
  const { redis } = await import('./classes/redis');
  const { getClientIP } = await import('./lib/security/get-ip');

  const clientIp = getClientIP(request);
  if (!clientIp || clientIp === '127.0.0.1' || clientIp === '::1') {
    return null;
  }

  const isBanned = await redis.sismember('ban:ips', clientIp);
  if (isBanned) {
    safeLog('warn', 'Blocked banned IP at edge', {
      ip: clientIp,
      path: request.nextUrl.pathname,
    });
    return new NextResponse(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Access denied',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  return null;
}

/**
 * @private
 * @description Determines the rate limiting type based on the request path.
 */
function getRateLimitingType(pathname: string): RateLimitHelper['rateLimitingType'] {
  if (pathname.startsWith('/api/v1')) {
    return 'apiv1';
  }
  if (pathname.startsWith('/api')) {
    return 'api';
  }
  if (pathname.startsWith('/monitoring')) {
    return 'ai';
  }
  return 'default';
}

/**
 * @private
 * @description Applies rate limiting and returns a 429 response if limit is exceeded.
 */
async function applyRateLimit(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse | null> {
  const { getRateLimitReset, rateLimiter } = await import('./lib');

  const rateLimitingType = getRateLimitingType(request.nextUrl.pathname);

  safeLog('log', 'Applying rate limiting', {
    type: rateLimitingType,
    path: request.nextUrl.pathname,
  });

  const identifier = request.headers.get('x-forwarded-for') || 'anonymous';
  const result = await rateLimiter(rateLimitingType)({ identifier });

  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.reset.toString());

  if (!result.success) {
    safeLog('warn', 'Rate limit exceeded', {
      identifier,
      path: request.nextUrl.pathname,
      remaining: result.remaining,
      reset: result.reset,
    });
    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: `Please try again later. Reset time: ${getRateLimitReset(result.reset)}`,
        retryAfter: getRateLimitReset(result.reset),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': getRateLimitReset(result.reset),
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': getRateLimitReset(result.reset),
        },
      },
    );
  }

  return null;
}

/**
 * @private
 * @description Applies security headers to the response.
 */
function applySecurityHeaders(response: NextResponse, nonce: string, isProd: boolean): void {
  const ttDirectives = isProd
    ? [`require-trusted-types-for 'script'`, `trusted-types default dompurify nextjs#bundler`]
    : [];

  const scriptSrc = isProd
    ? [`'self'`, `'nonce-${nonce}'`, `'strict-dynamic'`]
    : [`'self'`, `'unsafe-eval'`, `'nonce-${nonce}'`, `'strict-dynamic'`];

  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(' ')}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: https:`,
    `connect-src 'self' https://*.google-analytics.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://*.gstatic.com data: https://*.sanity.io ${env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL} https://*.sentry.io https://cdn.discordapp.com`,
    `frame-src https://cdn.sanity.io https://www.gstatic.com https://www.google.com`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'none'`,
    `frame-ancestors 'none'`,
    `font-src 'self' https://fonts.gstatic.com`,
    `upgrade-insecure-requests`,
    ...ttDirectives,
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-site');
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
}

/**
 * @async
 * @public
 * @description Middleware function to handle security concerns like IP banning, CSRF token management, and rate limiting for incoming requests.
 * This middleware integrates various security measures with Next.js middleware capabilities.
 *
 * @param {NextRequest} request - The incoming Next.js request object containing headers, cookies and other request data.
 * @returns {Promise<NextResponse>} A promise that resolves to the modified Next.js response object, potentially with security headers or error responses.
 * @throws {Error} If an unexpected error occurs during middleware processing.
 *
 * @remarks
 * - Checks for banned IPs early in the request lifecycle.
 * - Sets a CSRF token cookie if one is not present.
 * - Applies rate limiting based on the request path and identifier.
 * - Handles rate limit exceeded responses with appropriate headers.
 *
 * @example
 * ```ts
 * // Automatically applied to matching routes via Next.js middleware
 * const response = await middleware(request);
 * ```
 * @author Mike Odnis
 * @version 1.0.2 (Reduced Cognitive Complexity)
 * @see {@link https://nextjs.org/docs/app/building-your-application/routing/middleware Next.js Middleware}
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const isProd = env.NODE_ENV === 'production';
  safeLog('log', 'Processing middleware request', { path: request.nextUrl.pathname });

  if (rateLimitExemptPaths.some((path) => request.nextUrl.pathname.startsWith(path))) {
    safeLog('log', 'Skipping middleware for exempt path', { path: request.nextUrl.pathname });
    return NextResponse.next();
  }

  try {
    let csrfToken: string | undefined;
    if (!isProd && !request.cookies.get('csrfToken')) {
      csrfToken = crypto.randomUUID().replaceAll('-', '');
    }

    const nonce = crypto.randomUUID().replaceAll('-', '');
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    if (isProd) {
      const { csrfToken: prodCsrfToken } = await import('./lib');
      csrfToken = prodCsrfToken;

      const bannedResponse = await checkBannedIP(request);
      if (bannedResponse) {
        return bannedResponse;
      }

      const rateLimitResponse = await applyRateLimit(request, response);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }
    }

    applySecurityHeaders(response, nonce, isProd);

    if (!request.cookies.get('csrfToken') && csrfToken) {
      safeLog('log', 'Setting CSRF token cookie');
      response.cookies.set('csrfToken', csrfToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'strict',
      });
    }

    response.headers.set('x-url', request.nextUrl.pathname);

    if (isPublicAsset(request)) {
      safeLog('log', 'Serving public asset', { path: request.nextUrl.pathname });
      return response;
    }

    safeLog('log', 'Middleware processing complete', { path: request.nextUrl.pathname });
    return response;
  } catch (error) {
    safeLog('error', 'Middleware error', {
      path: request.nextUrl.pathname,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.next();
  }
}

/**
 * @private
 * @description Determines if the incoming request is for a public asset that should bypass certain middleware logic.
 * Public assets include static files, images, favicons, and other publicly accessible resources.
 *
 * @param {NextRequest} request - The incoming Next.js request object to check.
 * @returns {boolean} True if the request is for a public asset, false otherwise.
 *
 * @remarks
 * - Checks request path against predefined list of public asset paths.
 * - Uses startsWith() to match path prefixes.
 * - Includes common static assets like favicons, images, PWA assets.
 * - Includes common web standard files like robots.txt and sitemap.xml.
 *
 * @example
 * ```ts
 * if (isPublicAsset(request)) {
 * // Allow access without authentication
 * return response;
 * }
 * ```
 * @author Mike Odnis
 * @version 1.0.0
 */
const isPublicAsset = (request: NextRequest): boolean =>
  publicAssetPaths.has(request.nextUrl.pathname);

/**
 * @public
 * @description Configuration object that defines which routes the middleware should be applied to.
 * Uses Next.js middleware matcher patterns to include/exclude specific paths.
 *
 * @property {string[]} matcher - Array of path patterns to match against incoming requests.
 *
 * @remarks
 * - **Simplified:** Only matches the root path and the '/api' paths.
 * - Excludes Next.js internal paths (_next/static, _next/image).
 * - Excludes favicon.ico requests.
 * - Pattern can be modified to include additional paths.
 *
 * @example
 * ```ts
 * // In middleware.ts
 * export const config = {
 * matcher: ['/', '/api/:path*']
 * };
 * ```
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher Next.js Middleware Matcher}
 */
export const config = {
  matcher: [
    // Match API routes and the root path explicitly
    '/',
    '/api/:path*',
  ],
};
