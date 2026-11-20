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
 * @file spotifyArtFor picks the smallest of Spotify's images at least twice the slot it is drawn
 * in, for every slot the site has (40 to 112 px), from an album's 640, 300 and 64 px set.
 */

import { describe, expect, it } from 'vitest';
import { SPOTIFY_ART_SCALE, spotifyArtFor } from '@/lib/images/spotify-art';

const SPOTIFY_SET = [640, 300, 64].map((width) => ({
  url: `https://i.scdn.co/image/${width}`,
  width,
  height: width,
}));

describe('spotifyArtFor', () => {
  it.each([
    [32, 'https://i.scdn.co/image/64'],
    [40, 'https://i.scdn.co/image/300'],
    [56, 'https://i.scdn.co/image/300'],
    [64, 'https://i.scdn.co/image/300'],
    [96, 'https://i.scdn.co/image/300'],
    [112, 'https://i.scdn.co/image/300'],
    [150, 'https://i.scdn.co/image/300'],
    [160, 'https://i.scdn.co/image/640'],
  ])('draws a %i px slot from the smallest image at least twice as wide', (slot, url) => {
    expect(spotifyArtFor(SPOTIFY_SET, slot)).toBe(url);
  });

  it('picks at twice the slot', () => {
    expect(SPOTIFY_ART_SCALE).toBe(2);
  });

  it('takes the widest image when none is wide enough, and the first when none states a width', () => {
    expect(spotifyArtFor(SPOTIFY_SET, 400)).toBe('https://i.scdn.co/image/640');
    expect(spotifyArtFor([{ url: 'https://i.scdn.co/image/x', width: null }], 56)).toBe(
      'https://i.scdn.co/image/x',
    );
  });

  it("only takes art from Spotify's CDN, over https", () => {
    expect(
      spotifyArtFor([{ url: 'https://images.example.com/a.png', width: 300 }], 56),
    ).toBeUndefined();
    expect(spotifyArtFor([{ url: 'http://i.scdn.co/image/300', width: 300 }], 56)).toBeUndefined();
    expect(spotifyArtFor(undefined, 56)).toBeUndefined();
  });
});
