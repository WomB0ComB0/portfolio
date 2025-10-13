import { logger } from '@/utils';
import { batchSpanProcessor, IS_VERCEL, version } from '../../_elysia/constants';
import { createElysiaApp } from '../../_elysia/shared/config';
import { apiRoutes, utilityRoutes } from './elysia';

const app = createElysiaApp({
  prefix: '/api/v1',
  swagger: {
    path: '/swagger',
    title: '🦊 Portfolio v3 API Server',
    version: version || '1.0.0',
    description: `
      Portfolio v3

      > **Contact: [API Support](mailto:mike@mikeodnis.dev)
    `,
    contact: {
      name: 'API Support',
      email: 'mike@mikeodnis.dev',
    },
    tags: [
      {
        name: 'Utility',
        description: 'Status, version, and health check endpoints',
      },
      {
        name: 'Info',
        description: 'API information endpoints',
      },
    ],
  },
})
  .use(utilityRoutes)
  .use(apiRoutes);

export const GET = app.handle;
export const POST = app.handle;
export const PUT = app.handle;
export const DELETE = app.handle;
export const PATCH = app.handle;

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
