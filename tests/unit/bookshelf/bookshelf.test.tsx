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
 * @file The bookshelf's client islands (the 3D stage, the in-page and standalone detail views,
 * the reading map and the shelf cards) and the /api/v1/books/lookup route. The islands render a
 * small fixture catalog built the way the pages build theirs: Sanity-shaped book and shelf
 * documents (tests/fixtures/sanity-docs.ts) joined by the real buildBookshelfCatalog, with the
 * real Sanity image URL builder. No production content is read.
 *
 * The shelf filter is keyed by slug (`?shelf=<slug>`): its chips are toggle buttons in the
 * 'Shelves' group, exactly one pressed ("All", the reset, or one shelf); a legacy
 * `?track=<title>` link is rewritten to its shelf's slug. Arrow keys and Home/End move the stage
 * only while it (or nothing) has focus.
 *
 * The stage's geometry comes from props, so the server's HTML is laid out as the browser's: each
 * slot's --slot-x is a factor of the CSS --book-h, which is never written inline. Covers are
 * sized to how they are drawn (the active one 260 px with the source at 2x, near ones 260 px, far
 * ones 96 px; fan covers 100 px at 1x-3x, on shelf cards that skip drawing until near the
 * viewport; the detail's hero sized to its frame, at high fetch priority). The detail view takes
 * its neighbours and slim reading-map entries, never the whole catalog; a shelf's page maps its
 * own shelf alone; every map section skips rendering off screen.
 */

import {
  act,
  createEvent,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { makeBook, makeBookshelf } from '@tests/fixtures/sanity-docs';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SanityBookshelf } from '@/hooks/sanity/schemas';

const render = (ui: ReactElement, searchParams?: string, onUrlUpdate?: OnUrlUpdateFunction) =>
  rtlRender(ui, {
    wrapper: ({ children }) => (
      <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
        {children}
      </NuqsTestingAdapter>
    ),
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

import { BookDetailView } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/book-detail-view';
import { slotOffsetFactor } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf-book-slot';
import { BookshelfStage } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf-stage';
import {
  neighborsOf,
  toBookNeighbor,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/book-neighbors';
import {
  type BookItem,
  DEFAULT_BOOK_INDEX,
  getIsbnRegistryLinks,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import {
  buildBookshelfCatalog,
  hasBooks,
  type NonEmptyBooks,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/load-bookshelf';
import { toReadingMapEntry } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/reading-map';
import ShelfDetailPage from '@/app/(routes)/(main)/(personal)/bookshelf/shelf/[shelfSlug]/page';
import { booksRoute } from '@/app/api/v1/[[...route]]/books';
import {
  cleanIsbn,
  lookupBooks,
  resetBookLookupCache,
  toBookSlug,
} from '@/app/api/v1/[[...route]]/books/handlers';
import { loadBookshelf } from '@/lib/sanity/loaders';

/**
 * Books per fixture shelf. Three shelves of six make 18 books: more than the stage's window of
 * book slots, so the unfiltered stage is the circular one and no book is drawn twice.
 */
const BOOKS_PER_SHELF = 6;

const shelfDoc = (title: string, slug: string): SanityBookshelf =>
  makeBookshelf({ title, slug: { _type: 'slug', current: slug } });

const BACKEND_SHELF = shelfDoc('Backend', 'backend');
const AI_SHELF = shelfDoc('AI', 'ai');
const HUMANITIES_SHELF = shelfDoc('Humanities', 'humanities');

/** The book the detail tests open: second on the AI shelf, with an ISBN and four topics. */
const FEATURED_TITLE = 'Agents in Practice';
const FEATURED_TOPIC = 'Agents: tools & planning';
const FEATURED_ISBN = '9780306406157';
const FEATURED_DOC = makeBook({
  shelfId: AI_SHELF._id,
  title: FEATURED_TITLE,
  isbn: FEATURED_ISBN,
  topics: ['Prompting', FEATURED_TOPIC, 'Evaluation', 'Serving'],
});

/** `count` books on `shelf`, titled by shelf and position ("AI Book 3"). */
const shelfBooks = (shelf: SanityBookshelf, count = BOOKS_PER_SHELF) =>
  Array.from({ length: count }, (_, index) =>
    makeBook({ shelfId: shelf._id, title: `${shelf.title} Book ${index + 1}` }),
  );

const [FIRST_AI_DOC, ...OTHER_AI_DOCS] = shelfBooks(AI_SHELF, BOOKS_PER_SHELF - 1);

const BOOK_DOCS = [
  ...shelfBooks(BACKEND_SHELF),
  ...(FIRST_AI_DOC ? [FIRST_AI_DOC] : []),
  FEATURED_DOC,
  ...OTHER_AI_DOCS,
  ...shelfBooks(HUMANITIES_SHELF),
];
const SHELF_DOCS = [BACKEND_SHELF, AI_SHELF, HUMANITIES_SHELF];

const CATALOG = buildBookshelfCatalog(BOOK_DOCS, SHELF_DOCS);

/** `books` as the islands take them: a list with at least one book. */
const nonEmpty = (books: readonly BookItem[]): NonEmptyBooks => {
  if (!hasBooks(books)) throw new Error('expected at least one fixture book');
  return books;
};

const BOOKS = nonEmpty(CATALOG.books);
const SHELVES = CATALOG.shelves;
const BOOK_COUNT = BOOKS.length;

/** The book at `index`, wrapping around the circular shelf as the stage does. */
const bookAt = (index: number): BookItem =>
  BOOKS[((index % BOOK_COUNT) + BOOK_COUNT) % BOOK_COUNT] ?? BOOKS[0];

/** The stage's live readout for `book`, e.g. "07 of 18: Agents in Practice". */
const liveTextOf = (book: BookItem): string => `${book.stageLabel} of ${BOOK_COUNT}: ${book.title}`;

/** A topic number as the detail view prints it, three digits wide. */
const topicLabel = (number: number | undefined): string => String(number).padStart(3, '0');

const bookWithSlug = (slug: string): BookItem => {
  const book = BOOKS.find((item) => item.slug === slug);
  if (!book) throw new Error(`no fixture book ${slug}`);
  return book;
};

const FEATURED = bookWithSlug(FEATURED_DOC.slug.current);

/** `book`'s props on its own page, built as /bookshelf/[slug] builds them. */
const standaloneProps = (book: BookItem) => {
  const { prev, next } = neighborsOf(BOOKS, BOOKS.indexOf(book));
  return {
    book,
    prev: toBookNeighbor(prev),
    next: toBookNeighbor(next),
    mapBooks: BOOKS.map(toReadingMapEntry),
    shelves: SHELVES,
  };
};

/** A shelf's books on the stage, in stage order. */
const booksOn = (slug: string): NonEmptyBooks =>
  nonEmpty(BOOKS.filter((book) => book.shelfSlug === slug));

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The 'Shelves' chip group. */
const shelvesGroup = () => screen.getByRole('group', { name: 'Shelves' });

/** Every chip titled `title` (whatever count it shows), in order: "All" is the reset chip. */
const shelfChips = (title: string) =>
  within(shelvesGroup()).getAllByRole('button', {
    name: new RegExp(`^${escapeRegExp(title)}\\s*\\d`),
  });

/** The one chip titled `title`, whatever count it shows. */
const shelfChip = (title: string) => {
  const [chip, ...others] = shelfChips(title);
  if (!chip || others.length > 0) throw new Error(`expected one shelf chip titled ${title}`);
  return chip;
};

/** The chips that are pressed now: always exactly one. */
const pressedChips = () => within(shelvesGroup()).getAllByRole('button', { pressed: true });

/** The stage's live readout, e.g. "07 of 18: Agents in Practice". */
const liveText = (): string => document.querySelector('[aria-live="polite"]')?.textContent ?? '';

describe('BookshelfStage Live Console & bidirectional scroll', () => {
  it('defaults to DEFAULT_BOOK_INDEX (stage 01) and steps both directions around the shelf', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);

    const defaultBook = bookAt(DEFAULT_BOOK_INDEX);
    const nextBook = bookAt(DEFAULT_BOOK_INDEX + 1);
    const prevBook = bookAt(DEFAULT_BOOK_INDEX - 1);

    expect(defaultBook.stageLabel).toBe('01');
    expect(screen.getByText(liveTextOf(defaultBook))).toBeInTheDocument();
    // No filter: "All" is the one pressed chip, and the pill marks the shelf of the book on stage.
    expect(pressedChips()).toEqual([shelfChip('All')]);
    expect(shelfChip(defaultBook.track)).toHaveAttribute('aria-pressed', 'false');
    expect(shelfChip(defaultBook.track)).toHaveAttribute('data-current', 'true');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next book' }));
    expect(screen.getByText(liveTextOf(nextBook))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous book' }));
    expect(screen.getByText(liveTextOf(defaultBook))).toBeInTheDocument();

    // Stage 01's previous book is the last stage: the shelf is circular.
    fireEvent.click(screen.getByRole('button', { name: 'Previous book' }));
    expect(prevBook.stage).toBe(BOOK_COUNT);
    expect(screen.getByText(liveTextOf(prevBook))).toBeInTheDocument();
  });

  it('scrolls right on wheel down and left on wheel up cleanly across direction reversals', () => {
    vi.useFakeTimers();
    const defaultBook = bookAt(DEFAULT_BOOK_INDEX);
    const nextBook = bookAt(DEFAULT_BOOK_INDEX + 1);
    const prevBook = bookAt(DEFAULT_BOOK_INDEX - 1);
    try {
      render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
      const stage = screen.getByRole('region', { name: /Bookshelf/i });

      // Advance past initial cooldown
      vi.advanceTimersByTime(300);
      fireEvent.wheel(stage, { deltaY: 120 });
      expect(screen.getByText(liveTextOf(nextBook))).toBeInTheDocument();

      // Momentum during cooldown is ignored, then scrolling up reverses immediately to defaultBook
      fireEvent.wheel(stage, { deltaY: 200 });
      vi.advanceTimersByTime(300);
      fireEvent.wheel(stage, { deltaY: -80 });
      expect(screen.getByText(liveTextOf(defaultBook))).toBeInTheDocument();

      // Another scroll up steps left to prevBook
      vi.advanceTimersByTime(300);
      fireEvent.wheel(stage, { deltaY: -80 });
      expect(screen.getByText(liveTextOf(prevBook))).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps pool DOM nodes in fixed ascending poolIndex order when stepping left and right', () => {
    const { container } = render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);

    const readOrder = (): string[] =>
      [...container.querySelectorAll<HTMLElement>('[data-pool-index]')].map(
        (el) => el.dataset.poolIndex ?? '',
      );

    const initialOrder = readOrder();
    expect(initialOrder.length).toBeGreaterThanOrEqual(7);

    fireEvent.click(screen.getByRole('button', { name: 'Next book' }));
    expect(readOrder()).toEqual(initialOrder);

    fireEvent.click(screen.getByRole('button', { name: 'Previous book' }));
    expect(readOrder()).toEqual(initialOrder);

    fireEvent.click(screen.getByRole('button', { name: 'Previous book' }));
    expect(readOrder()).toEqual(initialOrder);
  });

  it('scrubs across multiple books during a continuous pointer drag in both directions', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const stage = screen.getByRole('region', { name: /Bookshelf/i });

    // Drag left by 260px -> scrubs forward (right) multiple books
    fireEvent.pointerDown(stage, { pointerId: 1, button: 0, clientX: 500, clientY: 200 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 240, clientY: 200 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 240, clientY: 200 });

    const defaultBook = bookAt(DEFAULT_BOOK_INDEX);
    const liveTextAfterLeftDrag =
      screen.getByText(new RegExp(`of ${BOOK_COUNT}:`)).textContent ?? '';
    expect(liveTextAfterLeftDrag).not.toContain(`${defaultBook.stageLabel} of ${BOOK_COUNT}:`);

    // Drag right by 260px -> scrubs backward (left)
    fireEvent.pointerDown(stage, { pointerId: 2, button: 0, clientX: 240, clientY: 200 });
    fireEvent.pointerMove(stage, { pointerId: 2, clientX: 360, clientY: 200 });
    fireEvent.pointerMove(stage, { pointerId: 2, clientX: 520, clientY: 200 });
    fireEvent.pointerUp(stage, { pointerId: 2, clientX: 520, clientY: 200 });

    const liveTextAfterRightDrag =
      screen.getByText(new RegExp(`of ${BOOK_COUNT}:`)).textContent ?? '';
    expect(liveTextAfterRightDrag).not.toBe(liveTextAfterLeftDrag);
  });

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

  it('renders the stage detail view in-page inside PageShell and returns cleanly to Bookshelf', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} initialSlug={FEATURED.slug} />);

    const stage = screen.getByRole('region', { name: /Bookshelf/i });
    stage.focus();
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(screen.getByRole('heading', { level: 1, name: FEATURED_TITLE })).toBeInTheDocument();
    expect(screen.getByText(FEATURED_TOPIC)).toBeInTheDocument();
    expect(screen.getByText(topicLabel(FEATURED.topics[0]?.number))).toBeInTheDocument();
    expect(screen.getByText(topicLabel(FEATURED.topics.at(-1)?.number))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Back to Bookshelf/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'Bookshelf' })).toBeInTheDocument();
  });

  it('highlights books on the chosen shelf and dims the rest until All is clicked', async () => {
    vi.useFakeTimers();
    const firstAiBook = BOOKS.find((book) => book.shelfSlug === AI_SHELF.slug.current);
    expect(firstAiBook).toBeDefined();
    if (!firstAiBook) return;
    // The AI shelf starts further away than one slide (two books), so the chip jumps there in
    // one move, settled within one step's 400 ms whatever the distance.
    const distance = Math.abs(BOOKS.indexOf(firstAiBook) - DEFAULT_BOOK_INDEX);
    const stepsToFirstAi = Math.min(distance, BOOK_COUNT - distance);
    expect(stepsToFirstAi).toBeGreaterThan(2);
    try {
      const { container } = render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);

      await act(async () => {
        fireEvent.click(shelfChip(AI_SHELF.title));
        vi.advanceTimersByTime(400);
      });

      const highlighted = container.querySelectorAll('[data-highlighted="true"]');
      const dimmed = container.querySelectorAll('[data-dimmed="true"]');
      expect(highlighted.length).toBeGreaterThan(0);
      expect(dimmed.length).toBeGreaterThan(0);
      expect(screen.getByText(liveTextOf(firstAiBook))).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Open AI shelf/i })).toHaveAttribute(
        'href',
        `/bookshelf/shelf/${AI_SHELF.slug.current}`,
      );

      expect(pressedChips()).toEqual([shelfChip(AI_SHELF.title)]);
      expect(vi.getTimerCount()).toBe(0);

      await act(async () => {
        fireEvent.click(shelfChip('All'));
        vi.advanceTimersByTime(100);
      });
      expect(container.querySelectorAll('[data-dimmed="true"]').length).toBe(0);
      expect(pressedChips()).toEqual([shelfChip('All')]);
      // "All" resets the filter without moving the stage.
      expect(screen.getByText(liveTextOf(firstAiBook))).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders separated fanned shelf cards linking to /bookshelf/shelf/[slug], in shelf order', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Shelves' })).toBeInTheDocument();
    expect(SHELVES.map((shelf) => shelf.slug)).toEqual(['backend', 'ai', 'humanities']);
    for (const shelf of SHELVES) {
      const link = screen.getByRole('link', { name: new RegExp(shelf.title) });
      expect(link).toHaveAttribute('href', `/bookshelf/shelf/${shelf.slug}`);
    }
  });

  it('describes the whole shelf by its shelf titles, in shelf order', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);

    expect(
      screen.getByText('Foundational books across Backend, AI, and Humanities.'),
    ).toBeInTheDocument();
  });

  it('renders focused single-shelf mode finitely without duplicating books', () => {
    const backendShelf = SHELVES.find((shelf) => shelf.slug === BACKEND_SHELF.slug.current);
    expect(backendShelf).toBeDefined();
    if (!backendShelf) return;
    const backendBooks = nonEmpty(BOOKS.filter((book) => book.shelfSlug === backendShelf.slug));
    expect(backendBooks.map((book) => book.slug)).toEqual(backendShelf.bookSlugs);

    const { container } = render(
      <BookshelfStage books={backendBooks} shelves={SHELVES} activeShelf={backendShelf} />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Backend' })).toBeInTheDocument();
    expect(
      screen.getByText(`Book 01 / ${String(backendBooks.length).padStart(2, '0')}`),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /All shelves/i })).toHaveAttribute(
      'href',
      '/bookshelf',
    );
    expect(container.querySelectorAll('[data-pool-index]')).toHaveLength(backendBooks.length);
  });

  it('filters and spotlights books by reading status and groups shelves by status', () => {
    const statusAt = (idx: number) => {
      if (idx === 0) return 'queued' as const;
      return idx === 1 ? ('reading' as const) : ('completed' as const);
    };
    const mixedBooks = nonEmpty(BOOKS.map((book, idx) => ({ ...book, status: statusAt(idx) })));

    const { container } = render(<BookshelfStage books={mixedBooks} shelves={SHELVES} />);
    const statusGroup = screen.getByRole('group', { name: 'Reading status' });

    fireEvent.click(within(statusGroup).getByRole('button', { name: /Unread/i }));
    const highlighted = container.querySelectorAll('[data-highlighted="true"]');
    const dimmed = container.querySelectorAll('[data-dimmed="true"]');
    expect(highlighted.length).toBeGreaterThan(0);
    expect(dimmed.length).toBeGreaterThan(0);
    for (const el of highlighted) {
      expect(el.getAttribute('data-book-status')).toBe('queued');
    }

    // Switch Shelves grid to "By reading status"
    fireEvent.click(screen.getByRole('button', { name: 'By reading status' }));
    expect(screen.getByText(/Finished books with distilled notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Books currently on the desk/i)).toBeInTheDocument();
    expect(screen.getByText(/Queued on the reading list/i)).toBeInTheDocument();
  });
});

