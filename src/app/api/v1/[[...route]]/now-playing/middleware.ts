import { createCacheHeaders, createErrorHandler } from '@/app/api/_elysia/shared/middleware';

export const cacheHeaders = createCacheHeaders('NoCache');

export const errorHandler = createErrorHandler({
  context: 'now-playing API route',
  customMessage: () => 'Internal Server Error',
});
