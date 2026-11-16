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
 * @file The typing tile's accuracy gauge (the lab's `stats-accuracy=gauge`): a ring split into
 * the share reached (brand) and the rest (a surface-3 track), a small gap on each side.
 *
 * Adapted from Magic UI's Animated Circular Progress Bar
 * (https://magicui.design/docs/components/animated-circular-progress-bar), rewritten in this
 * repo's style: palette tokens instead of colour props, the arcs' lengths computed here rather
 * than in CSS custom properties, and motion only on a change. Server-safe (no directive, no
 * hooks): the server HTML holds the final ring, and since CSS transitions never run on first
 * paint, the ring never sweeps up from 0 on load. When the value changes on a later render (a
 * refresh), the arcs glide on --motion-tween with ease-out-expo; under reduced motion they jump.
 * The ring is decorative: the percentage is printed in its centre and said in full to screen
 * readers.
 *
 * Magic UI's licence, kept with the adapted work as it requires:
 *
 * MIT License
 *
 * Copyright (c) Magic UI
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';

/** The ring in a 100-unit box: its radius and stroke, so the stroke never clips. */
const RADIUS = 45;
const STROKE = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** The gap on each side of the reached arc, in percent of the ring (Magic UI's 5). */
const GAP_PERCENT = 5;
const DEGREES_PER_PERCENT = 3.6;
/** The ring starts at twelve o'clock. */
const START_DEGREES = -90;

/**
 * Both arcs glide on a change (length, and the track's start), from the centre of their own
 * box. Never on load: a transition needs a value to change from.
 */
const ARC_CLASS =
  'origin-center [transform-box:fill-box] transition-[stroke-dasharray,rotate] duration-(--motion-tween) ease-out-expo motion-reduce:transition-none';
/** Forced colours ignore the palette: the system's text and grey keep the two arcs apart. */
const REACHED_CLASS = 'stroke-brand forced-colors:stroke-[CanvasText]';
const TRACK_CLASS = 'stroke-surface-3 forced-colors:stroke-[GrayText]';
const LABEL_CLASS = 'text-[0.8125rem] font-semibold leading-none tracking-[-0.01em] tabular-nums';

/** A dash `percent` of the ring long, then a gap the whole ring long. */
const dash = (percent: number): string =>
  `${((percent / 100) * CIRCUMFERENCE).toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`;

/** `value` as a share of 100, kept between 0 and 100. */
const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

export interface AccuracyGaugeProps {
  /** A percentage, 0 to 100; outside that it is clamped. */
  readonly value: number;
  /** What screen readers hear, e.g. '93% accuracy'. */
  readonly label: string;
  readonly className?: string;
}

/**
 * The gauge. The reached arc is hidden at 0 (a round cap would leave a dot), and the track at 90
 * and above (the two gaps would swallow it), as in Magic UI. Renders nothing for a non-finite
 * value: the caller shows the words instead.
 */
export function AccuracyGauge({
  value,
  label,
  className,
}: AccuracyGaugeProps): ReactElement | null {
  if (!Number.isFinite(value)) return null;
  const percent = clampPercent(value);
  const track = 100 - percent - 2 * GAP_PERCENT;
  const trackStart = START_DEGREES + (percent + GAP_PERCENT) * DEGREES_PER_PERCENT;

  return (
    <span
      data-gauge=""
      className={cn('relative grid size-14 shrink-0 place-items-center', className)}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden="true"
        focusable="false"
        className="absolute inset-0 size-full"
      >
        {track > 0 && (
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            strokeWidth={STROKE}
            strokeLinecap="round"
            className={cn(ARC_CLASS, TRACK_CLASS)}
            style={{ strokeDasharray: dash(track), rotate: `${trackStart.toFixed(2)}deg` }}
          />
        )}
        {percent > 0 && (
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            strokeWidth={STROKE}
            strokeLinecap="round"
            className={cn(ARC_CLASS, REACHED_CLASS)}
            style={{ strokeDasharray: dash(percent), rotate: `${START_DEGREES}deg` }}
          />
        )}
      </svg>
      <span aria-hidden="true" className={cn(LABEL_CLASS, 'text-foreground')}>
        {Math.round(percent)}%
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