/** A catalog of `[title, slug, books]` shelves, in order; each book is titled "<slug> book <n>". */
function catalogOf(specs: readonly (readonly [title: string, slug: string, books: number])[]) {
  const shelves = specs.map(([title, slug, count]) => ({
    doc: shelfDoc(title, slug),
    slug,
    count,
  }));
  const catalog = buildBookshelfCatalog(
    shelves.flatMap(({ doc, slug, count }) =>
      Array.from({ length: count }, (_, index) =>
        makeBook({ shelfId: doc._id, title: `${slug} book ${index + 1}` }),
      ),
    ),
    shelves.map(({ doc }) => doc),
  );
  return { books: nonEmpty(catalog.books), shelves: catalog.shelves };
}

/** The cover alt text ("<title> by <authors>") of every book slot the stage highlights now. */
const highlightedCovers = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[data-highlighted="true"] img')].map(
    (img) => img.getAttribute('alt') ?? '',
  );

/** The search params of the last URL update, or null when the URL was never written. */
const lastUrl = (onUrlUpdate: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>) =>
  onUrlUpdate.mock.lastCall?.[0].searchParams ?? null;

describe('BookshelfStage shelf filter, keyed by slug', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rewrites a legacy ?track=<title> link to ?shelf=<slug> and links that shelf's page", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />, '?track=AI', onUrlUpdate);

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(lastUrl(onUrlUpdate)?.toString()).toBe('shelf=ai');
    expect(onUrlUpdate.mock.lastCall?.[0].options.history).toBe('replace');
    expect(pressedChips()).toEqual([shelfChip(AI_SHELF.title)]);
    expect(screen.getByRole('link', { name: /Open AI shelf/ })).toHaveAttribute(
      'href',
      `/bookshelf/shelf/${AI_SHELF.slug.current}`,
    );
  });

  it.each(['?track=Nope', '?shelf=nope'])(
    'drops %s, which names no shelf, and leaves All pressed',
    async (search) => {
      const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
      const { container } = render(
        <BookshelfStage books={BOOKS} shelves={SHELVES} />,
        search,
        onUrlUpdate,
      );

      await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
      expect(lastUrl(onUrlUpdate)?.toString()).toBe('');
      expect(pressedChips()).toEqual([shelfChip('All')]);
      expect(screen.queryByRole('link', { name: /^Open .* shelf$/ })).not.toBeInTheDocument();
      expect(container.querySelectorAll('[data-dimmed="true"]')).toHaveLength(0);
    },
  );

  it('filters by ?shelf=<slug> directly, with nothing to rewrite', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />, '?shelf=humanities', onUrlUpdate);

    expect(pressedChips()).toEqual([shelfChip(HUMANITIES_SHELF.title)]);
    expect(screen.getByRole('link', { name: /Open Humanities shelf/ })).toHaveAttribute(
      'href',
      '/bookshelf/shelf/humanities',
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('tells two shelves with one title apart: each chip highlights only its own books', async () => {
    const { books, shelves } = catalogOf([
      ['Systems', 'systems-intro', BOOKS_PER_SHELF],
      ['Systems', 'systems-advanced', BOOKS_PER_SHELF],
      ['AI', 'ai', BOOKS_PER_SHELF],
    ]);
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const { container } = render(
      <BookshelfStage books={books} shelves={shelves} />,
      undefined,
      onUrlUpdate,
    );
    const [intro, advanced] = shelfChips('Systems');
    expect(shelfChips('Systems')).toHaveLength(2);
    if (!intro || !advanced) return;

    for (const [chip, slug] of [
      [intro, 'systems-intro'],
      [advanced, 'systems-advanced'],
    ] as const) {
      await act(async () => {
        fireEvent.click(chip);
      });
      expect(pressedChips()).toEqual([chip]);
      const lit = highlightedCovers(container);
      expect(lit.length, `books lit for ${slug}`).toBeGreaterThan(0);
      expect(lit.filter((alt) => !alt.startsWith(`${slug} book `))).toEqual([]);
      await waitFor(() => expect(lastUrl(onUrlUpdate)?.get('shelf')).toBe(slug));
    }
  });

  it('gives a shelf titled "All" (slug "all") its own chip, apart from the All reset', async () => {
    const { books, shelves } = catalogOf([
      ['All', 'all', BOOKS_PER_SHELF],
      ['AI', 'ai', BOOKS_PER_SHELF],
      ['Backend', 'backend', BOOKS_PER_SHELF],
    ]);
    const { container } = render(<BookshelfStage books={books} shelves={shelves} />);
    const [reset, allShelf] = shelfChips('All');
    expect(shelfChips('All')).toHaveLength(2);
    if (!reset || !allShelf) return;
    expect(reset).toHaveTextContent(String(books.length));
    expect(pressedChips()).toEqual([reset]);

    await act(async () => {
      fireEvent.click(allShelf);
    });
    expect(pressedChips()).toEqual([allShelf]);
    expect(screen.getByRole('link', { name: /Open All shelf/ })).toHaveAttribute(
      'href',
      '/bookshelf/shelf/all',
    );

    await act(async () => {
      fireEvent.click(reset);
    });
    expect(pressedChips()).toEqual([reset]);
    expect(container.querySelectorAll('[data-dimmed="true"]')).toHaveLength(0);
  });

  it('keeps exactly one chip pressed, whatever is clicked, and has no tabs', async () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);

    for (const title of ['AI', 'Backend', 'All', 'Humanities', 'Humanities', 'All', 'All']) {
      await act(async () => {
        fireEvent.click(shelfChip(title));
      });
      expect(pressedChips(), `after clicking ${title}`).toEqual([shelfChip(title)]);
    }
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('stays put when the chip of the shelf on stage is clicked: only the highlight changes', async () => {
    vi.useFakeTimers();
    const secondBackendBook = bookAt(1);
    expect(secondBackendBook.shelfSlug).toBe(BACKEND_SHELF.slug.current);
    const { container } = render(
      <BookshelfStage books={BOOKS} shelves={SHELVES} initialSlug={secondBackendBook.slug} />,
    );

    await act(async () => {
      fireEvent.click(shelfChip(BACKEND_SHELF.title));
      vi.advanceTimersByTime(400);
    });

    expect(liveText()).toBe(liveTextOf(secondBackendBook));
    expect(pressedChips()).toEqual([shelfChip(BACKEND_SHELF.title)]);
    expect(container.querySelectorAll('[data-highlighted="true"]').length).toBeGreaterThan(0);
  });
});

