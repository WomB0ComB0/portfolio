import { createCacheHeaders, createErrorHandler } from '@/app/api/_elysia/shared/middleware';

export const cacheHeaders = createCacheHeaders('Medium');

export const errorHandler = createErrorHandler({
  context: 'fetching GitHub stats',
  includeErrorDetails: true,
});
