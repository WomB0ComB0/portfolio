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
 * @file The live half of the /projects hover preview, loaded lazily by ProjectPreview on a fine
 * pointer only, so a phone never downloads it (nor motion's animate(), which only /stats shares):
 * - the card hangs 8px under the hovered row and 24px right of the pointer, gliding on the house
 *   spring (SPRING_PHYSICS, the JS form of --ease-spring) and interruptible; it scales in from
 *   0.96 only when it was gone, and never leans;
 * - keyboard focus on any link in a row, and reduced motion, pin it outside the row with a fade
 *   only (positions jump; scale stays 1);
 * - where the window has no room for it clear of the row (a short or zoomed window), it stays
 *   hidden, and a pinned row that scrolls under the stuck bar hides it: it never covers the row,
 *   its focused link or the bar;
 * - Escape hides it (WCAG 1.4.13, dismissible) until the pointer or focus reaches another row;
 *   the key is never consumed, so it still closes a popover or the sheet.
 * It stays up anywhere in the groups (a year bar included), hides 60ms after the pointer leaves,
 * and hides at once when `resetOn` changes (any filter or URL change). Moving the pointer never
 * re-renders React: it only sets motion values.
 */

import { animate, useMotionValue, useSpring } from 'motion/react';
import {
  type ReactElement,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import {
  DURATION_MS,
  EASE,
  prefersReducedMotion,
  SPRING,
  SPRING_PHYSICS,
  seconds,
} from '@/lib/design/motion';
import type { PreviewItem } from '../_lib/project-index';
import { PreviewCard } from './project-preview-card';
import {
  type CardState,
  EMPTY_CARD,
  hideCard,
  pointerSpot,
  rowSpot,
  type Spot,
  showRow,
  type Viewport,
} from './project-preview-geometry';

/** Leaving the groups hides the card only after this long, so a brush past an edge never blinks. */
const HIDE_DELAY_MS = 60;
const START_SCALE = 0.96;
/** Above this opacity a card that was fading out is still on screen: it comes back, not in. */
const STILL_SHOWN = 0.02;

/** The row under an event's target, if it is one of this preview's rows. */
const rowOf = (target: EventTarget | null, root: HTMLElement): HTMLElement | null => {
  const row = target instanceof Element ? target.closest<HTMLElement>('[data-preview-id]') : null;
  return row && root.contains(row) ? row : null;
};

const idOf = (row: HTMLElement): string => row.dataset.previewId ?? '';

/** Whether focus reached `target` from the keyboard (where the browser can say so). */
function isKeyboardFocus(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  try {
    return target.matches(':focus-visible');
  } catch {
    return false;
  }
}

/** The window's size without its scrollbar, where the browser reports one. */
const viewportOf = (): Viewport => ({
  width: document.documentElement.clientWidth || window.innerWidth,
  height: window.innerHeight,
});

/** The bottom of this list's filter bar on screen (0 when it has none), which the card stays under. */
function topLimitOf(root: HTMLElement): number {
  const bar = root.closest('[data-filter-scope]')?.querySelector('[data-filter-part="bar"]');
  return bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
}

/** The card's state and motion: where it goes, showing a row, and hiding. */
function usePreviewCard() {
  const [state, setState] = useState<CardState>(EMPTY_CARD);
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const x = useSpring(targetX, SPRING_PHYSICS);
  const y = useSpring(targetY, SPRING_PHYSICS);
  const opacity = useMotionValue(0);
  const scale = useMotionValue(START_SCALE);
  const visible = useRef(false);
  const pinned = useRef<HTMLElement | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);

  /** Sets where the card goes: gliding on the spring, or jumping (always on its first show). */
  const place = useCallback(
    ([left, top]: Spot, glide: boolean) => {
      targetX.set(left);
      targetY.set(top);
      if (!glide || !visible.current) {
        x.jump(left);
        y.jump(top);
      }
    },
    [targetX, targetY, x, y],
  );

  /**
   * Shows row `id`. A card still on screen (fading out) comes back from where it is; only a card
   * that was gone springs in from START_SCALE. `fadeOnly` (keyboard) and reduced motion never scale.
   */
  const show = useCallback(
    (id: string, fadeOnly: boolean) => {
      window.clearTimeout(hideTimer.current);
      setState((current) => showRow(current, id));
      if (visible.current) return;
      visible.current = true;
      const stillShown = opacity.get() > STILL_SHOWN;
      animate(opacity, 1, { duration: seconds(DURATION_MS.base), ease: [...EASE.effect] });
      if (fadeOnly || prefersReducedMotion()) scale.jump(1);
      else animate(scale, stillShown ? 1 : [START_SCALE, 1], SPRING);
    },
    [opacity, scale],
  );

  /** Fades the card out over `durationMs` now; nothing when it is already hidden. */
  const hideNow = useCallback(
    (durationMs: number) => {
      window.clearTimeout(hideTimer.current);
      if (!visible.current) return;
      visible.current = false;
      pinned.current = null;
      animate(opacity, 0, { duration: seconds(durationMs), ease: [...EASE.effect] });
      setState(hideCard);
    },
    [opacity],
  );

  const hide = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => hideNow(DURATION_MS.slow), HIDE_DELAY_MS);
  }, [hideNow]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  return useMemo(
    () => ({ state, x, y, opacity, scale, visible, pinned, place, show, hide, hideNow }),
    [state, x, y, opacity, scale, place, show, hide, hideNow],
  );
}

type PreviewCardControls = ReturnType<typeof usePreviewCard>;

