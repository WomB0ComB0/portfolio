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
 * @file The /places photo URLs built on the server: the card folder's 96 x 64 slivers (a crop
 * around the hotspot), the photos view's cover thumbnail (the whole photo sized by one side, so
 * it is never cropped by the URL and never enlarged), each photo's shape and focus point, and
 * captions tidied once.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// The real URL builder: what it adds (rect=, fit) is what these guard.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import {
  coverThumbUrl,
  isUsablePhoto,
  normaliseCaption,
  photoFocus,
  photoRatio,
  sliverUrl,
} from '@/app/(routes)/(main)/(personal)/places/_lib/place-photo-urls';

const ref = (width: number, height: number) =>
  `image-0123456789abcdef0123456789abcdef01234567-${width}x${height}-jpg`;
const asset = (width: number, height: number) => ({
  _type: 'reference' as const,
  _ref: ref(width, height),
});
const photo = (width: number, height: number, extra: Record<string, unknown> = {}) => ({
  _type: 'image' as const,
  asset: asset(width, height),
  ...extra,
});
const params = (url: string) => new URL(url).searchParams;

describe('sliverUrl', () => {
  it("is a 96 x 64 crop (the folder's 48 x 32 at 2x) in the best format", () => {
    const p = params(sliverUrl(photo(4000, 3000)));

    expect(p.get('w')).toBe('96');
    expect(p.get('h')).toBe('64');
    expect(p.get('fit')).toBe('crop');
    expect(p.get('auto')).toBe('format');
  });

  it('cuts around the hotspot set in Studio', () => {
    const centred = params(sliverUrl(photo(3000, 4000)));
    const nearTop = params(
      sliverUrl(photo(3000, 4000, { hotspot: { x: 0.5, y: 0.1, width: 0.2, height: 0.2 } })),
    );

    expect(centred.get('rect')).not.toBe(nearTop.get('rect'));
  });
});

describe('coverThumbUrl', () => {
  it('sizes a landscape photo by height 360, so it covers a 480 x 360 card', () => {
    const p = params(coverThumbUrl(asset(4000, 3000)));

    expect(p.get('h')).toBe('360');
    expect(p.has('w')).toBe(false);
    expect(p.get('fit')).toBe('max');
    expect(p.has('rect')).toBe(false);
  });

  it('sizes a portrait photo by width 480, never cropping it in the URL', () => {
    const p = params(coverThumbUrl(asset(3000, 4000)));

    expect(p.get('w')).toBe('480');
    expect(p.has('h')).toBe(false);
    expect(p.has('rect')).toBe(false);
  });

  it('treats exactly 4:3 as landscape', () => {
    expect(params(coverThumbUrl(asset(1600, 1200))).get('h')).toBe('360');
  });
});

describe('photoRatio', () => {
  it('reads the width over the height from the asset id', () => {
    expect(photoRatio(ref(3000, 4000))).toBeCloseTo(0.75);
    expect(photoRatio(ref(4080, 1836))).toBeCloseTo(2.222, 3);
  });

  it('falls back to 4:3 when the id has no size', () => {
    expect(photoRatio('image-unknown')).toBeCloseTo(4 / 3);
    expect(photoRatio('image-a-0x0-jpg')).toBeCloseTo(4 / 3);
  });
});

describe('photoFocus', () => {
  it('is the hotspot centre, as fractions', () => {
    expect(photoFocus({ x: 0.25, y: 0.8, width: 0.1, height: 0.1 })).toEqual({ x: 0.25, y: 0.8 });
  });

  it('is null without a hotspot, and keeps a stray value inside the photo', () => {
    expect(photoFocus(undefined)).toBeNull();
    expect(photoFocus({ x: 1.4, y: -0.2, width: 0.1, height: 0.1 })).toEqual({ x: 1, y: 0 });
  });
});

describe('normaliseCaption', () => {
  it('trims and collapses the blanks inside', () => {
    expect(normaliseCaption('  Demo   day\n at  the office ')).toBe('Demo day at the office');
  });

  it('treats a blank or missing caption as none', () => {
    expect(normaliseCaption('   ')).toBeNull();
    expect(normaliseCaption('')).toBeNull();
    expect(normaliseCaption(undefined)).toBeNull();
  });
});

describe('isUsablePhoto', () => {
  it('keeps a photo whose asset id the URL builder can read', () => {
    expect(isUsablePhoto(photo(1600, 1200))).toBe(true);
  });

  it('drops one with no asset id, or one the builder would throw on', () => {
    expect(isUsablePhoto({ _type: 'image', asset: { _type: 'reference', _ref: '' } })).toBe(false);
    expect(isUsablePhoto({ _type: 'image', asset: { _type: 'reference', _ref: 'image-x' } })).toBe(
      false,
    );
    expect(isUsablePhoto(null)).toBe(false);
  });
});
