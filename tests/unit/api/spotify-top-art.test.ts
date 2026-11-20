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
 * @file The v1 top-tracks and top-artists handlers serve Spotify's 300 px art, the smallest
 * image at least twice the 64 px the site draws a listed cover or portrait at, rather than the
 * first (640 px) image Spotify lists; and art only from Spotify's image CDN.
 */

import { describe, expect, it, vi } from 'vitest';

const spotify = vi.hoisted(() => ({ topTracks: vi.fn(), topArtists: vi.fn() }));

vi.mock('@/lib/api-integrations/spotify', () => spotify);

import { fetchTopArtists } from '@/app/api/v1/[[...route]]/top-artists/handlers';
import { fetchTopTracks } from '@/app/api/v1/[[...route]]/top-tracks/handlers';

/** Spotify's three sizes, largest first, as it lists them. */
const images = (name: string) => [
  { url: `https://i.scdn.co/image/${name}-640`, width: 640, height: 640 },
  { url: `https://i.scdn.co/image/${name}-300`, width: 300, height: 300 },
  { url: `https://i.scdn.co/image/${name}-64`, width: 64, height: 64 },
];

describe('v1 Spotify list art', () => {
  it("gives each top track Spotify's 300 px cover, and none from another host", async () => {
    spotify.topTracks.mockResolvedValue([
      {
        name: 'First Song',
        artists: [{ name: 'First Artist' }],
        album: { images: images('album') },
        external_urls: { spotify: 'https://open.spotify.com/track/first' },
      },
      {
        name: 'Elsewhere',
        artists: [{ name: 'Someone' }],
        album: { images: [{ url: 'https://images.example.com/a.png', width: 300 }] },
        external_urls: { spotify: 'https://open.spotify.com/track/elsewhere' },
      },
    ]);

    const tracks = await fetchTopTracks();

    expect(tracks.map((track) => track.imageUrl)).toEqual([
      'https://i.scdn.co/image/album-300',
      '',
    ]);
  });

  it("gives each top artist Spotify's 300 px portrait", async () => {
    spotify.topArtists.mockResolvedValue([
      {
        name: 'First Artist',
        external_urls: { spotify: 'https://open.spotify.com/artist/first' },
        images: images('artist'),
      },
    ]);

    const artists = await fetchTopArtists();

    expect(artists).toEqual([
      {
        name: 'First Artist',
        url: 'https://open.spotify.com/artist/first',
        imageUrl: 'https://i.scdn.co/image/artist-300',
      },
    ]);
  });
});
