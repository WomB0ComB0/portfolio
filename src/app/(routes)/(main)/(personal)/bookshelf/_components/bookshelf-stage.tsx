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
import { StatStrip, type StatStripItem } from '@/components/console/stat-strip';
import { BOOKSHELF_URL_OPTIONS, bookshelfSearchParsers } from '@/lib/books/bookshelf-search-params';
import { prefersReducedMotion } from '@/lib/design/motion';
import { cn } from '@/lib/utils';
import {
  BOOKS,
  type BookCategory,
  type BookItem,
  type BookStatusFilter,
  DEFAULT_BOOK_INDEX,
  DEFAULT_SHELVES,
  type ShelfCollection,
  slugifyShelf,
} from '../_lib/books';
import { BookDetailView } from './book-detail-view';
import styles from './bookshelf.module.css';
import { BookshelfBookSlot } from './bookshelf-book-slot';
import { BookshelfControlsBar, FreeLibraryDirectoryCard } from './bookshelf-controls-bar';
import { BookshelfFiltersBar, type TabIndicatorState } from './bookshelf-filters-bar';
import { ReadingMapDialog } from './reading-map-dialog';
import { ShelfCardsGrid } from './shelf-cards-grid';
import { useBookshelfNavigation } from './use-bookshelf-navigation';

export interface BookshelfStageProps {
  /** Optional initial book slug (e.g. from `?book=<slug>` when returning from a detail route). */
  readonly initialSlug?: string;
  /** Dynamic books list from Sanity (falls back to built-in catalog when omitted). */
  readonly books?: readonly BookItem[];
  /** Dynamic separated shelf collections from Sanity (falls back to built-in shelves). */
  readonly shelves?: readonly ShelfCollection[];
  /** When set, renders a focused single-shelf view (`/bookshelf/shelf/[shelfSlug]`). */
  readonly activeShelf?: ShelfCollection;
}

const DEFAULT_BOOK_HEIGHT = 360;
const STEP_DURATION_MS = 400;
const CHAIN_STEP_DURATION_MS = 220;
const CHAIN_TICK_MS = 55;

const mod = (a: number, n: number): number => ((a % n) + n) % n;
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

interface PoolSlot {
  readonly poolIndex: number;
  readonly slotPosition: number;
  readonly offset: number;
  readonly book: BookItem;
}

/**
 * Interactive 3D Bookshelf orchestrator built natively inside Live Console `<PageShell>`.
 * Delegates filter chrome (`BookshelfFiltersBar`), 3D cuboid slots (`BookshelfBookSlot`),
 * wheel/keyboard/drag/cursor physics (`useBookshelfNavigation`), and readout controls
 * (`BookshelfControlsBar`) to isolated sub-modules.
 */
