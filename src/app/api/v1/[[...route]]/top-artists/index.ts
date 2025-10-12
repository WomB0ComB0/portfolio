import { Elysia, StatusMap } from 'elysia';
import { fetchTopArtists } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { topArtistsSchema } from './schema';

export const topArtistsRoute = new Elysia({ prefix: '/top-artists' }).model(topArtistsSchema).get(
  '/',
  async ({ set }) => {
    try {
      const data = await fetchTopArtists();
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
      200: 'top-artists.response',
      500: 'top-artists.error',
    },
  },
);
