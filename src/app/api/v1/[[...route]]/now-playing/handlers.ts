import { currentlyPlayingSong } from '@/lib';

export async function getNowPlaying() {
  const response = await currentlyPlayingSong();

  if (!response || !response.is_playing) {
    return { isPlaying: false };
  }

  return {
    isPlaying: response.is_playing,
    songName: response.item?.name,
    artistName: response.item?.artists?.map((_artist: any) => _artist.name).join(', '),
    songURL: response.item?.external_urls?.spotify,
    imageURL: response.item?.album?.images?.[0]?.url,
  };
}
