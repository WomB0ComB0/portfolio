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
import {
  type CSSProperties,
  type PointerEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FiArrowLeft, FiArrowRight, FiArrowUpRight, FiMap } from 'react-icons/fi';
import { PageShell } from '@/components/console/page-shell';
import { StatStrip, type StatStripItem } from '@/components/console/stat-strip';
import { prefersReducedMotion } from '@/lib/design/motion';
import { cn } from '@/lib/utils';
import {
  BOOKS,
  type BookCategory,
  type BookItem,
  DEFAULT_BOOK_INDEX,
  DEFAULT_SHELVES,
  type ShelfCollection,
  slugifyShelf,
} from '../_lib/books';
import { BookDetailView } from './book-detail-view';
import styles from './bookshelf.module.css';
import { ReadingMapDialog } from './reading-map-dialog';
import { ShelfCardsGrid } from './shelf-cards-grid';

export interface BookshelfStageProps {
  /** Optional initial book slug (e.g. from `?book=<slug>` when returning from a detail route). */
  readonly initialSlug?: string;
  /** Dynamic books list from Sanity (falls back to built-in catalog when omitted). */
  readonly books?: readonly BookItem[];
  /** Dynamic separated shelf collections from Sanity (falls back to built-in 4 shelves). */
  readonly shelves?: readonly ShelfCollection[];
  /** When set, renders a focused single-shelf view (`/bookshelf/shelf/[shelfSlug]`). */
  readonly activeShelf?: ShelfCollection;
}

const DEFAULT_BOOK_HEIGHT = 360;
const STEP_DURATION_MS = 400;
const CHAIN_STEP_DURATION_MS = 220;
const CHAIN_TICK_MS = 55;
const WHEEL_THRESHOLD = 20;
const WHEEL_COOLDOWN_MS = 140;
const DRAG_ACTIVATION_PX = 6;

const mod = (a: number, n: number): number => ((a % n) + n) % n;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

interface PoolSlot {
  readonly poolIndex: number;
  readonly slotPosition: number;
  readonly offset: number;
  readonly book: BookItem;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  vx: number;
  residualX: number;
  isDragging: boolean;
  steppedDuringDrag: boolean;
  startTarget: EventTarget | null;
}

/**
 * Interactive 3D Engineering Bookshelf built natively inside Live Console `<PageShell>`:
 * - Supports both the unified multi-section shelf (`/bookshelf` with fanned shelf cards below)
 *   and focused finite single-shelf views (`/bookshelf/shelf/[shelfSlug]`).
 * - Clicking a section pill (`Foundations`, `Backend`, `Infra & Ops`, `AI`, etc.) visually
 *   highlights/spotlights that section's books while dimming out-of-section books.
 * - Fixed ascending `poolIndex` DOM order guarantees identical 60fps CSS 3D cuboid animations in
 *   BOTH left and right directions, plus live 1:1 drag scrubbing and bidirectional wheel scroll.
 */