describe('BookshelfStage keyboard scope', () => {
  const MIDDLE = Math.floor(BOOK_COUNT / 2);

  /** Presses `key` on `target` and reports whether the stage prevented the default. */
  const press = (target: Element, key: string): boolean => {
    const event = createEvent.keyDown(target, { key });
    fireEvent(target, event);
    return event.defaultPrevented;
  };

  it('leaves Home to the page while a link has focus: not prevented, and the stage stays', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} initialSlug={bookAt(MIDDLE).slug} />);
    const link = screen.getByRole('link', { name: /Free library/ });
    link.focus();

    expect(press(link, 'Home')).toBe(false);
    expect(press(link, 'End')).toBe(false);
    expect(liveText()).toBe(liveTextOf(bookAt(MIDDLE)));
  });

  it('leaves the arrow keys to a focused shelf chip', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} initialSlug={bookAt(MIDDLE).slug} />);
    const chip = shelfChip(AI_SHELF.title);
    chip.focus();

    expect(press(chip, 'ArrowRight')).toBe(false);
    expect(press(chip, 'ArrowLeft')).toBe(false);
    expect(liveText()).toBe(liveTextOf(bookAt(MIDDLE)));
  });

  it('steps with an arrow key and jumps with Home while the stage, or nothing, has focus', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} initialSlug={bookAt(MIDDLE).slug} />);
    const stage = screen.getByRole('region', { name: /Bookshelf/i });
    stage.focus();

    expect(press(stage, 'ArrowRight')).toBe(true);
    expect(liveText()).toBe(liveTextOf(bookAt(MIDDLE + 1)));
    expect(press(stage, 'Home')).toBe(true);
    expect(liveText()).toBe(liveTextOf(bookAt(0)));

    stage.blur();
    expect(document.activeElement).toBe(document.body);
    expect(press(document.body, 'End')).toBe(true);
    expect(liveText()).toBe(liveTextOf(bookAt(-1)));
  });
});

