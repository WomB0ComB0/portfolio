import { Elysia, StatusMap } from 'elysia';
import { fetchTopTracks } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { topTracksSchema } from './schema';

export const topTracksRoute = new Elysia({ prefix: '/top-tracks' }).model(topTracksSchema).get(
  '/',
  async ({ set }) => {
    try {
      const data = await fetchTopTracks();
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
      200: 'top-tracks.response',
      500: 'top-tracks.error',
    },
  },
);
