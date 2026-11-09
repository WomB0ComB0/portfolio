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
 * @file The place viewer picks its photo from the photo strip, the owner's pick B from the lab
 * review, which replaces the dots (fixed for phones in #622). The strip sits right under the
 * frame, above the caption, so picking a captioned photo never moves the strip from under the
 * pointer; a single photo has no strip. Picking a photo shows it, says so in the header and
 * resets the zoom, as the dots did.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlacePhotoViewer } from '@/app/(routes)/(main)/(personal)/places/[placeId]/_components/place-photo-viewer';
import type { ViewerPhoto } from '@/app/(routes)/(main)/(personal)/places/[placeId]/page.types';

const PLACE = 'Photographed Place';

const photo = (n: number, caption?: string): ViewerPhoto => ({
  url: `https://cdn.sanity.io/images/test/test/p${n}-1600x1200.jpg?w=1600&fit=max`,
  thumb: `https://cdn.sanity.io/images/test/test/p${n}-1600x1200.jpg?w=320&h=240&fit=crop&auto=format`,
  ...(caption && { caption }),
  alt: caption ?? `Photo of ${PLACE}`,
});

const PHOTOS: readonly ViewerPhoto[] = Array.from({ length: 13 }, (_, index) =>
  photo(index + 1, index === 12 ? 'The stage before the keynote' : undefined),
);

const viewer = (photos: readonly ViewerPhoto[] = PHOTOS) => (
  <PlacePhotoViewer photos={photos} placeName={PLACE} summary={<h2>{PLACE}</h2>} />
);

const strip = (): HTMLElement => screen.getByRole('toolbar', { name: `Photos of ${PLACE}` });
const thumb = (name: string | RegExp): HTMLElement => within(strip()).getByRole('button', { name });

describe('the place viewer’s photo strip', () => {
  it('replaces the dots: one named thumbnail per photo, under the frame', () => {
    render(viewer());

    expect(within(strip()).getAllByRole('button')).toHaveLength(13);
    expect(thumb('Photo 1 of 13')).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByRole('button', { name: /^Go to photo/ })).not.toBeInTheDocument();
  });

  it('shows the photo picked, its position in the header and its caption', () => {
    render(viewer());

    fireEvent.click(thumb('Photo 13 of 13: The stage before the keynote'));

    expect(screen.getByText('Photo 13 of 13')).toBeInTheDocument();
    expect(thumb(/^Photo 13 of 13/)).toHaveAttribute('aria-current', 'true');
    expect(thumb('Photo 1 of 13')).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('img', { name: 'The stage before the keynote' })).toBeInTheDocument();
    // The caption fades in (from opacity 0) after a move, so it is only checked for.
    expect(screen.getByText('The stage before the keynote', { selector: 'p' })).toBeInTheDocument();
  });

  it('puts the strip right under the frame, before the caption, so a caption never moves it', () => {
    render(viewer());
    fireEvent.click(thumb(/^Photo 13 of 13/));

    const frame = screen.getByRole('button', { name: 'Zoom in' }).closest('.aspect-video');
    const caption = screen.getByText('The stage before the keynote', { selector: 'p' });
    if (!frame) throw new Error('no photo frame');

    expect(frame.nextElementSibling).toBe(strip());
    expect(
      strip().compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('resets the zoom when another photo is picked, as the dots did', () => {
    render(viewer());
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('120%')).toBeInTheDocument();

    fireEvent.click(thumb('Photo 4 of 13'));

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Photo 4 of 13')).toBeInTheDocument();
  });

  it('keeps the zoom when the photo picked is the one shown', () => {
    render(viewer());
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));

    fireEvent.click(thumb('Photo 1 of 13'));

    expect(screen.getByText('120%')).toBeInTheDocument();
  });

  it('draws no strip for a single photo', () => {
    render(viewer([photo(1)]));

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Photo \d+ of \d+$/)).not.toBeInTheDocument();
  });

  it('is in the server HTML with the first photo current and one Tab stop', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(viewer());

    const toolbar = within(container).getByRole('toolbar', { name: `Photos of ${PLACE}` });
    const buttons = within(toolbar).getAllByRole('button');
    expect(buttons).toHaveLength(13);
    expect(buttons.filter((button) => button.tabIndex === 0)).toEqual([buttons[0]]);
    expect(buttons[0]).toHaveAttribute('aria-current', 'true');
  });
});