describe('BookshelfStage shelf chip row', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  /** A box as getBoundingClientRect reports it, `width` x `height` at `left`, `top`. */
  const box = (left: number, top: number, width: number, height: number): DOMRect =>
    ({
      x: left,
      y: top,
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      toJSON: () => ({}),
    }) as DOMRect;

  /** Lays the chip row out as a 300 px wide scroller over 900 px of chips, scrolled to `left`. */
  function layOutRow(group: HTMLElement): { readonly scrollLeft: () => number } {
    let scrollLeft = 0;
    Object.defineProperties(group, {
      scrollWidth: { configurable: true, value: 900 },
      clientWidth: { configurable: true, value: 300 },
      scrollLeft: {
        configurable: true,
        get: () => scrollLeft,
        set: (value: number) => {
          scrollLeft = value;
        },
      },
    });
    group.getBoundingClientRect = () => box(0, 0, 300, 40);
    return { scrollLeft: () => scrollLeft };
  }

  it('clips the pill with inset variables, never sizing or moving it', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const pill = shelvesGroup().querySelector<HTMLElement>(':scope > [aria-hidden="true"]');
    if (!pill) throw new Error('no shelf pill');

    for (const property of ['--pill-track', '--pill-t', '--pill-r', '--pill-b', '--pill-l']) {
      expect(pill.style.getPropertyValue(property), property).toMatch(/^\d+(\.\d+)?px$/);
    }
    expect(pill.style.width).toBe('');
    expect(pill.style.height).toBe('');
    expect(pill.style.transform).toBe('');
  });

  it('keeps the current chip in view by scrolling the chip row alone, never the page', async () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const group = shelvesGroup();
    const row = layOutRow(group);
    const humanities = shelfChip(HUMANITIES_SHELF.title);
    // 500 px into the chips: past the row's 300 px, wherever the row is scrolled to.
    humanities.getBoundingClientRect = () => box(500 - row.scrollLeft(), 4, 110, 32);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    await act(async () => {
      fireEvent.click(humanities);
    });

    // Centred in the row (where its scroll-snap rests), clear of the 1.5rem fade over each end.
    expect(row.scrollLeft()).toBe(500 + 110 / 2 - 300 / 2);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('marks the ends of a scrolling row with chips past them, for the fade', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const group = shelvesGroup();
    expect(group).not.toHaveAttribute('data-overflow');
    layOutRow(group);

    for (const [left, edges] of [
      [0, 'end'],
      [300, 'both'],
      [600, 'start'],
    ] as const) {
      group.scrollLeft = left;
      fireEvent.scroll(group);
      expect(group, `scrolled to ${left}`).toHaveAttribute('data-overflow', edges);
    }
  });
});

