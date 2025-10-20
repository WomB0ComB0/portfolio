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

import { logger } from '@/utils';
import { batchSpanProcessor, createElysiaApp, IS_VERCEL } from '../../_elysia';
import { apiRoutes, utilityRoutes } from './elysia';

const app = createElysiaApp({
  prefix: '/api/v1',
})
  .use(utilityRoutes)
  .use(apiRoutes)
  .onError(({ code, error, request }) => {
    logger.error('Elysia error', error, {
      code,
      url: request.url,
      path: new URL(request.url).pathname,
    });
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
        code,
      }),
      {
        status: code === 'NOT_FOUND' ? 404 : 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  });

const wrapHandler = (handler: typeof app.handle) => async (request: Request) => {
  try {
    const response = await handler(request);
    if (!response) {
      logger.warn('Handler returned null/undefined, creating fallback response');
      return new Response(JSON.stringify({ error: 'No response from handler' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return response;
  } catch (error) {
    logger.error('Handler error', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};

export const GET = wrapHandler(app.handle);
export const POST = wrapHandler(app.handle);
export const PUT = wrapHandler(app.handle);
export const DELETE = wrapHandler(app.handle);
export const PATCH = wrapHandler(app.handle);
export const OPTIONS = wrapHandler(app.handle);

const shutdown = async (signal: string): Promise<void> => {
  if (IS_VERCEL) {
    logger.info('Vercel function cleanup');
  } else {
    logger.info(`Shutting down /api/v1 due to ${signal}`);
    if (batchSpanProcessor) {
      await batchSpanProcessor.forceFlush();
    }
  }
};

if (!IS_VERCEL) {
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export type API_V1 = typeof app;
