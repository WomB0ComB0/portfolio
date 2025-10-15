import { topTracks as getTopTracks } from '@/lib/api-integrations/spotify';

interface SpotifyTrack {
  name: string;
  artists: Array<{ name: string }>;
  album: {
    images: Array<{ url: string }>;
  };
  external_urls: {
    spotify: string;
  };
}

interface TopTrack {
  name: string;
  artist?: string;
  url?: string;
  imageUrl?: string;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
let cache: { data: TopTrack[]; timestamp: number } | null = null;

export async function fetchTopTracks(): Promise<TopTrack[]> {
  const now = Date.now();
  const shouldRevalidate = !cache || now - cache.timestamp > CACHE_DURATION;

  if (!shouldRevalidate && cache) {
    return cache.data;
  }

  const resp: SpotifyTrack[] = await getTopTracks();

  const topTracks: TopTrack[] = resp.map((track) => ({
    name: track.name,
    artist: track.artists?.[0]?.name,
    url: track.external_urls?.spotify,
    imageUrl: track.album.images?.[0]?.url,
  }));

  cache = { data: topTracks, timestamp: now };

  return topTracks;
}
