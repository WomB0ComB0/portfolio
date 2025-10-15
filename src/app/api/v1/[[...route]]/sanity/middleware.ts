import { createCacheHeaders } from '@/app/api/_elysia/shared/middleware';
import type { Context } from 'elysia';

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

  console.log(`[Sanity] ${request.method} ${url.pathname}`);

  try {
    // Allow the request to continue
    return;
  } finally {
    const duration = Date.now() - start;
    console.log(`[Sanity] ${request.method} ${url.pathname} completed in ${duration}ms`);
  }
}

