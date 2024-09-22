import { env } from '@/env';
import { NextResponse } from 'next/server';
import superjson from 'superjson';
import { z } from 'zod';

const CACHE_DURATION = 60 * 1000;
let cache: { data: any; timestamp: number } | null = null;

export const schema = z.object({
  data: z.object({
    discord_user: z.object({
      username: z.string(),
      discriminator: z.string(),
      avatar: z.string(),
      id: z.string(),
    }),
    discord_status: z.string(),
  }),
}).passthrough();

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(superjson.stringify(cache.data), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const resp = await fetch(`https://api.lanyard.rest/v1/users/${env.DISCORD_ID}`);
    const rawData = await resp.json();
    console.log('Lanyard API raw response:', JSON.stringify(rawData, null, 2));

    const parsedResp = schema.safeParse(rawData);

    if (!parsedResp.success) {
      console.error('Lanyard API schema validation error:', parsedResp.error);
      throw new Error(`Lanyard API response validation failed: ${parsedResp.error}`);
    }

    const lanyard = parsedResp.data.data;

    cache = { data: lanyard, timestamp: Date.now() };

    return NextResponse.json(superjson.stringify(lanyard), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('Error fetching Lanyard data:', error);
    return NextResponse.json(superjson.stringify({ error: 'Failed to fetch Lanyard data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
