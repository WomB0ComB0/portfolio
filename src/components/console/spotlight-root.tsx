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
 * @file One delegated pointer listener that steers every tile spotlight on the page.
 *
 * The `spotlight` utility draws a glow centred on `--spot-x`/`--spot-y`. Rather than a listener
 * (and a client component) per tile, this sets those two properties on whichever
 * `[data-spotlight]` element the mouse is over, at most once per animation frame. Tiles stay
 * server components. Mount it once, in the shell layout.
 */

import { useEffect } from 'react';

const SPOTLIGHT_SELECTOR = '[data-spotlight]';

interface SpotPosition {
  readonly host: HTMLElement;
  readonly clientX: number;
  readonly clientY: number;
}

/** Touch and pen have no hover glow. jsdom has no PointerEvent, so its events count as mouse. */
const isMousePointer = (event: PointerEvent): boolean => (event.pointerType ?? 'mouse') === 'mouse';

function spotlightHost(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const host = target.closest(SPOTLIGHT_SELECTOR);
  return host instanceof HTMLElement ? host : null;
}

/** Writes the pointer position relative to the host's border box, in px. */
function placeSpot({ host, clientX, clientY }: SpotPosition): void {
  const rect = host.getBoundingClientRect();
  host.style.setProperty('--spot-x', `${clientX - rect.left}px`);
  host.style.setProperty('--spot-y', `${clientY - rect.top}px`);
}

/**
 * Moves each tile's spotlight under the mouse. Renders nothing.
 *
 * Moves are batched to one write per animation frame (the latest position wins), and the host's
 * box is measured inside that frame, not per event.
 */
export function SpotlightRoot(): null {
  useEffect(() => {
    let frame: number | null = null;
    let latest: SpotPosition | null = null;

    const flush = (): void => {
      frame = null;
      if (latest) placeSpot(latest);
      latest = null;
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!isMousePointer(event)) return;
      const host = spotlightHost(event.target);
      if (!host) return;
      latest = { host, clientX: event.clientX, clientY: event.clientY };
      frame ??= requestAnimationFrame(flush);
    };

    document.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
