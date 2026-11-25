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

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Vite cannot load Next's PostCSS plugin configuration for CSS modules under Vitest.
vi.mock('@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf.module.css', () => ({
  default: {},
}));

import { BookDetailView } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/book-detail-view';
import { BookshelfStage } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf-stage';
import {
  BOOK_SLUGS,
  BOOK_TRACKS,
  BOOKS,
  DEFAULT_BOOK_INDEX,
  DEFAULT_SHELVES,
  getAdjacentBooks,
  getBookAt,
  getBookBySlug,
  TOTAL_TOPICS,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import { booksRoute } from '@/app/api/v1/[[...route]]/books';
import { cleanIsbn, lookupBooks, toBookSlug } from '@/app/api/v1/[[...route]]/books/handlers';

describe('Engineering bookshelf catalog', () => {
  it('contains 14 uniquely slugged stages numbered 01 through 14 across all 4 tracks', () => {
    expect(BOOKS).toHaveLength(14);
    expect(new Set(BOOK_SLUGS).size).toBe(BOOKS.length);
    expect(BOOKS.map((book) => book.stage)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ]);
    for (const track of BOOK_TRACKS) {
      expect(BOOKS.some((book) => book.track === track)).toBe(true);
    }
  });

  it('numbers curriculum topics continuously from 1 to TOTAL_TOPICS without gaps', () => {
    const numbers = BOOKS.flatMap((book) => book.topics.map((topic) => topic.number));
    expect(numbers).toHaveLength(TOTAL_TOPICS);
    expect(numbers[0]).toBe(1);
    expect(numbers.at(-1)).toBe(TOTAL_TOPICS);
    for (let index = 1; index < numbers.length; index += 1) {
      expect(numbers[index]).toBe((numbers[index - 1] ?? 0) + 1);
    }
  });

  it('has a real local WebP cover asset under public/ for every book', () => {
    for (const book of BOOKS) {
      expect(book.coverSrc).toMatch(/^\/assets\/bookshelf\/[a-z0-9-]+\.webp$/);
      const diskPath = join(process.cwd(), 'public', book.coverSrc);
      expect(existsSync(diskPath), book.coverSrc).toBe(true);
    }
  });

  it('wraps previous and next neighbors cyclically around stage 01 and stage 14', () => {
    const first = getAdjacentBooks(getBookAt(0).slug);
    expect(first.prev.stage).toBe(14);
    expect(first.next.stage).toBe(2);

    const last = getAdjacentBooks(getBookAt(13).slug);
    expect(last.prev.stage).toBe(13);
    expect(last.next.stage).toBe(1);
  });
});

