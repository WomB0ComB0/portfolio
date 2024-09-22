import { type GAResponse, getAnalytics } from '@/lib/google';
import { NextResponse } from 'next/server';
import superjson from 'superjson';
import { z } from 'zod';

const schema = z.object({
  analytics: z.object({
    total_pageviews: z.number(),
  }),
  response: z.custom<GAResponse>(),
});

const CACHE_DURATION = 60 * 60 * 1000;
let cache: { data: any; timestamp: number } | null = null;

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(superjson.stringify(cache.data), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const parsedResp = schema.safeParse(await getAnalytics());

    if (!parsedResp.success) {
      throw new Error(`
        Umami API responded with status ${parsedResp.error}
      `);
    }

    const analytics = parsedResp.data.analytics;
    cache = { data: analytics, timestamp: Date.now() };

    return NextResponse.json(superjson.stringify(analytics), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
      },
    });
  } catch (error) {
    console.error('Error fetching Umami analytics:', error);
    return NextResponse.json(
      superjson.stringify({
        error: `${error instanceof Error ? error.message : ''}`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
