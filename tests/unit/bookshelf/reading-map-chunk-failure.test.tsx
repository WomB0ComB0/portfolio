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
 * @file The reading map's code loads only when a visitor asks for it (the #632 pattern). When it
 * fails to arrive (a deploy skew, a dropped connection, a blocked chunk), the bookshelf keeps
 * working instead of falling to the route's error view: the click opens nothing, and focus stays
 * on the button. Its own file because the module mock below replaces the live map for every test
 * in it.
 */

import { act, fireEvent, screen } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The catalog builder draws each cover with the real image URL builder; the client module itself
// reads server configuration on import.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return {
    sanityFetchWithToken: vi.fn(),
    urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source),
  };
});
// Only buildBookshelfCatalog is used here; the cached Sanity loaders are never asked.
vi.mock('@/lib/sanity/loaders', () => ({ loadBookshelf: vi.fn() }));
vi.mock('@/app/(routes)/(main)/(personal)/bookshelf/_components/reading-map-dialog-live', () => {
  throw new Error('Loading chunk reading-map-dialog-live failed');
});

import { BookshelfStage } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf-stage';
import { BOOKS, renderWithNuqs as render, SHELVES } from './bookshelf-fixtures';

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

/** Lets the failed import settle, then React render what it got. */
async function settle(): Promise<void> {
  for (let tick = 0; tick < 3; tick += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

afterEach(() => {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
});

describe('a reading map whose code fails to load', () => {
  it('opens nothing, keeps focus on its button and leaves the bookshelf standing', async () => {
    render(
      <Boundary>
        <BookshelfStage books={BOOKS} shelves={SHELVES} />
      </Boundary>,
    );
    const trigger = screen.getByRole('button', { name: 'Reading map' });
    act(() => trigger.focus());

    fireEvent.click(trigger);
    await settle();

    expect(screen.queryByText('crashed')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByRole('heading', { level: 1, name: 'Bookshelf' })).toBeInTheDocument();
  });
});
