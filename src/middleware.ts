import { type NextRequest, NextResponse } from 'next/server';
import { env } from '@/env';
import { csrfToken, getRateLimitReset, rateLimiter } from '@/lib';
import type { RateLimitHelper } from '@/lib';
import { logger } from '@/utils';

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

// Add paths that should bypass rate limiting
const rateLimitExemptPaths = [...publicAssetPaths, '/_next', '/api/health'];

/**
 * Middleware function to handle authentication and session management for incoming requests.
 * This middleware integrates Supabase authentication with Next.js middleware capabilities.
 *
 * @param {NextRequest} request - The incoming Next.js request object containing headers, cookies and other request data
 * @returns {Promise<NextResponse>} A promise that resolves to the modified Next.js response object
 *
 * @remarks
 * - Creates a new response object with preserved request headers
 * - Checks if request is for public asset using isPublicAsset()
 * - Initializes Supabase client with cookie handling
 * - Manages authentication state via getUser()
 * - Handles cookie operations (get/set/remove) for session management
 *
 * @example
 * ```ts
 * // Automatically applied to matching routes via Next.js middleware
 * const response = await middleware(request);
 * ```
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  logger.debug('Processing middleware request', { path: request.nextUrl.pathname });

  // Early return for exempt paths
  if (rateLimitExemptPaths.some((path) => request.nextUrl.pathname.startsWith(path))) {
    logger.debug('Skipping middleware for exempt path', { path: request.nextUrl.pathname });
    return NextResponse.next();
  }

  try {
    const response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    // Authentication logic commented out
    /*
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
      logger.debug('Checking authentication for dashboard access');
      const { data: session } = await betterFetch<Session>('/api/auth/get-session', {
        baseURL: request.nextUrl.origin,
        headers: {
          //get the cookie from the request
          cookie: request.headers.get('cookie') || '',
        },
      });
      if (!session) {
        logger.info('Redirecting unauthenticated user from dashboard', {
          path: request.nextUrl.pathname,
        });
        return NextResponse.redirect(new URL('/auth/login', request.url));
      }
      logger.debug('User authenticated for dashboard access', { userId: session.user?.id });
    }
    */

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
        rateLimitingType = 'forcedSlowMode';
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
 * Determines if the incoming request is for a public asset that should bypass authentication.
 * Public assets include static files, images, favicons, and other publicly accessible resources.
 *
 * @param {NextRequest} request - The incoming Next.js request object to check
 * @returns {boolean} True if the request is for a public asset, false otherwise
 *
 * @remarks
 * - Checks request path against predefined list of public asset paths
 * - Uses startsWith() to match path prefixes
 * - Includes common static assets like favicons, images, PWA assets
 * - Includes common web standard files like robots.txt and sitemap.xml
 *
 * @example
 * ```ts
 * if (isPublicAsset(request)) {
 *   // Allow access without authentication
 *   return response;
 * }
 * ```
 */

const isPublicAsset = (request: NextRequest): boolean =>
  publicAssetPaths.has(request.nextUrl.pathname);

/**
 * Configuration object that defines which routes the middleware should be applied to.
 * Uses Next.js middleware matcher patterns to include/exclude specific paths.
 *
 * @type {Object}
 * @property {string[]} matcher - Array of path patterns to match against incoming requests
 *
 * @remarks
 * - Matches all paths by default
 * - Excludes Next.js internal paths (_next/static, _next/image)
 * - Excludes favicon.ico requests
 * - Pattern can be modified to include additional paths
 * - Uses negative lookahead (?!) in regex for exclusions
 *
 * @example
 * ```ts
 * // In middleware.ts
 * export const config = {
 *   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
 * };
 * ```
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
  runtime: 'nodejs',
};
