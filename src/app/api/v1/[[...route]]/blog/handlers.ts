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
import { getBlogs } from '@/lib';

export const BlogSchema = Schema.Struct({
  title: Schema.String,
  slug: Schema.String,
  publishedAt: Schema.String,
  excerpt: Schema.String,
  imageUrl: Schema.optional(Schema.String), // Corrected usage of Schema.optional
});

export type Blog = Schema.Schema.Type<typeof BlogSchema>;

export async function fetchBlogs(): Promise<Blog[]> {
  const blogs: Blog[] = await getBlogs('WomB0ComB0');

  if (!blogs || !Array.isArray(blogs)) {
    throw new BaseError(new Error('Failed to fetch blogs'), 'blog:fetch', {
      username: 'WomB0ComB0',
    });
  }

  return blogs;
}