/** The pointer, focus, key and scroll listeners. */
function usePreviewListeners(
  rootRef: RefObject<HTMLDivElement | null>,
  { visible, pinned, place, show, hide, hideNow }: PreviewCardControls,
): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let pointer: { readonly x: number; readonly y: number } | null = null;
    let frame = 0;
    /** The row last shown, and the row Escape dismissed (it stays hidden until another row). */
    let lastRow: HTMLElement | null = null;
    let dismissed: string | null = null;

    /** False for the row Escape dismissed; any other row clears the dismissal. */
    const allowed = (row: HTMLElement): boolean => {
      if (idOf(row) === dismissed) return false;
      dismissed = null;
      return true;
    };
    /** Shows `row` at `spot`, or hides the card at once where it has none (it would cover a row). */
    const showAt = (row: HTMLElement, spot: Spot | null, glide: boolean): void => {
      if (!spot) {
        hideNow(DURATION_MS.fast);
        return;
      }
      lastRow = row;
      place(spot, glide);
      show(idOf(row), !glide);
    };
    /** Pins the card beside `row` (keyboard, reduced motion); it stays pinned only where it shows. */
    const pinTo = (row: HTMLElement): void => {
      const spot = rowSpot(row.getBoundingClientRect(), viewportOf(), topLimitOf(root));
      showAt(row, spot, false);
      pinned.current = spot ? row : null;
    };
    /** Glides the card to its spot beside `row` for a pointer at x `pointerX`. */
    const follow = (row: HTMLElement, pointerX: number): void => {
      pinned.current = null;
      const box = row.getBoundingClientRect();
      showAt(row, pointerSpot(pointerX, box, viewportOf(), topLimitOf(root)), true);
    };
    /** Follows the pointer over a row, or pins to it under reduced motion; ignores touch. */
    const onPointerMove = (event: PointerEvent): void => {
      if (event.pointerType === 'touch') return;
      pointer = { x: event.clientX, y: event.clientY };
      const row = rowOf(event.target, root);
      if (!row || !allowed(row)) return;
      if (!prefersReducedMotion()) follow(row, event.clientX);
      else if (pinned.current !== row) pinTo(row);
    };
    /** Leaving hides the card, unless the keyboard pinned it to a row that still has focus. */
    const onPointerLeave = (): void => {
      pointer = null;
      if (!root.contains(document.activeElement) || !pinned.current) hide();
    };
    /** Keyboard focus on any link in a row pins the card to that row (the link, not the row). */
    const onFocusIn = (event: FocusEvent): void => {
      const row = rowOf(event.target, root);
      if (row && isKeyboardFocus(event.target) && allowed(row)) pinTo(row);
    };
    const onFocusOut = (event: FocusEvent): void => {
      if (!rowOf(event.relatedTarget, root) && !pointer) hide();
    };
    /** Escape hides a shown card and keeps its row dismissed; the key still reaches the page. */
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !visible.current || !lastRow) return;
      dismissed = idOf(lastRow);
      hideNow(DURATION_MS.fast);
    };
    /**
     * Scrolling moves the rows under a still pointer, or the pinned row under the card: the card
     * follows it, and hides once the row has slid under the stuck bar or off the window.
     */
    const retarget = (): void => {
      if (pinned.current) {
        const row = pinned.current;
        showAt(row, rowSpot(row.getBoundingClientRect(), viewportOf(), topLimitOf(root)), false);
        return;
      }
      const under = pointer ? document.elementFromPoint(pointer.x, pointer.y) : null;
      const row = rowOf(under, root);
      if (row && pointer) {
        if (!allowed(row)) hideNow(DURATION_MS.fast);
        else if (prefersReducedMotion()) pinTo(row);
        else follow(row, pointer.x);
      } else if (!under || !root.contains(under)) hide();
    };
    const onScroll = (): void => {
      if (frame || !visible.current) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        retarget();
      });
    };

    root.addEventListener('pointermove', onPointerMove, { passive: true });
    root.addEventListener('pointerleave', onPointerLeave);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, { passive: true });
    // This half loads lazily: a row a keyboard user reached before it arrived is pinned now.
    const focusedRow = rowOf(document.activeElement, root);
    if (focusedRow && isKeyboardFocus(document.activeElement)) pinTo(focusedRow);
    return () => {
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onPointerLeave);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [rootRef, visible, pinned, place, show, hide, hideNow]);
}

export interface LivePreviewProps {
  /** The element around the rows (ProjectPreview's), which the listeners attach to. */
  readonly rootRef: RefObject<HTMLDivElement | null>;
  /** Each row's card, by its `data-preview-id`. */
  readonly items: Readonly<Record<string, PreviewItem>>;
  /** Changes on any filter or URL change: the card hides at once. */
  readonly resetOn: string;
}

/** The card, portalled to the body, and the listeners that move it. */
export function LivePreview({ rootRef, items, resetOn }: LivePreviewProps): ReactElement {
  const card = usePreviewCard();
  const lastReset = useRef(resetOn);
  usePreviewListeners(rootRef, card);

  const { hideNow } = card;
  useEffect(() => {
    if (lastReset.current === resetOn) return;
    lastReset.current = resetOn;
    hideNow(DURATION_MS.fast);
  }, [resetOn, hideNow]);

  return createPortal(
    <PreviewCard
      items={items}
      state={card.state}
      x={card.x}
      y={card.y}
      opacity={card.opacity}
      scale={card.scale}
    />,
    document.body,
  );
}
