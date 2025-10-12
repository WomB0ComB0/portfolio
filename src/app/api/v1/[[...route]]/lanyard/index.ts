import { Elysia, StatusMap } from 'elysia';
import { getLanyardData } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { lanyardSchema } from './schema';

export const lanyardRoute = new Elysia({ prefix: '/lanyard' }).model(lanyardSchema).get(
  '/',
  async ({ set }) => {
    try {
      const data = await getLanyardData();
      set.headers = cacheHeaders();
      // Return raw data for validation, superjson will be applied in transform
      return data;
    } catch (error) {
      const errorResponse = errorHandler(error);
      set.status = StatusMap['Internal Server Error'];
      return { error: errorResponse.error };
    }
  },
  {
    response: {
      200: 'lanyard.response',
      500: 'lanyard.error',
    },
  },
);
