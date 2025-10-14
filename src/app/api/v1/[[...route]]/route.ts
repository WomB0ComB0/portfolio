import { logger } from '@/utils';
import { batchSpanProcessor, IS_VERCEL } from '../../_elysia/constants';
import { createElysiaApp } from '../../_elysia/shared/config';
import { apiRoutes, utilityRoutes } from './elysia';

// Next.js file path provides /api/v1, so don't add prefix here
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

// Log all registered routes for debugging
logger.info('Registered Elysia routes', {
  routes: app.routes.map((r) => ({ method: r.method, path: r.path })),
});

/**
 * Wraps Elysia handler to ensure it always returns a Response
 */
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

/**
 * Gracefully shuts down telemetry on Vercel using waitUntil if available.
 * For local development, flushes the batch span processor.
 */
const shutdown = async (): Promise<void> => {
  if (IS_VERCEL) {
    // On Vercel, we can't rely on process signals, so this is mainly for cleanup
    logger.info('Vercel function cleanup');
  } else {
    logger.info('Shutting down 🦊 Elysia');
    if (batchSpanProcessor) {
      await batchSpanProcessor.forceFlush();
    }
  }
};

// Don't set up process listeners on Vercel
if (!IS_VERCEL) {
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export type API_V1 = typeof app;
