import axios from 'axios';
import { NextResponse } from 'next/server';
import superjson from 'superjson';
import { z } from 'zod';

const CACHE_DURATION = 60 * 1000;
let cache: { data: any; timestamp: number } | null = null;

export const schema = z
  .object({
    data: z.object({
      discord_user: z.object({
        username: z.string(),
        discriminator: z.string(),
        avatar: z.string(),
        id: z.string(),
      }),
      activities: z.array(
        z.object({
          name: z.string(),
          type: z.number(),
          state: z.string().optional(),
          details: z.string().optional(),
        }),
      ),
      discord_status: z.string(),
    }),
  })
  .passthrough();

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(superjson.stringify(cache.data), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const resp = await axios.get(
      `https://api.lanyard.rest/v1/users/${process.env.NEXT_PUBLIC_DISCORD_ID}`,
    );
    const rawData = resp.data;
    // console.log('api-lanyard-rawData', rawData);

    const parsedResp = schema.safeParse(rawData);
    // console.log('api-lanyard-parsedResp', parsedResp);

    if (!parsedResp.success) {
      console.error('Lanyard API schema validation error:', parsedResp.error);
      throw new Error(`Lanyard API response validation failed: ${parsedResp.error}`);
    }

    const lanyard = parsedResp.data.data;
    // console.log('api-lanyard-lanyard', lanyard);
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