describe('BookshelfStage geometry rendered from props', () => {
  /** The stage as the server renders it (no effects run), parsed into a detached element. */
  const serverStage = (ui: ReactElement): HTMLElement => {
    const host = document.createElement('div');
    host.innerHTML = renderToString(<NuqsTestingAdapter>{ui}</NuqsTestingAdapter>);
    return host;
  };

  /** Each book slot's offset from the active book and its inline --slot-x. */
  const slotPlaces = (root: ParentNode) =>
    [...root.querySelectorAll<HTMLElement>('[data-pool-index]')].map((slot) => ({
      offset: Number(slot.dataset.slotOffset),
      x: slot.style.getPropertyValue('--slot-x'),
      zIndex: slot.style.zIndex,
    }));

  /** --slot-x for `offset`: the active book at 0, the rest a factor of the CSS book height. */
  const expectedX = (offset: number, finite: boolean): string =>
    offset === 0 ? '0px' : `calc(var(--book-h) * ${slotOffsetFactor(offset, finite).toFixed(4)})`;

  it.each([
    ['the circular /bookshelf stage', false],
    ["a shelf's finite stage", true],
  ] as const)(
    'places every book of %s in the server HTML, never all at the centre',
    (_label, finite) => {
      const backend = SHELVES.find((shelf) => shelf.slug === BACKEND_SHELF.slug.current);
      if (!backend) throw new Error('no backend shelf');
      const root = serverStage(
        finite ? (
          <BookshelfStage books={booksOn(backend.slug)} shelves={[backend]} activeShelf={backend} />
        ) : (
          <BookshelfStage books={BOOKS} shelves={SHELVES} />
        ),
      );

      const places = slotPlaces(root);
      expect(places.length).toBeGreaterThan(3);
      for (const { offset, x, zIndex } of places) {
        expect(x, `--slot-x at offset ${offset}`).toBe(expectedX(offset, finite));
        expect(zIndex, `z-index at offset ${offset}`).toBe(String(100 - Math.abs(offset)));
      }
      expect(places.filter(({ x }) => x === '0px').map(({ offset }) => offset)).toEqual([0]);
      expect(new Set(places.map(({ x }) => x)).size).toBe(places.length);
    },
  );

  it('leaves the book height to the CSS: no inline --book-h on the server or after mount', () => {
    const declaresBookHeight = /--book-h\s*:/;
    const root = serverStage(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const serverShell = root.querySelector<HTMLElement>('[style*="--shelf-dur"]');
    expect(serverShell).not.toBeNull();
    expect(root.innerHTML).not.toMatch(declaresBookHeight);

    const { container } = render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const shell = container.querySelector<HTMLElement>('[style*="--shelf-dur"]');
    expect(shell?.style.getPropertyValue('--book-h')).toBe('');
    expect(container.innerHTML).not.toMatch(declaresBookHeight);
  });

  it('moves each slot to the place its new offset gives when the stage steps', () => {
    const { container } = render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);

    for (const step of ['Next book', 'Next book', 'Previous book']) {
      fireEvent.click(screen.getByRole('button', { name: step }));
      for (const { offset, x } of slotPlaces(container)) {
        expect(x, `--slot-x at offset ${offset} after ${step}`).toBe(expectedX(offset, false));
      }
    }
  });
});