export function BookshelfStage({
  initialSlug,
  books = BOOKS,
  shelves = DEFAULT_SHELVES,
  activeShelf,
}: BookshelfStageProps): ReactElement {
  const safeBooks = books.length > 0 ? books : BOOKS;
  const bookCount = safeBooks.length;
  // Focused collections or small Sanity lists stay finite (0..N-1) so no book ever duplicates.
  const isFiniteShelf = Boolean(activeShelf) || bookCount < 9;

  const bookAt = useCallback(
    (index: number): BookItem => {
      const idx = isFiniteShelf ? clamp(index, 0, bookCount - 1) : mod(index, bookCount);
      return safeBooks[idx] ?? safeBooks[0] ?? BOOKS[0];
    },
    [safeBooks, bookCount, isFiniteShelf],
  );

  const initialPos = useMemo(() => {
    if (initialSlug) {
      const found = safeBooks.findIndex((book) => book.slug === initialSlug);
      if (found >= 0) return found;
    }
    if (isFiniteShelf) return 0;
    return Math.min(DEFAULT_BOOK_INDEX, bookCount - 1);
  }, [initialSlug, safeBooks, bookCount, isFiniteShelf]);

  const [pos, setPos] = useState<number>(initialPos);
  const [bookHeight, setBookHeight] = useState<number>(DEFAULT_BOOK_HEIGHT);
  const [halfWindow, setHalfWindow] = useState<number>(5);
  const [stepDuration, setStepDuration] = useState<number>(STEP_DURATION_MS);
  const [highlightedTrack, setHighlightedTrack] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [finePointer, setFinePointer] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [detailBook, setDetailBook] = useState<BookItem | null>(null);
  const [tabIndicator, setTabIndicator] = useState<{
    readonly left: number;
    readonly width: number;
    readonly ready: boolean;
  }>({ left: 0, width: 0, ready: false });

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
  const isDraggingRef = useRef<boolean>(false);
  isDraggingRef.current = isDragging;

  const chainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStepRef = useRef<number>(0);
  const dragRef = useRef<DragState | null>(null);

  const activeBook = bookAt(pos);

  // Derive section pills dynamically from the loaded books' tracks.
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

  const totalTopics = useMemo(
    () => safeBooks.reduce((sum, book) => sum + book.topics.length, 0),
    [safeBooks],
  );

  const statItems = useMemo<readonly StatStripItem[]>(
    () =>
      activeShelf
        ? [
            { label: bookCount === 1 ? 'book' : 'books', value: bookCount },
            { label: 'topics', value: totalTopics },
          ]
        : [
            { label: 'books', value: bookCount },
            { label: shelves.length === 1 ? 'shelf' : 'shelves', value: shelves.length },
            { label: 'topics', value: totalTopics },
          ],
    [activeShelf, bookCount, shelves.length, totalTopics],
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
      width: activeBtn.offsetWidth,
      ready: prev.ready || activeBtn.offsetWidth > 0,
    }));
  }, [activeTabCategory]);

  const syncTabIndicatorRef = useRef<() => void>(syncTabIndicator);
  syncTabIndicatorRef.current = syncTabIndicator;

  const slotX = useCallback(
    (offset: number): number => {
      if (offset === 0) return 0;
      const x1 = bookHeight * (isFiniteShelf ? 0.52 : 0.5);
      const pitch = bookHeight * (isFiniteShelf ? 0.2 : 0.18);
      return Math.sign(offset) * (x1 + (Math.abs(offset) - 1) * pitch);
    },
    [bookHeight, isFiniteShelf],
  );

  // CRITICAL: Fixed ascending `poolIndex` order (`0..poolSize-1`) so React NEVER moves DOM children
  // with `insertBefore` when stepping left vs right!
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

  // Synchronously position every slot before paint and apply section highlighting/dimming.
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

      const matchesHighlight = highlightedTrack !== null && slot.book.track === highlightedTrack;
      const isDimmed = highlightedTrack !== null && slot.book.track !== highlightedTrack;

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
  }, [poolSlots, slotX, detailBook, highlightedTrack]);

  const step = useCallback(
    (dir: number, dur = STEP_DURATION_MS): void => {
      setStepDuration(prefersReducedMotion() ? 0 : dur);
      lastStepRef.current = performance.now();
      setPos((current) => {
        const next = isFiniteShelf ? clamp(current + dir, 0, bookCount - 1) : current + dir;
        return next;
      });
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

  // Boot: measure stage, detect fine pointer, sync initial hash if present.
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

  // Cancel any in-flight multi-step chain only when the component unmounts.
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

  // Bidirectional wheel browsing on the stage.
  useEffect(() => {
    if (detailBook !== null) return;
    const stageEl = stageRef.current;
    if (!stageEl) return;

    let wheelAcc = 0;
    let wheelTimer: ReturnType<typeof setTimeout> | null = null;

    const onWheel = (event: WheelEvent): void => {
      if (detailOpenRef.current || mapOpen) return;
      const rawDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (rawDelta === 0) return;

      event.preventDefault();

      if (performance.now() - lastStepRef.current < WHEEL_COOLDOWN_MS) {
        wheelAcc = 0;
        return;
      }

      if (wheelAcc !== 0 && Math.sign(rawDelta) !== Math.sign(wheelAcc)) {
        wheelAcc = 0;
      }

      wheelAcc += rawDelta;
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        wheelAcc = 0;
      }, 150);

      if (Math.abs(wheelAcc) >= WHEEL_THRESHOLD) {
        step(wheelAcc > 0 ? 1 : -1);
        wheelAcc = 0;
      }
    };

    stageEl.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      stageEl.removeEventListener('wheel', onWheel);
      if (wheelTimer) clearTimeout(wheelTimer);
    };
  }, [detailBook, mapOpen, step]);

  // Keyboard navigation.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (mapOpen) return;
      if (detailOpenRef.current) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeDetail();
        }
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        goToBookIndex(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        goToBookIndex(bookCount - 1);
      } else if (
        (event.key === 'Enter' || event.key === ' ') &&
        document.activeElement === stageRef.current
      ) {
        event.preventDefault();
        openDetail(bookAt(posRef.current));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mapOpen, step, goToBookIndex, bookCount, openDetail, bookAt, closeDetail]);

  // Magnetic ring -> Open / Grab cursor.
  useEffect(() => {
    if (!finePointer || detailBook !== null) return;
    const state = { x: -200, y: -200, tx: -200, ty: -200, seen: false };

    const onMove = (event: globalThis.PointerEvent): void => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      state.tx = event.clientX;
      state.ty = event.clientY;
      if (!state.seen) {
        state.x = state.tx;
        state.y = state.ty;
      }
      state.seen = true;
    };
    const onLeave = (): void => {
      state.seen = false;
    };

    window.addEventListener('pointermove', onMove);
    document.documentElement.addEventListener('mouseleave', onLeave);

    let rafId = 0;
    const loop = (): void => {
      state.x += (state.tx - state.x) * 0.28;
      state.y += (state.ty - state.y) * 0.28;
      const cursorEl = cursorRef.current;
      const stageEl = stageRef.current;
      if (cursorEl && stageEl) {
        cursorEl.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;
        const hit =
          state.seen && !detailOpenRef.current && !mapOpen
            ? document.elementFromPoint(state.tx, state.ty)
            : null;
        const inStage = isDraggingRef.current || Boolean(hit && stageEl.contains(hit));
        const onActive =
          !isDraggingRef.current && Boolean(inStage && hit?.closest('[data-active-slot="true"]'));
        const visibleClass = styles['cursor-visible'] ?? '';
        const openClass = styles['cursor-open'] ?? '';
        const grabClass = styles['cursor-grabbing'] ?? '';
        if (visibleClass) cursorEl.classList.toggle(visibleClass, inStage);
        if (openClass) cursorEl.classList.toggle(openClass, onActive);
        if (grabClass) cursorEl.classList.toggle(grabClass, isDraggingRef.current);
      }
      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      window.cancelAnimationFrame(rafId);
    };
  }, [finePointer, detailBook, mapOpen]);

  // Live 1:1 pointer drag & multi-book scrubbing with flick momentum.
  const handleStagePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    if (chainTimerRef.current) {
      clearTimeout(chainTimerRef.current);
      chainTimerRef.current = null;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: performance.now(),
      vx: 0,
      residualX: 0,
      isDragging: false,
      steppedDuringDrag: false,
      startTarget: event.target,
    };
  };

  const handleStagePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const totalDx = event.clientX - drag.startX;
    const totalDy = event.clientY - drag.startY;

    if (!drag.isDragging) {
      if (Math.abs(totalDx) < DRAG_ACTIVATION_PX || Math.abs(totalDy) > Math.abs(totalDx) * 1.4) {
        return;
      }
      drag.isDragging = true;
      setIsDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    const now = performance.now();
    const dt = Math.max(1, now - drag.lastTime);
    const stepDx = event.clientX - drag.lastX;
    drag.vx = drag.vx * 0.5 + (stepDx / dt) * 0.5;
    drag.lastX = event.clientX;
    drag.lastTime = now;
    drag.residualX += stepDx;

    const scrubUnit = Math.max(70, bookHeightRef.current * 0.24);
    let stepsToMove = 0;
    while (drag.residualX <= -scrubUnit) {
      drag.residualX += scrubUnit;
      stepsToMove += 1;
    }
    while (drag.residualX >= scrubUnit) {
      drag.residualX -= scrubUnit;
      stepsToMove -= 1;
    }

    if (stepsToMove !== 0) {
      drag.steppedDuringDrag = true;
      step(stepsToMove, CHAIN_STEP_DURATION_MS);
    }

    const visualOffset = Math.max(
      -scrubUnit * 0.55,
      Math.min(scrubUnit * 0.55, drag.residualX * 0.65),
    );
    shelfRef.current?.style.setProperty('--drag-x', `${visualOffset.toFixed(1)}px`);
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>, cancelled = false): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;

    if (drag.isDragging) {
      setIsDragging(false);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      shelfRef.current?.style.setProperty('--drag-x', '0px');

      if (cancelled) return;

      const scrubUnit = Math.max(70, bookHeightRef.current * 0.24);
      const speed = Math.abs(drag.vx);
      if (speed > 0.4) {
        const extra = Math.min(3, Math.max(1, Math.round(speed * 1.6)));
        stepBy(drag.vx < 0 ? extra : -extra);
      } else if (!drag.steppedDuringDrag && Math.abs(drag.residualX) > scrubUnit * 0.3) {
        step(drag.residualX < 0 ? 1 : -1);
      }
      return;
    }

    if (cancelled) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 8) return;

    const targetEl = (drag.startTarget ?? event.target) as HTMLElement | null;
    const slotEl = targetEl?.closest<HTMLElement>('[data-slot-offset]');
    if (!slotEl) return;
    const offset = Number(slotEl.dataset.slotOffset);
    if (offset === 0) {
      openDetail(bookAt(posRef.current));
    } else if (!Number.isNaN(offset)) {
      const clickedBook = bookAt(posRef.current + offset);
      // Clicking a dimmed out-of-section book shifts section highlight to its track cleanly.
      if (highlightedTrack && clickedBook.track !== highlightedTrack) {
        setHighlightedTrack(clickedBook.track);
      }
      stepBy(offset);
    }
  };

  const handleTabClick = (category: BookCategory): void => {
    if (category === 'All') {
      setHighlightedTrack(null);
      return;
    }
    setHighlightedTrack(category);
    const firstInTrack = safeBooks.findIndex((book) => book.track === category);
    if (firstInTrack >= 0) {
      goToBookIndex(firstInTrack);
    }
  };

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
          : 'Foundational books on computer systems, backend architecture, infrastructure, and AI.'
      }
      stats={<StatStrip aria-label="Bookshelf summary" items={statItems} sizing="container" />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {activeShelf && (
            <Link
              href="/bookshelf"
              prefetch={false}
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-surface-1 px-3 tile-label text-muted-foreground no-underline transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
            >
              <FiArrowLeft className="size-4" aria-hidden="true" />
              All shelves
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-surface-1 px-3 tile-label text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
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
        {/* Live Console section filter pills (hidden on single-section focused shelf) */}
        {!activeShelf && categories.length > 2 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Categories" className={styles['track-bar']}>
              <span
                aria-hidden="true"
                className={cn(styles['track-pill'], !tabIndicator.ready && styles['no-anim'])}
                style={{
                  width: `${tabIndicator.width}px`,
                  transform: `translateX(${tabIndicator.left}px)`,
                }}
              />
              {categories.map((category) => (
                <button
                  key={category}
                  ref={(el) => {
                    if (el) tabButtonRefs.current.set(category, el);
                    else tabButtonRefs.current.delete(category);
                  }}
                  type="button"
                  role="tab"
                  aria-selected={
                    category === 'All' ? highlightedTrack === null : activeTabCategory === category
                  }
                  onClick={() => handleTabClick(category)}
                  className={styles['track-chip']}
                >
                  <span>{category}</span>
                  <span className={styles['track-count']}>{categoryCounts[category] ?? 0}</span>
                </button>
              ))}
            </div>

            {highlightedTrack && highlightedShelfSlug && (
              <Link
                href={`/bookshelf/shelf/${highlightedShelfSlug}`}
                prefetch={false}
                className="inline-flex items-center gap-1 tile-meta text-brand-ink no-underline underline-offset-4 hover:text-foreground hover:underline"
              >
                Open {highlightedTrack} shelf
                <FiArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        )}

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
              const isHighlighted = highlightedTrack !== null && book.track === highlightedTrack;
              const isDimmed = highlightedTrack !== null && book.track !== highlightedTrack;

              return (
                <div
                  key={slot.poolIndex}
                  ref={(el) => {
                    if (el) slotElementsRef.current.set(slot.poolIndex, el);
                    else slotElementsRef.current.delete(slot.poolIndex);
                  }}
                  data-pool-index={slot.poolIndex}
                  data-slot-offset={slot.offset}
                  data-active-slot={isActive ? 'true' : 'false'}
                  data-highlighted={isHighlighted ? 'true' : 'false'}
                  data-dimmed={isDimmed ? 'true' : 'false'}
                  className={styles.slot}
                >
                  <div
                    className={styles.book}
                    style={
                      {
                        '--spine-hdr': book.spine.capBg,
                        '--spine-body': book.spine.bodyBg,
                        '--spine-num': book.spine.capText,
                        '--spine-ink': book.spine.titleColor,
                      } as CSSProperties
                    }
                  >
                    <div className={cn(styles.face, styles['face-spine'])}>
                      <div className={styles['spine-hdr']}>{book.stageLabel}</div>
                      <div className={styles['spine-title']}>
                        <span>{book.spineTitle}</span>
                      </div>
                      <div className={styles['spine-author']}>
                        <span>{book.spineAuthor}</span>
                      </div>
                    </div>

                    <div data-book-cover className={cn(styles.face, styles['face-cover'])}>
                      <div className={styles.cover}>
                        {/* biome-ignore lint/performance/noImgElement: Local or CDN cover asset served directly without Next optimizer. */}
                        <img
                          src={book.coverSrc}
                          alt={`${book.title} by ${book.authors}`}
                          width={520}
                          height={680}
                          loading={Math.abs(slot.offset) <= 2 ? 'eager' : 'lazy'}
                          decoding="async"
                          draggable={false}
                          className={styles['cover-img']}
                        />
                      </div>
                    </div>

                    <div className={cn(styles.face, styles['face-back'])} />
                    <div className={cn(styles.face, styles['face-pages'])} />
                  </div>

                  <div aria-hidden="true" className={styles['slot-shadow']} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Live stage readout + borderless prev/next controls */}
        <div className={styles['controls-row']}>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="tile-meta tabular-nums text-brand-ink">
              {activeShelf
                ? `Book ${String(mod(pos, bookCount) + 1).padStart(2, '0')} / ${String(bookCount).padStart(2, '0')}`
                : `Stage ${activeBook.stageLabel} / ${String(bookCount).padStart(2, '0')}`}
            </span>
            <span aria-hidden="true" className="text-faint">
              ·
            </span>
            <span className="tile-sub font-medium text-foreground">{activeBook.title}</span>
            <span aria-hidden="true" className="text-faint">
              ·
            </span>
            <button
              type="button"
              onClick={() => openDetail(activeBook)}
              className="inline-flex items-center gap-1 tile-meta text-brand-ink underline-offset-4 hover:text-foreground hover:underline"
            >
              Open notes ({activeBook.topics.length} topics)
              <FiArrowUpRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className={styles['controls-arrows']}>
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={isFiniteShelf && pos <= 0}
              aria-label="Previous book"
              className={cn(styles.arrow, isFiniteShelf && pos <= 0 && 'opacity-35')}
            >
              <FiArrowLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={isFiniteShelf && pos >= bookCount - 1}
              aria-label="Next book"
              className={cn(styles.arrow, isFiniteShelf && pos >= bookCount - 1 && 'opacity-35')}
            >
              <FiArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Separated `seathru.app`-inspired fanned cover-stack shelf cards */}
        {!activeShelf && shelves.length > 0 && (
          <ShelfCardsGrid
            shelves={shelves}
            books={safeBooks}
            highlightedSection={highlightedTrack}
          />
        )}
      </div>

      {/* Magnetic custom cursor */}
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
