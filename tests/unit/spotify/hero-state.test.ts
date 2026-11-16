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
 * @file The /spotify hero's first state, from the server's now-playing snapshot: the track while
 * one plays; otherwise the track the site last saw playing ("Recently played"), if that was in
 * the last 12 hours; otherwise "Nothing playing". A failed snapshot is "unreachable", never
 * "nothing", and a slow one has the same readable fallback. The home tile's view rules decide what counts
 * as playing, so the two surfaces agree.
 */

import { describe, expect, it } from 'vitest';

import type { LiveInitial } from '@/app/_components/home/data/tile-result';
import type { PlayingTrackView } from '@/app/_components/home/live/now-playing-view';
import {
  firstHeroView,
  freshRecent,
  heroState,
  nextRecent,
  RECENT_MAX_AGE_MS,
  type RecentTrack,
} from '@/app/(routes)/(main)/(personal)/spotify/_lib/hero-state';
import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';

const FETCHED_AT = 1_700_000_000_000;
const HOUR_MS = 60 * 60_000;

const playing: NowPlayingResponse = {
  isPlaying: true,
  songName: 'Song',
  artistName: 'Singer',
  songURL: 'https://open.spotify.com/track/x',
  imageURL: 'https://i.scdn.co/image/x',
};

const snapshot = (data: NowPlayingResponse): LiveInitial<NowPlayingResponse> => ({
  kind: 'data',
  data,
  fetchedAt: FETCHED_AT,
});

const track: PlayingTrackView = {
  kind: 'playing',
  title: 'Earlier Song',
  subtitle: 'Earlier Singer',
  spokenSuffix: 'by Earlier Singer on Spotify',
  href: 'https://open.spotify.com/track/earlier',
  imageURL: 'https://i.scdn.co/image/earlier',
};

const recent: RecentTrack = { track, at: FETCHED_AT - HOUR_MS };

/** The hero's first state, as the page computes it from the server's snapshot. */
const first = (initial: LiveInitial<NowPlayingResponse>, memory?: RecentTrack) =>
  heroState(firstHeroView(initial), memory);

describe('the hero first state', () => {
  it('is the track while one plays, linked to its Spotify page', () => {
    const state = first(snapshot(playing), recent);

    expect(state).toMatchObject({
      kind: 'playing',
      title: 'Song',
      subtitle: 'Singer',
      href: 'https://open.spotify.com/track/x',
      imageURL: 'https://i.scdn.co/image/x',
    });
  });

  it('is the track last seen playing when nothing plays now', () => {
    expect(first(snapshot({ isPlaying: false }), recent)).toEqual({
      kind: 'recent',
      track,
      at: recent.at,
    });
  });

  it('is "nothing" when nothing plays and no track was seen', () => {
    expect(first(snapshot({ isPlaying: false }))).toEqual({ kind: 'nothing' });
  });

  it('is "playing-unknown" for an episode or an ad (playing, no track)', () => {
    expect(first(snapshot({ isPlaying: true }), recent)).toEqual({ kind: 'playing-unknown' });
  });

  it('is "unreachable" when Spotify failed, never "nothing", even with a track remembered', () => {
    expect(first({ kind: 'error' }, recent)).toEqual({ kind: 'unreachable' });
  });

  it('shows an honest unavailable state when Spotify is too slow, even without JavaScript', () => {
    expect(first({ kind: 'timeout' }, recent)).toEqual({ kind: 'unreachable' });
  });
});

describe('nextRecent', () => {
  it('remembers a playing track and when it was seen', () => {
    const view = firstHeroView(snapshot(playing));

    expect(nextRecent(undefined, view, FETCHED_AT)).toMatchObject({
      at: FETCHED_AT,
      track: { title: 'Song', href: 'https://open.spotify.com/track/x' },
    });
  });

  it('keeps what it had when nothing, or no track, plays', () => {
    expect(nextRecent(recent, firstHeroView(snapshot({ isPlaying: false })), FETCHED_AT)).toBe(
      recent,
    );
    expect(nextRecent(recent, firstHeroView(snapshot({ isPlaying: true })), FETCHED_AT)).toBe(
      recent,
    );
    expect(nextRecent(recent, firstHeroView({ kind: 'error' }), FETCHED_AT)).toBe(recent);
  });

  it('returns the same memory for the same sighting, so a render can compare by identity', () => {
    const view = firstHeroView(snapshot(playing));
    const memory = nextRecent(undefined, view, FETCHED_AT);

    expect(nextRecent(memory, view, FETCHED_AT)).toBe(memory);
    expect(nextRecent(memory, view, FETCHED_AT + 30_000)).not.toBe(memory);
  });
});

describe('freshRecent', () => {
  it('keeps a track seen in the last 12 hours and drops an older one', () => {
    expect(RECENT_MAX_AGE_MS).toBe(12 * HOUR_MS);
    expect(freshRecent(recent, recent.at + RECENT_MAX_AGE_MS)).toBe(recent);
    expect(freshRecent(recent, recent.at + RECENT_MAX_AGE_MS + 1)).toBeUndefined();
    expect(freshRecent(undefined, FETCHED_AT)).toBeUndefined();
  });

  it('drops a sighting from the future (a clock that jumped back)', () => {
    expect(freshRecent(recent, recent.at - 2 * 60_000)).toBeUndefined();
  });
});
