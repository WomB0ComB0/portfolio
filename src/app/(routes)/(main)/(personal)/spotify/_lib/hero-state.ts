/**
 * Copyright 2026 Mike Odnis
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
 * @file What the /spotify now-playing hero shows. Pure (no directive, no hooks), so the server
 * render and the island compute the same first state, and every rule is tested without
 * rendering.
 *
 * It sits on the home tile's view rules (nowPlayingView): what counts as playing, which links
 * and which art are allowed. On top, the hero remembers the last track it saw playing, so an
 * idle page can say "Recently played" instead of only "Nothing playing". The site never asks
 * Spotify for its history (no new API call): the memory is what this server instance, or this
 * tab, saw playing, so the copy says "recently", never "last".
 */

import type { LiveInitial } from '@/app/_components/home/data/tile-result';
import {
  type NowPlayingView,
  nowPlayingView,
  type PlayingTrackView,
} from '@/app/_components/home/live/now-playing-view';
import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';

/** A remembered track older than this is not shown: half a day on, it isn't recent any more. */
export const RECENT_MAX_AGE_MS = 12 * 60 * 60_000;
/** Clock skew allowed for a sighting stamped in the future; beyond it the sighting is dropped. */
const FUTURE_TOLERANCE_MS = 60_000;

/** The last track seen playing, and when (epoch ms). */
export interface RecentTrack {
  readonly track: PlayingTrackView;
  readonly at: number;
}

/** The hero's state, one per design. */
export type HeroState =
  | PlayingTrackView
  /** Playing, but not a track (an episode or an ad): nothing to name or link. */
  | { readonly kind: 'playing-unknown' }
  /** Nothing plays now; this track was seen playing at `at`. */
  | { readonly kind: 'recent'; readonly track: PlayingTrackView; readonly at: number }
  | { readonly kind: 'nothing' }
  /** Spotify failed: never shown as "nothing", which would be a claim. */
  | { readonly kind: 'unreachable' };

/** The home tile's view of the server's snapshot, before any poll (no poll has failed). */
export function firstHeroView(initial: LiveInitial<NowPlayingResponse>): NowPlayingView {
  return nowPlayingView({
    data: initial.kind === 'data' ? initial.data : undefined,
    isError: false,
    initialKind: initial.kind,
  });
}

/**
 * The memory after `view`, seen at `at`: a playing track replaces it; anything else keeps it.
 * The same sighting (same track, same moment) returns `previous` itself, so a render can compare
 * by identity and set state only on a real change.
 */
export function nextRecent(
  previous: RecentTrack | undefined,
  view: NowPlayingView,
  at: number,
): RecentTrack | undefined {
  if (view.kind !== 'playing') return previous;
  const same =
    previous !== undefined &&
    previous.at === at &&
    previous.track.title === view.title &&
    previous.track.href === view.href;
  return same ? previous : { track: view, at };
}

/** `recent` while it is no older than {@link RECENT_MAX_AGE_MS} at `now` (and not from the future). */
export function freshRecent(recent: RecentTrack | undefined, now: number): RecentTrack | undefined {
  if (!recent) return undefined;
  const age = now - recent.at;
  return age >= -FUTURE_TOLERANCE_MS && age <= RECENT_MAX_AGE_MS ? recent : undefined;
}

/**
 * The hero for the home tile's `view`, in this order:
 * 1. Playing (a track, or not a track): as the view says.
 * 2. Spotify failed: unreachable, even with a track remembered (it may still be playing).
 * 3. No answer by the server deadline: unavailable, readable without JavaScript.
 * 4. Nothing plays: the remembered track as "recent", or "nothing" without one.
 */
export function heroState(view: NowPlayingView, recent: RecentTrack | undefined): HeroState {
  switch (view.kind) {
    case 'playing':
    case 'playing-unknown':
      return view;
    case 'error':
      return { kind: 'unreachable' };
    case 'loading':
      return { kind: 'unreachable' };
    case 'idle':
      return recent ? { kind: 'recent', track: recent.track, at: recent.at } : { kind: 'nothing' };
  }
}
