import type { Context } from 'elysia';
import { createCacheHeaders } from '@/app/api/_elysia/shared/middleware';
import { logger } from '@/utils';

/**
 * Cache headers for Sanity responses
 * 5-minute cache with stale-while-revalidate
 */
export const sanityCacheHeaders = createCacheHeaders({
  contentType: 'application/json',
  cacheControl: 'public, s-maxage=300, stale-while-revalidate=600',
});

/**
 * Middleware for Sanity routes
 * Handles request/response logging
 */
export async function sanityMiddleware(context: Context) {
  const start = Date.now();
  const { request } = context;
  const url = new URL(request.url);

  logger.info(`[Sanity] ${request.method} ${url.pathname}`);

  try {
    // Allow the request to continue
    return;
  } finally {
    const duration = Date.now() - start;
    logger.info(`[Sanity] ${request.method} ${url.pathname} completed in ${duration}ms`);
  }
}
