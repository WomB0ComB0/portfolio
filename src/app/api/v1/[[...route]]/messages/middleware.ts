import { createCacheHeaders, createErrorHandler } from '../shared/middleware';

export const cacheHeaders = createCacheHeaders('JsonOnly');

export function errorHandler(error: unknown, operation: 'fetch' | 'add' = 'fetch') {
  const handler = createErrorHandler({
    context: operation === 'fetch' ? 'fetching messages' : 'adding message',
  });
  return handler(error);
}
