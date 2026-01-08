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
