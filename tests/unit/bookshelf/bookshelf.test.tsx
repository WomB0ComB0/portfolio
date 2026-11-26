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
 */

import { act, fireEvent, render as rtlRender, screen, within } from '@testing-library/react';
import { makeBook, makeBookshelf } from '@tests/fixtures/sanity-docs';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SanityBookshelf } from '@/hooks/sanity/schemas';

const render = (ui: ReactElement, searchParams?: string) =>
  rtlRender(ui, {
    wrapper: ({ children }) => (
      <NuqsTestingAdapter searchParams={searchParams}>{children}</NuqsTestingAdapter>
    ),
  });

// Vite cannot load Next's PostCSS plugin configuration for CSS modules under Vitest.
vi.mock('@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf.module.css', () => ({
  default: {},
}));
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
vi.mock('@/lib/sanity/loaders', () => ({ loadBooks: vi.fn(), loadBookshelves: vi.fn() }));

import { BookDetailView } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/book-detail-view';
import { BookshelfStage } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf-stage';
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
import { booksRoute } from '@/app/api/v1/[[...route]]/books';
import {
  cleanIsbn,
  lookupBooks,
  resetBookLookupCache,
  toBookSlug,
} from '@/app/api/v1/[[...route]]/books/handlers';

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

const CATALOG = buildBookshelfCatalog(
  [
    ...shelfBooks(BACKEND_SHELF),
    ...(FIRST_AI_DOC ? [FIRST_AI_DOC] : []),
    FEATURED_DOC,
    ...OTHER_AI_DOCS,
    ...shelfBooks(HUMANITIES_SHELF),
  ],
  [BACKEND_SHELF, AI_SHELF, HUMANITIES_SHELF],
);

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

/** A category tab by its shelf title, whatever count it shows. */
const tabNamed = (title: string) =>
  screen.getByRole('tab', { name: new RegExp(`^${title}\\s*\\d`) });

describe('BookshelfStage Live Console & bidirectional scroll', () => {
  it('defaults to DEFAULT_BOOK_INDEX (stage 01) and steps both directions around the shelf', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);

    const defaultBook = bookAt(DEFAULT_BOOK_INDEX);
    const nextBook = bookAt(DEFAULT_BOOK_INDEX + 1);
    const prevBook = bookAt(DEFAULT_BOOK_INDEX - 1);

    expect(defaultBook.stageLabel).toBe('01');
    expect(screen.getByText(liveTextOf(defaultBook))).toBeInTheDocument();
    expect(tabNamed(defaultBook.track)).toHaveAttribute('aria-selected', 'true');

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

  it('highlights books in the selected section pill and dims non-matching sections until All is clicked', async () => {
    vi.useFakeTimers();
    const firstAiBook = BOOKS.find((book) => book.track === AI_SHELF.title);
    expect(firstAiBook).toBeDefined();
    if (!firstAiBook) return;
    // Tab clicks walk the shelf one book per 55 ms chain tick, taking the shorter way around the
    // circular shelf; budget 100 ms per book plus the final settle, from the fixture's distance.
    const distance = Math.abs(BOOKS.indexOf(firstAiBook) - DEFAULT_BOOK_INDEX);
    const stepsToFirstAi = Math.min(distance, BOOK_COUNT - distance);
    // The AI shelf starts several books away, so the click walks a multi-step chain.
    expect(stepsToFirstAi).toBeGreaterThan(1);
    try {
      const { container } = render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);

      await act(async () => {
        fireEvent.click(tabNamed(AI_SHELF.title));
        vi.advanceTimersByTime(600 + stepsToFirstAi * 100);
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

      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: /All/ }));
        vi.advanceTimersByTime(100);
      });
      expect(container.querySelectorAll('[data-dimmed="true"]').length).toBe(0);
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
    render(<BookDetailView book={FEATURED} books={BOOKS} shelves={SHELVES} />);

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
    render(<BookDetailView book={FEATURED} books={BOOKS} shelves={SHELVES} />);

    const cover = screen.getByRole('img', { name: `${FEATURED_TITLE} by ${FEATURED_DOC.authors}` });
    expect(cover.getAttribute('src')).toMatch(
      /^https:\/\/cdn\.sanity\.io\/images\/test\/test\/abc123-520x680\.webp\?/,
    );
  });

  it('leaves out the facts and links Studio has no value for', () => {
    const bare = bookAt(DEFAULT_BOOK_INDEX);
    expect(bare.isbn).toBeUndefined();
    expect(bare.url).toBeUndefined();
    render(<BookDetailView book={bare} books={BOOKS} shelves={SHELVES} />);

    expect(screen.queryByText(/ISBN/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Explore/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open Library/i })).not.toBeInTheDocument();
    expect(screen.getByText(bare.authors)).toBeInTheDocument();
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
