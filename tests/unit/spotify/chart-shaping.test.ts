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
 * @file The Chart ledger's shaping of Spotify's raw top items: ranks in Spotify's order (counted
 * again after a bad item is skipped), m:ss lengths, every credited artist, links only to
 * open.spotify.com, art only from Spotify's CDN and at the smallest size that stays sharp, and
 * the header's figures.
 */

import { describe, expect, it } from 'vitest';

import {
  ARTISTS_SHOWN,
  chartStats,
  durationIso,
  formatDuration,
  pickImage,
  shapeTopArtists,
  shapeTopTracks,
} from '@/app/(routes)/(main)/(personal)/spotify/_lib/chart';

/** A raw top track as Spotify sends it, trimmed to the fields the ledger reads. */
const rawTrack = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'track-one',
  name: 'First Song',
  duration_ms: 185_000,
  external_urls: { spotify: 'https://open.spotify.com/track/one' },
  artists: [{ name: 'Singer One' }, { name: 'Guest' }],
  album: {
    name: 'First Album',
    images: [
      { url: 'https://i.scdn.co/image/640', width: 640, height: 640 },
      { url: 'https://i.scdn.co/image/300', width: 300, height: 300 },
      { url: 'https://i.scdn.co/image/64', width: 64, height: 64 },
    ],
  },
  ...overrides,
});

const rawArtist = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'artist-one',
  name: 'First Artist',
  external_urls: { spotify: 'https://open.spotify.com/artist/one' },
  images: [
    { url: 'https://i.scdn.co/image/a640', width: 640, height: 640 },
    { url: 'https://i.scdn.co/image/a320', width: 320, height: 320 },
    { url: 'https://i.scdn.co/image/a160', width: 160, height: 160 },
  ],
  ...overrides,
});

describe('formatDuration', () => {
  it('writes a length as m:ss, seconds rounded down', () => {
    expect(formatDuration(185_000)).toBe('3:05');
    expect(formatDuration(185_999)).toBe('3:05');
    expect(formatDuration(59_999)).toBe('0:59');
    expect(formatDuration(600_000)).toBe('10:00');
  });

  it('adds hours past an hour, as h:mm:ss', () => {
    expect(formatDuration(3_600_000)).toBe('1:00:00');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });

  it('has no length for a missing, negative or non-finite value', () => {
    for (const value of [undefined, null, -1, Number.NaN, Number.POSITIVE_INFINITY, '185000']) {
      expect(formatDuration(value)).toBeUndefined();
    }
  });
});

describe('durationIso', () => {
  it('writes the same length as an ISO 8601 duration for <time dateTime>', () => {
    expect(durationIso(185_000)).toBe('PT3M5S');
    expect(durationIso(3_725_000)).toBe('PT1H2M5S');
    expect(durationIso(45_000)).toBe('PT45S');
    expect(durationIso(undefined)).toBeUndefined();
  });
});

describe('pickImage', () => {
  it('picks the smallest image at least as wide as asked', () => {
    const images = (rawTrack().album as { images: unknown }).images;

    expect(pickImage(images, 80)).toBe('https://i.scdn.co/image/300');
    expect(pickImage(images, 64)).toBe('https://i.scdn.co/image/64');
  });

  it('falls back to the widest image when none is wide enough, and to the first without sizes', () => {
    expect(pickImage([{ url: 'https://i.scdn.co/image/64', width: 64 }], 300)).toBe(
      'https://i.scdn.co/image/64',
    );
    expect(pickImage([{ url: 'https://i.scdn.co/image/x' }], 80)).toBe('https://i.scdn.co/image/x');
  });

  it("only takes art from Spotify's CDN, over https", () => {
    expect(pickImage([{ url: 'https://evil.example/image.png', width: 300 }], 80)).toBeUndefined();
    expect(pickImage([{ url: 'http://i.scdn.co/image/300', width: 300 }], 80)).toBeUndefined();
    expect(pickImage(undefined, 80)).toBeUndefined();
    expect(pickImage([], 80)).toBeUndefined();
  });
});

