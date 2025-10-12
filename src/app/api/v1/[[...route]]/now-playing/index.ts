import { Elysia, StatusMap } from 'elysia';
import { getNowPlaying } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { nowPlayingSchema } from './schema';

export const nowPlayingRoute = new Elysia({ prefix: '/now-playing' }).model(nowPlayingSchema).get(
  '/',
  async ({ set }) => {
    try {
      const data = await getNowPlaying();
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
      200: 'now-playing.response',
      500: 'now-playing.error',
    },
  },
);
