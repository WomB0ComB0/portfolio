import { topArtists as getTopArtists } from '@/lib/spotify';
import { NextResponse } from 'next/server';
import superjson from 'superjson';
import { z } from 'zod';

const schema = z.array(
  z.object({
    name: z.string(),
    external_urls: z.object({ spotify: z.string() }),
    images: z.array(z.object({ url: z.string() })),
  }),
);

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
let cache: { data: any; timestamp: number } | null = null;

export async function GET() {
  try {
    const now = Date.now();
    const shouldRevalidate = !cache || (now - cache.timestamp > CACHE_DURATION);

    if (!shouldRevalidate && cache) {
      return NextResponse.json(superjson.stringify(cache.data), {
        headers: {
          'Content-Type': 'application/json',

          'Cache-Control': 'no-cache, must-revalidate, max-age=0',
        },
      });
    }

    const resp = await getTopArtists();
    const validatedData = schema.parse(resp);

    const topArtists = validatedData.map((artist) => ({
      name: artist.name,
      url: artist.external_urls.spotify,
      imageUrl: artist.images[0]?.url,
    }));

    cache = { data: topArtists, timestamp: now };

    return NextResponse.json(superjson.stringify(topArtists), {
      headers: {
        'Content-Type': 'application/json',

        'Cache-Control': 'no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error fetching top artists:', error);
    return NextResponse.json(superjson.stringify({ error: 'Failed to fetch top artists data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
