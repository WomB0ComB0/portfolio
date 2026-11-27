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
 * @file The reading map (reading-map-dialog.tsx, which loads reading-map-dialog-live.tsx on
 * intent), on the fixture catalog of bookshelf-fixtures.ts. From the stage it lists every shelf
 * and focuses or opens an entry's book on the stage, found by its slug. On a book's page it maps
 * the whole catalog from slim entries: the counts, each shelf's topic range and its books' stage
 * links, with every shelf's section skipping rendering off screen. It is the site's modal dialog:
 * focus is trapped inside, the page behind is hidden and holds still, Escape closes only the map
 * (never the in-page detail under it), and focus goes back to the button that opened it, except
 * after Open stage, when it lands on the opened book's heading. A book that Back or Forward opens
 * under the map closes it for good.
 */

import { act, fireEvent, screen, within } from '@testing-library/react';
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
import { toBookNeighbor } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/book-neighbors';
import { DEFAULT_BOOK_INDEX } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import { toReadingMapEntry } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/reading-map';
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
  oneBookCatalog,
  renderWithNuqs as render,
  resetAddress,
  SHELVES,
  standaloneProps,
  topicLabel,
} from './bookshelf-fixtures';

// An in-page detail sets its book's address; a stage mounted on that address opens it at once.
afterEach(async () => {
  vi.useRealTimers();
  await resetAddress();
});

/** The map, once its lazily loaded code has rendered it. */
const findMap = () => screen.findByRole('dialog', { name: /Reading map/i });

/** Focuses the 'Reading map' button, as a keyboard or a click would, and opens the map. */
async function openMap(): Promise<{ trigger: HTMLElement; dialog: HTMLElement }> {
  const trigger = screen.getByRole('button', { name: 'Reading map' });
  act(() => trigger.focus());
  fireEvent.click(trigger);
  return { trigger, dialog: await findMap() };
}

