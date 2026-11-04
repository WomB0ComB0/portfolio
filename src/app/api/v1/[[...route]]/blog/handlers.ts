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

import { Schema } from 'effect';
import { BaseError } from '@/classes/error';
import {
  addHashnodeCovers,
  getBlogs,
  getDevToBlogs,
  HASHNODE_BLOG_URL,
  mergeBlogSources,
} from '@/lib';
import { logger } from '@/utils';

export const BlogSchema = Schema.Struct({
  title: Schema.String,
  slug: Schema.String,
  publishedAt: Schema.String,
  excerpt: Schema.String,
  imageUrl: Schema.optional(Schema.String),
  source: Schema.optional(Schema.Union(Schema.Literal('hashnode'), Schema.Literal('devto'))),
  url: Schema.optional(Schema.String),
});

export type Blog = Schema.Schema.Type<typeof BlogSchema>;

/**
 * Fetches blogs from Hashnode and DevTo and merges them, newest first.
 *
 * Hashnode posts get their covers from each post page's `og:image`. A dev.to cross-post of a
 * Hashnode post is dropped in favour of the Hashnode entry, which takes the dev.to image when it
 * has none (see `mergeBlogSources`). If one source fails, the other is still served.
 *
 * @returns {Promise<Blog[]>} One entry per article, newest first.
 * @throws {BaseError} When neither source returns any posts.
 */
export async function fetchBlogs(): Promise<Blog[]> {
  const devToUsername = 'mikeodnis';

  // Fetch from both sources concurrently (Hashnode via its public RSS feed)
  const [hashnodeResult, devtoResult] = await Promise.allSettled([
    getBlogs().then((posts) => addHashnodeCovers(posts)),
    getDevToBlogs(devToUsername),
  ]);

  if (hashnodeResult.status === 'rejected') {
    logger.error('Failed to fetch Hashnode blogs:', hashnodeResult.reason);
  }
  if (devtoResult.status === 'rejected') {
    logger.error('Failed to fetch DevTo blogs:', devtoResult.reason);
  }

  const blogs = mergeBlogSources(
    hashnodeResult.status === 'fulfilled' ? hashnodeResult.value : [],
    devtoResult.status === 'fulfilled' ? devtoResult.value : [],
  );

  // If no blogs from any source, throw an error
  if (blogs.length === 0) {
    throw new BaseError(new Error('Failed to fetch blogs from any source'), 'blog:fetch', {
      hashnodeBlog: HASHNODE_BLOG_URL,
      devToUsername,
    });
  }

  return blogs;
}
