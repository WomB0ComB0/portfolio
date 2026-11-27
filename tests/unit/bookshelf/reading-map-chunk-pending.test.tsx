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
 * @file The reading map's code loads only when a visitor asks for it (the #632 pattern), so a
 * visitor can open a book's detail while it is still on its way. The detail replaces the stage,
 * and the map asked for goes with it: back on the stage, the map stays closed until its button is
 * pressed again. Its own file because the module mock below holds back the live map for every
 * test in it.
 */

import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** Holds the live map's module back until `release` is called. */
const chunk = vi.hoisted(() => {
  let release: () => void = () => undefined;
  const arrived = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { arrived, release: () => release() };
});

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
vi.mock(
  '@/app/(routes)/(main)/(personal)/bookshelf/_components/reading-map-dialog-live',
  async (importOriginal) => {
    await chunk.arrived;
    return importOriginal();
  },
);

import { BookshelfStage } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf-stage';
import { DEFAULT_BOOK_INDEX } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import {
  BOOKS,
  bookAt,
  renderWithNuqs as render,
  resetAddress,
  SHELVES,
} from './bookshelf-fixtures';

/** Lets the map's module arrive, then React render what it got. */
async function settle(): Promise<void> {
  for (let tick = 0; tick < 3; tick += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

afterEach(async () => {
  chunk.release();
  await resetAddress();
});

describe('a reading map whose code is still loading when a book opens', () => {
  it('stays closed when the visitor comes back to the stage, until its button is pressed', async () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reading map' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /Open notes/ }));
    const book = bookAt(DEFAULT_BOOK_INDEX);
    expect(screen.getByRole('heading', { level: 1, name: book.title })).toBeInTheDocument();
    chunk.release();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Back to Bookshelf/ }));
    await settle();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Bookshelf' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reading map' }));
    expect(await screen.findByRole('dialog', { name: /Reading map/i })).toBeInTheDocument();
  });
});
