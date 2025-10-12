import { t } from 'elysia';

export const blogSchema = {
  'blog.response': t.Array(
    t.Object({
      title: t.String(),
      slug: t.String(),
      publishedAt: t.String(),
      excerpt: t.String(),
    }),
  ),
  'blog.error': t.Object({
    error: t.String(),
  }),
};
