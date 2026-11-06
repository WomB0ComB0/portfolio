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
 * @file /spotify's artist portraits and track art fetch a file at least as wide as they are drawn
 * on hover. Each card's link scales its image (to 105% for an artist, 103% for a track), so a
 * `sizes` of the resting width let a 1x screen take the 96w portrait or the 64w art and draw it
 * larger, soft.
 *
 * jsdom applies no CSS, so the drawn size is read from the classes that produce it.
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchTopArtists, fetchTopTracks } = vi.hoisted(() => ({
  fetchTopArtists: vi.fn(),
  fetchTopTracks: vi.fn(),
}));

vi.mock('@/app/api/v1/[[...route]]/top-artists/handlers', () => ({ fetchTopArtists }));
vi.mock('@/app/api/v1/[[...route]]/top-tracks/handlers', () => ({ fetchTopTracks }));
vi.mock('@/lib/observability/report', () => ({
  reportApiFailure: vi.fn(() => true),
  reportError: vi.fn(),
}));

import { TopArtists } from '@/app/(routes)/(main)/(personal)/spotify/_components/top-artists';
import { TopTracks } from '@/app/(routes)/(main)/(personal)/spotify/_components/top-tracks';

const TAILWIND_SPACING_PX = 4;

/** The first capture of the first class on `element` that `pattern` matches, as a number. */
function classNumber(element: Element, pattern: RegExp): number {
  for (const name of element.classList) {
    const value = pattern.exec(name)?.[1];
    if (value !== undefined) return Number(value);
  }
  throw new Error(`no class matching ${pattern} on <${element.tagName.toLowerCase()}>`);
}

/** The hover scale a link's classes give it: `hover:scale-105` is 1.05, `hover:scale-[1.03]` 1.03. */
function hoverScaleOf(link: Element): number {
  for (const name of link.classList) {
    const [, percent, factor] =
      /^(?:motion-safe:)?hover:scale-(?:(\d+)|\[([\d.]+)\])$/.exec(name) ?? [];
    if (percent !== undefined) return Number(percent) / 100;
    if (factor !== undefined) return Number(factor);
  }
  throw new Error('the link has no hover scale');
}

const sizesPx = (image: Element): number =>
  Number(/^(\d+)px$/.exec(image.getAttribute('sizes') ?? '')?.[1] ?? Number.NaN);

/** The srcset candidate a 1x screen takes: the narrowest at least `sizes` wide. */
const oneXWidth = (image: Element): number | undefined =>
  [...(image.getAttribute('srcset') ?? '').matchAll(/\s(\d+)w(?:,|$)/g)]
    .map(([, width = '']) => Number(width))
    .sort((a, b) => a - b)
    .find((width) => width >= sizesPx(image));

/** The first image in `container` and the link that scales it. Both are decorative (alt=""). */
function imageAndLink(container: HTMLElement): { image: HTMLImageElement; link: Element } {
  const image = container.querySelector('img');
  const link = image?.closest('a');
  if (!(image && link)) throw new Error('no image inside a link');
  return { image, link };
}

beforeEach(() => {
  fetchTopArtists.mockResolvedValue([
    {
      name: 'First Artist',
      url: 'https://open.spotify.com/artist/first',
      imageUrl: 'https://i.scdn.co/image/first',
    },
  ]);
  fetchTopTracks.mockResolvedValue([
    {
      name: 'First Song',
      artist: 'Singer One',
      url: 'https://open.spotify.com/track/first',
      imageUrl: 'https://i.scdn.co/image/album-first',
    },
  ]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("a top artist's portrait", () => {
  it('asks for a file at least as wide as the portrait is drawn at its hover scale', async () => {
    const { image, link } = imageAndLink(render(await TopArtists()).container);
    const drawn = classNumber(image, /^w-(\d+)$/) * TAILWIND_SPACING_PX;

    expect(drawn).toBe(96);
    expect(hoverScaleOf(link)).toBe(1.05);
    expect(sizesPx(image)).toBeGreaterThanOrEqual(drawn * hoverScaleOf(link));
  });

  it('so a 1x screen fetches the 128w file, not the 96w one', async () => {
    const { image } = imageAndLink(render(await TopArtists()).container);

    expect(oneXWidth(image)).toBe(128);
  });
});

describe("a top track's art", () => {
  it('asks for a file at least as wide as the art is drawn at its hover scale', async () => {
    const { image, link } = imageAndLink(render(await TopTracks()).container);
    const drawn = classNumber(image, /^w-(\d+)$/) * TAILWIND_SPACING_PX;

    expect(drawn).toBe(64);
    expect(hoverScaleOf(link)).toBe(1.03);
    expect(sizesPx(image)).toBeGreaterThanOrEqual(drawn * hoverScaleOf(link));
  });

  it('so a 1x screen fetches the 96w file, not the 64w one', async () => {
    const { image } = imageAndLink(render(await TopTracks()).container);

    expect(oneXWidth(image)).toBe(96);
  });
});
