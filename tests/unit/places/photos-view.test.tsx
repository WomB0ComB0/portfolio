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
 * @file The photos view's choice (the owner's "Keep A: wall first on a mouse, grid on touch"):
 * the server sends the grid and an empty wall frame and CSS picks before hydration; after it, a
 * mouse or trackpad starts on the wall (its code loaded lazily, never on touch until asked), touch
 * on the grid, where Wall opens the full-screen sheet. Fewer than 12 photos: the grid alone, no
 * switch. Nothing is stored and nothing enters the URL.
 */

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PhotoPlace, WallPhoto } from '@/types/places';
import { byId, photoData, stubDevice } from './photo-fixtures';

const h = vi.hoisted(() => ({
  wallPhotos: [] as unknown[],
  wallLoads: 0,
  sheetLoads: 0,
}));

vi.mock('@/app/(routes)/(main)/(personal)/places/photos/_components/photo-wall-live', () => {
  h.wallLoads += 1;
  return {
    LiveWall: ({ photos }: { photos: readonly unknown[] }) => {
      h.wallPhotos = [...photos];
      return <div role="application" aria-roledescription="photo wall" aria-label="wall" />;
    },
  };
});
vi.mock('@/app/(routes)/(main)/(personal)/places/photos/_components/wall-sheet', () => {
  h.sheetLoads += 1;
  return {
    LiveWallSheet: ({ onClose }: { onClose: () => void }) => (
      <div role="dialog" aria-label="Photo wall sheet">
        <button type="button" onClick={onClose}>
          Done
        </button>
      </div>
    ),
  };
});
vi.mock('@/app/(routes)/(main)/(personal)/places/photos/_components/photo-dialog-live', () => ({
  LivePhotoDialog: () => null,
}));

import { PhotosView } from '@/app/(routes)/(main)/(personal)/places/photos/_components/photos-view';

const view = (photos: readonly WallPhoto[], places: readonly PhotoPlace[]) => (
  <PhotosView photos={photos} places={byId(places)} placeCount={places.length} />
);
const switchGroup = () => screen.queryByRole('group', { name: 'View' });
const option = (name: 'Wall' | 'Grid') =>
  within(switchGroup() as HTMLElement).getByRole('button', { name });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PhotosView on touch', () => {
  it('starts on the grid and asks for no wall code', async () => {
    stubDevice({ fine: false });
    const { places, photos } = photoData(6, 4);
    render(view(photos, places));

    expect(screen.getByRole('list', { name: 'Photos' })).toBeInTheDocument();
    expect(option('Grid')).toHaveAttribute('aria-pressed', 'true');
    expect(option('Wall')).toHaveAttribute('aria-pressed', 'false');
    await act(async () => {});
    expect(h.wallLoads).toBe(0);
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
  });

  it('opens the wall full screen from Wall, and Done returns to the grid', async () => {
    stubDevice({ fine: false });
    const { places, photos } = photoData(6, 4);
    render(view(photos, places));

    fireEvent.click(option('Wall'));
    const sheet = await screen.findByRole('dialog', { name: 'Photo wall sheet' });
    expect(option('Wall')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(option('Grid')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('list', { name: 'Photos' })).toBeInTheDocument();
  });
});

describe('PhotosView with a mouse or trackpad', () => {
  it('starts on the wall, loaded lazily, given every photo', async () => {
    stubDevice({ fine: true });
    const { places, photos } = photoData(6, 4);
    render(view(photos, places));

    expect(option('Wall')).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('application')).toHaveAttribute(
      'aria-roledescription',
      'photo wall',
    );
    expect(h.wallPhotos).toEqual(photos);
    expect(screen.queryByRole('list', { name: 'Photos' })).not.toBeInTheDocument();
  });

  it('swaps to the grid in place', async () => {
    stubDevice({ fine: true });
    const { places, photos } = photoData(6, 4);
    render(view(photos, places));
    await screen.findByRole('application');

    fireEvent.click(option('Grid'));

    expect(screen.getByRole('list', { name: 'Photos' })).toBeInTheDocument();
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
    expect(option('Grid')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('PhotosView with few photos', () => {
  it('shows the grid alone, with no switch, below 12 photos', () => {
    stubDevice({ fine: true });
    const { places, photos } = photoData(2, 5);
    render(view(photos, places));

    expect(switchGroup()).toBeNull();
    expect(screen.getByRole('list', { name: 'Photos' })).toBeInTheDocument();
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
  });

  it('says "1 photo" for one', () => {
    const { places, photos } = photoData(1, 1);
    render(view(photos, places));

    expect(screen.getByText('1 photo')).toBeInTheDocument();
  });
});

describe('PhotosView before hydration', () => {
  it('sends the grid and an empty wall frame, the switch not yet pressable', async () => {
    const { places, photos } = photoData(6, 4);
    const html = renderToString(view(photos, places));

    expect(html).toContain('aria-label="Photos"');
    expect(html).toContain('data-wall-frame');
    expect(html).toContain('data-wall="on"');
    expect(html).not.toContain('aria-pressed');
    expect(html).not.toContain('data-ready');

    stubDevice({ fine: false });
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    await act(async () => {
      hydrateRoot(container, view(photos, places));
    });

    expect(container.querySelector('[data-photos-view]')).toHaveAttribute('data-ready');
    expect(container.querySelector('button[aria-pressed="true"]')).toHaveTextContent('Grid');
    expect(container.querySelector('[data-wall-frame]')).toBeNull();
    container.remove();
  });
});
