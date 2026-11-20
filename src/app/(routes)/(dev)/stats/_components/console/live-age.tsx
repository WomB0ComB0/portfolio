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
 * @file The live age in the /stats header strip, '22.65753 years old': five decimals, as the
 * counter on the first site's dashboard showed, without what that counter cost.
 *
 * - The first render prints the age at `at`, the moment the server rendered the page, on the
 *   server and in the hydrating browser alike, so the two agree to the character and there is no
 *   mismatch to suppress. The clock starts after mount.
 * - Each tick writes through refs, and only text that changed: React never renders again. (The
 *   first site set state every 10 ms, a hundred renders a second, for a fifth decimal that moves
 *   once every 5 min 15 s.)
 * - A tick is an animation frame, a tenth of a second after the last (a second under reduced
 *   motion), so a write lands with a paint and an idle page is not woken every frame. A hidden
 *   tab stops the clock, and it catches up the moment the tab shows again.
 * - The digits on screen are hidden from screen readers and never live. A twin gives the whole
 *   years, which the strip's label completes ('years old, 22'), and changes once a year.
 * - Tabular figures in a box held at the figure's width by an unseen '00.00000', so a ticking
 *   digit never moves anything.
 *
 * The decimals are muted, as a unit is: the whole years stay the figure.
 */

import { type ReactElement, useEffect, useRef } from 'react';

import { exactAgeParts } from '@/constants/age';
import { REDUCED_MOTION_QUERY } from '@/lib/design/motion';
import { cn } from '@/lib/utils';

/** Ten updates a second: the last digit is never more than a tenth of a second late. */
export const TICK_MS = 100;

/** Once a second when the visitor asked for less motion. */
export const REDUCED_TICK_MS = 1_000;

/** Writes `text` into `node` only when it differs, so a tick that changes nothing touches nothing. */
function writeText(node: HTMLElement | null, text: string): void {
  if (node && node.textContent !== text) node.textContent = text;
}

export interface LiveAgeProps {
  /** When the server rendered the page (epoch ms): the age the first render shows. */
  readonly at: number;
  readonly className?: string;
}

/**
 * The owner's age to five decimals, kept current while the page is visible. Renders nothing for an
 * invalid `at`.
 *
 * @example
 * <LiveAge at={now} />
 */
export function LiveAge({ at, className }: LiveAgeProps): ReactElement | null {
  const spokenRef = useRef<HTMLSpanElement>(null);
  const wholeRef = useRef<HTMLSpanElement>(null);
  const fractionRef = useRef<HTMLSpanElement>(null);
  const initial = exactAgeParts(new Date(at));

  useEffect(() => {
    const reducedMotion =
      typeof globalThis.matchMedia === 'function'
        ? globalThis.matchMedia(REDUCED_MOTION_QUERY)
        : null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame: number | undefined;

    const show = (): void => {
      const parts = exactAgeParts(new Date());
      if (!parts) return;
      writeText(spokenRef.current, parts.whole);
      writeText(wholeRef.current, parts.whole);
      writeText(fractionRef.current, parts.fraction);
    };

    const stop = (): void => {
      if (timer !== undefined) clearTimeout(timer);
      if (frame !== undefined) cancelAnimationFrame(frame);
      timer = undefined;
      frame = undefined;
    };

    // The preference is read at every tick, so changing it takes effect within a second.
    const schedule = (): void => {
      timer = setTimeout(
        () => {
          timer = undefined;
          frame = requestAnimationFrame(() => {
            frame = undefined;
            show();
            schedule();
          });
        },
        reducedMotion?.matches ? REDUCED_TICK_MS : TICK_MS,
      );
    };

    const start = (): void => {
      stop();
      if (document.hidden) return;
      show();
      schedule();
    };

    const onVisibilityChange = (): void => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stop();
    };
  }, []);

  if (!initial) return null;

  // '00.00000': laid in the digits' grid cell, unseen, it holds the box at the figure's width in
  // the font as rendered (`ch` measures Geist's proportional zero, wider than its tabular digits).
  const template = `${'0'.repeat(initial.whole.length)}.${'0'.repeat(initial.fraction.length)}`;

  return (
    <span aria-live="off" className={cn('tabular-nums', className)}>
      <span ref={spokenRef} className="sr-only">
        {initial.whole}
      </span>
      <span aria-hidden="true" className="inline-grid">
        <span className="invisible col-start-1 row-start-1">{template}</span>
        <span data-digits="" className="col-start-1 row-start-1">
          <span ref={wholeRef}>{initial.whole}</span>
          <span className="text-muted-foreground">
            .<span ref={fractionRef}>{initial.fraction}</span>
          </span>
        </span>
      </span>
    </span>
  );
}
