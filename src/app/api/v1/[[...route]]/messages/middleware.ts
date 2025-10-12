import { createCacheHeaders, createErrorHandler } from '@/app/api/_elysia/shared/middleware';

export const cacheHeaders = createCacheHeaders('JsonOnly');

export function errorHandler(error: unknown, operation: 'fetch' | 'add' = 'fetch') {
  const handler = createErrorHandler({
    context: operation === 'fetch' ? 'fetching messages' : 'adding message',
  });
  return handler(error);
}
