import { Elysia, StatusMap } from 'elysia';
import { getGitHubStats } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { githubStatsSchema } from './schema';

export const githubStatsRoute = new Elysia({ prefix: '/github-stats' })
  .model(githubStatsSchema)
  .get(
    '/',
    async ({ set }) => {
      try {
        const data = await getGitHubStats();
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
        200: 'github-stats.response',
        500: 'github-stats.error',
      },
    },
  );
