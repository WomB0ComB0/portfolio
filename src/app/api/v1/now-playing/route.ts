import { currentlyPlayingSong as getNowPlaying } from '@/lib/spotify';
import { NextResponse } from 'next/server';
import superjson from 'superjson';
import { z } from 'zod';

const CACHE_DURATION = 60 * 1000; // 1 minute
let cache: { data: any; timestamp: number } | null = null;

const schema = z.object({
  is_playing: z.boolean(),
  item: z.object({
    name: z.string(),
    artists: z.array(z.object({ name: z.string() })),
    external_urls: z.object({ spotify: z.string() }),
    album: z.object({
      images: z.array(z.object({ url: z.string() })),
    }),
  }),
});

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(superjson.stringify(cache.data), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const resp = await getNowPlaying();

    if (resp.status === 204) {
      return NextResponse.json(superjson.stringify({ isPlaying: false }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const validatedData = schema.parse(data);

    const nowPlaying = {
      isPlaying: validatedData.is_playing,
      songName: validatedData.item?.name || '',
      artistName: validatedData.item?.artists[0]?.name || '',
      songURL: validatedData.item?.external_urls?.spotify || '',
      imageURL: validatedData.item?.album?.images[0]?.url || '',
    };

    cache = { data: nowPlaying, timestamp: Date.now() };

    return NextResponse.json(superjson.stringify(nowPlaying), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('Error fetching now playing:', error);
    return NextResponse.json(superjson.stringify({ error: 'Failed to fetch now playing data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