/** Lets a closed map hand focus on: the dialog does so a tick after it goes. */
async function afterClose(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Presses Escape where focus is, then lets the dialog hand focus back. */
async function pressEscape(): Promise<void> {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await afterClose();
}

/** The control on each map entry: Focus on shelf moves the stage, Open stage links to the book. */
const ENTRY_ROLE = { 'Focus on shelf': 'button', 'Open stage': 'link' } as const;
type EntryControl = keyof typeof ENTRY_ROLE;

/** The open map's `name` control on the entry of the book at `index`. */
function entryControl(dialog: HTMLElement, name: EntryControl, index: number): HTMLElement {
  const control = within(dialog).getAllByRole(ENTRY_ROLE[name], { name })[index];
  if (!control) throw new Error(`no '${name}' control for book ${index}`);
  return control;
}

/** Focuses the open map's `name` control on the entry of the book at `index`, and presses it. */
async function pressEntryButton(
  dialog: HTMLElement,
  name: EntryControl,
  index: number,
): Promise<void> {
  const control = entryControl(dialog, name, index);
  act(() => control.focus());
  fireEvent.click(control);
  await afterClose();
}

describe('ReadingMapDialog', () => {
  it('opens the reading map dialog with every shelf and closes on close button', async () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);

    fireEvent.click(screen.getByRole('button', { name: /Reading map/i }));
    const dialog = await findMap();
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

  it("focuses and opens a map entry's book on the stage, found by its slug", async () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const at = BOOK_COUNT - 2;
    const target = bookAt(at);
    /** The map's `name` control on the entry of `target` (the entries are in stage order). */
    const entryButton = async (name: EntryControl): Promise<HTMLElement> => {
      fireEvent.click(screen.getByRole('button', { name: /Reading map/i }));
      return entryControl(await findMap(), name, at);
    };

    fireEvent.click(await entryButton('Focus on shelf'));
    expect(liveText()).toBe(liveTextOf(target));

    fireEvent.click(await entryButton('Open stage'));
    expect(screen.getByRole('heading', { level: 1, name: target.title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Back to Bookshelf/i }));
  });

  it('maps the whole catalog from slim entries: the counts, topic ranges and stage links', async () => {
    render(<BookDetailView {...standaloneProps(FEATURED)} />);
    fireEvent.click(screen.getByRole('button', { name: /Reading map/i }));
    const dialog = await findMap();

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

describe("ReadingMapDialog's current entry", () => {
  /** The `N topics` label on the map entry titled `title`. */
  function topicCountOf(dialog: HTMLElement, title: string, topics: number): HTMLElement {
    const entry = within(dialog).getByRole('heading', { level: 4, name: title }).parentElement
      ?.parentElement;
    if (!entry) throw new Error(`no map entry for ${title}`);
    return within(entry).getByText(`${topics} topics`);
  }

  // jsdom applies no Tailwind CSS, so this is a class contract. The current entry sits on the
  // brand-subtle fill, where the faint tier is 4.25:1 and the muted one clears 4.5:1
  // (token-contrast.test.ts checks both, and design-tokens.test.ts that text-muted-foreground is
  // --fg-muted). Every other entry sits on the canvas, where the faint tier reads.
  it("lifts the current entry's topic count to the muted tier on its brand-subtle fill", async () => {
    render(<BookDetailView {...standaloneProps(FEATURED)} />);
    fireEvent.click(screen.getByRole('button', { name: /Reading map/i }));
    const dialog = await findMap();
    const other = bookAt(DEFAULT_BOOK_INDEX);

    const current = topicCountOf(dialog, FEATURED_TITLE, FEATURED.topics.length);
    expect(current.closest('.bg-brand-subtle')).not.toBeNull();
    expect(current).toHaveClass('text-muted-foreground');
    expect(current).not.toHaveClass('text-faint');

    const rest = topicCountOf(dialog, other.title, other.topics.length);
    expect(rest.closest('.bg-brand-subtle')).toBeNull();
    expect(rest).toHaveClass('text-faint');
  });
});

describe('ReadingMapDialog counts', () => {
  it('says each count in the singular for one: one book, shelf and numbered topic', async () => {
    const { books, shelves } = oneBookCatalog();
    const [only] = books;
    render(
      <BookDetailView
        book={only}
        prev={toBookNeighbor(only)}
        next={toBookNeighbor(only)}
        mapBooks={books.map(toReadingMapEntry)}
        shelves={shelves}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reading map' }));
    const dialog = await findMap();

    expect(
      within(dialog).getByText('1 book across 1 shelf, covering 1 numbered topic.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('1 topic')).toBeInTheDocument();
  });
});

describe('ReadingMapDialog as a modal dialog', () => {
  it('gives focus back to the Reading map button when Escape closes it', async () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const { trigger } = await openMap();

    await pressEscape();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps focus inside while it is open', async () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const { trigger, dialog } = await openMap();
    expect(dialog.contains(document.activeElement)).toBe(true);

    act(() => trigger.focus());

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('hides the page behind it from assistive technology and locks its scroll', async () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const stage = screen.getByRole('region', { name: /Bookshelf/i });

    const { dialog } = await openMap();

    expect(stage.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(dialog.closest('[aria-hidden="true"]')).toBeNull();
    expect(document.body).toHaveAttribute('data-scroll-locked');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it("closes only itself on Escape over the in-page detail, leaving the book's detail open", async () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const book = bookAt(DEFAULT_BOOK_INDEX);
    fireEvent.click(screen.getByRole('link', { name: /Open notes/ }));
    expect(screen.getByRole('heading', { level: 1, name: book.title })).toBeInTheDocument();

    const { trigger } = await openMap();
    await pressEscape();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: book.title })).toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('stays closed after Back or Forward opens a book under it, then returns', async () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const target = bookAt(BOOK_COUNT - 2);
    await openMap();
    const { pathname, search } = window.location;

    act(() => {
      window.history.pushState(null, '', `/bookshelf/${target.slug}${search}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByRole('heading', { level: 1, name: target.title })).toBeInTheDocument();
    act(() => {
      window.history.replaceState(null, '', `${pathname}${search}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await afterClose();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Bookshelf' })).toBeInTheDocument();
  });

  it('gives focus back to the Reading map button when Focus on shelf closes it', async () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const { trigger, dialog } = await openMap();

    await pressEntryButton(dialog, 'Focus on shelf', BOOK_COUNT - 2);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(liveText()).toBe(liveTextOf(bookAt(BOOK_COUNT - 2)));
    expect(document.activeElement).toBe(trigger);
  });

  it("moves focus to the book's heading when Open stage opens it in place", async () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const target = bookAt(BOOK_COUNT - 2);
    const { dialog } = await openMap();

    await pressEntryButton(dialog, 'Open stage', BOOK_COUNT - 2);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1, name: target.title }),
    );
  });

  it("moves focus to the new book's heading when Open stage is used over a detail", async () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    fireEvent.click(screen.getByRole('link', { name: /Open notes/ }));
    expect(
      screen.getByRole('heading', { level: 1, name: bookAt(DEFAULT_BOOK_INDEX).title }),
    ).toBeInTheDocument();
    const target = bookAt(BOOK_COUNT - 2);
    const { dialog } = await openMap();

    await pressEntryButton(dialog, 'Open stage', BOOK_COUNT - 2);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1, name: target.title }),
    );
  });
});
