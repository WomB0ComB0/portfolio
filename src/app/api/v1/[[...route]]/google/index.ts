import { Elysia, StatusMap } from 'elysia';
import { getGoogleAnalytics } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { googleSchema } from './schema';

export const googleRoute = new Elysia({ prefix: '/google' }).model(googleSchema).get(
  '/',
  async ({ set }) => {
    try {
      const data = await getGoogleAnalytics();
      set.headers = cacheHeaders();
      return data;
    } catch (error) {
      const errorResponse = errorHandler(error);
      set.status = StatusMap.OK; // Return 200 with error data as per original implementation
      return errorResponse;
    }
  },
  {
    response: {
      200: 'google.response',
    },
  },
);
