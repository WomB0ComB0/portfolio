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
import { spotifyArtFor } from '@/lib/images/spotify-art';

/**
 * The art's slot: a top track's cover is drawn at 40 to 64 px wherever the site lists one, so
 * Spotify's 300 px image is sharp on a 2x screen, at a fraction of its 640 px one.
 */
const TOP_TRACK_ART_PX = 64;

const SpotifyArtistSchema = Schema.Struct({
  name: Schema.String,
});

const SpotifyImageSchema = Schema.Struct({
  url: Schema.String,
  width: Schema.optional(Schema.NullOr(Schema.Number)),
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

const TopTrackSchema = Schema.Struct({
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
    imageUrl: spotifyArtFor(track.album.images, TOP_TRACK_ART_PX) ?? '',
  }));

  cache = { data: topTracks, timestamp: now };

  return topTracks;
}
