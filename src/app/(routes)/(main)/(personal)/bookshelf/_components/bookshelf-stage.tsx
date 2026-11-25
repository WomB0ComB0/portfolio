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
  useMemo,
  useRef,
  useState,
} from 'react';
import { prefersReducedMotion } from '@/lib/design/motion';
import { cn } from '@/lib/utils';
import {
  BOOK_CATEGORIES,
  BOOKS,
  type BookCategory,
  type BookItem,
  DEFAULT_BOOK_INDEX,
  getBookAt,
  getBookIndexBySlug,
  getTrackStartIndex,
} from '../_lib/books';
import styles from './bookshelf.module.css';
import { ReadingMapDialog } from './reading-map-dialog';

export interface BookshelfStageProps {
  /** Optional initial book slug (e.g. from `?book=<slug>` when returning from a detail route). */
  readonly initialSlug?: string;
}

const BOOK_COUNT = BOOKS.length;
const DEFAULT_BOOK_HEIGHT = 440;
const STEP_DURATION_MS = 620;
const CHAIN_STEP_DURATION_MS = 300;
const CHAIN_TICK_MS = 85;
const FULL_CLIP_INSET = 'inset(0px 0px 0px 0px round 0px)';

const mod = (a: number, n: number): number => ((a % n) + n) % n;

const insetFromRect = (rect: DOMRect): string =>
  `inset(${rect.top.toFixed(1)}px ${(window.innerWidth - rect.right).toFixed(1)}px ${(window.innerHeight - rect.bottom).toFixed(1)}px ${rect.left.toFixed(1)}px round 3px)`;

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
  readonly fresh: boolean;
}

