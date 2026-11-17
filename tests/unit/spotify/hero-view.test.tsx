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
 * @file The /spotify hero's album art loads at once. The hero is the first tile on the page and
 * its art is the largest image above the fold, so a lazy image makes the browser wait for layout
 * before it fetches the page's largest paint (and Next logs its LCP hint). The art is eager with
 * a high fetch priority in both states that show it; the states with no track draw no image.
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The app's PostCSS config cannot run in Vitest; this matches the home tile's CSS stub.
vi.mock('@/app/_components/home/live/equaliser.module.css', () => ({
  default: new Proxy(
    {},
    { get: (_target, name) => (typeof name === 'string' ? `eq-${name}` : undefined) },
  ),
}));

import type { PlayingTrackView } from '@/app/_components/home/live/now-playing-view';
import { HeroView } from '@/app/(routes)/(main)/(personal)/spotify/_components/hero-view';
import type { HeroState } from '@/app/(routes)/(main)/(personal)/spotify/_lib/hero-state';

const SEEN_AT = 1_700_000_000_000;
const TRACK: PlayingTrackView = {
  kind: 'playing',
  title: 'Sample song',
  subtitle: 'Sample artist',
  spokenSuffix: 'by Sample artist on Spotify',
  href: 'https://open.spotify.com/track/sample',
  imageURL: 'https://i.scdn.co/image/sample-album',
};

/** The hero's images for a state. The art is decorative (alt=""), so it is found by its tag. */
const imagesFor = (state: HeroState): HTMLImageElement[] => [
  ...render(<HeroView state={state} />).container.querySelectorAll('img'),
];

afterEach(cleanup);

describe("the /spotify hero's album art", () => {
  it.each<[string, HeroState]>([
    ['a playing track', TRACK],
    ['a recently played track', { kind: 'recent', track: TRACK, at: SEEN_AT }],
  ])('loads eagerly with a high fetch priority for %s', (_name, state) => {
    const images = imagesFor(state);

    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('loading', 'eager');
    expect(images[0]).toHaveAttribute('fetchpriority', 'high');
    // Still decorative, with the same display dimensions and direct Spotify artwork.
    expect(images[0]).toHaveAttribute('alt', '');
    expect(images[0]).toHaveAttribute('width', '112');
    expect(images[0]).toHaveAttribute('height', '112');
    expect(images[0]).toHaveAttribute('src', TRACK.imageURL);
    expect(images[0]).not.toHaveAttribute('srcset');
  });

  it.each<[string, HeroState]>([
    ['a track without art', { ...TRACK, imageURL: undefined }],
    ['something playing that is not a track', { kind: 'playing-unknown' }],
    ['nothing playing', { kind: 'nothing' }],
    ['Spotify unreachable', { kind: 'unreachable' }],
  ])('draws no image for %s', (_name, state) => {
    expect(imagesFor(state)).toEqual([]);
  });
});
