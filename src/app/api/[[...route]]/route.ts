import { logger } from '@/utils';
import { batchSpanProcessor, createElysiaApp, IS_VERCEL } from '../_elysia';
import { apiRoutes } from './elysia';

const app = createElysiaApp({
  prefix: '/api',
})
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
    logger.info(`Shutting down /api due to ${signal}`);
    if (batchSpanProcessor) {
      await batchSpanProcessor.forceFlush();
    }
  }
};

if (!IS_VERCEL) {
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export type API = typeof app;
