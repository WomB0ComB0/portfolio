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
 * @file The wall and the open view are enhancements loaded lazily (the #632 pattern). When their
 * code fails to arrive (a deploy skew, a dropped connection, a blocked chunk), /places/photos
 * keeps working instead of falling to the route's error view: a failed wall leaves the grid with
 * no Wall option, and a failed open view sends the click on to the photo's place page. Its own
 * file because the module mocks below replace both live modules for every test in it.
 */

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: h.push, replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@/app/(routes)/(main)/(personal)/places/photos/_components/photo-wall-live', () => {
  throw new Error('Loading chunk photo-wall-live failed');
});
vi.mock('@/app/(routes)/(main)/(personal)/places/photos/_components/photo-dialog-live', () => {
  throw new Error('Loading chunk photo-dialog-live failed');
});

import { PhotosView } from '@/app/(routes)/(main)/(personal)/places/photos/_components/photos-view';
import { byId, photoData, stubDevice } from './photo-fixtures';

/** Stands in for the route's error view: shows "crashed" if anything below throws. */
class Boundary extends Component<{ readonly children: ReactNode }, { readonly failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? <p>crashed</p> : this.props.children;
  }
}

const { places, photos } = photoData(6, 4);

/** Lets a failed import settle, then React render what it got. */
const settle = async (load: () => Promise<unknown>) => {
  await act(async () => {
    await load().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  h.push.mockReset();
});

describe('a lazy part that fails to load', () => {
  it('leaves the grid, with no Wall option, when the wall fails on a mouse', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubDevice({ fine: true });
    render(
      <Boundary>
        <PhotosView photos={photos} places={byId(places)} placeCount={places.length} />
      </Boundary>,
    );

    await settle(
      () => import('@/app/(routes)/(main)/(personal)/places/photos/_components/photo-wall-live'),
    );

    expect(screen.queryByText('crashed')).toBeNull();
    expect(screen.getByRole('list', { name: 'Photos' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull();
  });

  it('sends a click on to the place page when the open view fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubDevice({ fine: false });
    render(
      <Boundary>
        <PhotosView photos={photos} places={byId(places)} placeCount={places.length} />
      </Boundary>,
    );
    const [first] = within(screen.getByRole('list', { name: 'Photos' })).getAllByRole('link');

    fireEvent.click(first as HTMLElement);
    await settle(
      () => import('@/app/(routes)/(main)/(personal)/places/photos/_components/photo-dialog-live'),
    );

    expect(screen.queryByText('crashed')).toBeNull();
    expect(h.push).toHaveBeenCalledWith(`/places/${photos[0]?.placeId}`);
    // Later clicks are the links' own.
    expect(fireEvent.click(first as HTMLElement)).toBe(true);
  });
});
