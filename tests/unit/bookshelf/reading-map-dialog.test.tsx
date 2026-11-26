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
 * @file The reading map (reading-map-dialog.tsx), on the fixture catalog of
 * bookshelf-fixtures.ts. From the stage it lists every shelf and focuses or opens an entry's book
 * on the stage, found by its slug. On a book's page it maps the whole catalog from slim entries:
 * the counts, each shelf's topic range and its books' stage links, with every shelf's section
 * skipping rendering off screen.
 */

import { fireEvent, screen, within } from '@testing-library/react';
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

import { BookDetailView } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/book-detail-view';
import { BookshelfStage } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf-stage';
import {
  BOOK_COUNT,
  BOOKS,
  bookAt,
  booksOn,
  CATALOG,
  FEATURED,
  FEATURED_TITLE,
  liveText,
  liveTextOf,
  renderWithNuqs as render,
  SHELVES,
  standaloneProps,
  topicLabel,
} from './bookshelf-fixtures';

// An in-page detail sets #/stage/NN; a stage mounted on that hash opens the detail at once.
afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
});

describe('ReadingMapDialog', () => {
  it('opens the reading map dialog with every shelf and closes on close button', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);

    fireEvent.click(screen.getByRole('button', { name: /Reading map/i }));
    const dialog = screen.getByRole('dialog', { name: /Reading map/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(FEATURED_TITLE)).toBeInTheDocument();
    for (const shelf of SHELVES) {
      expect(
        within(dialog).getByRole('heading', { level: 3, name: shelf.title }),
      ).toBeInTheDocument();
    }

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close reading map' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it("focuses and opens a map entry's book on the stage, found by its slug", () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const at = BOOK_COUNT - 2;
    const target = bookAt(at);
    /** The map's `name` button on the entry of `target` (the entries are in stage order). */
    const entryButton = (name: string): HTMLElement => {
      fireEvent.click(screen.getByRole('button', { name: /Reading map/i }));
      const dialog = screen.getByRole('dialog', { name: /Reading map/i });
      const button = within(dialog).getAllByRole('button', { name })[at];
      if (!button) throw new Error(`no '${name}' button for book ${at}`);
      return button;
    };

    fireEvent.click(entryButton('Focus on shelf'));
    expect(liveText()).toBe(liveTextOf(target));

    fireEvent.click(entryButton('Open stage'));
    expect(screen.getByRole('heading', { level: 1, name: target.title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Back to Bookshelf/i }));
  });

  it('maps the whole catalog from slim entries: the counts, topic ranges and stage links', () => {
    render(<BookDetailView {...standaloneProps(FEATURED)} />);
    fireEvent.click(screen.getByRole('button', { name: /Reading map/i }));
    const dialog = screen.getByRole('dialog', { name: /Reading map/i });

    expect(
      within(dialog).getByText(
        `${BOOK_COUNT} books across ${SHELVES.length} shelves, covering ${CATALOG.totalTopics} numbered topics.`,
      ),
    ).toBeInTheDocument();
    const sections = dialog.querySelectorAll('section');
    expect(sections).toHaveLength(SHELVES.length);
    for (const [index, shelf] of SHELVES.entries()) {
      const section = sections[index];
      if (!section) throw new Error(`no map section for ${shelf.slug}`);
      const shelfBooks = booksOn(shelf.slug);
      const first = shelfBooks[0].topics[0]?.number;
      const last = shelfBooks.at(-1)?.topics.at(-1)?.number;
      const read = shelfBooks.filter((book) => book.status === 'completed').length;
      expect(section).toHaveTextContent(
        `${read}/${shelfBooks.length} read · topics ${topicLabel(first)}–${topicLabel(last)}`,
      );
      for (const book of shelfBooks) {
        expect(section).toHaveTextContent(`${book.topics.length} topics`);
      }
      // Off-screen shelves are not rendered until they near the viewport.
      expect(section).toHaveClass(
        '[content-visibility:auto]',
        '[contain-intrinsic-size:auto_900px]',
      );
    }
    const openStage = within(dialog).getAllByRole('link', { name: /Open stage/ });
    expect(openStage.map((link) => link.getAttribute('href'))).toEqual(
      BOOKS.map((book) => `/bookshelf/${book.slug}`),
    );
  });
});
