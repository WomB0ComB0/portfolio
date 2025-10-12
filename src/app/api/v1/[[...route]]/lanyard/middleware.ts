import { createCacheHeaders, createErrorHandler } from '@/app/api/_elysia/shared/middleware';

export const cacheHeaders = createCacheHeaders('Short');

export const errorHandler = createErrorHandler({
  context: 'fetching Lanyard data',
});
