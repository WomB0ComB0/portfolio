// @vitest-environment node
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
 * @file The now-playing tile only says what is known: a failed poll beats an earlier poll's
 * track, a failed server snapshot reads as an error rather than a spinner, and only a track's
 * own Spotify page ever becomes a link.
 */

import { describe, expect, it } from 'vitest';

import {
  nowPlayingHasLink,
  nowPlayingView,
  SPOTIFY_SUBTITLE,
} from '@/app/_components/home/live/now-playing-view';
import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';

const SONG_URL = 'https://open.spotify.com/track/abc';
const IMAGE_URL = 'https://i.scdn.co/image/ghi';

const TRACK: NowPlayingResponse = {
  isPlaying: true,
  songName: 'My War',
  artistName: 'Shinsei Kamattechan',
  songURL: SONG_URL,
  artistURL: 'https://open.spotify.com/artist/def',
  imageURL: IMAGE_URL,
};

const viewOf = (data: NowPlayingResponse | undefined, isError = false) =>
  nowPlayingView({ data, isError, initialKind: 'data' });

describe('nowPlayingView', () => {
  it('is an error when the latest poll failed, even with an earlier track at hand', () => {
    expect(nowPlayingView({ data: TRACK, isError: true, initialKind: 'data' })).toEqual({
      kind: 'error',
    });
  });

  it('is an error with no data when the server snapshot already failed', () => {
    expect(nowPlayingView({ data: undefined, isError: false, initialKind: 'error' })).toEqual({
      kind: 'error',
    });
  });

  it.each(['data', 'timeout'] as const)(
    'is loading with no data when the snapshot was %s',
    (initialKind) => {
      expect(nowPlayingView({ data: undefined, isError: false, initialKind })).toEqual({
        kind: 'loading',
      });
    },
  );

  it('is an error with no data once a poll has failed', () => {
    expect(nowPlayingView({ data: undefined, isError: true, initialKind: 'timeout' })).toEqual({
      kind: 'error',
    });
  });

  it('is idle when nothing plays, whatever else the answer carries', () => {
    expect(viewOf({ isPlaying: false })).toEqual({ kind: 'idle' });
    expect(viewOf({ ...TRACK, isPlaying: false })).toEqual({ kind: 'idle' });
  });

  it('is playing-unknown when something plays without a track name', () => {
    expect(viewOf({ isPlaying: true })).toEqual({ kind: 'playing-unknown' });
    expect(viewOf({ ...TRACK, songName: '   ' })).toEqual({ kind: 'playing-unknown' });
  });

  it('names the track, its artists, its page and its art', () => {
    expect(viewOf(TRACK)).toEqual({
      kind: 'playing',
      title: 'My War',
      subtitle: 'Shinsei Kamattechan',
      spokenSuffix: 'by Shinsei Kamattechan on Spotify',
      href: SONG_URL,
      imageURL: IMAGE_URL,
    });
  });

  it("says 'Spotify' when the track has no artist", () => {
    expect(viewOf({ ...TRACK, artistName: undefined })).toMatchObject({
      kind: 'playing',
      subtitle: SPOTIFY_SUBTITLE,
      spokenSuffix: 'on Spotify',
    });
    expect(viewOf({ ...TRACK, artistName: ' ' })).toMatchObject({ subtitle: SPOTIFY_SUBTITLE });
  });

  it('links only the song page, never the artist page', () => {
    const view = viewOf({ ...TRACK, songURL: undefined });

    expect(view).toMatchObject({ kind: 'playing', title: 'My War' });
    expect(view).toHaveProperty('href', undefined);
    expect(nowPlayingHasLink(view)).toBe(false);
  });

  it.each([
    ['blank', '  '],
    ['a bare #', '#'],
    ['not https', 'http://open.spotify.com/track/abc'],
    ['another host', 'https://evil.example/track/abc'],
    ['a script URL', 'javascript:alert(1)'],
    ['not a URL', 'open spotify'],
  ])('drops a songURL that is %s', (_label, songURL) => {
    expect(viewOf({ ...TRACK, songURL })).toHaveProperty('href', undefined);
  });

  it('keeps the trimmed page of a songURL with stray spaces', () => {
    expect(viewOf({ ...TRACK, songURL: ` ${SONG_URL} ` })).toHaveProperty('href', SONG_URL);
  });

  it.each([
    ['blank', ''],
    ['not on the Spotify image CDN', 'https://images.example/art.jpg'],
    ['not https', 'http://i.scdn.co/image/ghi'],
  ])('shows no art when imageURL is %s', (_label, imageURL) => {
    expect(viewOf({ ...TRACK, imageURL })).toHaveProperty('imageURL', undefined);
  });
});

describe('nowPlayingHasLink', () => {
  it('links a playing track with a page and the idle tile (to /spotify)', () => {
    expect(nowPlayingHasLink(viewOf(TRACK))).toBe(true);
    expect(nowPlayingHasLink({ kind: 'idle' })).toBe(true);
  });

  it.each(['loading', 'playing-unknown', 'error'] as const)('does not link the %s tile', (kind) => {
    expect(nowPlayingHasLink({ kind })).toBe(false);
  });
});
