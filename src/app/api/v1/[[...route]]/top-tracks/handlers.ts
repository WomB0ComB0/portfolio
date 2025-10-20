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
import { topTracks as getTopTracks } from '@/lib/api-integrations/spotify';

const SpotifyArtistSchema = Schema.Struct({
  name: Schema.String,
});

const SpotifyImageSchema = Schema.Struct({
  url: Schema.String,
});

const SpotifyAlbumSchema = Schema.Struct({
  images: Schema.Array(SpotifyImageSchema),
});

const SpotifyExternalUrlsSchema = Schema.Struct({
  spotify: Schema.String,
});

const SpotifyTrackSchema = Schema.Struct({
  name: Schema.String,
  artists: Schema.Array(SpotifyArtistSchema),
  album: SpotifyAlbumSchema,
  external_urls: SpotifyExternalUrlsSchema,
});

export const TopTrackSchema = Schema.Struct({
  name: Schema.String,
  artist: Schema.String,
  url: Schema.String,
  imageUrl: Schema.String,
});

type SpotifyTrack = Schema.Schema.Type<typeof SpotifyTrackSchema>;
export type TopTrack = Schema.Schema.Type<typeof TopTrackSchema>;

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
let cache: { data: TopTrack[]; timestamp: number } | null = null;

export async function fetchTopTracks(): Promise<TopTrack[]> {
  const now = Date.now();
  const shouldRevalidate = !cache || now - cache.timestamp > CACHE_DURATION;

  if (!shouldRevalidate && cache) {
    return cache.data;
  }

  const resp = (await getTopTracks()) as unknown as SpotifyTrack[];

  const topTracks: TopTrack[] = resp.map((track) => ({
    name: track.name,
    artist: track.artists?.[0]?.name ?? 'Unknown Artist',
    url: track.external_urls?.spotify ?? '',
    imageUrl: track.album.images?.[0]?.url ?? '',
  }));

  cache = { data: topTracks, timestamp: now };

  return topTracks;
}
