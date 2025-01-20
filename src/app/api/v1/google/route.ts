import { type GAResponse, getAnalytics } from '@/lib/google';
import { NextResponse } from 'next/server';
import superjson from 'superjson';
import { z } from 'zod';

const schema = z.object({
  analytics: z.object({
    total_pageviews: z.number().optional(),
  }),
  response: z.custom<GAResponse>().optional(),
});

const CACHE_DURATION = 60 * 60 * 1000;
let cache: { data: any; timestamp: number } | null = null;

export async function GET() {
  try {
    // Check cache first
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(superjson.stringify(cache.data), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add fallback data in case of errors
    const fallbackData = {
      analytics: {
        total_pageviews: 0,
      },
    };

    try {
      const parsedResp = schema.safeParse(await getAnalytics());

      if (!parsedResp.success) {
        console.warn('Failed to parse analytics response:', parsedResp.error);
        return NextResponse.json(superjson.stringify(fallbackData.analytics), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const analytics = parsedResp.data.analytics;
      cache = { data: analytics, timestamp: Date.now() };

      return NextResponse.json(superjson.stringify(analytics), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
        },
      });
    } catch (analyticsError) {
      console.error('Error fetching analytics:', analyticsError);
      return NextResponse.json(superjson.stringify(fallbackData.analytics), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in Google Analytics route:', error);
    return NextResponse.json(
      superjson.stringify({
        total_pageviews: 0,
        error: `${error instanceof Error ? error.message : 'Unknown error occurred'}`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
