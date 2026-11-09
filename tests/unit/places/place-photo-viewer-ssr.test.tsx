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
 * @file The place page's photo viewer is server content: its photo, caption and zoom/fullscreen
 * controls are visible in the server HTML. An entrance animation that starts at opacity 0 left
 * the controls invisible (yet focusable) until hydration, and hidden for good without JavaScript.
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlacePhotoViewer } from '@/app/(routes)/(main)/(personal)/places/[placeId]/_components/place-photo-viewer';
import type { ViewerPhoto } from '@/app/(routes)/(main)/(personal)/places/[placeId]/page.types';

/** An entrance serialises opacity:0 into the HTML; a translucent 0.8 or 0.5 is not hidden. */
const HIDDEN_OPACITY = /opacity:\s*0(?![.\d])/;

const PHOTOS: readonly ViewerPhoto[] = [
  {
    url: 'https://cdn.sanity.io/images/test/test/a-3000x4000.jpg?w=1600',
    thumb:
      'https://cdn.sanity.io/images/test/test/a-3000x4000.jpg?w=320&h=240&fit=crop&auto=format',
    alt: 'Photo of Photographed Place',
  },
  {
    url: 'https://cdn.sanity.io/images/test/test/b-1600x1200.jpg?w=1600',
    thumb:
      'https://cdn.sanity.io/images/test/test/b-1600x1200.jpg?w=320&h=240&fit=crop&auto=format',
    caption: 'The stage before the keynote',
    alt: 'The stage before the keynote',
  },
];

const CONTROLS = ['Zoom in', 'Zoom out', 'Enter fullscreen'] as const;

const viewer = (photos: readonly ViewerPhoto[] = PHOTOS) => (
  <PlacePhotoViewer
    photos={photos}
    placeName="Photographed Place"
    summary={<h2>Photographed Place</h2>}
  />
);

/** The server HTML parsed into a detached container, so its elements can be queried. */
const serverRender = (photos?: readonly ViewerPhoto[]): HTMLElement => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(viewer(photos));
  return container;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('PlacePhotoViewer in the server HTML', () => {
  it('serialises nothing at opacity 0', () => {
    expect(renderToString(viewer())).not.toMatch(HIDDEN_OPACITY);
  });

  it('shows the zoom and fullscreen controls without waiting for hydration', () => {
    const container = serverRender();

    for (const name of CONTROLS) {
      const control = within(container).getByRole('button', { name });
      // Neither the control nor any element around it is hidden by an inline opacity.
      for (let node: HTMLElement | null = control; node; node = node.parentElement) {
        expect(node.getAttribute('style') ?? '').not.toMatch(HIDDEN_OPACITY);
      }
    }
  });

  it('serialises nothing at opacity 0 for a single photo with a caption', () => {
    const [, captioned] = PHOTOS;
    if (!captioned) throw new Error('fixture needs a captioned photo');

    expect(renderToString(viewer([captioned]))).not.toMatch(HIDDEN_OPACITY);
  });
});

describe('PlacePhotoViewer on the client', () => {
  it('hydrates the server HTML without a mismatch', async () => {
    const container = serverRender();
    document.body.append(container);
    const onRecoverableError = vi.fn();

    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, viewer(), { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(within(container).getByRole('button', { name: 'Zoom in' })).toBeEnabled();
    act(() => root?.unmount());
  });

  it('still zooms from the controls', () => {
    render(viewer());

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));

    expect(screen.getByText('120%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  });
});
