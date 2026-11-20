/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Schema } from 'effect';
import { topArtists as getTopArtists } from '@/lib/api-integrations/spotify';
import { spotifyArtFor } from '@/lib/images/spotify-art';

/**
 * The portrait's slot: an artist is drawn at up to 64 px wherever the site lists one (the
 * /spotify strip), so Spotify's 300 px image is sharp on a 2x screen, unlike its 64 px one.
 */
const TOP_ARTIST_ART_PX = 64;

const SpotifyImageSchema = Schema.Struct({
  url: Schema.String,
  width: Schema.optional(Schema.NullOr(Schema.Number)),
});

const SpotifyExternalUrlsSchema = Schema.Struct({
  spotify: Schema.String,
});

const SpotifyArtistSchema = Schema.Struct({
  name: Schema.String,
  external_urls: SpotifyExternalUrlsSchema,
  images: Schema.Array(SpotifyImageSchema),
});

const TopArtistSchema = Schema.Struct({
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
    imageUrl: spotifyArtFor(artist.images, TOP_ARTIST_ART_PX) ?? '',
  }));

  cache = { data: topArtists, timestamp: now };

  return topArtists;
}
