import { createCacheHeaders, createErrorHandlerWithDefault } from '../shared/middleware';

export const cacheHeaders = createCacheHeaders('Medium');

export const errorHandler = createErrorHandlerWithDefault(
  {
    context: 'Google Analytics route',
  },
  {
    total_pageviews: 0,
  },
);