describe('BookshelfStage Live Console & bidirectional scroll', () => {
  it('defaults to Stage 04 (Designing Data-Intensive Applications) and steps both directions', () => {
    render(<BookshelfStage />);

    const defaultBook = getBookAt(DEFAULT_BOOK_INDEX);
    expect(screen.getByText(`04 of 14: ${defaultBook.title}`)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Backend/ })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Next book' }));
    const nextBook = getBookAt(DEFAULT_BOOK_INDEX + 1);
    expect(screen.getByText(`05 of 14: ${nextBook.title}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous book' }));
    expect(screen.getByText(`04 of 14: ${defaultBook.title}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous book' }));
    const prevBook = getBookAt(DEFAULT_BOOK_INDEX - 1);
    expect(screen.getByText(`03 of 14: ${prevBook.title}`)).toBeInTheDocument();
  });

  it('scrolls right on wheel down and left on wheel up cleanly across direction reversals', () => {
    vi.useFakeTimers();
    try {
      render(<BookshelfStage />);
      const stage = screen.getByRole('region', { name: /Bookshelf/i });

      // Advance past initial cooldown
      vi.advanceTimersByTime(300);
      fireEvent.wheel(stage, { deltaY: 120 });
      expect(
        screen.getByText(`05 of 14: ${getBookAt(DEFAULT_BOOK_INDEX + 1).title}`),
      ).toBeInTheDocument();

      // Momentum during cooldown is ignored, then scrolling up reverses immediately to 04
      fireEvent.wheel(stage, { deltaY: 200 });
      vi.advanceTimersByTime(300);
      fireEvent.wheel(stage, { deltaY: -80 });
      expect(
        screen.getByText(`04 of 14: ${getBookAt(DEFAULT_BOOK_INDEX).title}`),
      ).toBeInTheDocument();

      // Another scroll up steps left to 03
      vi.advanceTimersByTime(300);
      fireEvent.wheel(stage, { deltaY: -80 });
      expect(
        screen.getByText(`03 of 14: ${getBookAt(DEFAULT_BOOK_INDEX - 1).title}`),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps pool DOM nodes in fixed ascending poolIndex order when stepping left and right', () => {
    const { container } = render(<BookshelfStage />);

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
    render(<BookshelfStage />);
    const stage = screen.getByRole('region', { name: /Bookshelf/i });

    // Drag left by 260px -> scrubs forward (right) multiple books
    fireEvent.pointerDown(stage, { pointerId: 1, button: 0, clientX: 500, clientY: 200 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 240, clientY: 200 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 240, clientY: 200 });

    const liveTextAfterLeftDrag = screen.getByText(/of 14:/).textContent ?? '';
    expect(liveTextAfterLeftDrag).not.toContain('04 of 14:');

    // Drag right by 260px -> scrubs backward (left)
    fireEvent.pointerDown(stage, { pointerId: 2, button: 0, clientX: 240, clientY: 200 });
    fireEvent.pointerMove(stage, { pointerId: 2, clientX: 360, clientY: 200 });
    fireEvent.pointerMove(stage, { pointerId: 2, clientX: 520, clientY: 200 });
    fireEvent.pointerUp(stage, { pointerId: 2, clientX: 520, clientY: 200 });

    const liveTextAfterRightDrag = screen.getByText(/of 14:/).textContent ?? '';
    expect(liveTextAfterRightDrag).not.toBe(liveTextAfterLeftDrag);
  });

  it('opens the reading map dialog and closes on close button', () => {
    render(<BookshelfStage />);

    fireEvent.click(screen.getByRole('button', { name: /Reading map/i }));
    const dialog = screen.getByRole('dialog', { name: /Reading map/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/AI Engineering: Building Applications/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close reading map' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the stage detail view in-page inside PageShell and returns cleanly to Bookshelf', () => {
    render(<BookshelfStage initialSlug="ai-engineering" />);

    const stage = screen.getByRole('region', { name: /Bookshelf/i });
    stage.focus();
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'AI Engineering: Building Applications with Foundation Models',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Agents: tools & planning')).toBeInTheDocument();
    expect(screen.getByText('119')).toBeInTheDocument();
    expect(screen.getByText('132')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Back to Bookshelf/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'Bookshelf' })).toBeInTheDocument();
  });

  it('highlights books in the selected section pill and dims non-matching sections until All is clicked', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<BookshelfStage />);

      fireEvent.click(screen.getByRole('tab', { name: /AI/ }));
      act(() => {
        vi.advanceTimersByTime(600);
      });

      const highlighted = container.querySelectorAll('[data-highlighted="true"]');
      const dimmed = container.querySelectorAll('[data-dimmed="true"]');
      expect(highlighted.length).toBeGreaterThan(0);
      expect(dimmed.length).toBeGreaterThan(0);
      expect(screen.getByText(/11 of 14: Deep Learning/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Open AI shelf/i })).toHaveAttribute(
        'href',
        '/bookshelf/shelf/ai',
      );

      fireEvent.click(screen.getByRole('tab', { name: /All/ }));
      expect(container.querySelectorAll('[data-dimmed="true"]').length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders separated fanned shelf cards linking to /bookshelf/shelf/[slug]', () => {
    render(<BookshelfStage />);

    expect(screen.getByRole('heading', { level: 2, name: 'Shelves' })).toBeInTheDocument();
    for (const shelf of DEFAULT_SHELVES) {
      const link = screen.getByRole('link', { name: new RegExp(shelf.title) });
      expect(link).toHaveAttribute('href', `/bookshelf/shelf/${shelf.slug}`);
    }
  });

  it('renders focused single-shelf mode finitely without duplicating books', () => {
    const backendShelf = DEFAULT_SHELVES.find((shelf) => shelf.slug === 'backend');
    expect(backendShelf).toBeDefined();
    if (!backendShelf) return;
    const backendBooks = BOOKS.filter((book) => backendShelf.bookSlugs.includes(book.slug));

    const { container } = render(
      <BookshelfStage books={backendBooks} shelves={DEFAULT_SHELVES} activeShelf={backendShelf} />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Backend' })).toBeInTheDocument();
    expect(screen.getByText('Book 01 / 03')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /All shelves/i })).toHaveAttribute(
      'href',
      '/bookshelf',
    );
    expect(container.querySelectorAll('[data-pool-index]')).toHaveLength(backendBooks.length);
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
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('BookDetailView standalone', () => {
  it('renders inside PageShell with Back to Bookshelf link and numbered topics', () => {
    const book = getBookBySlug('ai-engineering');
    expect(book).toBeDefined();
    if (!book) return;
    render(<BookDetailView book={book} />);

    expect(screen.getByRole('heading', { level: 1, name: book.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Bookshelf/i })).toHaveAttribute(
      'href',
      '/bookshelf?book=ai-engineering',
    );
    expect(screen.getByText('119')).toBeInTheDocument();
    expect(screen.getByText('132')).toBeInTheDocument();
    expect(screen.getByText('Agents: tools & planning')).toBeInTheDocument();
  });
});
