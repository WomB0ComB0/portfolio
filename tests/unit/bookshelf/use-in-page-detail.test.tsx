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
 * @file The in-page detail's address (use-in-page-detail.ts), through the stage on the fixture
 * catalog of bookshelf-fixtures.ts. A book opened in place (Enter on the stage, Open notes, the
 * reading map's Open stage) pushes its own page's address, /bookshelf/<slug>, with the list's
 * query kept; Previous and Next replace it, so one Back returns to the list. Back to Bookshelf
 * and Escape go Back to the list's entry, or write the list's address in place of a page entered
 * on a book's address. Back and Forward open the book the address names, or close the detail. A
 * stage that mounts on a book's address opens that book; one on an old #/stage/NN link opens its
 * book and rewrites the address to the book's page. On a shelf's page the same holds, and the
 * list it returns to is the shelf's page. Closing gives focus back to Open notes when it opened
 * the book, once, and otherwise (or when that control has left the page) to the stage.
 */

import { act, fireEvent, renderHook, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { useInPageDetail } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/use-in-page-detail';
import {
  AI_SHELF,
  address,
  afterPopState,
  BOOK_COUNT,
  BOOKS,
  bookAt,
  booksOn,
  FEATURED,
  FEATURED_TITLE,
  LIST_ADDRESS,
  liveText,
  liveTextOf,
  nextPopState,
  renderWithNuqs as render,
  resetAddress,
  SHELVES,
} from './bookshelf-fixtures';

/** The list's query: it stays as it is while a book is open. */
const QUERY = '?group=status';
const LIST = `${LIST_ADDRESS}${QUERY}`;
const pageOf = (slug: string, query = QUERY): string => `/bookshelf/${slug}${query}`;

beforeEach(() => {
  window.history.replaceState(null, '', LIST);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await resetAddress();
});

/** The whole shelf with FEATURED on stage, at the address set before it. */
const renderStage = () =>
  render(<BookshelfStage books={BOOKS} shelves={SHELVES} initialSlug={FEATURED.slug} />, QUERY);

/** Opens the book on stage from the keyboard: the stage focused, then Enter. */
function openOnStage(): void {
  screen.getByRole('region', { name: /Bookshelf/i }).focus();
  fireEvent.keyDown(window, { key: 'Enter' });
}

const heading = (name: string) => screen.getByRole('heading', { level: 1, name });
const adjacentLink = (title: string) =>
  within(screen.getByRole('navigation', { name: 'Adjacent books' })).getByRole('link', {
    name: new RegExp(title),
  });

/** Runs `move` (a Back, a Forward or a control that goes Back) and waits for it to land. */
async function travel(move: () => void): Promise<void> {
  const landed = nextPopState();
  act(move);
  await afterPopState(landed);
}

const pressBackToBookshelf = () =>
  fireEvent.click(screen.getByRole('button', { name: /Back to Bookshelf/i }));

describe('opening a book in place', () => {
  it("pushes the book's own page, /bookshelf/<slug>, keeping the list's query", () => {
    renderStage();
    const push = vi.spyOn(window.history, 'pushState');

    openOnStage();

    expect(heading(FEATURED_TITLE)).toBeInTheDocument();
    expect(address()).toBe(pageOf(FEATURED.slug));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(expect.anything(), '', pageOf(FEATURED.slug));
  });

  it("opens from Open notes, a link to the book's page, without following it", () => {
    renderStage();
    const link = screen.getByRole('link', { name: /^Open notes/ });
    expect(link).toHaveAttribute('href', `/bookshelf/${FEATURED.slug}`);

    const followed = fireEvent.click(link);

    expect(followed).toBe(false);
    expect(heading(FEATURED_TITLE)).toBeInTheDocument();
    expect(address()).toBe(pageOf(FEATURED.slug));
  });

  it("opens from the reading map's Open stage, a link to the book's page", async () => {
    renderStage();
    const target = bookAt(BOOK_COUNT - 2);
    fireEvent.click(screen.getByRole('button', { name: 'Reading map' }));
    const dialog = await screen.findByRole('dialog', { name: /Reading map/i });
    const link = within(dialog).getAllByRole('link', { name: 'Open stage' })[BOOK_COUNT - 2];
    if (!link) throw new Error('no Open stage link for the target book');
    expect(link).toHaveAttribute('href', `/bookshelf/${target.slug}`);

    fireEvent.click(link);

    expect(heading(target.title)).toBeInTheDocument();
    expect(address()).toBe(pageOf(target.slug));
  });
});

describe('moving between books in the detail', () => {
  it('replaces the address on Previous and Next, so one Back returns to the list', async () => {
    renderStage();
    const next = bookAt(BOOKS.indexOf(FEATURED) + 1);
    openOnStage();
    const length = window.history.length;

    fireEvent.click(adjacentLink(next.title));
    expect(heading(next.title)).toBeInTheDocument();
    expect(address()).toBe(pageOf(next.slug));
    expect(window.history.length).toBe(length);

    await travel(() => window.history.back());

    expect(heading('Bookshelf')).toBeInTheDocument();
    expect(address()).toBe(LIST);
    expect(liveText()).toBe(liveTextOf(next));
  });
});

describe('closing the detail', () => {
  it("goes Back to the list's entry on Back to Bookshelf, adding no entry", async () => {
    renderStage();
    openOnStage();
    // Back moves within the entries; a write in its place would add one or rename this one.
    const length = window.history.length;
    const back = vi.spyOn(window.history, 'back');

    await travel(pressBackToBookshelf);

    expect(heading('Bookshelf')).toBeInTheDocument();
    expect(back).toHaveBeenCalledTimes(1);
    expect(address()).toBe(LIST);
    expect(window.history.length).toBe(length);
    expect(liveText()).toBe(liveTextOf(FEATURED));
  });

  it('goes Back the same way on Escape', async () => {
    renderStage();
    openOnStage();

    await travel(() => fireEvent.keyDown(window, { key: 'Escape' }));

    expect(heading('Bookshelf')).toBeInTheDocument();
    expect(address()).toBe(LIST);
  });
});

describe('focus after closing', () => {
  const stageRegion = () => screen.getByRole('region', { name: /Bookshelf/i });
  const openNotes = () => screen.getByRole('link', { name: /^Open notes/ });

  /** Opens the book on stage from its Open notes link, as a keyboard or a tap would. */
  function openFromNotes(): void {
    const link = openNotes();
    act(() => link.focus());
    fireEvent.click(link);
    expect(heading(FEATURED_TITLE)).toBeInTheDocument();
  }

  const closes = [
    ['Back to Bookshelf', pressBackToBookshelf],
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
    ['Back', () => window.history.back()],
  ] as const;

  it.each(closes)('gives it back to the stage that opened the book, on %s', async (_, close) => {
    renderStage();
    openOnStage();

    await travel(close);

    expect(heading('Bookshelf')).toBeInTheDocument();
    expect(document.activeElement).toBe(stageRegion());
  });

  it.each(closes)(
    'gives it back to Open notes when it opened the book, on %s',
    async (_, close) => {
      renderStage();
      openFromNotes();

      await travel(close);

      expect(heading('Bookshelf')).toBeInTheDocument();
      expect(document.activeElement).toBe(openNotes());
    },
  );

  it('gives it back to Open notes after Previous and Next moved to another book', async () => {
    renderStage();
    const next = bookAt(BOOKS.indexOf(FEATURED) + 1);
    openFromNotes();
    fireEvent.click(adjacentLink(next.title));
    expect(heading(next.title)).toBeInTheDocument();

    await travel(pressBackToBookshelf);

    expect(document.activeElement).toBe(openNotes());
    expect(openNotes()).toHaveAttribute('href', `/bookshelf/${next.slug}`);
  });

  it("falls back to the stage when the map's Open stage, now gone, opened the book", async () => {
    renderStage();
    const target = bookAt(BOOK_COUNT - 2);
    fireEvent.click(screen.getByRole('button', { name: 'Reading map' }));
    const dialog = await screen.findByRole('dialog', { name: /Reading map/i });
    const link = within(dialog).getAllByRole('link', { name: 'Open stage' })[BOOK_COUNT - 2];
    if (!link) throw new Error('no Open stage link for the target book');
    fireEvent.click(link);
    expect(heading(target.title)).toBeInTheDocument();

    await travel(pressBackToBookshelf);

    expect(document.activeElement).toBe(stageRegion());
    expect(liveText()).toBe(liveTextOf(target));
  });

  it('uses Open notes once: a book Forward opens again gives it to the stage on close', async () => {
    renderStage();
    openFromNotes();
    await travel(() => window.history.back());
    expect(document.activeElement).toBe(openNotes());

    await travel(() => window.history.forward());
    expect(heading(FEATURED_TITLE)).toBeInTheDocument();
    await travel(() => window.history.back());

    expect(heading('Bookshelf')).toBeInTheDocument();
    expect(document.activeElement).toBe(stageRegion());
  });

  it.each([
    ["a book's page", pageOf(FEATURED.slug)],
    ['an old #/stage/NN link', `${LIST}#/stage/${FEATURED.stageLabel}`],
  ])('falls back to the stage for a book the address opened, on %s', (_, entry) => {
    window.history.replaceState(null, '', entry);
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />, QUERY);
    expect(heading(FEATURED_TITLE)).toBeInTheDocument();

    pressBackToBookshelf();

    expect(heading('Bookshelf')).toBeInTheDocument();
    expect(document.activeElement).toBe(stageRegion());
  });

  it('falls back to the stage when the control that opened the book has left the page', async () => {
    // The stage always renders Open notes again, so this is the hook alone: an opener whose ref
    // still holds a control taken off the page must not swallow the focus.
    const stage = document.body.appendChild(document.createElement('div'));
    stage.tabIndex = -1;
    const opener = document.body.appendChild(document.createElement('button'));
    const options = {
      books: BOOKS,
      indexBySlug: new Map(BOOKS.map((book, index) => [book.slug, index])),
      setPos: vi.fn(),
      slotPositionsRef: { current: new Map<number, number>() },
      listPath: LIST_ADDRESS,
      returnFocusRef: { current: stage },
    };
    try {
      const { result } = renderHook(() => useInPageDetail(options));
      act(() => result.current.openDetail(FEATURED, { current: opener }));
      opener.remove();

      await travel(() => result.current.closeDetail());

      expect(result.current.detailBook).toBeNull();
      expect(document.activeElement).toBe(stage);
    } finally {
      stage.remove();
    }
  });
});

describe('Back and Forward', () => {
  it('closes the detail on Back and opens the book again on Forward', async () => {
    renderStage();
    openOnStage();

    await travel(() => window.history.back());
    expect(heading('Bookshelf')).toBeInTheDocument();
    expect(address()).toBe(LIST);

    await travel(() => window.history.forward());
    expect(heading(FEATURED_TITLE)).toBeInTheDocument();
    expect(address()).toBe(pageOf(FEATURED.slug));
  });

  it('closes the detail on an address that names no book on the stage', () => {
    renderStage();
    openOnStage();

    act(() => {
      window.history.pushState(null, '', pageOf('not-on-the-shelf'));
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(heading('Bookshelf')).toBeInTheDocument();
  });
});

describe("a stage that mounts on a book's address", () => {
  it('opens that book (Back from another page), and goes Back to the list on close', async () => {
    const first = renderStage();
    openOnStage();
    first.unmount();
    renderStage();
    expect(heading(FEATURED_TITLE)).toBeInTheDocument();
    const back = vi.spyOn(window.history, 'back');

    await travel(pressBackToBookshelf);

    expect(back).toHaveBeenCalledTimes(1);
    expect(address()).toBe(LIST);
  });

  it("writes the list's address in place of a book's page it did not push", () => {
    window.history.replaceState(null, '', pageOf(FEATURED.slug));
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />, QUERY);
    expect(heading(FEATURED_TITLE)).toBeInTheDocument();
    const back = vi.spyOn(window.history, 'back');
    const length = window.history.length;

    pressBackToBookshelf();

    expect(heading('Bookshelf')).toBeInTheDocument();
    expect(back).not.toHaveBeenCalled();
    expect(address()).toBe(LIST);
    expect(window.history.length).toBe(length);
  });
});

describe('an old #/stage/NN link', () => {
  it("opens its book and rewrites the address to the book's page, query kept", () => {
    window.history.replaceState(null, '', `${LIST}#/stage/${FEATURED.stageLabel}`);
    const length = window.history.length;

    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />, QUERY);

    expect(heading(FEATURED_TITLE)).toBeInTheDocument();
    expect(address()).toBe(pageOf(FEATURED.slug));
    expect(window.history.length).toBe(length);

    pressBackToBookshelf();
    expect(heading('Bookshelf')).toBeInTheDocument();
    expect(address()).toBe(LIST);
    expect(window.history.length).toBe(length);
  });
});

describe("on a shelf's page", () => {
  const shelfSlug = AI_SHELF.slug.current;
  const shelfBooks = booksOn(shelfSlug);
  const shelf = SHELVES.find((item) => item.slug === shelfSlug);
  const SHELF_QUERY = '?status=reading';
  const SHELF_PAGE = `/bookshelf/shelf/${shelfSlug}`;

  /** The AI shelf's own page, at the address set before it. */
  const renderShelf = () => {
    if (!shelf) throw new Error('no fixture AI shelf');
    render(
      <BookshelfStage books={shelfBooks} shelves={[shelf]} activeShelf={shelf} />,
      SHELF_QUERY,
    );
    return shelf;
  };

  it("pushes the book's own page and goes Back to the shelf's page", async () => {
    window.history.replaceState(null, '', `${SHELF_PAGE}${SHELF_QUERY}`);
    const { title } = renderShelf();
    const [first] = shelfBooks;

    openOnStage();
    expect(heading(first.title)).toBeInTheDocument();
    expect(address()).toBe(pageOf(first.slug, SHELF_QUERY));

    await travel(pressBackToBookshelf);
    expect(heading(title)).toBeInTheDocument();
    expect(address()).toBe(`${SHELF_PAGE}${SHELF_QUERY}`);
  });

  it("rewrites an old link to the book's page, and closes to the shelf's page", () => {
    const second = shelfBooks[1];
    if (!second) throw new Error('the AI shelf has one book');
    window.history.replaceState(null, '', `${SHELF_PAGE}#/stage/${second.stageLabel}`);
    const { title } = renderShelf();

    expect(heading(second.title)).toBeInTheDocument();
    expect(address()).toBe(`/bookshelf/${second.slug}`);

    pressBackToBookshelf();
    expect(heading(title)).toBeInTheDocument();
    expect(address()).toBe(SHELF_PAGE);
  });
});
