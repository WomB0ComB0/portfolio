import axios from 'axios';
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

    const resp = await axios.get('https://wakatime.com/api/v1/users/current/all_time_since_today', {
      headers: {
        Authorization: `Basic ${btoa(process.env.WAKA_TIME_API_KEY as string)}`,
      },
    });

    if (resp.status !== 200) {
      throw new Error(`WakaTime API responded with status ${resp.status}`);
    }

    const response = resp.data;
    // console.log('api-wakatime-response', response);
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