describe('Bookshelf covers sized to how they are drawn', () => {
  const coverUrl = (src: string | null | undefined): URL => new URL(src ?? '');
  const widthOf = (src: string | null | undefined): number =>
    Number(coverUrl(src).searchParams.get('w'));

  it('gives the active book the 260 px copy and the source at 2x, a near one 260 px, a far one 96 px', () => {
    const { container } = render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const coverAtOffset = (offset: number): HTMLImageElement => {
      const img = container.querySelector<HTMLImageElement>(`[data-slot-offset="${offset}"] img`);
      if (!img) throw new Error(`no cover at offset ${offset}`);
      return img;
    };

    const active = coverAtOffset(0);
    const activeBook = bookAt(DEFAULT_BOOK_INDEX);
    expect(widthOf(active.getAttribute('src'))).toBe(260);
    expect(active.getAttribute('srcset')).toBe(
      `${active.getAttribute('src')} 1x, ${activeBook.coverSrc} 2x`,
    );
    expect(widthOf(activeBook.coverSrc)).toBe(520);
    expect(active).toHaveAttribute('loading', 'eager');

    for (const offset of [1, -1, 2, -2]) {
      const near = coverAtOffset(offset);
      expect(widthOf(near.getAttribute('src')), `offset ${offset}`).toBe(260);
      expect(near.hasAttribute('srcset'), `offset ${offset}`).toBe(false);
      expect(near).toHaveAttribute('loading', 'eager');
    }
    for (const offset of [3, -3]) {
      const far = coverAtOffset(offset);
      expect(widthOf(far.getAttribute('src')), `offset ${offset}`).toBe(96);
      expect(far.hasAttribute('srcset'), `offset ${offset}`).toBe(false);
      expect(far).toHaveAttribute('loading', 'lazy');
    }
    // The attributes still give the cover's shape, whatever copy is drawn.
    expect(active).toHaveAttribute('width', '520');
    expect(active).toHaveAttribute('height', '680');
  });

  it('offers each fanned shelf-card cover at its drawn 100 px width, at 1x, 2x and 3x', () => {
    const { container } = render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const fans = container.querySelectorAll<HTMLImageElement>(
      'section[aria-labelledby="shelves-heading"] img',
    );

    expect(fans.length).toBeGreaterThan(0);
    for (const img of fans) {
      const candidates = (img.getAttribute('srcset') ?? '').split(', ').map((c) => c.split(' '));
      expect(candidates.map(([, density]) => density)).toEqual(['1x', '2x', '3x']);
      expect(candidates.map(([url]) => widthOf(url))).toEqual([100, 200, 300]);
      expect(candidates[0]?.[0]).toBe(img.getAttribute('src'));
      expect(img).toHaveAttribute('width', '100');
      expect(img).toHaveAttribute('height', '131');
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(img).toHaveAttribute('decoding', 'async');
    }
  });

  it('skips drawing a shelf card, and so fetching its fan covers, until it nears the viewport', () => {
    const { container } = render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const cards = container.querySelectorAll<HTMLAnchorElement>(
      'section[aria-labelledby="shelves-heading"] a[href^="/bookshelf/shelf/"]',
    );

    expect(cards).toHaveLength(SHELVES.length);
    for (const card of cards) {
      expect(card).toHaveClass(
        '[content-visibility:auto]',
        '[contain-intrinsic-block-size:auto_343px]',
      );
    }
  });
});

