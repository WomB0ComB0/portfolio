import { topTracks as getTopTracks } from '@/lib/spotify';
import { NextResponse } from 'next/server';
import superjson from 'superjson';
import { z } from 'zod';

const schema = z.array(
  z.object({
    name: z.string(),
    artists: z.array(z.object({ name: z.string() })),
    album: z.object({ images: z.array(z.object({ url: z.string() })) }),
    external_urls: z.object({ spotify: z.string() }),
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

    const resp = await getTopTracks();
    const validatedData = schema.parse(resp);

    const topTracks = validatedData.map((track) => ({
      name: track.name,
      artist: track.artists?.[0]?.name,
      url: track.external_urls?.spotify,
      imageUrl: track.album.images?.[0]?.url,
    }));

    cache = { data: topTracks, timestamp: now };

    return NextResponse.json(superjson.stringify(topTracks), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error fetching top tracks:', error);
    return NextResponse.json(superjson.stringify({ error: 'Failed to fetch top tracks data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
