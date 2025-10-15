import { Schema } from 'effect';
import { topArtists as getTopArtists } from '@/lib/api-integrations/spotify';

const SpotifyImageSchema = Schema.Struct({
  url: Schema.String,
});

const SpotifyExternalUrlsSchema = Schema.Struct({
  spotify: Schema.String,
});

const SpotifyArtistSchema = Schema.Struct({
  name: Schema.String,
  external_urls: SpotifyExternalUrlsSchema,
  images: Schema.Array(SpotifyImageSchema),
});

export const TopArtistSchema = Schema.Struct({
  name: Schema.String,
  url: Schema.String,
  imageUrl: Schema.String,
});

type SpotifyArtist = Schema.Schema.Type<typeof SpotifyArtistSchema>;
export type TopArtist = Schema.Schema.Type<typeof TopArtistSchema>;

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
let cache: { data: TopArtist[]; timestamp: number } | null = null;

export async function fetchTopArtists(): Promise<TopArtist[]> {
  const now = Date.now();
  const shouldRevalidate = !cache || now - cache.timestamp > CACHE_DURATION;

  if (!shouldRevalidate && cache) {
    return cache.data;
  }

  const resp = (await getTopArtists()) as unknown as SpotifyArtist[];

  const topArtists: TopArtist[] = resp.map((artist) => ({
    name: artist.name,
    url: artist.external_urls.spotify,
    imageUrl: artist.images[0]?.url ?? '',
  }));

  cache = { data: topArtists, timestamp: now };

  return topArtists;
}