describe('shapeTopTracks', () => {
  it('ranks the tracks in the order Spotify sent them, from 1', () => {
    const tracks = shapeTopTracks([
      rawTrack(),
      rawTrack({ id: 'track-two', name: 'Second Song' }),
      rawTrack({ id: 'track-three', name: 'Third Song' }),
    ]);

    expect(tracks.map((track) => [track.rank, track.title])).toEqual([
      [1, 'First Song'],
      [2, 'Second Song'],
      [3, 'Third Song'],
    ]);
  });

  it('keeps the title, every artist, the album, the length and the link', () => {
    const [track] = shapeTopTracks([rawTrack()]);

    expect(track).toMatchObject({
      key: 'track-one',
      title: 'First Song',
      artist: 'Singer One, Guest',
      album: 'First Album',
      duration: '3:05',
      durationIso: 'PT3M5S',
      durationMs: 185_000,
      href: 'https://open.spotify.com/track/one',
      art: 'https://i.scdn.co/image/300',
    });
  });

  it('has no art when the album has none, so the row draws its glyph', () => {
    const [noImages, noAlbum] = shapeTopTracks([
      rawTrack({ album: { name: 'Bare', images: [] } }),
      rawTrack({ id: 'two', album: undefined }),
    ]);

    expect(noImages?.art).toBeUndefined();
    expect(noAlbum?.art).toBeUndefined();
    expect(noAlbum?.album).toBeUndefined();
  });

  it('does not link a local file (no Spotify page) or anything off open.spotify.com', () => {
    const [local, offsite] = shapeTopTracks([
      rawTrack({ external_urls: {} }),
      rawTrack({ id: 'two', external_urls: { spotify: 'https://evil.example/track' } }),
    ]);

    expect(local?.href).toBeUndefined();
    expect(offsite?.href).toBeUndefined();
  });

  it("says 'Unknown artist' when Spotify names none, and has no length without one", () => {
    const [track] = shapeTopTracks([rawTrack({ artists: [], duration_ms: undefined })]);

    expect(track?.artist).toBe('Unknown artist');
    expect(track?.duration).toBeUndefined();
    expect(track?.durationIso).toBeUndefined();
  });

  it('skips an item without a title and ranks the rest without a gap', () => {
    const tracks = shapeTopTracks([
      rawTrack(),
      rawTrack({ id: 'blank', name: '   ' }),
      null,
      'not a track',
      rawTrack({ id: 'track-four', name: 'Fourth Song' }),
    ]);

    expect(tracks.map((track) => [track.rank, track.title])).toEqual([
      [1, 'First Song'],
      [2, 'Fourth Song'],
    ]);
  });

  it('keys a track without an id by its link, then by its rank', () => {
    const [byUrl, byRank] = shapeTopTracks([
      rawTrack({ id: undefined }),
      rawTrack({ id: undefined, external_urls: {} }),
    ]);

    expect(byUrl?.key).toBe('https://open.spotify.com/track/one');
    expect(byRank?.key).toBe('rank-2');
  });
});

describe('shapeTopArtists', () => {
  it('ranks the artists and keeps a portrait sharp at 64px on a 2x screen', () => {
    const artists = shapeTopArtists([rawArtist(), rawArtist({ id: 'two', name: 'Second' })]);

    expect(artists[0]).toMatchObject({
      rank: 1,
      key: 'artist-one',
      name: 'First Artist',
      href: 'https://open.spotify.com/artist/one',
      image: 'https://i.scdn.co/image/a160',
    });
    expect(artists[1]?.rank).toBe(2);
  });

  it('has no portrait when Spotify sent none, and no link off open.spotify.com', () => {
    const [artist] = shapeTopArtists([
      rawArtist({ images: [], external_urls: { spotify: 'javascript:alert(1)' } }),
    ]);

    expect(artist?.image).toBeUndefined();
    expect(artist?.href).toBeUndefined();
  });

  it('shows the top ten in the strip', () => {
    expect(ARTISTS_SHOWN).toBe(10);
  });
});

describe('chartStats', () => {
  it('counts the tracks, the different artists credited on them and their minutes', () => {
    const tracks = shapeTopTracks([
      rawTrack({ artists: [{ name: 'A' }, { name: 'B' }], duration_ms: 120_000 }),
      rawTrack({ id: 'two', artists: [{ name: 'A' }], duration_ms: 150_000 }),
      rawTrack({ id: 'three', artists: [{ name: 'C' }], duration_ms: 200_000 }),
    ]);

    expect(chartStats(tracks)).toEqual({ tracks: 3, artists: 3, minutes: 8 });
  });

  it('has no minutes when no track has a length, and no artists when none is named', () => {
    const tracks = shapeTopTracks([rawTrack({ artists: [], duration_ms: undefined })]);

    expect(chartStats(tracks)).toEqual({ tracks: 1, artists: null, minutes: null });
  });

  it('is all zero and nothing for an empty chart', () => {
    expect(chartStats([])).toEqual({ tracks: 0, artists: null, minutes: null });
  });
});