describe('BookshelfStage in-page detail and reading map', () => {
  // An in-page detail sets #/stage/NN; a stage mounted on that hash opens the detail at once.
  afterEach(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  });

  it('steps to the next and previous books within /bookshelf from the in-page detail', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} initialSlug={FEATURED.slug} />);
    const at = BOOKS.indexOf(FEATURED);
    screen.getByRole('region', { name: /Bookshelf/i }).focus();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByRole('heading', { level: 1, name: FEATURED_TITLE })).toBeInTheDocument();

    const adjacent = () => screen.getByRole('navigation', { name: 'Adjacent books' });
    expect(within(adjacent()).queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(
      within(adjacent()).getByRole('button', { name: new RegExp(bookAt(at + 1).title) }),
    );

    expect(
      screen.getByRole('heading', { level: 1, name: bookAt(at + 1).title }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe(`#/stage/${bookAt(at + 1).stageLabel}`);

    fireEvent.click(within(adjacent()).getByRole('button', { name: new RegExp(FEATURED_TITLE) }));
    expect(screen.getByRole('heading', { level: 1, name: FEATURED_TITLE })).toBeInTheDocument();
    expect(window.location.hash).toBe(`#/stage/${FEATURED.stageLabel}`);

    fireEvent.click(screen.getByRole('button', { name: /Back to Bookshelf/i }));
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

describe('Books Lookup API (/api/v1/books/lookup)', () => {
  it('normalizes slugs and ISBN strings cleanly', () => {
    expect(toBookSlug('Designing Data-Intensive Applications!')).toBe(
      'designing-data-intensive-applications',
    );
    expect(cleanIsbn('978-1-09-816630-4')).toBe('9781098166304');
  });

  it('answers 400 when neither q nor isbn is provided', async () => {
    const response = await booksRoute.handle(new Request('http://localhost/books/lookup'));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain('isbn');
  });

  it('normalizes Open Library results and falls back to Google Books when empty', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            docs: [
              {
                key: '/works/OL123W',
                title: 'AI Engineering',
                author_name: ['Chip Huyen'],
                publisher: ["O'Reilly Media"],
                first_publish_year: 2025,
                isbn: ['9781098166304'],
                cover_i: 14625765,
              },
            ],
          }),
          { status: 200 },
        ),
      );

      const olResult = await lookupBooks({ isbn: '978-1098166304' });
      expect(olResult.query).toBe('9781098166304');
      expect(olResult.items).toHaveLength(1);
      expect(olResult.items[0]).toMatchObject({
        title: 'AI Engineering',
        slug: 'ai-engineering',
        authors: 'Chip Huyen',
        coverUrl: 'https://covers.openlibrary.org/b/id/14625765-L.jpg',
        source: 'openlibrary',
      });

      fetchSpy
        .mockResolvedValueOnce(new Response(JSON.stringify({ docs: [] }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              items: [
                {
                  volumeInfo: {
                    title: 'Designing Data-Intensive Applications',
                    authors: ['Martin Kleppmann'],
                    publisher: "O'Reilly Media",
                    publishedDate: '2017-03-16',
                    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781449373320' }],
                    imageLinks: { thumbnail: 'http://books.google.com/cover.jpg&edge=curl' },
                    infoLink: 'http://books.google.com/ddia',
                  },
                },
              ],
            }),
            { status: 200 },
          ),
        );

      const gbResult = await lookupBooks({ q: 'Designing Data-Intensive Applications' });
      expect(gbResult.items).toHaveLength(1);
      expect(gbResult.items[0]).toMatchObject({
        title: 'Designing Data-Intensive Applications',
        slug: 'designing-data-intensive-applications',
        authors: 'Martin Kleppmann',
        year: 2017,
        isbn: '9781449373320',
        coverUrl: 'https://books.google.com/cover.jpg',
        source: 'googlebooks',
      });

      // Second identical lookup hits the in-memory cache with zero additional upstream fetches
      const callsBefore = fetchSpy.mock.calls.length;
      const cached = await lookupBooks({ q: 'Designing Data-Intensive Applications' });
      expect(cached.items[0]?.slug).toBe('designing-data-intensive-applications');
      expect(fetchSpy.mock.calls.length).toBe(callsBefore);
    } finally {
      resetBookLookupCache();
      fetchSpy.mockRestore();
    }
  });

  it('sanitizes XSS/HTML and unsafe URLs in book lookup inputs and upstream responses', async () => {
    resetBookLookupCache();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            docs: [
              {
                key: '/works/OL999W',
                title: '<b>Rust</b> in Action\u202E',
                author_name: ['Tim <script>alert(1)</script>McNamara'],
                publisher: ['Manning'],
                first_publish_year: 2021,
                first_sentence: 'A <img src=x onerror=alert(1)>practical guide.',
              },
            ],
          }),
          { status: 200 },
        ),
      );

      const res = await lookupBooks({ q: '<script>alert(1)</script>Rust in Action' });
      expect(res.query).toBe('alert(1)Rust in Action');
      expect(res.items[0]).toMatchObject({
        title: 'Rust in Action',
        authors: 'Tim alert(1)McNamara',
        description: 'A practical guide.',
      });
    } finally {
      resetBookLookupCache();
      fetchSpy.mockRestore();
    }
  });
});

