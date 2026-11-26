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

'use client';

import Link from 'next/link';
import { useQueryStates } from 'nuqs';
import {
  type CSSProperties,
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FiArrowLeft, FiBookOpen, FiMap } from 'react-icons/fi';
import { PageShell } from '@/components/console/page-shell';
import { StatStrip } from '@/components/console/stat-strip';
import { FINE_POINTER } from '@/hooks/use-fine-pointer';
import { prefersReducedMotion } from '@/lib/design/motion';
import { cn } from '@/lib/utils';
import { describeShelves, formatStageLabel, shelfStats } from '../_lib/book-labels';
import { neighborsOf } from '../_lib/book-neighbors';
import {
  type BookItem,
  DEFAULT_BOOK_INDEX,
  type NonEmptyBooks,
  type ShelfCollection,
} from '../_lib/books';
import {
  BOOKSHELF_URL_OPTIONS,
  type BookStatusFilter,
  bookshelfSearchParsers,
  buildShelfTabs,
  countStatuses,
  matchesFilter,
  resolveShelfFilter,
  type ShelfTab,
} from '../_lib/bookshelf-filters';
import { type ReadingMapEntry, toReadingMapEntry } from '../_lib/reading-map';
import {
  buildPoolSlots,
  clamp,
  INITIAL_HALF_WINDOW,
  MIN_CIRCULAR_BOOKS,
  measureShelf,
  type PoolSlot,
  SLOT_GEOMETRY,
  STAGE_FALLBACK_HEIGHT,
  slotOffsetFactor,
  wrapIndex,
} from '../_lib/shelf-geometry';
import { BookDetailView } from './book-detail-view';
import { BookshelfBookSlot, SLOT_NO_ANIM_CLASS } from './bookshelf-book-slot';
import { headerActionClass } from './bookshelf-classes';
import { BookshelfControlsBar } from './bookshelf-controls-bar';
import { BookshelfFiltersBar } from './bookshelf-filters-bar';
import styles from './bookshelf-stage.module.css';
import { FreeLibraryDirectoryCard } from './free-library-card';
import { ReadingMapDialog } from './reading-map-dialog';
import { ShelfCardsGrid } from './shelf-cards-grid';
import { useBookshelfNavigation } from './use-bookshelf-navigation';
import { useInPageDetail } from './use-in-page-detail';
import { useShelfMotion } from './use-shelf-motion';
import { useShelfPill } from './use-shelf-pill';

export interface BookshelfStageProps {
  /** Optional initial book slug (e.g. from `?book=<slug>` when returning from a detail route). */
  readonly initialSlug?: string;
  /**
   * The books to shelve, in stage order: the whole catalog, or one shelf's books. Never empty: the
   * server page renders the empty state instead of this island when there are none.
   */
  readonly books: NonEmptyBooks;
  /**
   * The shelves of `books`, in shelf order (the shelf cards and the reading map): every shelf on
   * /bookshelf, only `activeShelf` on a shelf's page.
   */
  readonly shelves: readonly ShelfCollection[];
  /** When set, renders a focused single-shelf view (`/bookshelf/shelf/[shelfSlug]`). */
  readonly activeShelf?: ShelfCollection;
}

/** A resize re-measures the stage once it has settled this long. */
const RESIZE_DEBOUNCE_MS = 100;
/** A jump past JUMP_SLIDE_MAX (use-shelf-motion.ts) teleports every slot, then fades in this long. */
const JUMP_IN_MS = 220;
/** The fade-in's easing: the shelf's --shelf-ease-out (bookshelf-stage.module.css). */
const JUMP_IN_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** How far the shelf slides in from the side it travels toward, in book heights: one slot pitch. */
const JUMP_IN_SHIFT = SLOT_GEOMETRY.circular.pitch;

/**
 * Interactive 3D Bookshelf orchestrator built natively inside Live Console `<PageShell>`.
 * Delegates filter chrome (`BookshelfFiltersBar`), 3D cuboid slots (`BookshelfBookSlot`),
 * wheel/keyboard/drag/cursor physics (`useBookshelfNavigation`), and readout controls
 * (`BookshelfControlsBar`) to isolated sub-modules.
 */
