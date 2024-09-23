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
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(superjson.stringify(cache.data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
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

    cache = { data: topArtists, timestamp: Date.now() };

    return NextResponse.json(superjson.stringify(topArtists), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
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
