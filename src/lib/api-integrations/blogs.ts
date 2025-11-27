/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { config } from '@/config';
import { post } from '@/lib/http-clients/effect-fetcher';
import { logger } from '@/utils';
import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';

/**
 * GraphQL query for fetching user blog posts from Hashnode.
 * @readonly
 * @private
 * @see https://hashnode.com/graphql
 */
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
            coverImage { url }
          }
        }
      }
    }
  }
`;

/**
 * @readonly
 * @description
 * Schema definition for a blog object returned from Hashnode via GraphQL.
 * Used for type validation and transformation of post data.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @see https://hashnode.com/graphql
 */
export const BlogSchema = Schema.Struct({
  title: Schema.String,
  slug: Schema.String,
  publishedAt: Schema.String,
  excerpt: Schema.String,
  imageUrl: Schema.optional(Schema.String), // Corrected usage of Schema.optional
});

/**
 * TypeScript type representing a blog/article fetched from Hashnode.
 * @see BlogSchema
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 */
export type Blog = Schema.Schema.Type<typeof BlogSchema>;

/**
 * Fetches blog posts for a given Hashnode username.
 *
 * This function retrieves paginated blog posts written by a user on Hashnode
 * using the Hashnode GraphQL API. Includes customizable page and pageSize for pagination.
 *
 * @async
 * @function
 * @public
 * @param {string} username - Hashnode username to retrieve posts for.
 * @param {number} [page=1] - The page of posts to fetch (for pagination).
 * @param {number} [pageSize=10] - Number of posts to fetch per page.
 * @returns {Promise<Blog[]>} Resolves to an array of {@link Blog} objects containing blog metadata.
 * @throws {Error} Throws if API request fails or if the Hashnode API returns an error response.
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://hashnode.com/graphql
 * @example
 * const blogs = await getBlogs('WomB0ComB0', 1, 5);
 * blogs.forEach(blog => console.log(blog.title, blog.slug, blog.excerpt));
 */
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
        imageUrl: post.coverImage?.url, // Extract imageUrl
      };
    });
  } catch (error) {
    logger.error('Error fetching blogs:', error);
    throw error;
  }
}
