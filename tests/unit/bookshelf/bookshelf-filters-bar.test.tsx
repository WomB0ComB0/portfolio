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
 * @file The 'Shelves' chips (bookshelf-filters-bar.tsx), rendered in the stage on the fixture
 * catalog of bookshelf-fixtures.ts. The shelf filter is keyed by slug (`?shelf=<slug>`): its chips
 * are toggle buttons in the 'Shelves' group, exactly one pressed ("All", the reset, or one shelf);
 * a chosen shelf lights its books and dims the rest; a legacy `?track=<title>` link is rewritten
 * to its shelf's slug. The chips keep to one row that scrolls sideways: the pill is clipped with
 * inset variables, the current chip is kept in view by scrolling the row alone, and the row marks
 * each end that has chips past it.
 */

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { OnUrlUpdateFunction } from 'nuqs/adapters/testing';
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
import { DEFAULT_BOOK_INDEX } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import {
  AI_SHELF,
  BACKEND_SHELF,
  BOOK_COUNT,
  BOOKS,
  BOOKS_PER_SHELF,
  bookAt,
  catalogOf,
  HUMANITIES_SHELF,
  liveText,
  liveTextOf,
  pressedChips,
  renderWithNuqs as render,
  SHELVES,
  shelfChip,
  shelfChips,
  shelvesGroup,
} from './bookshelf-fixtures';

afterEach(() => {
  vi.useRealTimers();
});

/** The cover alt text ("<title> by <authors>") of every book slot the stage highlights now. */
const highlightedCovers = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[data-highlighted="true"] img')].map(
    (img) => img.getAttribute('alt') ?? '',
  );

/** The search params of the last URL update, or null when the URL was never written. */
const lastUrl = (onUrlUpdate: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>) =>
  onUrlUpdate.mock.lastCall?.[0].searchParams ?? null;

describe('BookshelfFiltersBar shelf filter, keyed by slug', () => {
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
    vi.useFakeTimers();
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />, '?shelf=humanities', onUrlUpdate);

    expect(pressedChips()).toEqual([shelfChip(HUMANITIES_SHELF.title)]);
    expect(screen.getByRole('link', { name: /Open Humanities shelf/ })).toHaveAttribute(
      'href',
      '/bookshelf/shelf/humanities',
    );
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
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

describe('BookshelfFiltersBar shelf chip row', () => {
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

describe('BookshelfFiltersBar empty filter', () => {
  /** The banner the bar shows when no book matches the filter, and its sentence. */
  const banner = () => screen.getByRole('button', { name: 'Show all books' }).parentElement;

  it('says plainly that no book is marked Read, never pointing visitors at the CMS', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const statusGroup = screen.getByRole('group', { name: 'Reading status' });
    // Every fixture book is queued, so Read matches none.
    fireEvent.click(within(statusGroup).getByRole('button', { name: /^Read\s*0$/ }));

    expect(banner()).toHaveTextContent('No books marked Read.');
    expect(banner()?.textContent).not.toMatch(/Studio|Sanity/);
  });

  it('names the shelf and the status that left nothing', () => {
    render(
      <BookshelfStage books={BOOKS} shelves={SHELVES} />,
      `?shelf=${AI_SHELF.slug.current}&status=completed`,
    );

    expect(banner()).toHaveTextContent('No books on the AI shelf marked Read.');
  });
});
