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
import { prefersReducedMotion } from '@/lib/design/motion';
import { cn } from '@/lib/utils';
import {
  type BookItem,
  DEFAULT_BOOK_INDEX,
  neighborsOf,
  type ReadingMapEntry,
  type ShelfCollection,
  toReadingMapEntry,
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
import { BookDetailView } from './book-detail-view';
import styles from './bookshelf.module.css';
import { BookshelfBookSlot, slotOffsetFactor } from './bookshelf-book-slot';
import { BookshelfControlsBar, FreeLibraryDirectoryCard } from './bookshelf-controls-bar';
import {
  BookshelfFiltersBar,
  measureShelfPill,
  revealShelfChip,
  type ShelfPillState,
  sameShelfPillClip,
  trackEdgeFadePx,
} from './bookshelf-filters-bar';
import { ReadingMapDialog } from './reading-map-dialog';
import { ShelfCardsGrid } from './shelf-cards-grid';
import { useBookshelfNavigation } from './use-bookshelf-navigation';

export interface BookshelfStageProps {
  /** Optional initial book slug (e.g. from `?book=<slug>` when returning from a detail route). */
  readonly initialSlug?: string;
  /**
   * The books to shelve, in stage order: the whole catalog, or one shelf's books. Never empty: the
   * server page renders the empty state instead of this island when there are none.
   */
  readonly books: readonly [BookItem, ...BookItem[]];
  /**
   * The shelves of `books`, in shelf order (the shelf cards and the reading map): every shelf on
   * /bookshelf, only `activeShelf` on a shelf's page.
   */
  readonly shelves: readonly ShelfCollection[];
  /** When set, renders a focused single-shelf view (`/bookshelf/shelf/[shelfSlug]`). */
  readonly activeShelf?: ShelfCollection;
}

/**
 * The book height drags and the jump fade move by until the first measurement. It is never
 * painted: the stage's CSS sizes the books (--book-h on .shelf-shell, the same formula as
 * measureStage), so the server's HTML is laid out as the browser's.
 */
const DEFAULT_BOOK_HEIGHT = 360;
const STEP_DURATION_MS = 400;
const CHAIN_STEP_DURATION_MS = 220;
const CHAIN_TICK_MS = 55;
/**
 * The longest jump that slides as one step: measureStage keeps two to three slots off screen on
 * each side (measured at stage widths of 328-1568 px), so a slide of up to two books never shows
 * a recycled slot crossing the stage.
 */
const JUMP_SLIDE_MAX = 2;
/** A longer jump teleports every slot, then fades the shelf in over this long. */
const JUMP_IN_MS = 220;
/** The fade-in's easing: the shelf's --shelf-ease-out (bookshelf.module.css). */
const JUMP_IN_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** How far the shelf slides in from the side it travels toward, in book heights: one slot pitch. */
const JUMP_IN_SHIFT = 0.19;
/** The shelf pill before its first measurement: no clip, so hidden, and placed without a slide. */
const UNMEASURED_PILL: ShelfPillState = { clip: null, animate: false };

const mod = (a: number, n: number): number => ((a % n) + n) % n;
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

interface PoolSlot {
  readonly poolIndex: number;
  readonly slotPosition: number;
  readonly offset: number;
  readonly book: BookItem;
}

/** A jump waiting for its commit: the position it lands on, and the side it travels toward. */
interface PendingJump {
  readonly pos: number;
  /** -1 or 1; 0 lands with no fade (reduced motion). */
  readonly dir: number;
}

/** "A", "A and B", or "A, B, and C". Plain joins, so the server and browser render the same text. */
function listTitles(titles: readonly string[]): string {
  if (titles.length <= 2) return titles.join(' and ');
  return `${titles.slice(0, -1).join(', ')}, and ${titles.at(-1)}`;
}

/** The whole shelf's description: its shelves' titles in shelf order, never a fixed subject list. */
function describeShelves(shelves: readonly ShelfCollection[]): string {
  return shelves.length === 0
    ? 'Foundational books, shelf by shelf.'
    : `Foundational books across ${listTitles(shelves.map((shelf) => shelf.title))}.`;
}

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
  const isFiniteShelf = Boolean(activeShelf) || bookCount < 9;

  const bookAt = useCallback(
    (index: number): BookItem => {
      const idx = isFiniteShelf ? clamp(index, 0, bookCount - 1) : mod(index, bookCount);
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

  const [pos, setPos] = useState<number>(initialPos);
  const [halfWindow, setHalfWindow] = useState<number>(5);
  const [stepDuration, setStepDuration] = useState<number>(STEP_DURATION_MS);
  const [mapOpen, setMapOpen] = useState(false);
  const [finePointer, setFinePointer] = useState(false);
  const [detailBook, setDetailBook] = useState<BookItem | null>(null);
  const [shelfPill, setShelfPill] = useState<ShelfPillState>(UNMEASURED_PILL);

  // A shelf's slug is its filter's identity; its title is only the chip's label.
  const shelfTabs = useMemo(() => buildShelfTabs(books), [books]);
  const mapBooks = useMemo(() => books.map(toReadingMapEntry), [books]);
  const indexBySlug = useMemo(
    () => new Map(books.map((book, index) => [book.slug, index] as const)),
    [books],
  );
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
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const slotElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const prevSlotPositionsRef = useRef<Map<number, number>>(new Map());

  const posRef = useRef<number>(pos);
  posRef.current = pos;
  const bookHeightRef = useRef<number>(DEFAULT_BOOK_HEIGHT);
  const detailOpenRef = useRef<boolean>(false);
  detailOpenRef.current = detailBook !== null;
  const chainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStepRef = useRef<number>(0);
  const pendingJumpRef = useRef<PendingJump | null>(null);
  const jumpAnimRef = useRef<Animation | null>(null);

  const activeBook = bookAt(pos);

  const statusCounts = useMemo(() => countStatuses(books), [books]);

  const totalTopics = useMemo(
    () => books.reduce((sum, book) => sum + book.topics.length, 0),
    [books],
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

  // Where the pill sits: the filtered shelf, else the shelf of the book on stage.
  const locationShelfSlug = activeShelfSlug ?? activeBook.shelfSlug;
  const poolSize = isFiniteShelf ? bookCount : 2 * halfWindow + 1;

  // Derived from the shelves, so the copy never drifts from what Studio holds.
  const catalogDescription = useMemo(() => describeShelves(shelves), [shelves]);

  /**
   * Measures the stage: the pool size (halfWindow), and the book height drags and the jump fade
   * move by. Nothing painted reads it: the books are sized by the CSS --book-h on .shelf-shell,
   * this same nextH unrounded, so they never resize after hydration.
   */
  const measureStage = useCallback((): void => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const sw = stageEl.clientWidth || window.innerWidth;
    const sh = stageEl.clientHeight || 390;
    const nextH = Math.round(Math.max(220, Math.min(sh * 0.84, 410, sw * 0.88)));
    const x1 = nextH * 0.5;
    const pitch = nextH * 0.18;
    const nextK = Math.max(3, Math.ceil((sw / 2 - x1) / pitch) + 2);
    bookHeightRef.current = nextH;
    setHalfWindow(nextK);
  }, []);

  /**
   * Clips the shelf pill to the current chip and keeps that chip in view in a chip row that
   * scrolls, by scrolling the row alone (revealShelfChip): never scrollIntoView, which would also
   * scroll the page when the reader is further down it.
   */
  const syncShelfPill = useCallback((): void => {
    const chip = chipRefs.current.get(locationShelfSlug);
    const bar = chip?.parentElement;
    if (!chip || !bar) return;
    const clip = measureShelfPill(bar, chip);
    setShelfPill((prev) =>
      prev.clip !== null && sameShelfPillClip(prev.clip, clip) ? prev : { ...prev, clip },
    );
    revealShelfChip(bar, chip, trackEdgeFadePx(bar));
  }, [locationShelfSlug]);

  const syncShelfPillRef = useRef<() => void>(syncShelfPill);
  syncShelfPillRef.current = syncShelfPill;

  // The pill's first placement lands at once (.no-anim): its clip is committed to style here,
  // before transitions come on, so it never slides in from the row's start. It slides after that.
  useLayoutEffect(() => {
    if (shelfPill.clip === null || shelfPill.animate) return;
    const pill = chipRefs.current.get(locationShelfSlug)?.parentElement?.firstElementChild;
    if (pill) void getComputedStyle(pill).clipPath;
    setShelfPill((prev) => (prev.animate ? prev : { ...prev, animate: true }));
  }, [shelfPill, locationShelfSlug]);

  // Fixed ascending `poolIndex` order (`0..poolSize-1`) prevents DOM reordering during transitions.
  const poolSlots = useMemo<readonly PoolSlot[]>(() => {
    if (isFiniteShelf) {
      return books.map((book, index) => ({
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
  }, [isFiniteShelf, books, pos, halfWindow, poolSize, bookAt]);

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
    const noAnimClass = styles['no-anim'] ?? '';

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
      // Position (--slot-x), z-index and the state classes are rendered from props, server and
      // client; React commits them before this effect, so a teleported slot lands without a
      // transition.
    }

    if (teleported.length > 0) {
      void shelfRef.current?.offsetWidth;
      for (const el of teleported) {
        if (noAnimClass) el.classList.remove(noAnimClass);
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
  }, [poolSlots, detailBook]);

  const step = useCallback(
    (dir: number, dur = STEP_DURATION_MS): void => {
      pendingJumpRef.current = null;
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

  /**
   * Moves the stage to the book at `targetIndex` in ONE move, however far it is (the shorter way
   * round the circular shelf): up to JUMP_SLIDE_MAX books slide as one step; a longer jump
   * teleports every slot and the layout effect fades the shelf in, instantly under reduced
   * motion. One position change, so one announcement in the live region. Shelf chips, status
   * chips, Home/End and the reading map jump; arrow keys, drags and clicks on a visible book step.
   */
  const jumpTo = useCallback(
    (targetIndex: number): void => {
      if (chainTimerRef.current) {
        clearTimeout(chainTimerRef.current);
        chainTimerRef.current = null;
      }
      let delta: number;
      if (isFiniteShelf) {
        delta = clamp(targetIndex, 0, bookCount - 1) - posRef.current;
      } else {
        delta = mod(targetIndex - mod(posRef.current, bookCount), bookCount);
        if (delta > bookCount / 2) delta -= bookCount;
      }
      if (delta === 0) return;
      if (Math.abs(delta) <= JUMP_SLIDE_MAX) {
        step(delta);
        return;
      }
      const reduced = prefersReducedMotion();
      const target = posRef.current + delta;
      pendingJumpRef.current = { pos: target, dir: reduced ? 0 : Math.sign(delta) };
      setStepDuration(reduced ? 0 : STEP_DURATION_MS);
      lastStepRef.current = performance.now();
      setPos(target);
    },
    [isFiniteShelf, bookCount, step],
  );

  const stageIndexFromHash = useCallback((): number => {
    if (typeof window === 'undefined') return -1;
    const match = /^#\/stage\/(\d+)/.exec(window.location.hash);
    if (!match?.[1]) return -1;
    const label = match[1].padStart(2, '0');
    return books.findIndex((book) => book.stageLabel === label);
  }, [books]);

  const openDetail = useCallback(
    (book: BookItem, { push = true } = {}): void => {
      const idx = books.findIndex((item) => item.slug === book.slug);
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
    [books],
  );

  /** Opens the book with this slug (the detail's Previous/Next, the map's Open stage). */
  const openDetailBySlug = useCallback(
    (slug: string): void => {
      const idx = indexBySlug.get(slug);
      const book = idx === undefined ? undefined : books[idx];
      if (book) openDetail(book);
    },
    [indexBySlug, books, openDetail],
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
        syncShelfPillRef.current();
      }, 100);
    };
    window.addEventListener('resize', onResize);
    void document.fonts?.ready.then(() => syncShelfPillRef.current());
    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [measureStage, stageIndexFromHash, bookAt]);

  useEffect(() => {
    return () => {
      if (chainTimerRef.current) clearTimeout(chainTimerRef.current);
      jumpAnimRef.current?.cancel();
    };
  }, []);

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
      jumpAnimRef,
      finePointer,
      detailOpen: detailBook !== null,
      mapOpen,
      bookCount,
      activeShelfSlug,
      statusFilter,
      bookAt,
      step,
      stepBy,
      jumpTo,
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
          displayIndex={mod(pos, bookCount)}
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
        {activeShelf ? String(mod(pos, bookCount) + 1).padStart(2, '0') : activeBook.stageLabel} of{' '}
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
