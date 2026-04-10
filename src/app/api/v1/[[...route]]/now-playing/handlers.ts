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
import { currentlyPlayingSong } from '@/lib';

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

const SpotifyResponseSchema = Schema.Struct({
  is_playing: Schema.Boolean,
  item: Schema.optional(SpotifyTrackSchema),
});

const NowPlayingResponseSchema = Schema.Struct({
  isPlaying: Schema.Boolean,
  songName: Schema.optional(Schema.String),
  artistName: Schema.optional(Schema.String),
  songURL: Schema.optional(Schema.String),
  imageURL: Schema.optional(Schema.String),
});

export type SpotifyResponse = Schema.Schema.Type<typeof SpotifyResponseSchema>;
export type NowPlayingResponse = Schema.Schema.Type<typeof NowPlayingResponseSchema>;

export async function getNowPlaying(): Promise<NowPlayingResponse> {
  const response = (await currentlyPlayingSong()) as SpotifyResponse | null;

  if (!response || !response.is_playing) {
    return { isPlaying: false };
  }

  return {
    isPlaying: response.is_playing,
    songName: response.item?.name,
    // TODO: flag
    artistName: response.item?.artists?.map((artist: any) => artist.name).join(', '),
    songURL: response.item?.external_urls?.spotify,
    imageURL: response.item?.album?.images?.[0]?.url,
  };
}
