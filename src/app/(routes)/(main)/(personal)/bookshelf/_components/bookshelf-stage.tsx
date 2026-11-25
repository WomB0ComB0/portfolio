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
  BOOK_CATEGORIES,
  BOOK_TRACKS,
  BOOKS,
  type BookCategory,
  type BookItem,
  DEFAULT_BOOK_INDEX,
  getBookAt,
  getBookIndexBySlug,
  getTrackStartIndex,
  TOTAL_TOPICS,
} from '../_lib/books';
import { BookDetailView } from './book-detail-view';
import styles from './bookshelf.module.css';
import { ReadingMapDialog } from './reading-map-dialog';

export interface BookshelfStageProps {
  /** Optional initial book slug (e.g. from `?book=<slug>` when returning from a detail route). */
  readonly initialSlug?: string;
}

const BOOK_COUNT = BOOKS.length;
const DEFAULT_BOOK_HEIGHT = 390;
const STEP_DURATION_MS = 560;
const CHAIN_STEP_DURATION_MS = 280;
const CHAIN_TICK_MS = 85;
const WHEEL_THRESHOLD = 24;
const WHEEL_COOLDOWN_MS = 240;

const STAT_ITEMS: readonly StatStripItem[] = [
  { label: 'books', value: BOOKS.length },
  { label: 'tracks', value: BOOK_TRACKS.length },
  { label: 'topics', value: TOTAL_TOPICS },
];

const CATEGORY_COUNTS: Readonly<Record<BookCategory, number>> = {
  All: BOOKS.length,
  Foundations: BOOKS.filter((book) => book.track === 'Foundations').length,
  Backend: BOOKS.filter((book) => book.track === 'Backend').length,
  'Infra & Ops': BOOKS.filter((book) => book.track === 'Infra & Ops').length,
  AI: BOOKS.filter((book) => book.track === 'AI').length,
};

const mod = (a: number, n: number): number => ((a % n) + n) % n;

const stageIndexFromHash = (): number => {
  if (typeof window === 'undefined') return -1;
  const match = /^#\/stage\/(\d+)/.exec(window.location.hash);
  if (!match?.[1]) return -1;
  const label = match[1].padStart(2, '0');
  return BOOKS.findIndex((book) => book.stageLabel === label);
};

interface PoolSlot {
  readonly poolIndex: number;
  readonly slotPosition: number;
  readonly offset: number;
  readonly book: BookItem;
}

/**
 * Interactive 3D Engineering Bookshelf built natively inside Live Console `<PageShell>`:
 * - Never covers the site's left nav rail or footer (detail view renders in-page inside PageShell).
 * - True 4-face CSS 3D cuboid books with symmetric perspective depth across all 14 stages.
 * - Synchronous `useLayoutEffect` slot recycling so only off-screen teleported slots skip transitions,
 *   guaranteeing smooth 3D rotation & slide across every visible book in BOTH directions.
 * - Bidirectional wheel scrolling (scroll up / left -> previous book, scroll down / right -> next
 *   book) with instant direction reversal and cooldown gating so momentum never locks direction.
 */
