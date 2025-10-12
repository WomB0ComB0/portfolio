import { createCacheHeaders, createErrorHandler } from '../shared/middleware';

export const cacheHeaders = createCacheHeaders('NoCache');

export const errorHandler = createErrorHandler({
  context: 'fetching top tracks',
});