export function BookshelfStage({
  initialSlug,
  books,
  shelves,
  activeShelf,
}: BookshelfStageProps): ReactElement {
  const bookCount = books.length;
  const isFiniteShelf = Boolean(activeShelf) || bookCount < MIN_CIRCULAR_BOOKS;

  const bookAt = useCallback(
    (index: number): BookItem => {
      const idx = isFiniteShelf ? clamp(index, 0, bookCount - 1) : wrapIndex(index, bookCount);
      return books[idx] ?? books[0];
    },
    [books, bookCount, isFiniteShelf],
  );

  const [urlState, setUrlState] = useQueryStates(bookshelfSearchParsers, BOOKSHELF_URL_OPTIONS);
  const resolvedInitialSlug = urlState.book ?? initialSlug;

  const initialPos = useMemo(() => {
    if (resolvedInitialSlug) {
      const found = books.findIndex((book) => book.slug === resolvedInitialSlug);
      if (found >= 0) return found;
    }
    if (isFiniteShelf) return 0;
    return Math.min(DEFAULT_BOOK_INDEX, bookCount - 1);
  }, [resolvedInitialSlug, books, bookCount, isFiniteShelf]);

  const motion = useShelfMotion({ initialPos, finite: isFiniteShelf, bookCount });
  const { pos, setPos, stepDuration, posRef, bookHeightRef, pendingJumpRef, jumpAnimRef } = motion;
  const { step, jumpTo } = motion;

  const indexBySlug = useMemo(
    () => new Map(books.map((book, index) => [book.slug, index] as const)),
    [books],
  );
  const prevSlotPositionsRef = useRef<Map<number, number>>(new Map());
  const {
    detailBook,
    setDetailBook,
    stageIndexFromHash,
    openDetail,
    openDetailBySlug,
    closeDetail,
  } = useInPageDetail({
    books,
    indexBySlug,
    bookAt,
    setPos,
    slotPositionsRef: prevSlotPositionsRef,
  });

  const [halfWindow, setHalfWindow] = useState<number>(INITIAL_HALF_WINDOW);
  const [mapOpen, setMapOpen] = useState(false);
  const [finePointer, setFinePointer] = useState(false);

  // A shelf's slug is its filter's identity; its title is only the chip's label.
  const shelfTabs = useMemo(() => buildShelfTabs(books), [books]);
  const mapBooks = useMemo(() => books.map(toReadingMapEntry), [books]);
  const activeShelfSlug = resolveShelfFilter(urlState.shelf, urlState.track, shelfTabs);
  const activeShelfTab = useMemo<ShelfTab | null>(
    () => shelfTabs.find((tab) => tab.slug === activeShelfSlug) ?? null,
    [shelfTabs, activeShelfSlug],
  );
  const statusFilter: BookStatusFilter = urlState.status;
  const shelfGroupBy = urlState.group;

  const stageRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const slotElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const activeBook = bookAt(pos);

  const statusCounts = useMemo(() => countStatuses(books), [books]);

  const statItems = useMemo(
    () =>
      shelfStats({
        books,
        readCount: statusCounts.completed,
        shelfCount: shelves.length,
        isSingleShelf: Boolean(activeShelf),
      }),
    [books, statusCounts.completed, shelves.length, activeShelf],
  );

  // Where the pill sits: the filtered shelf, else the shelf of the book on stage.
  const locationShelfSlug = activeShelfSlug ?? activeBook.shelfSlug;
  const { chipRefs, shelfPill, syncShelfPill, syncShelfPillRef } = useShelfPill(locationShelfSlug);

  // Derived from the shelves, so the copy never drifts from what Studio holds.
  const catalogDescription = useMemo(() => describeShelves(shelves), [shelves]);

  /**
   * Measures the stage: the pool size (halfWindow), and the book height drags and the jump fade
   * move by. Nothing painted reads it: the books are sized by the CSS --book-h on .shelf-shell,
   * the same height unrounded, so they never resize after hydration.
   */
  const measureStage = useCallback((): void => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const { bookHeight, halfWindow: nextHalfWindow } = measureShelf(
      stageEl.clientWidth || window.innerWidth,
      stageEl.clientHeight || STAGE_FALLBACK_HEIGHT,
    );
    bookHeightRef.current = bookHeight;
    setHalfWindow(nextHalfWindow);
  }, [bookHeightRef]);

  const poolSlots = useMemo<readonly PoolSlot[]>(
    () => buildPoolSlots({ books, pos, halfWindow, finite: isFiniteShelf, bookAt }),
    [isFiniteShelf, books, pos, halfWindow, bookAt],
  );

  const registerSlotRef = useCallback((poolIndex: number, el: HTMLDivElement | null): void => {
    if (el) slotElementsRef.current.set(poolIndex, el);
    else slotElementsRef.current.delete(poolIndex);
  }, []);

  useLayoutEffect(() => {
    if (detailBook !== null) return;
    // The commit a jump lands on: every slot counts as fresh, so each teleports under .no-anim.
    const jump = pendingJumpRef.current?.pos === posRef.current ? pendingJumpRef.current : null;
    if (jump) {
      pendingJumpRef.current = null;
      prevSlotPositionsRef.current.clear();
    }
    const teleported: HTMLDivElement[] = [];

    for (const slot of poolSlots) {
      const el = slotElementsRef.current.get(slot.poolIndex);
      if (!el) continue;

      const prevSlot = prevSlotPositionsRef.current.get(slot.poolIndex);
      const isFresh = prevSlot === undefined || prevSlot !== slot.slotPosition;
      prevSlotPositionsRef.current.set(slot.poolIndex, slot.slotPosition);

      if (isFresh && SLOT_NO_ANIM_CLASS) {
        el.classList.add(SLOT_NO_ANIM_CLASS);
        teleported.push(el);
      }
      // Position (--slot-x), z-index and the state classes are rendered from props, server and
      // client; React commits them before this effect, so a teleported slot lands without a
      // transition.
    }

    if (teleported.length > 0) {
      void shelfRef.current?.offsetWidth;
      for (const el of teleported) {
        if (SLOT_NO_ANIM_CLASS) el.classList.remove(SLOT_NO_ANIM_CLASS);
      }
    }

    // The teleport is hidden by fading the whole shelf in from the side it travels toward:
    // opacity and transform only, on the compositor.
    const shelfEl = shelfRef.current;
    if (jump && jump.dir !== 0 && shelfEl && typeof shelfEl.animate === 'function') {
      jumpAnimRef.current?.cancel();
      const fromX = jump.dir * bookHeightRef.current * JUMP_IN_SHIFT;
      jumpAnimRef.current = shelfEl.animate(
        [
          { opacity: 0, transform: `translate3d(${fromX.toFixed(1)}px, 0, 0)` },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' },
        ],
        { duration: JUMP_IN_MS, easing: JUMP_IN_EASE },
      );
    }
  }, [poolSlots, detailBook, pendingJumpRef, posRef, jumpAnimRef, bookHeightRef]);

  useEffect(() => {
    measureStage();
    const isFine =
      typeof window.matchMedia === 'function' && window.matchMedia(FINE_POINTER).matches;
    setFinePointer(isFine);

    const hashIndex = stageIndexFromHash();
    if (hashIndex >= 0) {
      setPos(hashIndex);
      setDetailBook(bookAt(hashIndex));
    }

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = (): void => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        measureStage();
        syncShelfPillRef.current();
      }, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener('resize', onResize);
    void document.fonts?.ready.then(() => syncShelfPillRef.current());
    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [measureStage, stageIndexFromHash, bookAt, setPos, setDetailBook, syncShelfPillRef]);

  useEffect(() => {
    if (detailBook !== null) return;
    measureStage();
    syncShelfPill();
  }, [detailBook, measureStage, syncShelfPill]);

  useEffect(() => {
    syncShelfPill();
  }, [syncShelfPill]);

  // An old shared link (?track=<title>), or a ?shelf= that names no shelf on the stage, is
  // rewritten once to the filter it resolves to (the URL options replace the history entry).
  useEffect(() => {
    const isClean =
      urlState.track === null && (urlState.shelf === null || urlState.shelf === activeShelfSlug);
    if (!isClean) void setUrlState({ shelf: activeShelfSlug, track: null });
  }, [urlState.track, urlState.shelf, activeShelfSlug, setUrlState]);

  const { isDragging, handleStagePointerDown, handleStagePointerMove, finishDrag } =
    useBookshelfNavigation({
      stageRef,
      shelfRef,
      cursorRef,
      motion,
      finePointer,
      detailOpen: detailBook !== null,
      mapOpen,
      bookCount,
      activeShelfSlug,
      statusFilter,
      bookAt,
      openDetail,
      closeDetail,
      onUpdateUrlFilter: (patch) => void setUrlState({ ...patch, track: null }),
    });

  /**
   * A shelf chip sets the shelf filter and jumps to the shelf's first book that matches the
   * status filter (else its first book). The stage stays where it is when the book on stage is
   * already on that shelf and matches the status filter: only the highlight changes. "All"
   * (null) clears the filter without moving. Focus stays on the chip; the live region announces
   * the book the jump lands on.
   */
  const handleShelfClick = (slug: string | null): void => {
    void setUrlState({ shelf: slug, track: null });
    if (slug === null) return;
    if (matchesFilter(activeBook, slug, statusFilter)) return;
    const firstMatch = books.findIndex((book) => matchesFilter(book, slug, statusFilter));
    const target =
      firstMatch >= 0 ? firstMatch : books.findIndex((book) => book.shelfSlug === slug);
    if (target >= 0) jumpTo(target);
  };

  const handleStatusClick = (nextStatus: BookStatusFilter, scrollToStage = false): void => {
    let clearShelf = false;
    if (nextStatus !== 'all') {
      const firstMatch = books.findIndex((book) =>
        matchesFilter(book, activeShelfSlug, nextStatus),
      );
      if (firstMatch >= 0) {
        jumpTo(firstMatch);
      } else if (activeShelfSlug !== null) {
        const anyWithStatus = books.findIndex((book) => book.status === nextStatus);
        if (anyWithStatus >= 0) {
          clearShelf = true;
          jumpTo(anyWithStatus);
        }
      }
    }
    void setUrlState(
      clearShelf ? { status: nextStatus, shelf: null, track: null } : { status: nextStatus },
    );
    if (scrollToStage && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  };

  const matchingFilterCount = useMemo(() => {
    if (activeShelfSlug === null && statusFilter === 'all') return bookCount;
    return books.filter((book) => matchesFilter(book, activeShelfSlug, statusFilter)).length;
  }, [books, bookCount, activeShelfSlug, statusFilter]);

  if (detailBook) {
    const { prev, next } = neighborsOf(books, indexBySlug.get(detailBook.slug) ?? pos);
    return (
      <BookDetailView
        book={detailBook}
        prev={prev}
        next={next}
        mapBooks={mapBooks}
        shelves={shelves}
        entering
        onBack={() => closeDetail()}
        onNavigateBook={openDetailBySlug}
      />
    );
  }

  return (
    <PageShell
      sizing="container"
      eyebrow={activeShelf ? 'Shelf collection' : 'Reading'}
      title={activeShelf ? activeShelf.title : 'Bookshelf'}
      description={activeShelf ? activeShelf.description : catalogDescription}
      stats={<StatStrip aria-label="Bookshelf summary" items={statItems} sizing="container" />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {activeShelf && (
            <Link href="/bookshelf" prefetch={false} className={headerActionClass('wide', true)}>
              <FiArrowLeft className="size-4" aria-hidden="true" />
              All shelves
            </Link>
          )}
          <Link
            href="/bookshelf/free"
            prefetch={false}
            className={headerActionClass('tight', true)}
          >
            <FiBookOpen className="size-3.5" aria-hidden="true" />
            Free library
          </Link>
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className={headerActionClass('tight', false)}
          >
            <FiMap className="size-3.5" aria-hidden="true" />
            Reading map
          </button>
        </div>
      }
      className="pb-16"
    >
      <div
        className={cn(styles['shelf-shell'], isFiniteShelf && styles['shelf-focused'])}
        style={{ '--shelf-dur': `${stepDuration}ms` } as CSSProperties}
      >
        <BookshelfFiltersBar
          showShelves={!activeShelf && shelfTabs.length > 1}
          shelfTabs={shelfTabs}
          allCount={bookCount}
          activeShelf={activeShelfTab}
          locationShelfSlug={locationShelfSlug}
          shelfPill={shelfPill}
          chipRefs={chipRefs}
          onSelectShelf={handleShelfClick}
          statusFilter={statusFilter}
          statusCounts={statusCounts}
          onSelectStatus={(status) => handleStatusClick(status)}
          matchingFilterCount={matchingFilterCount}
          onResetFilters={() => void setUrlState({ shelf: null, track: null, status: 'all' })}
        />

        {/* Borderless 3D Shelf Stage */}
        {/* biome-ignore lint/a11y/useSemanticElements: Interactive 3D carousel stage follows ARIA carousel pattern. */}
        <div
          ref={stageRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Bookshelf. Drag, scroll, or use left and right arrow keys to browse, Enter to open."
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Carousel viewport is focusable for keyboard navigation.
          tabIndex={0}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={(event) => finishDrag(event, false)}
          onPointerCancel={(event) => finishDrag(event, true)}
          className={cn(
            styles.stage,
            isDragging && styles['stage-dragging'],
            finePointer && styles['custom-cursor'],
          )}
        >
          <div ref={shelfRef} className={cn(styles.shelf, isDragging && styles['shelf-dragging'])}>
            {poolSlots.map((slot) => {
              const isActive = slot.offset === 0;
              const { book } = slot;
              const hasFilter = activeShelfSlug !== null || statusFilter !== 'all';
              const isHighlighted = hasFilter && matchesFilter(book, activeShelfSlug, statusFilter);
              const isDimmed = hasFilter && !isHighlighted;

              return (
                <BookshelfBookSlot
                  key={slot.poolIndex}
                  poolIndex={slot.poolIndex}
                  offset={slot.offset}
                  x={slotOffsetFactor(slot.offset, isFiniteShelf)}
                  book={book}
                  isActive={isActive}
                  isHighlighted={isHighlighted}
                  isDimmed={isDimmed}
                  registerRef={registerSlotRef}
                />
              );
            })}
          </div>
        </div>

        <BookshelfControlsBar
          isSingleShelf={Boolean(activeShelf)}
          isFiniteShelf={isFiniteShelf}
          pos={pos}
          displayIndex={wrapIndex(pos, bookCount)}
          bookCount={bookCount}
          activeBook={activeBook}
          onOpenDetail={(book) => openDetail(book)}
          onStep={(delta) => step(delta)}
        />

        {!activeShelf && shelves.length > 0 && (
          <ShelfCardsGrid
            shelves={shelves}
            books={books}
            highlightedShelfSlug={activeShelfSlug}
            activeStatus={statusFilter}
            groupBy={shelfGroupBy}
            onGroupByChange={(next) => {
              void setUrlState({ group: next });
            }}
            onSelectStatus={(status) => handleStatusClick(status, true)}
          />
        )}

        {!activeShelf && <FreeLibraryDirectoryCard />}
      </div>

      <div ref={cursorRef} aria-hidden="true" className={styles['cursor-layer']}>
        <div className={styles['cursor-ring']}>
          <span className={styles['cursor-label']}>Open</span>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {activeShelf ? formatStageLabel(wrapIndex(pos, bookCount) + 1) : activeBook.stageLabel} of{' '}
        {bookCount}: {activeBook.title}
      </p>

      <ReadingMapDialog
        open={mapOpen}
        activeSlug={activeBook.slug}
        books={mapBooks}
        shelves={shelves}
        onClose={() => setMapOpen(false)}
        onSelectBook={(entry: ReadingMapEntry) => {
          const idx = indexBySlug.get(entry.slug);
          if (idx !== undefined) jumpTo(idx);
        }}
        onOpenBook={(entry: ReadingMapEntry) => openDetailBySlug(entry.slug)}
      />
    </PageShell>
  );
}