export function BookshelfStage({
  initialSlug,
  books = BOOKS,
  shelves = DEFAULT_SHELVES,
  activeShelf,
}: BookshelfStageProps): ReactElement {
  const safeBooks = books.length > 0 ? books : BOOKS;
  const bookCount = safeBooks.length;
  const isFiniteShelf = Boolean(activeShelf) || bookCount < 9;

  const bookAt = useCallback(
    (index: number): BookItem => {
      const idx = isFiniteShelf ? clamp(index, 0, bookCount - 1) : mod(index, bookCount);
      return safeBooks[idx] ?? safeBooks[0] ?? BOOKS[0];
    },
    [safeBooks, bookCount, isFiniteShelf],
  );

  const [urlState, setUrlState] = useQueryStates(bookshelfSearchParsers, BOOKSHELF_URL_OPTIONS);
  const resolvedInitialSlug = urlState.book ?? initialSlug;

  const initialPos = useMemo(() => {
    if (resolvedInitialSlug) {
      const found = safeBooks.findIndex((book) => book.slug === resolvedInitialSlug);
      if (found >= 0) return found;
    }
    if (isFiniteShelf) return 0;
    return Math.min(DEFAULT_BOOK_INDEX, bookCount - 1);
  }, [resolvedInitialSlug, safeBooks, bookCount, isFiniteShelf]);

  const [pos, setPos] = useState<number>(initialPos);
  const [bookHeight, setBookHeight] = useState<number>(DEFAULT_BOOK_HEIGHT);
  const [halfWindow, setHalfWindow] = useState<number>(5);
  const [stepDuration, setStepDuration] = useState<number>(STEP_DURATION_MS);
  const [mapOpen, setMapOpen] = useState(false);
  const [finePointer, setFinePointer] = useState(false);
  const [detailBook, setDetailBook] = useState<BookItem | null>(null);
  const [tabIndicator, setTabIndicator] = useState<TabIndicatorState>({
    left: 0,
    top: 0,
    width: 0,
    height: 32,
    ready: false,
  });

  const validTrackSet = useMemo(() => new Set(safeBooks.map((book) => book.track)), [safeBooks]);
  const highlightedTrack: string | null =
    urlState.track && validTrackSet.has(urlState.track) ? urlState.track : null;
  const statusFilter: BookStatusFilter = urlState.status;
  const shelfGroupBy = urlState.group;

  const stageRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Map<BookCategory, HTMLButtonElement>>(new Map());
  const slotElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const prevSlotPositionsRef = useRef<Map<number, number>>(new Map());

  const posRef = useRef<number>(pos);
  posRef.current = pos;
  const bookHeightRef = useRef<number>(bookHeight);
  bookHeightRef.current = bookHeight;
  const detailOpenRef = useRef<boolean>(false);
  detailOpenRef.current = detailBook !== null;
  const chainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStepRef = useRef<number>(0);

  const activeBook = bookAt(pos);

  const categories = useMemo<readonly BookCategory[]>(() => {
    const seen = new Set<string>();
    const tracks: string[] = [];
    for (const book of safeBooks) {
      if (!seen.has(book.track)) {
        seen.add(book.track);
        tracks.push(book.track);
      }
    }
    return ['All', ...tracks];
  }, [safeBooks]);

  const categoryCounts = useMemo<Readonly<Record<string, number>>>(() => {
    const counts: Record<string, number> = { All: bookCount };
    for (const book of safeBooks) {
      counts[book.track] = (counts[book.track] ?? 0) + 1;
    }
    return counts;
  }, [safeBooks, bookCount]);

  const statusCounts = useMemo<Readonly<Record<BookStatusFilter, number>>>(() => {
    const counts: Record<BookStatusFilter, number> = {
      all: bookCount,
      completed: 0,
      reading: 0,
      queued: 0,
    };
    for (const book of safeBooks) {
      counts[book.status] += 1;
    }
    return counts;
  }, [safeBooks, bookCount]);

  const totalTopics = useMemo(
    () => safeBooks.reduce((sum, book) => sum + book.topics.length, 0),
    [safeBooks],
  );

  const statItems = useMemo<readonly StatStripItem[]>(
    () =>
      activeShelf
        ? [
            { label: bookCount === 1 ? 'book' : 'books', value: bookCount },
            { label: 'read', value: statusCounts.completed },
            { label: 'topics', value: totalTopics },
          ]
        : [
            { label: 'books', value: bookCount },
            { label: 'read', value: statusCounts.completed },
            { label: shelves.length === 1 ? 'shelf' : 'shelves', value: shelves.length },
            { label: 'topics', value: totalTopics },
          ],
    [activeShelf, bookCount, statusCounts.completed, shelves.length, totalTopics],
  );

  const activeTabCategory: BookCategory = highlightedTrack ?? activeBook.track;
  const poolSize = isFiniteShelf ? bookCount : 2 * halfWindow + 1;

  const highlightedShelfSlug = useMemo(() => {
    if (!highlightedTrack) return null;
    const match = shelves.find(
      (shelf) =>
        shelf.title.toLowerCase() === highlightedTrack.toLowerCase() ||
        shelf.slug === slugifyShelf(highlightedTrack),
    );
    return match?.slug ?? null;
  }, [highlightedTrack, shelves]);

  const measureStage = useCallback((): void => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const sw = stageEl.clientWidth || window.innerWidth;
    const sh = stageEl.clientHeight || 390;
    const nextH = Math.round(Math.max(220, Math.min(sh * 0.84, 410, sw * 0.88)));
    const x1 = nextH * 0.5;
    const pitch = nextH * 0.18;
    const nextK = Math.max(3, Math.ceil((sw / 2 - x1) / pitch) + 2);
    setBookHeight(nextH);
    setHalfWindow(nextK);
  }, []);

  const syncTabIndicator = useCallback((): void => {
    const activeBtn = tabButtonRefs.current.get(activeTabCategory);
    if (!activeBtn) return;
    setTabIndicator((prev) => ({
      left: activeBtn.offsetLeft,
      top: activeBtn.offsetTop,
      width: activeBtn.offsetWidth,
      height: activeBtn.offsetHeight || 32,
      ready: prev.ready || activeBtn.offsetWidth > 0,
    }));
  }, [activeTabCategory]);

  const syncTabIndicatorRef = useRef<() => void>(syncTabIndicator);
  syncTabIndicatorRef.current = syncTabIndicator;

  const slotX = useCallback(
    (offset: number): number => {
      if (offset === 0) return 0;
      const x1 = bookHeight * (isFiniteShelf ? 0.53 : 0.515);
      const pitch = bookHeight * (isFiniteShelf ? 0.205 : 0.19);
      return Math.sign(offset) * (x1 + (Math.abs(offset) - 1) * pitch);
    },
    [bookHeight, isFiniteShelf],
  );

  // Fixed ascending `poolIndex` order (`0..poolSize-1`) prevents DOM reordering during transitions.
  const poolSlots = useMemo<readonly PoolSlot[]>(() => {
    if (isFiniteShelf) {
      return safeBooks.map((book, index) => ({
        poolIndex: index,
        slotPosition: index,
        offset: index - pos,
        book,
      }));
    }
    const base = pos - halfWindow;
    const baseMod = mod(base, poolSize);
    const slots: PoolSlot[] = [];
    for (let poolIndex = 0; poolIndex < poolSize; poolIndex += 1) {
      const shift = mod(poolIndex - baseMod, poolSize);
      const slotPosition = base + shift;
      slots.push({
        poolIndex,
        slotPosition,
        offset: slotPosition - pos,
        book: bookAt(slotPosition),
      });
    }
    return slots;
  }, [isFiniteShelf, safeBooks, pos, halfWindow, poolSize, bookAt]);

  const registerSlotRef = useCallback((poolIndex: number, el: HTMLDivElement | null): void => {
    if (el) slotElementsRef.current.set(poolIndex, el);
    else slotElementsRef.current.delete(poolIndex);
  }, []);

  useLayoutEffect(() => {
    if (detailBook !== null) return;
    const noAnimClass = styles['no-anim'] ?? '';
    const activeClass = styles['is-active'] ?? '';
    const beforeClass = styles['is-before'] ?? '';
    const afterClass = styles['is-after'] ?? '';
    const dimmedClass = styles['is-dimmed'] ?? '';
    const highlightedClass = styles['is-highlighted'] ?? '';

    const teleported: HTMLDivElement[] = [];

    for (const slot of poolSlots) {
      const el = slotElementsRef.current.get(slot.poolIndex);
      if (!el) continue;

      const prevSlot = prevSlotPositionsRef.current.get(slot.poolIndex);
      const isFresh = prevSlot === undefined || prevSlot !== slot.slotPosition;
      prevSlotPositionsRef.current.set(slot.poolIndex, slot.slotPosition);

      if (isFresh && noAnimClass) {
        el.classList.add(noAnimClass);
        teleported.push(el);
      }

      const hasFilter = highlightedTrack !== null || statusFilter !== 'all';
      const matchesTrack = highlightedTrack === null || slot.book.track === highlightedTrack;
      const matchesStatus = statusFilter === 'all' || slot.book.status === statusFilter;
      const matchesHighlight = hasFilter && matchesTrack && matchesStatus;
      const isDimmed = hasFilter && !matchesHighlight;

      if (activeClass) el.classList.toggle(activeClass, slot.offset === 0);
      if (beforeClass) el.classList.toggle(beforeClass, slot.offset < 0);
      if (afterClass) el.classList.toggle(afterClass, slot.offset > 0);
      if (highlightedClass) el.classList.toggle(highlightedClass, matchesHighlight);
      if (dimmedClass) el.classList.toggle(dimmedClass, isDimmed);

      el.style.setProperty('--slot-x', `${slotX(slot.offset).toFixed(2)}px`);
      el.style.zIndex = String(100 - Math.abs(slot.offset));
    }

    if (teleported.length > 0) {
      void shelfRef.current?.offsetWidth;
      for (const el of teleported) {
        if (noAnimClass) el.classList.remove(noAnimClass);
      }
    }
  }, [poolSlots, slotX, detailBook, highlightedTrack, statusFilter]);

  const step = useCallback(
    (dir: number, dur = STEP_DURATION_MS): void => {
      setStepDuration(prefersReducedMotion() ? 0 : dur);
      lastStepRef.current = performance.now();
      setPos((current) => (isFiniteShelf ? clamp(current + dir, 0, bookCount - 1) : current + dir));
    },
    [isFiniteShelf, bookCount],
  );

  const stepBy = useCallback(
    (delta: number): void => {
      if (chainTimerRef.current) {
        clearTimeout(chainTimerRef.current);
        chainTimerRef.current = null;
      }
      if (!delta) return;
      const dir = Math.sign(delta);
      let left = Math.abs(delta);
      if (left === 1) {
        step(dir, STEP_DURATION_MS);
        return;
      }
      const tick = (): void => {
        left -= 1;
        step(dir, left > 0 ? CHAIN_STEP_DURATION_MS : STEP_DURATION_MS);
        if (left > 0) {
          chainTimerRef.current = setTimeout(tick, CHAIN_TICK_MS);
        }
      };
      tick();
    },
    [step],
  );

  const goToBookIndex = useCallback(
    (targetIndex: number): void => {
      if (isFiniteShelf) {
        stepBy(clamp(targetIndex, 0, bookCount - 1) - posRef.current);
        return;
      }
      let delta = mod(targetIndex - mod(posRef.current, bookCount), bookCount);
      if (delta > bookCount / 2) delta -= bookCount;
      stepBy(delta);
    },
    [isFiniteShelf, bookCount, stepBy],
  );

  const stageIndexFromHash = useCallback((): number => {
    if (typeof window === 'undefined') return -1;
    const match = /^#\/stage\/(\d+)/.exec(window.location.hash);
    if (!match?.[1]) return -1;
    const label = match[1].padStart(2, '0');
    return safeBooks.findIndex((book) => book.stageLabel === label);
  }, [safeBooks]);

  const openDetail = useCallback(
    (book: BookItem, { push = true } = {}): void => {
      const idx = safeBooks.findIndex((item) => item.slug === book.slug);
      if (idx >= 0) setPos(idx);
      setDetailBook(book);
      if (push && typeof window !== 'undefined') {
        const nextHash = `#/stage/${book.stageLabel}`;
        if (window.location.hash !== nextHash) {
          window.history.pushState(
            { stage: book.stageLabel },
            '',
            `${window.location.pathname}${window.location.search}${nextHash}`,
          );
        }
      }
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    },
    [safeBooks],
  );

  const closeDetail = useCallback(({ fromPop = false } = {}): void => {
    if (!fromPop && typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    prevSlotPositionsRef.current.clear();
    setDetailBook(null);
  }, []);

  useEffect(() => {
    measureStage();
    const isFine =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;
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
        syncTabIndicatorRef.current();
      }, 100);
    };
    window.addEventListener('resize', onResize);
    void document.fonts?.ready.then(() => syncTabIndicatorRef.current());
    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [measureStage, stageIndexFromHash, bookAt]);

  useEffect(() => {
    return () => {
      if (chainTimerRef.current) clearTimeout(chainTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (detailBook !== null) return;
    measureStage();
    syncTabIndicator();
  }, [detailBook, measureStage, syncTabIndicator]);

  useEffect(() => {
    syncTabIndicator();
  }, [syncTabIndicator]);

  useEffect(() => {
    const onPopState = (): void => {
      const idx = stageIndexFromHash();
      if (idx < 0) {
        closeDetail({ fromPop: true });
      } else {
        setPos(idx);
        setDetailBook(bookAt(idx));
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [closeDetail, stageIndexFromHash, bookAt]);

  const { isDragging, handleStagePointerDown, handleStagePointerMove, finishDrag } =
    useBookshelfNavigation({
      stageRef,
      shelfRef,
      cursorRef,
      posRef,
      bookHeightRef,
      detailOpenRef,
      chainTimerRef,
      lastStepRef,
      finePointer,
      detailOpen: detailBook !== null,
      mapOpen,
      bookCount,
      highlightedTrack,
      statusFilter,
      bookAt,
      step,
      stepBy,
      goToBookIndex,
      openDetail,
      closeDetail,
      onUpdateUrlFilter: (patch) => void setUrlState(patch),
    });

  const handleTabClick = (category: BookCategory): void => {
    if (category === 'All') {
      void setUrlState({ track: null });
      return;
    }
    void setUrlState({ track: category });
    const firstMatch = safeBooks.findIndex(
      (book) => book.track === category && (statusFilter === 'all' || book.status === statusFilter),
    );
    const fallbackInTrack =
      firstMatch >= 0 ? firstMatch : safeBooks.findIndex((book) => book.track === category);
    if (fallbackInTrack >= 0) {
      goToBookIndex(fallbackInTrack);
    }
  };

  const handleStatusClick = (nextStatus: BookStatusFilter, scrollToStage = false): void => {
    let clearTrack = false;
    if (nextStatus !== 'all') {
      const firstMatch = safeBooks.findIndex(
        (book) =>
          book.status === nextStatus &&
          (highlightedTrack === null || book.track === highlightedTrack),
      );
      if (firstMatch >= 0) {
        goToBookIndex(firstMatch);
      } else if (highlightedTrack !== null) {
        const anyWithStatus = safeBooks.findIndex((book) => book.status === nextStatus);
        if (anyWithStatus >= 0) {
          clearTrack = true;
          goToBookIndex(anyWithStatus);
        }
      }
    }
    void setUrlState(clearTrack ? { status: nextStatus, track: null } : { status: nextStatus });
    if (scrollToStage && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  };

  const matchingFilterCount = useMemo(() => {
    if (highlightedTrack === null && statusFilter === 'all') return bookCount;
    return safeBooks.filter(
      (book) =>
        (highlightedTrack === null || book.track === highlightedTrack) &&
        (statusFilter === 'all' || book.status === statusFilter),
    ).length;
  }, [safeBooks, bookCount, highlightedTrack, statusFilter]);

  if (detailBook) {
    return (
      <BookDetailView
        book={detailBook}
        books={safeBooks}
        shelves={shelves}
        entering
        onBack={() => closeDetail()}
        onNavigateBook={(book) => openDetail(book)}
      />
    );
  }

  return (
    <PageShell
      sizing="container"
      eyebrow={activeShelf ? 'Shelf collection' : 'Reading'}
      title={activeShelf ? activeShelf.title : 'Bookshelf'}
      description={
        activeShelf
          ? activeShelf.description
          : 'Foundational books across computer systems, backend architecture, AI, philosophy, psychology, society, economics, and political power.'
      }
      stats={<StatStrip aria-label="Bookshelf summary" items={statItems} sizing="container" />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {activeShelf && (
            <Link
              href="/bookshelf"
              prefetch={false}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground no-underline transition-colors hover:border-hairline-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
            >
              <FiArrowLeft className="size-4" aria-hidden="true" />
              All shelves
            </Link>
          )}
          <Link
            href="/bookshelf/free"
            prefetch={false}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground no-underline transition-colors hover:border-hairline-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
          >
            <FiBookOpen className="size-3.5" aria-hidden="true" />
            Free library
          </Link>
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground transition-colors hover:border-hairline-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
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
        style={
          {
            '--book-h': `${bookHeight}px`,
            '--shelf-dur': `${stepDuration}ms`,
          } as CSSProperties
        }
      >
        <BookshelfFiltersBar
          showCategories={!activeShelf && categories.length > 2}
          categories={categories}
          categoryCounts={categoryCounts}
          highlightedTrack={highlightedTrack}
          activeTabCategory={activeTabCategory}
          tabIndicator={tabIndicator}
          tabButtonRefs={tabButtonRefs}
          onSelectCategory={handleTabClick}
          statusFilter={statusFilter}
          statusCounts={statusCounts}
          onSelectStatus={(status) => handleStatusClick(status)}
          highlightedShelfSlug={highlightedShelfSlug}
          matchingFilterCount={matchingFilterCount}
          onResetFilters={() => void setUrlState({ track: null, status: 'all' })}
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
              const hasFilter = highlightedTrack !== null || statusFilter !== 'all';
              const matchesTrack = highlightedTrack === null || book.track === highlightedTrack;
              const matchesStatus = statusFilter === 'all' || book.status === statusFilter;
              const isHighlighted = hasFilter && matchesTrack && matchesStatus;
              const isDimmed = hasFilter && !isHighlighted;

              return (
                <BookshelfBookSlot
                  key={slot.poolIndex}
                  poolIndex={slot.poolIndex}
                  offset={slot.offset}
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
          displayIndex={mod(pos, bookCount)}
          bookCount={bookCount}
          activeBook={activeBook}
          onOpenDetail={(book) => openDetail(book)}
          onStep={(delta) => step(delta)}
        />

        {!activeShelf && shelves.length > 0 && (
          <ShelfCardsGrid
            shelves={shelves}
            books={safeBooks}
            highlightedSection={highlightedTrack}
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
        {activeShelf ? String(mod(pos, bookCount) + 1).padStart(2, '0') : activeBook.stageLabel} of{' '}
        {bookCount}: {activeBook.title}
      </p>

      <ReadingMapDialog
        open={mapOpen}
        activeSlug={activeBook.slug}
        books={safeBooks}
        shelves={shelves}
        onClose={() => setMapOpen(false)}
        onSelectBook={(book) => {
          const idx = safeBooks.findIndex((item) => item.slug === book.slug);
          if (idx >= 0) goToBookIndex(idx);
        }}
        onOpenBook={(book) => openDetail(book)}
      />
    </PageShell>
  );
}
