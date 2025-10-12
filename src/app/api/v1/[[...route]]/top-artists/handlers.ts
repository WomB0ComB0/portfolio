import { topArtists as getTopArtists } from '@/lib/spotify';

interface SpotifyArtist {
  name: string;
  external_urls: {
    spotify: string;
  };
  images: Array<{ url: string }>;
}

interface TopArtist {
  name: string;
  url: string;
  imageUrl?: string;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
let cache: { data: TopArtist[]; timestamp: number } | null = null;

export async function fetchTopArtists(): Promise<TopArtist[]> {
  const now = Date.now();
  const shouldRevalidate = !cache || now - cache.timestamp > CACHE_DURATION;

  if (!shouldRevalidate && cache) {
    return cache.data;
  }

  const resp: SpotifyArtist[] = await getTopArtists();

  const topArtists: TopArtist[] = resp.map((artist) => ({
    name: artist.name,
    url: artist.external_urls.spotify,
    imageUrl: artist.images[0]?.url,
  }));

  cache = { data: topArtists, timestamp: now };

  return topArtists;
}
