import { Elysia, StatusMap } from 'elysia';
import { fetchBlogs } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { blogSchema } from './schema';

export const blogRoute = new Elysia({ prefix: '/blog' }).model(blogSchema).get(
  '/',
  async ({ set }) => {
    try {
      const data = await fetchBlogs();
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
      200: 'blog.response',
      500: 'blog.error',
    },
  },
);
