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

/**
 * @file The stage's input. The wheel steps it, sideways or down, each 20 px of travel past a
 * cooldown; the arrow keys step and Home and End jump while the stage (or nothing) has focus,
 * Enter or Space opens the book on stage and Escape closes the detail; a drag scrubs a step per
 * scrub unit and a flick adds up to three; a tap on a side book steps to it (moving the shelf
 * filter to its shelf, and clearing a status filter it fails) and a tap on the active one opens
 * it; with a fine pointer a ring cursor trails the pointer (under reduced motion it sits on it).
 * The drag maths is in _lib/shelf-glide.ts and the moves in use-shelf-motion.ts. The stage
 * (bookshelf-stage.tsx) calls it. Guarded by tests/unit/bookshelf/bookshelf-stage.test.tsx and
 * tests/unit/bookshelf/scale-budgets.test.ts.
 */

import { type PointerEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/design/motion';
import type { BookItem } from '../_lib/books';
import type { BookStatusFilter } from '../_lib/bookshelf-filters';
import {
  dragOffset,
  dragVelocity,
  flickSteps,
  isSidewaysDrag,
  isTap,
  scrubSteps,
  scrubUnit,
  settleStep,
} from '../_lib/shelf-glide';
import styles from './bookshelf-stage.module.css';
import { CHAIN_STEP_DURATION_MS, type ShelfMotion } from './use-shelf-motion';

/** The wheel travel, in px, that makes one step. */
const WHEEL_THRESHOLD = 20;
/** The wheel is ignored this long after any step starts, so one notch is one step. */
const WHEEL_COOLDOWN_MS = 140;
/** Wheel travel left unused this long is dropped. */
const WHEEL_ACCUMULATOR_RESET_MS = 150;
/** The share of the way to the pointer the ring cursor moves each frame, without reduced motion. */
const CURSOR_LERP = 0.28;
/** Where the ring cursor waits, in px, before the pointer first moves. */
const CURSOR_OFF_SCREEN_PX = -200;
/** The keys that move the stage, and only while it (or nothing) has focus. */
const STAGE_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

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

export interface UseBookshelfNavigationOptions {
  readonly stageRef: RefObject<HTMLDivElement | null>;
  readonly shelfRef: RefObject<HTMLDivElement | null>;
  readonly cursorRef: RefObject<HTMLDivElement | null>;
  /** The stage's position, its refs and the moves (use-shelf-motion.ts). */
  readonly motion: ShelfMotion;
  readonly finePointer: boolean;
  readonly detailOpen: boolean;
  readonly mapOpen: boolean;
  readonly bookCount: number;
  /** The shelf filter's slug, or null for every shelf. */
  readonly activeShelfSlug: string | null;
  readonly statusFilter: BookStatusFilter;
  readonly bookAt: (index: number) => BookItem;
  readonly openDetail: (book: BookItem) => void;
  readonly closeDetail: () => void;
  readonly onUpdateUrlFilter: (patch: { shelf?: string | null; status?: BookStatusFilter }) => void;
}

/** What the stage binds to its element: whether a drag is on, and the pointer handlers. */
export interface BookshelfNavigation {
  readonly isDragging: boolean;
  readonly handleStagePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  readonly handleStagePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  /** Ends a press: a drag's flick or settle, or a tap that steps to or opens a book. */
  readonly finishDrag: (event: PointerEvent<HTMLDivElement>, cancelled?: boolean) => void;
}

/**
 * True when a stage key should move the stage: focus is on the stage (or inside it), or on
 * nothing (the page itself). Anywhere else, such as a shelf chip, a link or a button, the key
 * keeps its own meaning (Home and End scroll the page), as the ARIA carousel pattern has it.
 */
function stageHasFocus(stage: HTMLElement | null): boolean {
  const active = document.activeElement;
  return active === null || active === document.body || Boolean(stage?.contains(active));
}

/**
 * Whether (`x`, `y`) is on the active book's cover, as its turned face is drawn on screen. A
 * press that ends there opens the book even when it started off the slot.
 */
function isOverActiveCover(stage: HTMLElement | null, x: number, y: number): boolean {
  const cover = stage?.querySelector<HTMLElement>('[data-active-slot="true"] [data-book-cover]');
  const rect = cover?.getBoundingClientRect();
  return Boolean(
    rect &&
      rect.width > 0 &&
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom,
  );
}

/** The stage's wheel, keyboard, pointer and cursor handling. */
export function useBookshelfNavigation({
  stageRef,
  shelfRef,
  cursorRef,
  motion,
  finePointer,
  detailOpen,
  mapOpen,
  bookCount,
  activeShelfSlug,
  statusFilter,
  bookAt,
  openDetail,
  closeDetail,
  onUpdateUrlFilter,
}: UseBookshelfNavigationOptions): BookshelfNavigation {
  const { posRef, bookHeightRef, lastStepRef, jumpAnimRef, step, stepBy, jumpTo, cancelChain } =
    motion;
  const detailOpenRef = useRef<boolean>(detailOpen);
  detailOpenRef.current = detailOpen;
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  isDraggingRef.current = isDragging;
  const dragRef = useRef<DragState | null>(null);

  // The wheel steps the stage either way, sideways or down.
  useEffect(() => {
    if (detailOpen) return;
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
      }, WHEEL_ACCUMULATOR_RESET_MS);

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
  }, [detailOpen, mapOpen, step, stageRef, lastStepRef]);

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
      if (STAGE_KEYS.has(event.key) && !stageHasFocus(stageRef.current)) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        jumpTo(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        jumpTo(bookCount - 1);
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
  }, [mapOpen, step, jumpTo, bookCount, openDetail, bookAt, closeDetail, stageRef, posRef]);

  // The ring cursor trails the pointer, reads Open over the active book, shrinks while dragging.
  // Under reduced motion it sits on the pointer instead of trailing it.
  useEffect(() => {
    if (!finePointer || detailOpen) return;
    const lerp = prefersReducedMotion() ? 1 : CURSOR_LERP;
    const state = {
      x: CURSOR_OFF_SCREEN_PX,
      y: CURSOR_OFF_SCREEN_PX,
      tx: CURSOR_OFF_SCREEN_PX,
      ty: CURSOR_OFF_SCREEN_PX,
      seen: false,
    };

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
      state.x += (state.tx - state.x) * lerp;
      state.y += (state.ty - state.y) * lerp;
      const cursorEl = cursorRef.current;
      const stageEl = stageRef.current;
      if (cursorEl && stageEl) {
        cursorEl.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;
        const hit =
          state.seen && !detailOpenRef.current && !mapOpen
            ? document.elementFromPoint(state.tx, state.ty)
            : null;
        const inStage = isDraggingRef.current || Boolean(hit && stageEl.contains(hit));
        const insideCoverRect = isOverActiveCover(stageEl, state.tx, state.ty);
        const onActive =
          !isDraggingRef.current &&
          inStage &&
          (insideCoverRect || Boolean(hit?.closest('[data-active-slot="true"]')));
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
  }, [finePointer, detailOpen, mapOpen, cursorRef, stageRef]);

  const handleStagePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    cancelChain();
    jumpAnimRef.current?.finish();
    jumpAnimRef.current = null;
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
      if (!isSidewaysDrag(totalDx, totalDy)) return;
      drag.isDragging = true;
      setIsDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    const now = performance.now();
    const dt = Math.max(1, now - drag.lastTime);
    const stepDx = event.clientX - drag.lastX;
    drag.vx = dragVelocity(drag.vx, stepDx, dt);
    drag.lastX = event.clientX;
    drag.lastTime = now;

    const unit = scrubUnit(bookHeightRef.current);
    const scrub = scrubSteps(drag.residualX + stepDx, unit);
    drag.residualX = scrub.residual;

    if (scrub.steps !== 0) {
      drag.steppedDuringDrag = true;
      step(scrub.steps, CHAIN_STEP_DURATION_MS);
    }

    const visualOffset = dragOffset(drag.residualX, unit);
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

      const flick = flickSteps(drag.vx);
      const settle = settleStep(
        drag.residualX,
        scrubUnit(bookHeightRef.current),
        drag.steppedDuringDrag,
      );
      if (flick !== 0) stepBy(flick);
      else if (settle !== 0) step(settle);
      return;
    }

    if (cancelled) return;
    if (!isTap(event.clientX - drag.startX, event.clientY - drag.startY)) return;

    const targetEl = (drag.startTarget ?? event.target) as HTMLElement | null;
    const slotEl = targetEl?.closest<HTMLElement>('[data-slot-offset]');
    if (slotEl) {
      const offset = Number(slotEl.dataset.slotOffset);
      if (offset === 0) {
        openDetail(bookAt(posRef.current));
        return;
      }
      if (!Number.isNaN(offset)) {
        const clickedBook = bookAt(posRef.current + offset);
        const nextUrlPatch = {
          ...(activeShelfSlug && clickedBook.shelfSlug !== activeShelfSlug
            ? { shelf: clickedBook.shelfSlug }
            : {}),
          ...(statusFilter !== 'all' && clickedBook.status !== statusFilter
            ? { status: 'all' as const }
            : {}),
        };
        if (Object.keys(nextUrlPatch).length > 0) {
          onUpdateUrlFilter(nextUrlPatch);
        }
        stepBy(offset);
        return;
      }
    }

    // A tap on no slot still opens the active book when it lands on its turned cover.
    if (isOverActiveCover(stageRef.current, event.clientX, event.clientY)) {
      openDetail(bookAt(posRef.current));
    }
  };

  return {
    isDragging,
    handleStagePointerDown,
    handleStagePointerMove,
    finishDrag,
  };
}
