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

import { type ReactElement, type RefObject, useEffect, useRef } from 'react';

import { pauseAnimationsUnderEdge, type UnderEdgeWatch } from './pause-under-edge';

/** Blur layers per band (src/styles/edge-haze.css). Under a coarse pointer the CSS hides the last. */
export const EDGE_HAZE_LAYERS = 8;

/** The opacities the fallback sets on .edge-haze, which edge-haze.css reads without a scroll timeline. */
export const EDGE_HAZE_TOP_OPACITY = '--edge-haze-top-opacity';
export const EDGE_HAZE_BOTTOM_OPACITY = '--edge-haze-bottom-opacity';

const LAYER_KEYS = Array.from({ length: EDGE_HAZE_LAYERS }, (_, index) => `layer-${index + 1}`);

/** Where the page is scrolled, and how tall the two bands are, in px. */
export interface EdgeHazeScroll {
  readonly scrollY: number;
  /** How far the page scrolls: its height less the window's. */
  readonly maxScroll: number;
  readonly topHeight: number;
  readonly bottomHeight: number;
}

/** Each band's opacity, 0 to 1. */
export interface EdgeHazeOpacity {
  readonly top: number;
  readonly bottom: number;
}

/** How far into a band's height `distance` reaches, 0 to 1; a band of no height is on or off. */
const ramp = (distance: number, height: number): number => {
  if (height <= 0) return distance > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, distance / height));
};

/**
 * What the CSS scroll timeline computes: the top band fades in over the first top-band height of
 * scroll, the bottom one fades out over the last bottom-band height. On a page too short to
 * scroll both stay hidden, as an inactive timeline leaves them.
 */
export function edgeHazeOpacity({
  scrollY,
  maxScroll,
  topHeight,
  bottomHeight,
}: EdgeHazeScroll): EdgeHazeOpacity {
  if (maxScroll <= 0) return { top: 0, bottom: 0 };
  return { top: ramp(scrollY, topHeight), bottom: ramp(maxScroll - scrollY, bottomHeight) };
}

const supportsScrollTimeline = (): boolean =>
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('animation-timeline: scroll()');

/**
 * Only where the browser has no scroll-driven animations (Firefox; Safari before 26): fades the
 * bands from the scroll position, at most once per frame, and again when the page or the window
 * changes size (a client navigation, a filter). Effects never run on the server.
 */
function useScrollFadeFallback(ref: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const haze = ref.current;
    if (!haze || supportsScrollTimeline()) return;
    const top = haze.querySelector<HTMLElement>('.t');
    const bottom = haze.querySelector<HTMLElement>('.b');
    if (!top || !bottom) return;

    let frame = 0;
    const update = (): void => {
      frame = 0;
      const opacity = edgeHazeOpacity({
        scrollY: window.scrollY,
        maxScroll: document.documentElement.scrollHeight - window.innerHeight,
        topHeight: top.offsetHeight,
        bottomHeight: bottom.offsetHeight,
      });
      haze.style.setProperty(EDGE_HAZE_TOP_OPACITY, String(opacity.top));
      haze.style.setProperty(EDGE_HAZE_BOTTOM_OPACITY, String(opacity.bottom));
    };
    const schedule = (): void => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    const resize = new ResizeObserver(schedule);
    resize.observe(document.body);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}

/**
 * Pauses the pulsing placeholders, live dots and home equaliser that sit under a band while the
 * haze is mounted, and after each route change lets go of the ones the last route left behind
 * (an observer reports nothing for an element removed clear of the bands).
 */
function usePauseUnderEdge(ref: RefObject<HTMLDivElement | null>, path: string): void {
  const watch = useRef<UnderEdgeWatch | null>(null);
  const sweptPath = useRef(path);

  useEffect(() => {
    const haze = ref.current;
    if (!haze) return;
    const started = pauseAnimationsUnderEdge(haze);
    watch.current = started;
    return () => {
      watch.current = null;
      started.stop();
    };
  }, [ref]);

  useEffect(() => {
    if (sweptPath.current === path) return;
    sweptPath.current = path;
    watch.current?.sweep();
  }, [path]);
}

/** One band: the blur layers, the tint, and above the top band the safe-area cap. */
function Band({ edge }: { edge: 't' | 'b' }): ReactElement {
  return (
    <div className={edge}>
      {LAYER_KEYS.map((key) => (
        <i key={key} className="l" />
      ))}
      <i className="tn" />
      {edge === 't' && <i className="cap" />}
    </div>
  );
}

export interface EdgeHazeProps {
  /** The current route, which the shell reads: on each change the haze sweeps its watcher. */
  readonly path: string;
}

/**
 * The scroll edge haze: a straight band of progressive blur at the top and the bottom of the
 * page column, tinted with the canvas, so the page softens into the screen's edges as it scrolls
 * (variant A of the blur lab, iOS 26's scroll edge). edge-haze.css draws and fades it.
 *
 * Mounted once by the shell, after the page column: fixed, so it never moves the layout;
 * pointer-events none and aria-hidden, so it never takes a click, a hover, focus, a selection or
 * a screen reader's attention. While it is mounted, pulsing placeholders, live dots and the home
 * equaliser pause under its bands, where each of their frames would blur a band again.
 */
export function EdgeHaze({ path }: EdgeHazeProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useScrollFadeFallback(ref);
  usePauseUnderEdge(ref, path);

  return (
    <div ref={ref} className="edge-haze" aria-hidden="true">
      <Band edge="t" />
      <Band edge="b" />
    </div>
  );
}
