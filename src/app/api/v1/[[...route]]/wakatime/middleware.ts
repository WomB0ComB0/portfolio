import { createCacheHeaders, createErrorHandler } from '@/app/api/_elysia/shared/middleware';

export const cacheHeaders = createCacheHeaders('Long');

export const errorHandler = createErrorHandler({
  context: 'fetching WakaTime data',
});
