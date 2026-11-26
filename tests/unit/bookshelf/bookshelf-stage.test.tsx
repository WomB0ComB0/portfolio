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
 * @file The bookshelf's 3D stage (bookshelf-stage.tsx) on the fixture catalog of
 * bookshelf-fixtures.ts. It opens on DEFAULT_BOOK_INDEX and steps both ways round the circular
 * shelf (buttons, wheel and drag) with its pool of book slots kept in order; a shelf's finite
 * stage draws each book once; the reading-status chips spotlight their books. Arrow keys and
 * Home/End move the stage only while it (or nothing) has focus.
 *
 * The stage's geometry comes from props, so the server's HTML is laid out as the browser's: each
 * slot's --slot-x is a factor of the CSS --book-h, which is never written inline. Covers are sized
 * to how they are drawn: the active one 260 px with the source at 2x, near ones 260 px, far ones
 * 96 px.
 */

import { act, createEvent, fireEvent, screen, within } from '@testing-library/react';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
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
import { slotOffsetFactor } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/shelf-geometry';
import { FINE_POINTER } from '@/hooks/use-fine-pointer';
import { REDUCED_MOTION_QUERY } from '@/lib/design/motion';
import {
  AI_SHELF,
  BACKEND_SHELF,
  BOOK_COUNT,
  BOOKS,
  bookAt,
  booksOn,
  liveText,
  liveTextOf,
  nonEmpty,
  pressedChips,
  renderWithNuqs as render,
  SHELVES,
  shelfChip,
  widthOf,
} from './bookshelf-fixtures';

afterEach(() => {
  vi.useRealTimers();
});

describe('BookshelfStage', () => {
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

describe('BookshelfStage ring cursor', () => {
  /** A media query list that matches when `matches` says so for its query. */
  const mediaList = (query: string, matches: boolean): MediaQueryList =>
    ({
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;

  /**
   * Renders the stage with a fine pointer (and reduced motion when asked), moves the pointer from
   * (100, 100) to (500, 300) and runs one animation frame: the cursor layer's transform then.
   */
  function ringAfterOneFrame(reducedMotion: boolean): string {
    vi.spyOn(globalThis, 'matchMedia').mockImplementation((query: string) =>
      mediaList(query, query === FINE_POINTER || (reducedMotion && query === REDUCED_MOTION_QUERY)),
    );
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => null,
    });

    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const layer = document.querySelector<HTMLElement>('.cursor-layer');
    if (!layer) throw new Error('no cursor layer');
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 100, clientY: 100 }));
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 500, clientY: 300 }));
    });
    act(() => frames.at(-1)?.(16));
    return layer.style.transform;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  it('sits exactly on the pointer under reduced motion', () => {
    expect(ringAfterOneFrame(true)).toBe('translate3d(500px, 300px, 0px)');
  });

  it('still trails the pointer, part of the way each frame, without reduced motion', () => {
    const transform = ringAfterOneFrame(false);

    expect(transform).toMatch(/^translate3d\(/);
    expect(transform).not.toBe('translate3d(500px, 300px, 0px)');
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

describe('BookshelfStage covers sized to how they are drawn', () => {
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
});
