import { logger } from '@/utils';
import { batchSpanProcessor, createElysiaApp, IS_VERCEL } from '../_elysia';
import { apiRoutes } from './elysia';

/**
 * Main API route composition
 * Includes all admin and health routes
 */
// Next.js file path provides /api, so don't add prefix here
const app = createElysiaApp({
  prefix: '',
}).use(apiRoutes);

/**
 * Next.js API route handlers
 * Delegates to Elysia app for all HTTP methods
 */
export const GET = app.handle;
export const POST = app.handle;
export const PUT = app.handle;
export const PATCH = app.handle;
export const DELETE = app.handle;
export const OPTIONS = app.handle;

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

// Export type for use in other modules
export type API = typeof app;
