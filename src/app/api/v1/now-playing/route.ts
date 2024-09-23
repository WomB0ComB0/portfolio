import { currentlyPlayingSong } from '@/lib/spotify';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  isPlaying: z.boolean(),
  songName: z.string().optional(),
  artistName: z.string().optional(),
  songURL: z.string().optional(),
  imageURL: z.string().optional(),
});

export async function GET() {
  try {
    const response = await currentlyPlayingSong();

    if (!response || !response.is_playing) {
      return NextResponse.json({ isPlaying: false });
    }

    const song = {
      isPlaying: response.is_playing,
      songName: response.item?.name,
      artistName: response.item?.artists?.map((_artist: any) => _artist.name).join(', '),
      songURL: response.item?.external_urls?.spotify,
      imageURL: response.item?.album?.images?.[0]?.url,
    };

    const validatedSong = schema.parse(song);
    return NextResponse.json(validatedSong);
  } catch (error) {
    console.error('Error in now-playing API route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
