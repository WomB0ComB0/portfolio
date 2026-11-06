/**
 * Copyright 2025 Mike Odnis
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
 * @file A number that glides to its new value when it changes, for figures a live query updates.
 *
 * The first render (server and client alike) prints the final value, so there is no count-up
 * from zero on load and nothing to mismatch on hydration. Only a later change animates, and
 * only the visible copy: screen readers get the final value at once from an sr-only twin.
 * Frames write textContent through a ref, so the tween never re-renders React. No motion/react:
 * the ease-out-expo curve comes from the shared EASE token.
 */

import { type ReactElement, useLayoutEffect, useRef } from 'react';

import { numberFormatter } from '@/components/console/stat-strip';
import { DURATION_MS, EASE, prefersReducedMotion } from '@/lib/design/motion';
import { cn } from '@/lib/utils';

type BezierPoints = readonly [x1: number, y1: number, x2: number, y2: number];

/** 20 halvings pin the curve's time to within 1e-6, far below one pixel of any figure. */
const BISECTION_STEPS = 20;

/** One axis of a cubic Bézier from 0 to 1 whose control values are a1 and a2, at time t. */
const bezierAxis = (a1: number, a2: number, t: number): number => {
  const u = 1 - t;
  return 3 * u * u * t * a1 + 3 * u * t * t * a2 + t * t * t;
};

/** CSS cubic-bezier() as a function of progress: finds t where x(t) = progress, returns y(t). */
function cubicBezier([x1, y1, x2, y2]: BezierPoints): (progress: number) => number {
  return (progress) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    let low = 0;
    let high = 1;
    for (let step = 0; step < BISECTION_STEPS; step += 1) {
      const mid = (low + high) / 2;
      if (bezierAxis(x1, x2, mid) < progress) low = mid;
      else high = mid;
    }
    return bezierAxis(y1, y2, (low + high) / 2);
  };
}

const easeOutExpo = cubicBezier(EASE.outExpo);

/** Whether a change should show at once instead of gliding. */
const showsAtOnce = (from: number, to: number, durationMs: number): boolean =>
  from === to ||
  !Number.isFinite(from) ||
  !Number.isFinite(to) ||
  durationMs <= 0 ||
  document.hidden ||
  prefersReducedMotion();

/** The number shown at `eased` of the way; whole numbers stay whole while they glide. */
function numberBetween(from: number, to: number, eased: number): number {
  const next = from + (to - from) * eased;
  return Number.isInteger(from) && Number.isInteger(to) ? Math.round(next) : next;
}

export interface LiveNumberProps {
  value: number;
  /** Intl options; the locale is always en-US so server and client text match. */
  format?: Intl.NumberFormatOptions;
  /** How long a change glides. Defaults to the `--motion-tween` token. */
  durationMs?: number;
  className?: string;
}

/**
 * A formatted number that tweens from what is on screen to each new `value`.
 *
 * It shows the new value at once, without a tween, under reduced motion, in a hidden tab, for a
 * non-finite number, or when nothing changed. A change during a tween restarts from the number
 * on screen.
 */
export function LiveNumber({
  value,
  format,
  durationMs = DURATION_MS.tween,
  className,
}: LiveNumberProps): ReactElement {
  const formatter = numberFormatter(format);
  const final = formatter.format(value);
  const visibleRef = useRef<HTMLSpanElement>(null);
  const shownRef = useRef(value);

  // A layout effect: React has already written the final text, and the first frame of a tween
  // must replace it before the browser paints, or the new value flashes first.
  useLayoutEffect(() => {
    const node = visibleRef.current;
    const from = shownRef.current;
    if (!node) return;

    if (showsAtOnce(from, value, durationMs)) {
      shownRef.current = value;
      node.textContent = formatter.format(value);
      return;
    }

    node.textContent = formatter.format(from);
    const start = performance.now();
    const step = (now: number): void => {
      const progress = Math.min(1, Math.max(0, (now - start) / durationMs));
      shownRef.current = progress < 1 ? numberBetween(from, value, easeOutExpo(progress)) : value;
      node.textContent = formatter.format(shownRef.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    let frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [value, formatter, durationMs]);

  return (
    <span className={cn('tabular-nums', className)}>
      <span className="sr-only">{final}</span>
      <span aria-hidden="true" ref={visibleRef}>
        {final}
      </span>
    </span>
  );
}
