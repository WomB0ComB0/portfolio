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
import { getBlogs, getDevToBlogs } from '@/lib';
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
 * Fetches blogs from both Hashnode and DevTo, combining and sorting by date.
 * @returns {Promise<Blog[]>} Combined and sorted array of blogs from all sources.
 */
export async function fetchBlogs(): Promise<Blog[]> {
  const username = 'WomB0ComB0';
  const devToUsername = 'womb0comb0';

  // Fetch from both sources concurrently
  const [hashnodeResult, devtoResult] = await Promise.allSettled([
    getBlogs(username),
    getDevToBlogs(devToUsername),
  ]);

  const blogs: Blog[] = [];

  // Blog URL configuration
  const HASHNODE_BLOG_BASE_URL = 'https://blog.mikeodnis.dev';

  // Process Hashnode results
  if (hashnodeResult.status === 'fulfilled' && Array.isArray(hashnodeResult.value)) {
    const hashnodeBlogs = hashnodeResult.value.map((blog) => ({
      ...blog,
      source: 'hashnode' as const,
      url: `${HASHNODE_BLOG_BASE_URL}/${blog.slug}`,
    }));
    blogs.push(...hashnodeBlogs);
  } else if (hashnodeResult.status === 'rejected') {
    logger.error('Failed to fetch Hashnode blogs:', hashnodeResult.reason);
  }

  // Process DevTo results
  if (devtoResult.status === 'fulfilled' && Array.isArray(devtoResult.value)) {
    blogs.push(...devtoResult.value);
  } else if (devtoResult.status === 'rejected') {
    logger.error('Failed to fetch DevTo blogs:', devtoResult.reason);
  }

  // If no blogs from any source, throw an error
  if (blogs.length === 0) {
    throw new BaseError(new Error('Failed to fetch blogs from any source'), 'blog:fetch', {
      username,
    });
  }

  // Sort all blogs by published date (newest first)
  blogs.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return blogs;
}
