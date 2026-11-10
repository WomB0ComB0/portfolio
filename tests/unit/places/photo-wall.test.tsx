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
 * @file The live photo wall (the lazily loaded part): one Tab stop with role="application" and
 * its own keyboard model (arrows move between photos and spring the wall to centre the one
 * picked; Enter or Space opens it), a polite live region that says the place, the number, the
 * caption and the dates, a drag that never opens a photo, and under reduced motion no glide and
 * no spring: the arrows jump.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('motion/react', async (importOriginal) => {
  const real = await importOriginal<typeof import('motion/react')>();
  return { ...real, animate: vi.fn(real.animate) };
});

import { animate } from 'motion/react';
import { LiveWall } from '@/app/(routes)/(main)/(personal)/places/photos/_components/photo-wall-live';
import {
  geometryFor,
  photoAt,
} from '@/app/(routes)/(main)/(personal)/places/photos/_lib/wall-geometry';
import { byId, photoData, stubDevice } from './photo-fixtures';

const WIDTH = 1000;
const HEIGHT = 600;
const { places, photos } = photoData(10, 4);
const PLACES = byId(places);
const g = geometryFor(WIDTH, HEIGHT, photos.length);

const sizes = {
  clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
  clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight'),
};

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => WIDTH,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => HEIGHT,
  });
});

afterAll(() => {
  if (sizes.clientWidth)
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', sizes.clientWidth);
  if (sizes.clientHeight) {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', sizes.clientHeight);
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(animate).mockClear();
});

const renderWall = (onOpen = vi.fn()) => {
  render(
    <LiveWall
      photos={photos}
      places={PLACES}
      placeCount={places.length}
      mode="page"
      onOpen={onOpen}
    />,
  );
  return { onOpen, wall: screen.getByRole('application') };
};
const cardAt = (c: number, r: number) =>
  document.querySelector<HTMLElement>(`[data-cell="${c}:${r}"]`);
const photoOf = (c: number, r: number) => photos[photoAt({ c, r }, g, photos.length) ?? 0];

describe('LiveWall', () => {
  it('is one Tab stop with its own keyboard model', () => {
    stubDevice({ fine: true });
    const { wall } = renderWall();

    expect(wall).toHaveAttribute('aria-roledescription', 'photo wall');
    expect(wall).toHaveAttribute('aria-label', '40 photos from 10 past visits');
    expect(wall).toHaveAttribute('tabindex', '0');
    expect(cardAt(0, 0)).not.toBeNull();
  });

  it('moves the active photo with the arrows and says its place, number and caption', async () => {
    stubDevice({ fine: true });
    const { wall } = renderWall();

    fireEvent.keyDown(wall, { key: 'ArrowRight' });
    expect(cardAt(1, 0)).toHaveAttribute('data-active', 'true');
    fireEvent.keyDown(wall, { key: 'ArrowLeft' });
    fireEvent.keyDown(wall, { key: 'ArrowLeft' });
    expect(cardAt(-1, 0)).toHaveAttribute('data-active', 'true');

    const photo = photoOf(-1, 0);
    const place = places.find((item) => item.id === photo?.placeId);
    const live = document.querySelector('[data-wall-announce]');
    expect(live).toHaveAttribute('aria-live', 'polite');
    await waitFor(() =>
      expect(live).toHaveTextContent(new RegExp(`^${place?.name}, photo ${photo?.index} of 4`)),
    );
    expect(vi.mocked(animate)).toHaveBeenCalled();
  });

  it('opens the active photo with Enter or Space', () => {
    stubDevice({ fine: true });
    const { wall, onOpen } = renderWall();

    fireEvent.keyDown(wall, { key: 'ArrowDown' });
    fireEvent.keyDown(wall, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(1);
    const [request] = onOpen.mock.calls[0] ?? [];
    expect(request.photo).toBe(photoOf(0, 1));
    expect(request.returnFocus).toBe(wall);
    expect(request.source).toBe(cardAt(0, 1));

    fireEvent.keyDown(wall, { key: ' ' });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('opens the photo clicked, but never after a drag', () => {
    stubDevice({ fine: true });
    const { wall, onOpen } = renderWall();
    const card = cardAt(0, 0) as HTMLElement;

    fireEvent.pointerDown(wall, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(wall, { pointerId: 1, clientX: 160, clientY: 120 });
    fireEvent.pointerUp(wall, { pointerId: 1, clientX: 160, clientY: 120 });
    fireEvent.click(card);
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.pointerDown(wall, { button: 0, pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(wall, { pointerId: 2, clientX: 101, clientY: 100 });
    fireEvent.click(cardAt(0, 0) as HTMLElement);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('jumps instead of springing under reduced motion', async () => {
    stubDevice({ fine: true, reduced: true });
    const { wall } = renderWall();

    await act(async () => {
      fireEvent.keyDown(wall, { key: 'ArrowRight' });
    });
    expect(cardAt(1, 0)).toHaveAttribute('data-active', 'true');
    expect(vi.mocked(animate)).not.toHaveBeenCalled();
  });
});
