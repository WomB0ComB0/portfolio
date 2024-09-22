import { env } from '@/env';
import { NextResponse } from 'next/server';
import superjson from 'superjson';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
let cache: { data: any; timestamp: number } | null = null;

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(superjson.stringify(cache.data), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const resp = await fetch('https://wakatime.com/api/v1/users/current/all_time_since_today', {
      headers: {
        Authorization: `Basic ${btoa(env.WAKA_TIME_API_KEY as string)}`,
      },
    });

    if (!resp.ok) {
      throw new Error(`WakaTime API responded with status ${resp.status}`);
    }

    const response = await resp.json();
    cache = { data: response.data, timestamp: Date.now() };

    return NextResponse.json(superjson.stringify(response.data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
      },
    });
  } catch (error) {
    console.error('Error fetching WakaTime data:', error);
    return NextResponse.json(superjson.stringify({ error: 'Failed to fetch WakaTime data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