export function BookshelfStage({ initialSlug }: BookshelfStageProps): ReactElement {
  const initialPos = useMemo(() => {
    if (!initialSlug) return DEFAULT_BOOK_INDEX;
    const found = getBookIndexBySlug(initialSlug);
    return found >= 0 ? found : DEFAULT_BOOK_INDEX;
  }, [initialSlug]);

  const [pos, setPos] = useState<number>(initialPos);
  const [bookHeight, setBookHeight] = useState<number>(DEFAULT_BOOK_HEIGHT);
  const [halfWindow, setHalfWindow] = useState<number>(5);
  const [stepDuration, setStepDuration] = useState<number>(STEP_DURATION_MS);
  const [pinnedTab, setPinnedTab] = useState<BookCategory | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [finePointer, setFinePointer] = useState(false);
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
  const detailOpenRef = useRef<boolean>(false);
  detailOpenRef.current = detailBook !== null;
  const chainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStepRef = useRef<number>(0);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);

  const activeBook = getBookAt(pos);
  const activeTabCategory: BookCategory = pinnedTab ?? activeBook.track;
  const poolSize = 2 * halfWindow + 1;

  const measureStage = useCallback((): void => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const sw = stageEl.clientWidth || window.innerWidth;
    const sh = stageEl.clientHeight || 420;
    const nextH = Math.round(Math.max(220, Math.min(sh * 0.84, 430, sw * 0.88)));
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

  const slotX = useCallback(
    (offset: number): number => {
      if (offset === 0) return 0;
      const x1 = bookHeight * 0.5;
      const pitch = bookHeight * 0.18;
      return Math.sign(offset) * (x1 + (Math.abs(offset) - 1) * pitch);
    },
    [bookHeight],
  );

  // Build the recycled M = 2K+1 slot array (pure; DOM recycling happens synchronously in useLayoutEffect).
  const poolSlots = useMemo<readonly PoolSlot[]>(() => {
    const slots: PoolSlot[] = [];
    for (let s = pos - halfWindow; s <= pos + halfWindow; s += 1) {
      slots.push({
        poolIndex: mod(s, poolSize),
        slotPosition: s,
        offset: s - pos,
        book: getBookAt(s),
      });
    }
    return slots;
  }, [pos, halfWindow, poolSize]);

  // Synchronously position every slot before paint: ONLY newly recycled off-screen slots skip
  // transition via a flush, so ALL visible books smoothly animate in BOTH left and right directions.
  useLayoutEffect(() => {
    if (detailBook !== null) return;
    const noAnimClass = styles['no-anim'] ?? '';
    const activeClass = styles['is-active'] ?? '';
    const beforeClass = styles['is-before'] ?? '';
    const afterClass = styles['is-after'] ?? '';

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

      if (activeClass) el.classList.toggle(activeClass, slot.offset === 0);
      if (beforeClass) el.classList.toggle(beforeClass, slot.offset < 0);
      if (afterClass) el.classList.toggle(afterClass, slot.offset > 0);
      el.style.setProperty('--slot-x', `${slotX(slot.offset).toFixed(2)}px`);
      el.style.zIndex = String(100 - Math.abs(slot.offset));
    }

    if (teleported.length > 0) {
      void shelfRef.current?.offsetWidth;
      for (const el of teleported) {
        if (noAnimClass) el.classList.remove(noAnimClass);
      }
    }
  }, [poolSlots, slotX, detailBook]);

  const step = useCallback(
    (dir: number, dur = STEP_DURATION_MS, pin: BookCategory | null = null): void => {
      setStepDuration(prefersReducedMotion() ? 0 : dur);
      setPinnedTab(pin);
      lastStepRef.current = performance.now();
      setPos((current) => current + dir);
    },
    [],
  );

  const stepBy = useCallback(
    (delta: number, pin: BookCategory | null = null): void => {
      if (chainTimerRef.current) {
        clearTimeout(chainTimerRef.current);
        chainTimerRef.current = null;
      }
      if (!delta) return;
      const dir = Math.sign(delta);
      let left = Math.abs(delta);
      if (left === 1) {
        step(dir, STEP_DURATION_MS, pin);
        return;
      }
      const tick = (): void => {
        left -= 1;
        step(dir, left > 0 ? CHAIN_STEP_DURATION_MS : STEP_DURATION_MS, pin);
        if (left > 0) {
          chainTimerRef.current = setTimeout(tick, CHAIN_TICK_MS);
        }
      };
      tick();
    },
    [step],
  );

  const goToBookIndex = useCallback(
    (targetIndex: number, pin: BookCategory | null = null): void => {
      let delta = mod(targetIndex - mod(posRef.current, BOOK_COUNT), BOOK_COUNT);
      if (delta > BOOK_COUNT / 2) delta -= BOOK_COUNT;
      stepBy(delta, pin);
    },
    [stepBy],
  );

  const openDetail = useCallback((book: BookItem, { push = true } = {}): void => {
    const idx = getBookIndexBySlug(book.slug);
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
  }, []);

  const closeDetail = useCallback(({ fromPop = false } = {}): void => {
    if (!fromPop && typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    // Reset slot map so returning to the shelf lays out cleanly without flying in from stale coords.
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
      setDetailBook(getBookAt(hashIndex));
    }

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = (): void => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        measureStage();
        syncTabIndicator();
      }, 100);
    };
    window.addEventListener('resize', onResize);
    void document.fonts?.ready.then(syncTabIndicator);
    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeTimer) clearTimeout(resizeTimer);
      if (chainTimerRef.current) clearTimeout(chainTimerRef.current);
    };
  }, [measureStage, syncTabIndicator]);

  // Re-measure when returning from the detail view to the shelf.
  useEffect(() => {
    if (detailBook !== null) return;
    measureStage();
    syncTabIndicator();
  }, [detailBook, measureStage, syncTabIndicator]);

  useEffect(() => {
    syncTabIndicator();
  }, [syncTabIndicator]);

  // Hash popstate sync for browser Back / Forward.
  useEffect(() => {
    const onPopState = (): void => {
      const idx = stageIndexFromHash();
      if (idx < 0) {
        closeDetail({ fromPop: true });
      } else {
        setPos(idx);
        setDetailBook(getBookAt(idx));
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [closeDetail]);

  // Bidirectional wheel browsing on the stage (scroll up / left -> previous, scroll down / right -> next).
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

      // Drop momentum events during cooldown so previous direction never blocks a reversal.
      if (performance.now() - lastStepRef.current < WHEEL_COOLDOWN_MS) {
        wheelAcc = 0;
        return;
      }

      // Immediately zero accumulator when the user reverses scroll direction.
      if (wheelAcc !== 0 && Math.sign(rawDelta) !== Math.sign(wheelAcc)) {
        wheelAcc = 0;
      }

      wheelAcc += rawDelta;
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        wheelAcc = 0;
      }, 160);

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
        goToBookIndex(BOOK_COUNT - 1);
      } else if (
        (event.key === 'Enter' || event.key === ' ') &&
        document.activeElement === stageRef.current
      ) {
        event.preventDefault();
        openDetail(getBookAt(posRef.current));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mapOpen, step, goToBookIndex, openDetail, closeDetail]);

  // Magnetic ring -> Open disc cursor while pointer is over the shelf stage.
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
      state.x += (state.tx - state.x) * 0.24;
      state.y += (state.ty - state.y) * 0.24;
      const cursorEl = cursorRef.current;
      const stageEl = stageRef.current;
      if (cursorEl && stageEl) {
        cursorEl.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;
        const hit =
          state.seen && !detailOpenRef.current && !mapOpen
            ? document.elementFromPoint(state.tx, state.ty)
            : null;
        const inStage = Boolean(hit && stageEl.contains(hit));
        const onActive = Boolean(inStage && hit?.closest('[data-active-slot="true"]'));
        cursorEl.classList.toggle(styles['cursor-visible'] ?? '', inStage);
        cursorEl.classList.toggle(styles['cursor-open'] ?? '', onActive);
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

  const handleStagePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    pointerDownRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleStagePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const start = pointerDownRef.current;
    pointerDownRef.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      step(dx < 0 ? 1 : -1);
      return;
    }
    if (Math.hypot(dx, dy) > 8) return;
    const slotEl = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-slot-offset]');
    if (!slotEl) return;
    const offset = Number(slotEl.dataset.slotOffset);
    if (offset === 0) {
      openDetail(getBookAt(posRef.current));
    } else if (!Number.isNaN(offset)) {
      stepBy(offset);
    }
  };

  const handleTabClick = (category: BookCategory): void => {
    if (category === 'All') {
      setPinnedTab('All');
      goToBookIndex(0, 'All');
      return;
    }
    goToBookIndex(getTrackStartIndex(category));
  };

  if (detailBook) {
    return (
      <BookDetailView
        book={detailBook}
        entering
        onBack={() => closeDetail()}
        onNavigateBook={(book) => openDetail(book)}
      />
    );
  }

  return (
    <PageShell
      sizing="container"
      eyebrow="Reading"
      title="Bookshelf"
      description="Foundational books on computer systems, backend architecture, infrastructure, and AI."
      stats={<StatStrip aria-label="Bookshelf summary" items={STAT_ITEMS} sizing="container" />}
      actions={
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-surface-1 px-3 tile-label text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
        >
          <FiMap className="size-3.5" aria-hidden="true" />
          Reading map
        </button>
      }
      className="pb-12"
    >
      <div
        className={styles['shelf-shell']}
        style={
          {
            '--book-h': `${bookHeight}px`,
            '--shelf-dur': `${stepDuration}ms`,
          } as CSSProperties
        }
      >
        {/* Live Console track filter chips with sliding brand-subtle pill */}
        <div role="tablist" aria-label="Categories" className={styles['track-bar']}>
          <span
            aria-hidden="true"
            className={cn(styles['track-pill'], !tabIndicator.ready && styles['no-anim'])}
            style={{
              width: `${tabIndicator.width}px`,
              transform: `translateX(${tabIndicator.left}px)`,
            }}
          />
          {BOOK_CATEGORIES.map((category) => (
            <button
              key={category}
              ref={(el) => {
                if (el) tabButtonRefs.current.set(category, el);
                else tabButtonRefs.current.delete(category);
              }}
              type="button"
              role="tab"
              aria-selected={activeTabCategory === category}
              onClick={() => handleTabClick(category)}
              className={styles['track-chip']}
            >
              <span>{category}</span>
              <span className={styles['track-count']}>{CATEGORY_COUNTS[category]}</span>
            </button>
          ))}
        </div>

        {/* Borderless 3D Shelf Stage */}
        {/* biome-ignore lint/a11y/useSemanticElements: Interactive 3D carousel stage follows ARIA carousel pattern. */}
        <div
          ref={stageRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Bookshelf. Scroll or use left and right arrow keys to browse, Enter to open."
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Carousel viewport is focusable for keyboard navigation.
          tabIndex={0}
          onPointerDown={handleStagePointerDown}
          onPointerUp={handleStagePointerUp}
          className={cn(styles.stage, finePointer && styles['custom-cursor'])}
        >
          <div ref={shelfRef} className={styles.shelf}>
            {poolSlots.map((slot) => {
              const isActive = slot.offset === 0;
              const { book } = slot;

              return (
                <div
                  key={slot.poolIndex}
                  ref={(el) => {
                    if (el) slotElementsRef.current.set(slot.poolIndex, el);
                    else slotElementsRef.current.delete(slot.poolIndex);
                  }}
                  data-slot-offset={slot.offset}
                  data-active-slot={isActive ? 'true' : 'false'}
                  className={cn(
                    styles.slot,
                    isActive && styles['is-active'],
                    slot.offset < 0 && styles['is-before'],
                    slot.offset > 0 && styles['is-after'],
                  )}
                  style={
                    {
                      '--slot-x': `${slotX(slot.offset).toFixed(2)}px`,
                      zIndex: 100 - Math.abs(slot.offset),
                    } as CSSProperties
                  }
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
                        {/* biome-ignore lint/performance/noImgElement: Local WebP asset served directly from public/assets/bookshelf (next.config disables /_next/image). */}
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
              Stage {activeBook.stageLabel} / {String(BOOK_COUNT).padStart(2, '0')}
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
              aria-label="Previous book"
              className={styles.arrow}
            >
              <FiArrowLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next book"
              className={styles.arrow}
            >
              <FiArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Magnetic custom cursor */}
      <div ref={cursorRef} aria-hidden="true" className={styles['cursor-layer']}>
        <div className={styles['cursor-ring']}>
          <span className={styles['cursor-label']}>Open</span>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {activeBook.stageLabel} of {BOOK_COUNT}: {activeBook.title}
      </p>

      <ReadingMapDialog
        open={mapOpen}
        activeSlug={activeBook.slug}
        onClose={() => setMapOpen(false)}
        onSelectBook={(book) => {
          const idx = getBookIndexBySlug(book.slug);
          if (idx >= 0) goToBookIndex(idx);
        }}
        onOpenBook={(book) => openDetail(book)}
      />
    </PageShell>
  );
}
