import { Elysia, StatusMap } from 'elysia';
import { getWakaTimeData } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { wakatimeSchema } from './schema';

export const wakatimeRoute = new Elysia({ prefix: '/wakatime' }).model(wakatimeSchema).get(
  '/',
  async ({ set }) => {
    try {
      const data = await getWakaTimeData();
      set.headers = cacheHeaders();
      return data;
    } catch (error) {
      const errorResponse = errorHandler(error);
      set.status = StatusMap['Internal Server Error'];
      return { error: errorResponse.error };
    }
  },
  {
    response: {
      200: 'wakatime.response',
      500: 'wakatime.error',
    },
  },
);