describe('BookDetailView standalone', () => {
  it('renders inside PageShell with Back to Bookshelf link and numbered topics', () => {
    render(<BookDetailView {...standaloneProps(FEATURED)} />);

    expect(screen.getByRole('heading', { level: 1, name: FEATURED_TITLE })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Bookshelf/i })).toHaveAttribute(
      'href',
      `/bookshelf?book=${FEATURED.slug}`,
    );
    expect(screen.getByText(topicLabel(FEATURED.topics[0]?.number))).toBeInTheDocument();
    expect(screen.getByText(topicLabel(FEATURED.topics.at(-1)?.number))).toBeInTheDocument();
    expect(screen.getByText(FEATURED_TOPIC)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Direct link/i })).not.toBeInTheDocument();

    const links = getIsbnRegistryLinks(FEATURED.isbn);
    expect(links).toEqual({
      openLibrary: `https://openlibrary.org/isbn/${FEATURED_ISBN}`,
      worldCat: `https://search.worldcat.org/isbn/${FEATURED_ISBN}`,
      isbnSearch: `https://isbnsearch.org/isbn/${FEATURED_ISBN}`,
    });
    expect(screen.getByRole('link', { name: /Open Library/i })).toHaveAttribute(
      'href',
      `https://openlibrary.org/isbn/${FEATURED_ISBN}`,
    );
    expect(screen.getByRole('link', { name: /WorldCat/i })).toHaveAttribute(
      'href',
      `https://search.worldcat.org/isbn/${FEATURED_ISBN}`,
    );
    expect(screen.getByRole('link', { name: /ISBN Search/i })).toHaveAttribute(
      'href',
      `https://isbnsearch.org/isbn/${FEATURED_ISBN}`,
    );
    expect(getIsbnRegistryLinks('N/A')).toBeNull();
  });

  it("draws the Sanity CDN cover with Studio's alt, or the title and authors", () => {
    render(<BookDetailView {...standaloneProps(FEATURED)} />);

    const cover = screen.getByRole('img', { name: `${FEATURED_TITLE} by ${FEATURED_DOC.authors}` });
    expect(cover.getAttribute('src')).toMatch(
      /^https:\/\/cdn\.sanity\.io\/images\/test\/test\/abc123-520x680\.webp\?/,
    );
  });

  it('leaves out the facts and links Studio has no value for', () => {
    const bare = bookAt(DEFAULT_BOOK_INDEX);
    expect(bare.isbn).toBeUndefined();
    expect(bare.url).toBeUndefined();
    render(<BookDetailView {...standaloneProps(bare)} />);

    expect(screen.queryByText(/ISBN/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Explore/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open Library/i })).not.toBeInTheDocument();
    expect(screen.getByText(bare.authors)).toBeInTheDocument();
  });

  it('links the books before and after, wrapping round from the first book to the last', () => {
    const first = bookAt(0);
    render(<BookDetailView {...standaloneProps(first)} />);
    const adjacent = screen.getByRole('navigation', { name: 'Adjacent books' });

    for (const neighbour of [bookAt(-1), bookAt(1)]) {
      const link = within(adjacent).getByRole('link', { name: new RegExp(neighbour.title) });
      expect(link).toHaveAttribute('href', `/bookshelf/${neighbour.slug}`);
      expect(link).toHaveTextContent(`Stage ${neighbour.stageLabel} · ${neighbour.track}`);
    }
  });

  it('has no Previous or Next links when the book is alone on the shelf', () => {
    const only = bookAt(0);
    render(
      <BookDetailView
        book={only}
        prev={toBookNeighbor(only)}
        next={toBookNeighbor(only)}
        mapBooks={[toReadingMapEntry(only)]}
        shelves={SHELVES}
      />,
    );

    expect(screen.queryByRole('navigation', { name: 'Adjacent books' })).not.toBeInTheDocument();
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
      // Off-screen shelves are not rendered until they near the viewport (S9).
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

  it('loads its hero cover first, at high fetch priority, sized to the frame', () => {
    render(<BookDetailView {...standaloneProps(FEATURED)} />);

    const cover = screen.getByRole('img', { name: `${FEATURED_TITLE} by ${FEATURED_DOC.authors}` });
    expect(cover).toHaveAttribute('fetchpriority', 'high');
    expect(cover).toHaveAttribute('loading', 'eager');
    expect(cover).toHaveAttribute('sizes', '(max-width: 900px) 260px, 340px');
    const [small, full] = (cover.getAttribute('srcset') ?? '').split(', ');
    expect(full).toBe(`${FEATURED.coverSrc} 520w`);
    const [smallUrl, smallWidth] = (small ?? '').split(' ');
    expect(smallWidth).toBe('340w');
    expect(new URL(smallUrl ?? '').searchParams.get('w')).toBe('340');
  });

  it('renders a unified Live Console ribbon track and progress fill on every topic shelf card', () => {
    const { container } = render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    for (const shelf of SHELVES) {
      const track = container.querySelector(`[data-shelf-ribbon-track="${shelf.slug}"]`);
      const fill = container.querySelector(`[data-shelf-ribbon-fill="${shelf.slug}"]`);
      expect(track, shelf.slug).not.toBeNull();
      expect(fill, shelf.slug).not.toBeNull();
      expect(track).toHaveClass('bg-brand-subtle');
      expect(fill).toHaveClass('bg-brand');
    }
  });
});
