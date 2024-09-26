import { getBlogs } from '@/lib/blogs';
import { NextResponse } from 'next/server';
import superjson from 'superjson';
import { z } from 'zod';

const schema = z.array(
  z.object({
    title: z.string(),
    slug: z.string(),
    publishedAt: z.string(),
    excerpt: z.string(),
  }),
);

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
let cache: { data: any; timestamp: number } | null = null;

export const GET = async () => {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(superjson.stringify(cache.data), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const blogs = await getBlogs('WomB0ComB0');
    const parsedResp = schema.safeParse(blogs);

    if (!parsedResp.success) {
      throw new Error('Failed to parse blogs');
    }

    cache = { data: parsedResp.data, timestamp: Date.now() };

    return NextResponse.json(superjson.stringify(cache.data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
      },
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    return NextResponse.json(superjson.stringify({ error: 'Failed to fetch blogs' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
