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
 * @file axe on the place photo viewer (audit 2026-11-20 moderate 4 and 5): zoomed in, where the
 * photo is a named, described pan surface (role application) that the arrow keys move, and at
 * the last photo, where Next is aria-disabled instead of disabled so focus stays on it.
 *
 * Set up as place-photo-viewer-pan.test.tsx sets it up: jsdom lays nothing out, so the stage is
 * given an 800 x 600 box.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PlacePhotoViewer } from '@/app/(routes)/(main)/(personal)/places/[placeId]/_components/place-photo-viewer';
import type { ViewerPhoto } from '@/app/(routes)/(main)/(personal)/places/[placeId]/page.types';
import { expectNoAxeViolations } from '../../utils/axe';

const PLACE = 'Photographed Place';
const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;

const photo = (n: number): ViewerPhoto => ({
  url: `https://cdn.sanity.io/images/test/test/p${n}-1600x1200.jpg?w=1600&fit=max`,
  thumb: `https://cdn.sanity.io/images/test/test/p${n}-1600x1200.jpg?w=320&h=240&fit=crop&auto=format`,
  alt: `Photo ${n} of ${PLACE}`,
});

const PHOTOS: readonly ViewerPhoto[] = [photo(1), photo(2), photo(3)];

const renderViewer = () =>
  render(<PlacePhotoViewer photos={PHOTOS} placeName={PLACE} summary={<h2>{PLACE}</h2>} />);

const button = (name: string): HTMLElement => screen.getByRole('button', { name });

beforeEach(() => {
  for (const [property, size] of [
    ['offsetWidth', STAGE_WIDTH],
    ['offsetHeight', STAGE_HEIGHT],
  ] as const) {
    vi.spyOn(HTMLElement.prototype, property, 'get').mockReturnValue(size);
  }
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: STAGE_WIDTH,
    bottom: STAGE_HEIGHT,
    x: 0,
    y: 0,
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the place photo viewer under axe', () => {
  it('finds nothing to fix zoomed in, with the photo a named pan surface', async () => {
    const { container } = renderViewer();

    fireEvent.click(button('Zoom in'));

    const surface = screen.getByRole('application', { name: `Zoomed photo: Photo 1 of ${PLACE}` });
    expect(surface).toHaveAttribute('tabindex', '0');
    expect(surface).toHaveAccessibleDescription(/arrow keys/);
    await expectNoAxeViolations(container, { label: 'the zoomed photo viewer' });
  });

  it('finds nothing to fix at the last photo, Next marked unavailable but focusable', async () => {
    const { container } = renderViewer();

    fireEvent.click(button('Next photo'));
    fireEvent.click(button('Next photo'));

    expect(screen.getByText('Photo 3 of 3')).toBeInTheDocument();
    expect(button('Next photo')).toHaveAttribute('aria-disabled', 'true');
    expect(button('Next photo')).not.toBeDisabled();
    await expectNoAxeViolations(container, { label: 'the photo viewer at its last photo' });
  });
});
