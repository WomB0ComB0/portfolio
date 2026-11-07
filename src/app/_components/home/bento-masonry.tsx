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
 * @file The bento grid's element, and the Waterfall's only script: it keeps each slot's span equal
 * to its measured height where the browser has no native masonry. The slots inside are the
 * server's; this island renders them as given.
 *
 * Where `display: grid-lanes` is supported, bento.module.css lays the slots out natively and this
 * does nothing. Elsewhere a ResizeObserver collects each slot's border-box block size and, in the
 * next animation frame, writes `--rows-js` (rowsFor of that size) on the slot, only when it
 * changed. Writing inside the observer's callback would raise "ResizeObserver loop completed with
 * undelivered notifications" when a lane change moves a slot's width by a fraction of a pixel.
 * A slot is as tall as its tile, never its rows, so the write cannot feed back into the observer.
 *
 * A streamed tile replaces its skeleton inside the same slot, so observing the slots sees it. A
 * MutationObserver adds slots that join the grid later and drops the ones that leave. Without
 * JavaScript, or before this runs, the server's estimates (--rows-sm to --rows-lg, one per tier in
 * bento-layout.ts) hold.
 */

import { type ReactElement, type ReactNode, useEffect, useRef } from 'react';

import { MEASURED_ROWS_PROPERTY, rowsFor } from './bento-layout';

interface BentoMasonryProps {
  /** The grid's class (bento.module.css's grid). */
  className?: string;
  /** The slots, one element each, in priority order. */
  children: ReactNode;
}

/** Whether the browser packs the lanes itself, so measuring is not needed. */
function hasNativeLanes(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
    ? CSS.supports('display', 'grid-lanes')
    : false;
}

function canMeasure(): boolean {
  return (
    typeof ResizeObserver === 'function' &&
    typeof MutationObserver === 'function' &&
    typeof requestAnimationFrame === 'function'
  );
}

/** A slot's border-box block size from its observer entry. */
const blockSizeOf = (entry: ResizeObserverEntry): number =>
  entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;

const elementsOf = (nodes: Iterable<Node>): HTMLElement[] =>
  [...nodes].filter((node): node is HTMLElement => node instanceof HTMLElement);

/**
 * Keeps every slot of `grid` spanning its measured height, from now until the returned cleanup
 * runs. Does nothing (and returns undefined) where lanes are native or the observers are missing.
 */
function measureSlots(grid: HTMLElement): (() => void) | undefined {
  if (hasNativeLanes() || !canMeasure()) return undefined;

  const pending = new Map<HTMLElement, number>();
  let frame: number | null = null;

  const flush = (): void => {
    frame = null;
    for (const [slot, blockSize] of pending) {
      const rows = String(rowsFor(blockSize));
      // A hidden slot measures 0: keep its last span rather than collapse it.
      if (blockSize > 0 && slot.style.getPropertyValue(MEASURED_ROWS_PROPERTY) !== rows) {
        slot.style.setProperty(MEASURED_ROWS_PROPERTY, rows);
      }
    }
    pending.clear();
  };

  const sizes = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target instanceof HTMLElement) pending.set(entry.target, blockSizeOf(entry));
    }
    frame ??= requestAnimationFrame(flush);
  });

  const membership = new MutationObserver((records) => {
    for (const record of records) {
      for (const slot of elementsOf(record.addedNodes)) sizes.observe(slot);
      for (const slot of elementsOf(record.removedNodes)) {
        sizes.unobserve(slot);
        pending.delete(slot);
      }
    }
  });

  for (const slot of elementsOf(grid.children)) sizes.observe(slot);
  membership.observe(grid, { childList: true });

  return () => {
    membership.disconnect();
    sizes.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    pending.clear();
  };
}

/** The bento grid: a div with the given class around the server-rendered slots. */
export function BentoMasonry({ className, children }: BentoMasonryProps): ReactElement {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    return grid ? measureSlots(grid) : undefined;
  }, []);

  return (
    <div ref={gridRef} className={className}>
      {children}
    </div>
  );
}