/**
 * Interactive 3D Engineering Bookshelf:
 * - True 4-face CSS 3D cuboid books with isolated per-slot perspective.
 * - Single transform function list interpolated numerically (`rotateY: 0deg -> -100deg`,
 *   `rotateZ: 0deg -> -4deg`, passed books at `rotateY: -4deg`).
 * - Recycled infinite slot pool (`2K+1`) with multi-step cascading flips.
 * - Scroll-spy segmented tabs with a sliding pill indicator.
 * - Magnetic ring-to-`Open` cursor on mouse devices.
 * - Container-transform `clip-path` detail reveal with staggered top-to-bottom wipes.
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
  const [detailPhase, setDetailPhase] = useState<'closed' | 'entering' | 'open' | 'leaving'>(
    'closed',
  );
  const [tabIndicator, setTabIndicator] = useState<{
    readonly left: number;
    readonly width: number;
    readonly ready: boolean;
  }>({ left: 0, width: 0, ready: false });

  const appRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const detailCloseRef = useRef<HTMLButtonElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Map<BookCategory, HTMLButtonElement>>(new Map());
  const slotElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const prevSlotPositionsRef = useRef<Map<number, number>>(new Map());

  const posRef = useRef<number>(pos);
  posRef.current = pos;
  const detailOpenRef = useRef<boolean>(false);
  detailOpenRef.current = detailBook !== null;
  const pushedHashRef = useRef<boolean>(false);
  const chainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStepRef = useRef<number>(0);
  const detailAnimRef = useRef<Animation | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);

  const activeBook = getBookAt(pos);
  const activeTabCategory: BookCategory = pinnedTab ?? activeBook.track;
  const poolSize = 2 * halfWindow + 1;

  // Measure stage dimensions -> compute --book-h and off-screen pool radius K.
  const measureStage = useCallback((): void => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const vw = window.innerWidth;
    const sh = stageEl.clientHeight || window.innerHeight * 0.72;
    const nextH = Math.round(Math.max(220, Math.min(sh * 0.84, 520, vw * 0.92)));
    const x1 = nextH * 0.5;
    const pitch = nextH * 0.18;
    const nextK = Math.max(3, Math.ceil((vw / 2 - x1) / pitch) + 2);
    setBookHeight(nextH);
    setHalfWindow(nextK);
  }, []);

  // Measure active segmented tab to slide indicator smoothly.
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

  // Build the recycled M = 2K+1 slot array, flagging newly teleported slots so they skip transition.
  const poolSlots = useMemo<readonly PoolSlot[]>(() => {
    const slots: PoolSlot[] = [];
    for (let s = pos - halfWindow; s <= pos + halfWindow; s += 1) {
      const poolIndex = mod(s, poolSize);
      const prevSlot = prevSlotPositionsRef.current.get(poolIndex);
      const fresh = prevSlot !== undefined && prevSlot !== s;
      slots.push({
        poolIndex,
        slotPosition: s,
        offset: s - pos,
        book: getBookAt(s),
        fresh,
      });
    }
    return slots;
  }, [pos, halfWindow, poolSize]);

  // After commit: record each pool slot's new logical slotPosition and drop `.no-anim` on recycled slots.
  useEffect(() => {
    const freshElements: HTMLDivElement[] = [];
    for (const slot of poolSlots) {
      prevSlotPositionsRef.current.set(slot.poolIndex, slot.slotPosition);
      if (slot.fresh) {
        const el = slotElementsRef.current.get(slot.poolIndex);
        if (el) freshElements.push(el);
      }
    }
    if (freshElements.length === 0) return;
    void shelfRef.current?.offsetWidth;
    const raf = window.requestAnimationFrame(() => {
      for (const el of freshElements) el.classList.remove(styles['no-anim'] ?? '');
    });
    return () => window.cancelAnimationFrame(raf);
  }, [poolSlots]);

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

  const getActiveCoverRect = useCallback((): DOMRect | null => {
    const activePoolIndex = mod(posRef.current, poolSize);
    const slotEl = slotElementsRef.current.get(activePoolIndex);
    const face = slotEl?.querySelector<HTMLElement>('[data-book-cover]');
    return face ? face.getBoundingClientRect() : null;
  }, [poolSize]);

  const openDetail = useCallback(
    (book: BookItem, { animate = true, push = true } = {}): void => {
      if (detailOpenRef.current) return;
      const coverRect = animate ? getActiveCoverRect() : null;
      setDetailBook(book);
      setDetailPhase(animate && !prefersReducedMotion() ? 'entering' : 'open');

      if (push && typeof window !== 'undefined') {
        const nextHash = `#/stage/${book.stageLabel}`;
        if (window.location.hash !== nextHash) {
          window.history.pushState(
            { stage: book.stageLabel },
            '',
            `${window.location.pathname}${window.location.search}${nextHash}`,
          );
          pushedHashRef.current = true;
        }
      }

      window.requestAnimationFrame(() => {
        const detailEl = detailRef.current;
        if (!detailEl) return;
        detailEl.scrollTop = 0;
        detailAnimRef.current?.cancel();
        if (
          animate &&
          !prefersReducedMotion() &&
          coverRect &&
          typeof detailEl.animate === 'function'
        ) {
          detailAnimRef.current = detailEl.animate(
            [{ clipPath: insetFromRect(coverRect) }, { clipPath: FULL_CLIP_INSET }],
            { duration: 720, easing: 'cubic-bezier(0.77, 0, 0.18, 1)' },
          );
        }
        detailCloseRef.current?.focus({ preventScroll: true });
      });
    },
    [getActiveCoverRect],
  );

  const closeDetail = useCallback(
    ({ fromPop = false } = {}): void => {
      if (!detailOpenRef.current) return;
      if (!fromPop && typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}`,
        );
      }
      pushedHashRef.current = false;

      const finish = (): void => {
        detailAnimRef.current?.cancel();
        detailAnimRef.current = null;
        setDetailBook(null);
        setDetailPhase('closed');
        stageRef.current?.focus({ preventScroll: true });
      };

      const detailEl = detailRef.current;
      const coverRect = getActiveCoverRect();
      if (
        prefersReducedMotion() ||
        !detailEl ||
        !coverRect ||
        typeof detailEl.animate !== 'function'
      ) {
        finish();
        return;
      }

      setDetailPhase('leaving');
      detailAnimRef.current?.cancel();
      const anim = detailEl.animate(
        [{ clipPath: FULL_CLIP_INSET }, { clipPath: insetFromRect(coverRect) }],
        {
          duration: 560,
          delay: 140,
          easing: 'cubic-bezier(0.77, 0, 0.18, 1)',
          fill: 'forwards',
        },
      );
      detailAnimRef.current = anim;
      anim.onfinish = finish;
    },
    [getActiveCoverRect],
  );

  // Boot: measure stage, check fine pointer, sync initial hash if present.
  useEffect(() => {
    measureStage();
    const isFine =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    setFinePointer(isFine);

    const hashIndex = stageIndexFromHash();
    if (hashIndex >= 0) {
      setPos(hashIndex);
      openDetail(getBookAt(hashIndex), { animate: false, push: false });
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
  }, [measureStage, syncTabIndicator, openDetail]);

  useEffect(() => {
    syncTabIndicator();
  }, [syncTabIndicator]);

  // Hash popstate sync (browser Back / Forward).
  useEffect(() => {
    const onPopState = (): void => {
      const idx = stageIndexFromHash();
      if (idx < 0) {
        closeDetail({ fromPop: true });
      } else if (!detailOpenRef.current) {
        goToBookIndex(idx);
        setTimeout(() => openDetail(getBookAt(idx), { push: false }), 650);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [closeDetail, goToBookIndex, openDetail]);

  // Wheel navigation on the stage (prevents page scroll while browsing books).
  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    let wheelAcc = 0;
    let wheelTimer: ReturnType<typeof setTimeout> | null = null;

    const onWheel = (event: WheelEvent): void => {
      if (detailOpenRef.current || mapOpen) return;
      event.preventDefault();
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      wheelAcc += delta;
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        wheelAcc = 0;
      }, 180);
      if (Math.abs(wheelAcc) > 40 && performance.now() - lastStepRef.current > 300) {
        step(Math.sign(wheelAcc));
        wheelAcc = 0;
      }
    };

    stageEl.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      stageEl.removeEventListener('wheel', onWheel);
      if (wheelTimer) clearTimeout(wheelTimer);
    };
  }, [mapOpen, step]);

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

  // Magnetic ring -> Open disc custom cursor on fine pointers.
  useEffect(() => {
    if (!finePointer) return;
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
  }, [finePointer, mapOpen]);

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
    if (detailOpenRef.current) return;
    if (category === 'All') {
      setPinnedTab('All');
      goToBookIndex(0, 'All');
      return;
    }
    goToBookIndex(getTrackStartIndex(category));
  };

  return (
    <div
      ref={appRef}
      className={styles.app}
      style={
        {
          '--book-h': `${bookHeight}px`,
          '--shelf-dur': `${stepDuration}ms`,
        } as CSSProperties
      }
    >
      {/* Top header (borderless) */}
      <header className={styles.top}>
        <h1 className={styles['top-title']}>Engineering shelf</h1>
        <button type="button" onClick={() => setMapOpen(true)} className={styles['top-link']}>
          Reading map ↗
        </button>
      </header>

      {/* Scroll-spy segmented category tabs with sliding pill indicator */}
      <div role="tablist" aria-label="Categories" className={styles.tabs}>
        <span
          aria-hidden="true"
          className={cn(styles['tabs-ind'], !tabIndicator.ready && styles['no-anim'])}
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
            className={styles.tab}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Borderless 3D Shelf Stage */}
      {/* biome-ignore lint/a11y/useSemanticElements: Interactive 3D carousel stage follows ARIA carousel pattern. */}
      <div
        ref={stageRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Bookshelf. Use left and right arrow keys to browse, Enter to open."
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Carousel viewport is focusable for keyboard navigation.
        tabIndex={0}
        onPointerDown={handleStagePointerDown}
        onPointerUp={handleStagePointerUp}
        className={cn(styles.stage, finePointer && styles['custom-cursor'])}
      >
        <div ref={shelfRef} className={styles.shelf}>
          {poolSlots.map((slot) => {
            const isActive = slot.offset === 0;
            const isBefore = slot.offset < 0;
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
                  isBefore && styles['is-before'],
                  slot.fresh && styles['no-anim'],
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
                  {/* 3D Spine Face */}
                  <div className={cn(styles.face, styles['face-spine'])}>
                    <div className={styles['spine-hdr']}>{book.stageLabel}</div>
                    <div className={styles['spine-title']}>
                      <span>{book.spineTitle}</span>
                    </div>
                    <div className={styles['spine-author']}>
                      <span>{book.spineAuthor}</span>
                    </div>
                  </div>

                  {/* 3D Front Cover Face */}
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

                  {/* 3D Back Cover Face */}
                  <div className={cn(styles.face, styles['face-back'])} />

                  {/* 3D Page Block Edge Face */}
                  <div className={cn(styles.face, styles['face-pages'])} />
                </div>

                {/* Soft grounded floor shadow */}
                <div aria-hidden="true" className={styles['slot-shadow']} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom circular arrow controls (borderless) */}
      <div className={styles.controls}>
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous book"
          className={styles.arrow}
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next book"
          className={styles.arrow}
        >
          →
        </button>
      </div>

      {/* Magnetic custom cursor */}
      <div ref={cursorRef} aria-hidden="true" className={styles['cursor-layer']}>
        <div className={styles['cursor-ring']}>
          <span className={styles['cursor-label']}>Open</span>
        </div>
      </div>

      {/* Container-transform book detail overlay */}
      <section
        ref={detailRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookshelf-detail-title"
        aria-hidden={detailBook === null}
        className={cn(
          styles.detail,
          detailBook !== null && styles['detail-open'],
          detailPhase === 'entering' && styles['detail-entering'],
          detailPhase === 'leaving' && styles['detail-leaving'],
        )}
      >
        <button
          ref={detailCloseRef}
          type="button"
          onClick={() => closeDetail()}
          aria-label="Back to shelf"
          className={styles['detail-close']}
        >
          ✕
        </button>

        {detailBook && (
          <div className={styles['detail-grid']}>
            <div className={styles['detail-text']}>
              <p
                className={cn(styles['detail-eyebrow'], styles.rv)}
                style={{ '--d': '340ms' } as CSSProperties}
              >
                <span>
                  Stage {detailBook.stageLabel} · {detailBook.spineTitle}
                </span>
              </p>

              <h2
                id="bookshelf-detail-title"
                className={cn(styles['detail-heading'], styles.rv)}
                style={{ '--d': '400ms', '--rd': '800ms' } as CSSProperties}
              >
                {detailBook.title}
              </h2>

              <p
                className={cn(styles['detail-desc'], styles.rv)}
                style={{ '--d': '500ms' } as CSSProperties}
              >
                {detailBook.summary}
              </p>

              <ol
                className={cn(styles['detail-topics'], styles.rv)}
                style={
                  {
                    '--d': '540ms',
                    '--topic-rows': String(Math.ceil(detailBook.topics.length / 2)),
                  } as CSSProperties
                }
              >
                {detailBook.topics.map((topic) => (
                  <li key={topic.number}>
                    <span className={styles['detail-topic-num']}>{topic.number}</span>
                    <span>{topic.title}</span>
                  </li>
                ))}
              </ol>

              <div
                className={cn('mt-7 flex flex-wrap items-center gap-5', styles.rv)}
                style={{ '--d': '620ms' } as CSSProperties}
              >
                <a
                  href={detailBook.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles['detail-cta']}
                >
                  Explore {detailBook.spineTitle} →
                </a>
                <Link
                  href={`/bookshelf/${detailBook.slug}`}
                  prefetch={false}
                  className="text-label font-mono text-faint no-underline hover:text-foreground"
                >
                  Permalink ↗
                </Link>
              </div>
            </div>

            <div
              className={cn(styles['detail-cover'], styles.rv)}
              style={{ '--d': '360ms', '--rd': '900ms' } as CSSProperties}
            >
              <div className={styles.cover}>
                {/* biome-ignore lint/performance/noImgElement: Local WebP asset served directly from public/assets/bookshelf (next.config disables /_next/image). */}
                <img
                  src={detailBook.coverSrc}
                  alt={`${detailBook.title} by ${detailBook.authors}`}
                  width={520}
                  height={680}
                  draggable={false}
                  className={styles['cover-img']}
                />
              </div>
            </div>
          </div>
        )}
      </section>

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
        onOpenBook={(book) => {
          const idx = getBookIndexBySlug(book.slug);
          if (idx >= 0) {
            setPos(idx);
            openDetail(book, { animate: false });
          }
        }}
      />
    </div>
  );
}
