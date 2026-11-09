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
 * @file The place viewer's photo dots on a phone. They were the shared Button, whose size padding
 * turned each 8 px dot into a 32 x 16 pill in a single nowrap flex row: with 13 photos the row
 * was wider than a 390 px card and the first and last dots sat off screen. They are now plain
 * 24 x 24 buttons, each holding an 8 px dot, laid out inline so a row that doesn't fit wraps.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlacePhotoViewer } from '@/app/(routes)/(main)/(personal)/places/[placeId]/_components/place-photo-viewer';
import type { ViewerPhoto } from '@/app/(routes)/(main)/(personal)/places/[placeId]/page.types';

const PHOTOS: readonly ViewerPhoto[] = Array.from({ length: 13 }, (_, index) => ({
  url: `https://cdn.sanity.io/images/test/test/p${index}-1600x1200.jpg?w=1600`,
  alt: `Photo ${index + 1} of the place`,
}));

const dots = (): HTMLElement[] => screen.getAllByRole('button', { name: /^Go to photo \d+$/ });

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the photo dots', () => {
  it('are plain 24 px buttons, each holding a small dot', () => {
    render(<PlacePhotoViewer photos={PHOTOS} summary={<h2>Place</h2>} />);

    expect(dots()).toHaveLength(13);
    for (const dot of dots()) {
      expect(dot.getAttribute('type')).toBe('button');
      expect(dot.className).toContain('size-6');
      // No size padding or fixed pill width on the button itself.
      expect(dot.className).not.toMatch(/\b(?:h-8|h-9|h-10|px-\d|w-8)\b/);
      const mark = dot.querySelector('span[aria-hidden="true"]');
      expect(mark?.className).toContain('size-2');
    }
  });

  it('wrap inline instead of sitting in one nowrap flex row', () => {
    render(<PlacePhotoViewer photos={PHOTOS} summary={<h2>Place</h2>} />);

    const row = dots()[0]?.parentElement;
    expect(row?.className).not.toMatch(/(?:^|\s)flex(?:\s|$)/);
    expect(row?.className).toContain('text-center');
  });

  it('mark the shown photo as current and follow a click', () => {
    render(<PlacePhotoViewer photos={PHOTOS} summary={<h2>Place</h2>} />);

    expect(dots()[0]?.getAttribute('aria-current')).toBe('true');
    expect(dots().filter((dot) => dot.hasAttribute('aria-current'))).toHaveLength(1);

    const last = dots()[12];
    if (!last) throw new Error('expected 13 dots');
    fireEvent.click(last);

    expect(dots()[12]?.getAttribute('aria-current')).toBe('true');
    expect(dots()[0]?.hasAttribute('aria-current')).toBe(false);
  });
});
