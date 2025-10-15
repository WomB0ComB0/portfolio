import { Schema } from 'effect';
import { BaseError } from '@/classes/error';
import { getBlogs } from '@/lib';

export const BlogSchema = Schema.Struct({
  title: Schema.String,
  slug: Schema.String,
  publishedAt: Schema.String,
  excerpt: Schema.String,
});

export type Blog = Schema.Schema.Type<typeof BlogSchema>;

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
let cache: { data: Blog[]; timestamp: number } | null = null;

export async function fetchBlogs(): Promise<Blog[]> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const blogs: Blog[] = await getBlogs('WomB0ComB0');

  if (!blogs || !Array.isArray(blogs)) {
    throw new BaseError(new Error('Failed to fetch blogs'), 'blog:fetch', {
      username: 'WomB0ComB0',
      cacheExpired: !cache || Date.now() - cache.timestamp >= CACHE_DURATION,
    });
  }

  cache = { data: blogs, timestamp: Date.now() };

  return blogs;
}
