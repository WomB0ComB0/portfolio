import { createCacheHeaders, createErrorHandler } from '../shared/middleware';

export const cacheHeaders = createCacheHeaders('Long');

export const errorHandler = createErrorHandler({
  context: 'fetching blogs',
});
