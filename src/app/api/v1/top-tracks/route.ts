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
  })
);

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
let cache: { data: any; timestamp: number } | null = null;

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(superjson.stringify(cache.data), {
        headers: { 'Content-Type': 'application/json' },
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

    cache = { data: topTracks, timestamp: Date.now() };

    return NextResponse.json(superjson.stringify(topTracks), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
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
