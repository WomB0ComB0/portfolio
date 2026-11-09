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

import { describe, expect, it, vi } from 'vitest';

// The real URL builder: the crop this guards against comes from @sanity/image-url itself.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import {
  stripThumbUrl,
  viewerPhotoUrl,
} from '@/app/(routes)/(main)/(personal)/places/[placeId]/_components/viewer-photo-url';

const asset = (width: number, height: number) => ({
  _type: 'reference' as const,
  _ref: `image-0123456789abcdef0123456789abcdef01234567-${width}x${height}-jpg`,
});
const params = (url: string) => new URL(url).searchParams;

describe('viewerPhotoUrl', () => {
  it('keeps a portrait photo whole, sized by height', () => {
    const p = params(viewerPhotoUrl(asset(3000, 4000), 1600, 1200));

    expect(p.get('h')).toBe('1200');
    expect(p.has('w')).toBe(false);
    expect(p.has('rect')).toBe(false);
  });

  it('keeps a landscape photo whole, sized by width', () => {
    const p = params(viewerPhotoUrl(asset(4000, 3000), 1600, 1200));

    expect(p.get('w')).toBe('1600');
    expect(p.has('h')).toBe(false);
    expect(p.has('rect')).toBe(false);
  });

  it('sizes a panorama by width, so it is not cropped either', () => {
    const p = params(viewerPhotoUrl(asset(4080, 1836), 1600, 1200));

    expect(p.get('w')).toBe('1600');
    expect(p.has('rect')).toBe(false);
  });

  it('never enlarges a photo smaller than the viewer', () => {
    expect(params(viewerPhotoUrl(asset(800, 600), 1600, 1200)).get('fit')).toBe('max');
  });

  it("leaves a malformed asset id to the URL builder's own error", () => {
    expect(() => viewerPhotoUrl({ _type: 'reference', _ref: 'image-unknown' }, 1600, 1200)).toThrow(
      /Malformed asset _ref/,
    );
  });
});

describe('stripThumbUrl', () => {
  /** An image field as Sanity stores it: the asset, plus the hotspot and crop set in Studio. */
  const image = (
    width: number,
    height: number,
    hotspot?: { x: number; y: number },
    crop?: { top: number; bottom: number; left: number; right: number },
  ) => ({
    _type: 'image' as const,
    asset: asset(width, height),
    ...(hotspot && { hotspot: { ...hotspot, width: 0.2, height: 0.2 } }),
    ...(crop && { crop }),
  });

  it("is a 320 x 240 crop (the strip's 160 x 120 at 2x) in the best format the browser takes", () => {
    const p = params(stripThumbUrl(image(4000, 3000)));

    expect(p.get('w')).toBe('320');
    expect(p.get('h')).toBe('240');
    expect(p.get('fit')).toBe('crop');
    expect(p.get('auto')).toBe('format');
  });

  it('crops a portrait to 4:3 around its hotspot, not its middle', () => {
    // 3000 x 4000 cut to 3000 x 2250: the middle starts 875 px down; a hotspot near the top
    // pulls the cut up to the top edge.
    const centred = params(stripThumbUrl(image(3000, 4000)));
    const nearTop = params(stripThumbUrl(image(3000, 4000, { x: 0.5, y: 0.15 })));

    expect(centred.get('rect')).toBe('0,875,3000,2250');
    expect(nearTop.get('rect')).toBe('0,0,3000,2250');
  });

  it('keeps the cut inside the crop set in Studio, even with the hotspot outside it', () => {
    // The crop drops the top fifth (800 px) of a 3000 x 4000 photo. The hotspot at 15 % lies in
    // that dropped band, which would pull the cut to the top edge; the crop holds it at 800.
    const crop = { top: 0.2, bottom: 0, left: 0, right: 0 };
    const p = params(stripThumbUrl(image(3000, 4000, { x: 0.5, y: 0.15 }, crop)));

    expect(p.get('rect')).toBe('0,800,3000,2250');
  });
});
