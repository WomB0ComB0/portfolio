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

import { type CurrentlyPlayingTrack, currentlyPlayingSong } from '@/lib/api-integrations/spotify';
import type { NowPlayingResponse } from './schema';

export type { NowPlayingResponse } from './schema';

const SPOTIFY_LINK_HOST = 'open.spotify.com';
/** Spotify's image CDN, the host next.config allows next/image to load album art from. */
const SPOTIFY_IMAGE_HOST = 'i.scdn.co';

/** `value` as an https URL on `hostname`, or undefined, so the cards only link to Spotify. */
const httpsUrlOn = (value: string | undefined, hostname: string): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === hostname ? url.href : undefined;
  } catch {
    return undefined;
  }
};

const fromTrack = (track: CurrentlyPlayingTrack): NowPlayingResponse => {
  const artistName = track.artists.map((artist) => artist.name).join(', ');
  return {
    isPlaying: true,
    songName: track.name,
    artistName: artistName || undefined,
    songURL: httpsUrlOn(track.external_urls?.spotify, SPOTIFY_LINK_HOST),
    artistURL: httpsUrlOn(track.artists[0]?.external_urls?.spotify, SPOTIFY_LINK_HOST),
    imageURL: httpsUrlOn(track.album?.images[0]?.url, SPOTIFY_IMAGE_HOST),
  };
};

/**
 * What is playing on Spotify, shaped for the site's cards. Nothing playing (Spotify's 204, or a
 * paused player) is `{ isPlaying: false }`. Failures throw, so the route answers 500 rather than
 * claiming nothing is playing.
 */
export async function getNowPlaying(): Promise<NowPlayingResponse> {
  const playback = await currentlyPlayingSong();
  if (!playback?.is_playing) return { isPlaying: false };
  // Playing, but not a track: an episode or an ad has no track details to show.
  if (!playback.item) return { isPlaying: true };
  return fromTrack(playback.item);
}
