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
 * @file A project's images: the cover then the gallery, each once, with its shape from the asset
 * id, its focus, its alt text tidied and the whole image's URL at most 1600 wide; unreadable
 * assets are skipped. Synthetic asset ids only.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  IMAGE_MAX_WIDTH,
  projectImagesOf,
} from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-images';

const asset = (ref: string) => ({ _ref: ref });
const urlOf = vi.fn((ref: string, width: number) => `https://cdn.example/${ref}?w=${width}`);

describe('projectImagesOf', () => {
  it('puts the cover first, then the gallery, each once', () => {
    const images = projectImagesOf(
      {
        image: { asset: asset('image-cover-3200x1800-jpg'), alt: '  The   hero  ' },
        images: [
          { asset: asset('image-shot-1200x630-png'), hotspot: { x: 0.2, y: 1.4 } },
          { asset: asset('image-cover-3200x1800-jpg') },
        ],
      },
      urlOf,
    );

    expect(images).toEqual([
      {
        src: `https://cdn.example/image-cover-3200x1800-jpg?w=${IMAGE_MAX_WIDTH}`,
        ratio: 3200 / 1800,
        alt: 'The hero',
        focus: null,
      },
      {
        src: 'https://cdn.example/image-shot-1200x630-png?w=1200',
        ratio: 1200 / 630,
        alt: null,
        focus: { x: 0.2, y: 1 },
      },
    ]);
  });

  it('skips an image whose asset id carries no size, and a missing cover', () => {
    expect(
      projectImagesOf(
        { image: null, images: [{ asset: asset('image-broken') }, { asset: null }] },
        urlOf,
      ),
    ).toEqual([]);
    expect(projectImagesOf({}, urlOf)).toEqual([]);
  });

  it('reads a portrait or square shape as it is', () => {
    const [portrait, square] = projectImagesOf(
      {
        image: { asset: asset('image-phone-768x942-png') },
        images: [{ asset: asset('image-logo-512x512-png') }],
      },
      urlOf,
    );

    expect(portrait?.ratio).toBeCloseTo(768 / 942);
    expect(square?.ratio).toBe(1);
  });
});
