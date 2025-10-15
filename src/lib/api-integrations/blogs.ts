import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { post } from '@/lib/http-clients/effect-fetcher';
import 'server-only';
import { config } from '@/config';

const query = `
  query UserPosts($username: String!, $page: Int!, $pageSize: Int!) {
    user(username: $username) {
      posts(page: $page, pageSize: $pageSize) {
        edges {
          node {
            title
            slug
            publishedAt
            brief
          }
        }
      }
    }
  }
`;

export const BlogSchema = Schema.Struct({
  title: Schema.String,
  slug: Schema.String,
  publishedAt: Schema.String,
  excerpt: Schema.String,
});

export type Blog = Schema.Schema.Type<typeof BlogSchema>;

export async function getBlogs(username: string, page = 1, pageSize = 10): Promise<Blog[]> {
  const token = config.hashnode.token;

  const effect = pipe(
    post(
      'https://gql.hashnode.com/',
      {
        query,
        variables: { username, page, pageSize },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        retries: 2,
        timeout: 10_000,
      },
    ),
    Effect.provide(FetchHttpClient.layer),
  );

  try {
    const data: any = await Effect.runPromise(effect);

    if (data.errors) {
      throw new Error(data.errors.map((e: any) => e.message).join(', '));
    }

    const posts = data.data?.user?.posts?.edges || [];
    return posts.map((edge: any) => {
      const post = edge.node;
      return {
        title: post.title,
        slug: post.slug,
        publishedAt: post.publishedAt,
        excerpt: post.brief,
      };
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    throw error;
  }
}
