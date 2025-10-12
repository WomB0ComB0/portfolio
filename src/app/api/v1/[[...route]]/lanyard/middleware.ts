import { createCacheHeaders, createErrorHandler } from '../shared/middleware';

export const cacheHeaders = createCacheHeaders('Short');

export const errorHandler = createErrorHandler({
  context: 'fetching Lanyard data',
});
