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

import { createCacheHeaders, createErrorHandler } from '@/app/api/_elysia/shared/middleware';

export const cacheHeaders = createCacheHeaders('Short');

export const errorHandler = createErrorHandler({
  context: 'fetch system status',
});

import { logAPIRequest } from '@/lib/better-stack';
import { Elysia } from 'elysia';

/**
 * Status endpoint middleware
 * Logs all requests to the status endpoint
 * @function
 * @returns {Elysia} Elysia plugin with middleware applied
 * @author Mike Odnis
 * @version 1.0.0
 */
export const statusMiddleware = new Elysia({ name: 'status-middleware' })
  .onAfterHandle(({ request, set }) => {
    const url = new URL(request.url);
    const statusCode = typeof set.status === 'number' ? set.status : 200;
    logAPIRequest({
      method: request.method,
      path: url.pathname,
      statusCode,
      duration: 0, // Will be calculated by the logger
      ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
  })
  .onError(({ request, error }) => {
    const url = new URL(request.url);
    logAPIRequest({
      method: request.method,
      path: url.pathname,
      statusCode: 500,
      duration: 0,
      ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
      error: error instanceof Error ? error : new Error(String(error)),
    });
  });
