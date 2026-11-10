'use client';

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
 * @file The wall's input: drag with a mouse, pen or finger (past a small slop, so a tap still
 * opens), a glide on release (none under reduced motion or after a cancelled pointer), a sideways
 * wheel or trackpad swipe that pans (a vertical one still scrolls the page), and the keyboard
 * model of its one Tab stop: arrows move the active photo and spring the wall to centre it (a
 * jump under reduced motion), Enter or Space opens it. A click that ends a drag opens nothing.
 * The pan is two motion values, written once a frame, so the cards move by transform only.
 */

import { animate, type MotionValue } from 'motion/react';
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { prefersReducedMotion, SPRING } from '@/lib/design/motion';
import { type Cell, centreCell, type Geometry, panToCentre } from '../_lib/wall-geometry';
import {
  glideStep,
  isGliding,
  type PointerSample,
  releaseVelocity,
  VELOCITY_WINDOW_MS,
  type Velocity,
} from '../_lib/wall-glide';

/** How far a press must travel before it is a drag rather than a tap. */
const DRAG_SLOP_PX = 6;
const MS_PER_SECOND = 1000;
/** The arrow keys' steps, in cells. */
const STEPS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

interface Stoppable {
  readonly stop: () => void;
}

interface DragState {
  readonly id: number;
  readonly x0: number;
  readonly y0: number;
  readonly px0: number;
  readonly py0: number;
  readonly moved: boolean;
  readonly samples: readonly PointerSample[];
}

/**
 * Glides the pan on from a release speed, slowing exponentially (glideStep), one motion value
 * write per frame. Returns the handle that stops it.
 */
function startGlide(
  panX: MotionValue<number>,
  panY: MotionValue<number>,
  from: Velocity,
): Stoppable {
  let velocity = from;
  let last = 0;
  let id = 0;
  const step = (time: number): void => {
    if (last) {
      const next = glideStep(velocity, (time - last) / MS_PER_SECOND);
      velocity = next.velocity;
      panX.set(panX.get() + next.delta.x);
      panY.set(panY.get() + next.delta.y);
    }
    last = time;
    if (isGliding(velocity)) id = requestAnimationFrame(step);
  };
  if (isGliding(velocity)) id = requestAnimationFrame(step);
  return { stop: () => cancelAnimationFrame(id) };
}

/** The cell a card stands for, from its data-cell ("c:r"). */
const cellOf = (card: HTMLElement): Cell => {
  const [c = 0, r = 0] = (card.dataset.cell ?? '0:0').split(':').map(Number);
  return { c, r };
};

/** Whether an element shows keyboard focus (false where the selector isn't supported). */
const showsFocusRing = (element: Element): boolean => {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
};

export interface WallInputOptions {
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  readonly geometry: Geometry | null;
  readonly panX: MotionValue<number>;
  readonly panY: MotionValue<number>;
  /** Opens the photo in a cell: a click on its card, or Enter on the active one. */
  readonly onOpenCell: (cell: Cell) => void;
  /** Says a cell: on every arrow move and every keyboard focus. */
  readonly onAnnounce: (cell: Cell) => void;
}

export interface WallHandlers {
  readonly onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  readonly onClick: (event: MouseEvent<HTMLDivElement>) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly onFocus: () => void;
}

/** The wall's pointer, wheel and keyboard handling, and its active (keyboard) cell. */
export function useWallInput({
  viewportRef,
  geometry,
  panX,
  panY,
  onOpenCell,
  onAnnounce,
}: WallInputOptions): { readonly active: Cell | null; readonly handlers: WallHandlers } {
  const [active, setActive] = useState<Cell | null>(null);
  const drag = useRef<DragState | null>(null);
  /** Set when a press dragged, so the click that ends it doesn't open a photo. */
  const suppressClick = useRef(false);
  const motions = useRef<readonly Stoppable[]>([]);

  const stopMotions = useCallback(() => {
    for (const motion of motions.current) motion.stop();
    motions.current = [];
  }, []);

  useEffect(() => stopMotions, [stopMotions]);

  // A sideways wheel or trackpad swipe pans; a vertical wheel is left to scroll the page. Not
  // passive, so only the sideways one can be kept from scrolling.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const onWheel = (event: WheelEvent): void => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      stopMotions();
      panX.set(panX.get() - event.deltaX);
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [panX, stopMotions, viewportRef]);

  /** Springs the wall to centre `cell` (a jump under reduced motion). */
  const centre = (cell: Cell): void => {
    if (!geometry) return;
    stopMotions();
    const target = panToCentre(cell, geometry);
    if (prefersReducedMotion()) {
      panX.set(target.x);
      panY.set(target.y);
      return;
    }
    motions.current = [animate(panX, target.x, SPRING), animate(panY, target.y, SPRING)];
  };

  const nearest = (): Cell | null =>
    geometry ? centreCell(panX.get(), panY.get(), geometry) : null;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    stopMotions();
    suppressClick.current = false;
    drag.current = {
      id: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      px0: panX.get(),
      py0: panY.get(),
      moved: false,
      samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    const dx = event.clientX - state.x0;
    const dy = event.clientY - state.y0;
    if (!state.moved && Math.hypot(dx, dy) < DRAG_SLOP_PX) return;
    if (!state.moved) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // A pointer the browser no longer tracks: the drag still works without capture.
      }
      event.currentTarget.dataset.dragging = 'true';
    }
    panX.set(state.px0 + dx);
    panY.set(state.py0 + dy);
    drag.current = {
      ...state,
      moved: true,
      // The window's moves, plus the one just before it as the speed's starting point.
      samples: [
        ...state.samples.filter((sample) => event.timeStamp - sample.t <= VELOCITY_WINDOW_MS * 2),
        { t: event.timeStamp, x: event.clientX, y: event.clientY },
      ],
    };
  };

  /** Ends a press: a drag glides on (not when cancelled or under reduced motion). */
  const endDrag = (event: PointerEvent<HTMLDivElement>, cancelled: boolean): void => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;
    delete event.currentTarget.dataset.dragging;
    // A tap opens its photo on the click that follows (onClick), not here: a touch's mouse
    // events come after its pointerup, and would land on a dialog opened this early.
    suppressClick.current = state.moved;
    if (!state.moved || cancelled || prefersReducedMotion()) return;
    motions.current = [startGlide(panX, panY, releaseVelocity(state.samples, event.timeStamp))];
  };

  /** A click (a tap, or a mouse press that didn't drag) opens the photo under it. */
  const onClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const card =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-cell]') : null;
    if (!card || !event.currentTarget.contains(card)) return;
    const cell = cellOf(card);
    setActive(cell);
    onOpenCell(cell);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = STEPS[event.key];
    if (step) {
      event.preventDefault();
      const from = active ?? nearest();
      if (!from) return;
      const next = { c: from.c + step[0], r: from.r + step[1] };
      setActive(next);
      centre(next);
      onAnnounce(next);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && active) {
      event.preventDefault();
      onOpenCell(active);
    }
  };

  /** Every keyboard focus says where it is, coming back from an open photo included. */
  const onFocus = (): void => {
    const viewport = viewportRef.current;
    if (!viewport || !showsFocusRing(viewport)) return;
    const cell = active ?? nearest();
    if (!cell) return;
    if (!active) setActive(cell);
    onAnnounce(cell);
  };

  return {
    active,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (event) => endDrag(event, false),
      onPointerCancel: (event) => endDrag(event, true),
      onClick,
      onKeyDown,
      onFocus,
    },
  };
}
