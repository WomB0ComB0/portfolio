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

/**
 * @file What the home now-playing tile shows for its query's state. Pure (no directive, no
 * hooks, type-only imports), so every rule is tested without rendering.
 */

import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';
import type { LiveInitial } from '../data/tile-result';

/** The subtitle of a playing track whose artist Spotify did not name. */
export const SPOTIFY_SUBTITLE = 'Spotify';

/** Track pages: the only links the tile makes. The API sends nothing else, and this keeps it so. */
const SPOTIFY_LINK_HOST = 'open.spotify.com';
/** Spotify's image CDN, the one album-art host next.config lets next/image load. */
const SPOTIFY_IMAGE_HOST = 'i.scdn.co';

/** A playing track, as the tile prints it. */
export interface PlayingTrackView {
  readonly kind: 'playing';
  readonly title: string;
  /** The artists, or 'Spotify' when Spotify sent none. */
  readonly subtitle: string;
  /** What screen readers hear after the title in the link: 'by <artist> on Spotify'. */
  readonly spokenSuffix: string;
  /** The track's Spotify page. Only a playing track with one makes the tile a link. */
  readonly href?: string;
  readonly imageURL?: string;
}

export type NowPlayingView =
  | { readonly kind: 'loading' }
  | PlayingTrackView
  /** Playing, but not a track (an episode or an ad): nothing to name or link. */
  | { readonly kind: 'playing-unknown' }
  | { readonly kind: 'idle' }
  | { readonly kind: 'error' };

export interface NowPlayingViewInput {
  /** The query's data: the server snapshot or the latest poll. */
  readonly data: NowPlayingResponse | undefined;
  /** The latest poll failed (after the QueryClient's retry). */
  readonly isError: boolean;
  /** How the server snapshot went: 'error' means Spotify already failed during the render. */
  readonly initialKind: LiveInitial<NowPlayingResponse>['kind'];
}

/** `value` when it has visible text; a blank string counts as missing. */
const textOf = (value: string | undefined): string | undefined =>
  value?.trim() ? value : undefined;

/**
 * `value` as an https URL on `hostname`, normalised, or undefined for anything else. The URL
 * parser drops surrounding spaces itself.
 */
function httpsUrlOn(value: string | undefined, hostname: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === hostname ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function playingTrack(data: NowPlayingResponse, title: string): PlayingTrackView {
  const artist = textOf(data.artistName);
  return {
    kind: 'playing',
    title,
    subtitle: artist ?? SPOTIFY_SUBTITLE,
    spokenSuffix: artist ? `by ${artist} on Spotify` : 'on Spotify',
    href: httpsUrlOn(data.songURL, SPOTIFY_LINK_HOST),
    imageURL: httpsUrlOn(data.imageURL, SPOTIFY_IMAGE_HOST),
  };
}

/**
 * The tile's state, in this order:
 * 1. The latest poll failed: error, even with an earlier poll's track at hand. That track is no
 *    longer known to be playing, and showing it would claim it is.
 * 2. No data yet, and the server snapshot already failed: error (the island is polling).
 * 3. No data yet: loading.
 * 4. Nothing playing: idle.
 * 5. Playing without a track name: playing-unknown.
 * 6. Otherwise the track. Only its Spotify page (`songURL`, https on open.spotify.com) ever
 *    becomes the link, and only art on Spotify's CDN is shown.
 */
export function nowPlayingView({
  data,
  isError,
  initialKind,
}: NowPlayingViewInput): NowPlayingView {
  if (isError) return { kind: 'error' };
  if (!data) return initialKind === 'error' ? { kind: 'error' } : { kind: 'loading' };
  if (!data.isPlaying) return { kind: 'idle' };
  const title = textOf(data.songName);
  return title ? playingTrack(data, title) : { kind: 'playing-unknown' };
}

/** Whether the tile has a destination: a playing track's page, or /spotify while idle. */
export const nowPlayingHasLink = (view: NowPlayingView): boolean =>
  view.kind === 'idle' || (view.kind === 'playing' && view.href !== undefined);
