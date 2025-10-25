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

import { redis } from '@/classes/redis';
import { env } from '@/env';
import { csrfToken, getRateLimitReset, rateLimiter } from '@/lib';
import { getClientIP } from '@/lib/security/get-ip';
import type { RateLimitHelper } from '@/lib/security/rate-limit.types';
import { Logger, Stringify } from '@/utils';
import { type NextRequest, NextResponse } from 'next/server';

const logger = Logger.getLogger('Proxy');

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
 * @version 1.0.0
 * @see {@link https://nextjs.org/docs/app/building-your-application/routing/middleware Next.js Middleware}
 * @see {@link ../classes/redis.ts Redis Client}
 * @see {@link ../lib/security/get-ip.ts getClientIP}
 * @see {@link ../lib/rate-limiter.ts rateLimiter}
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  logger.debug('Processing middleware request', { path: request.nextUrl.pathname });

  // Early return for exempt paths
  if (rateLimitExemptPaths.some((path) => request.nextUrl.pathname.startsWith(path))) {
    logger.debug('Skipping middleware for exempt path', { path: request.nextUrl.pathname });
    return NextResponse.next();
  }

  try {
    // Check for banned IPs early (before rate limiting)
    if (env.NODE_ENV === 'production') {
      const clientIp = getClientIP(request);
      if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
        const isBanned = await redis.sismember('ban:ips', clientIp);
        if (isBanned) {
          logger.warn('Blocked banned IP at edge', {
            ip: clientIp,
            path: request.nextUrl.pathname,
          });
          return new NextResponse(
            Stringify({
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
      }
    }

    const nonce = crypto.randomUUID().replace(/-/g, '');
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    const ttDirectives =
      process.env.NODE_ENV === 'production'
        ? [`require-trusted-types-for 'script'`, `trusted-types default dompurify nextjs#bundler`]
        : []; // disable in development to let Turbopack HMR work

    const csp = [
      `default-src 'self'`,

      `script-src 'self' 'unsafe-eval' 'unsafe-inline' 'nonce-${nonce}' 'strict-dynamic'`,

      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,

      `img-src 'self' data: https:`,

      `connect-src 'self' https://*.google-analytics.com https://*.googleapis.com https://*.gstatic.com data: https://*.sanity.io ${env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL} *.sentry.io https://cdn.discordapp.com`,

      `frame-src https://cdn.sanity.io/`,
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

    if (!request.cookies.get('csrfToken')) {
      logger.debug('Setting CSRF token cookie');
      response.cookies.set('csrfToken', csrfToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
    }

    response.headers.set('x-url', request.nextUrl.pathname);
    if (env.NODE_ENV === 'production') {
      let rateLimitingType: RateLimitHelper['rateLimitingType'] = 'default';
      if (request.nextUrl.pathname.startsWith('/api/v1')) {
        rateLimitingType = 'apiv1';
      } else if (request.nextUrl.pathname.startsWith('/api')) {
        rateLimitingType = 'api';
      }

      logger.debug('Applying rate limiting', {
        type: rateLimitingType,
        path: request.nextUrl.pathname,
      });
      const identifier = request.headers.get('x-forwarded-for') || 'anonymous';
      const result = await rateLimiter(rateLimitingType)({ identifier });

      response.headers.set('X-RateLimit-Limit', result.limit.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', result.reset.toString());

      if (!result.success) {
        logger.warn('Rate limit exceeded', {
          identifier,
          path: request.nextUrl.pathname,
          remaining: result.remaining,
          reset: result.reset,
        });
        return new NextResponse(
          Stringify({
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
    }

    if (isPublicAsset(request)) {
      logger.debug('Serving public asset', { path: request.nextUrl.pathname });
      return response;
    }

    logger.debug('Middleware processing complete', { path: request.nextUrl.pathname });
    return response;
  } catch (error) {
    logger.error('Middleware error', {
      path: request.nextUrl.pathname,
      error: error instanceof Error ? error.message : String(error),
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
 *   // Allow access without authentication
 *   return response;
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
 * - Matches all paths by default.
 * - Excludes Next.js internal paths (_next/static, _next/image).
 * - Excludes favicon.ico requests.
 * - Pattern can be modified to include additional paths.
 * - Uses negative lookahead (?!) in regex for exclusions.
 *
 * @example
 * ```ts
 * // In middleware.ts
 * export const config = {
 *   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
 * };
 * ```
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher Next.js Middleware Matcher}
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|dashboard).*)',
  ],
};
