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
 * @file A shelf's page (bookshelf/shelf/[shelfSlug]/page.tsx), its catalog loaded from the
 * fixture documents of bookshelf-fixtures.ts: the page renders the stage on its own shelf's books,
 * and its reading map maps that shelf alone.
 */

import { fireEvent, screen, within } from '@testing-library/react';
import { isValidElement, type ReactNode } from 'react';
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

import { BookshelfStage } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf-stage';
import ShelfDetailPage from '@/app/(routes)/(main)/(personal)/bookshelf/shelf/[shelfSlug]/page';
import { loadBookshelf } from '@/lib/sanity/loaders';
import {
  BACKEND_SHELF,
  BOOK_DOCS,
  booksOn,
  renderWithNuqs as render,
  SHELF_DOCS,
} from './bookshelf-fixtures';

afterEach(() => {
  vi.useRealTimers();
});

describe("A shelf's page", () => {
  afterEach(() => {
    vi.mocked(loadBookshelf).mockReset();
  });

  it('maps only its own shelf: its books across 1 shelf', async () => {
    vi.mocked(loadBookshelf).mockResolvedValue({ books: BOOK_DOCS, shelves: SHELF_DOCS });
    const backendBooks = booksOn(BACKEND_SHELF.slug.current);
    const topics = backendBooks.reduce((sum, book) => sum + book.topics.length, 0);

    const page = await ShelfDetailPage({
      params: Promise.resolve({ shelfSlug: BACKEND_SHELF.slug.current }),
    });
    // The page's island, without its section boundary (that one needs a mounted app router).
    const stage = (page.props as { readonly children?: ReactNode }).children;
    if (!isValidElement(stage) || stage.type !== BookshelfStage) {
      throw new Error("the shelf's page renders no BookshelfStage in its section");
    }
    render(stage);
    fireEvent.click(screen.getByRole('button', { name: /Reading map/i }));
    const dialog = screen.getByRole('dialog', { name: /Reading map/i });

    expect(
      within(dialog).getByText(
        `${backendBooks.length} books across 1 shelf, covering ${topics} numbered topics.`,
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual([BACKEND_SHELF.title]);
  });
});
