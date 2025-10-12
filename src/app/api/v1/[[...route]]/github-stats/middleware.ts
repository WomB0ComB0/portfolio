import { createCacheHeaders, createErrorHandler } from '../shared/middleware';

export const cacheHeaders = createCacheHeaders('Medium');

export const errorHandler = createErrorHandler({
  context: 'fetching GitHub stats',
  includeErrorDetails: true,
});
