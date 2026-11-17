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

/** How far the fallback raises the top band's layers under a pinned FilterBar, in px. */
export const EDGE_HAZE_BAR_SHIFT = '--edge-haze-bar-shift';

/** A sticky FilterBar: the top band ends at its lower edge while it is pinned (edge-haze.css). */
export const STICKY_FILTER_BAR = '[data-filter-part="bar"][data-sticky]';

/** Where a sticky bar and the top band are, in px, as the window shows them now. */
export interface UnderBarGeometry {
  readonly barTop: number;
  readonly barHeight: number;
  /** The band's top (under the safe-area inset) and its height, before any rise. */
  readonly bandTop: number;
  readonly bandHeight: number;
  /** Distance from the band start to the raised sticky edge, in pixels. */
  readonly stickyInset?: number;
}

/**
 * How far the top band's layers rise under a sticky bar, in px: what edge-haze.css's view timeline
 * computes. Coming up, they rise with the bar, px for px, once its lower edge is inside the band,
 * so the band ends at that edge; with the bar pinned at the band's top, the whole way (the band's
 * height less the bar's); as the bar leaves above it, back down over the bar's height. Never below
 * 0, and 0 under a bar as tall as the band.
 */
export function underBarShift({
  barTop,
  barHeight,
  bandTop,
  bandHeight,
  stickyInset = 0,
}: UnderBarGeometry): number {
  const rise = Math.max(0, bandHeight - barHeight - stickyInset);
  if (rise === 0) return 0;
  const offset = barTop - bandTop - stickyInset;
  if (offset >= 0) return Math.min(rise, Math.max(0, rise - offset));
  return rise * Math.max(0, 1 + offset / barHeight);
}

const supports = (condition: string): boolean =>
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(condition);

const supportsScrollTimeline = (): boolean => supports('animation-timeline: scroll()');

/** Whether CSS can follow the sticky bar itself (a view timeline that the haze can see). */
const supportsBarTimeline = (): boolean => supports('timeline-scope: --filter-bar');

/** Sets both bands' opacity from the scroll position (edgeHazeOpacity). */
function writeFade(haze: HTMLElement, top: HTMLElement, bottom: HTMLElement): void {
  const opacity = edgeHazeOpacity({
    scrollY: window.scrollY,
    maxScroll: document.documentElement.scrollHeight - window.innerHeight,
    topHeight: top.offsetHeight,
    bottomHeight: bottom.offsetHeight,
  });
  haze.style.setProperty(EDGE_HAZE_TOP_OPACITY, String(opacity.top));
  haze.style.setProperty(EDGE_HAZE_BOTTOM_OPACITY, String(opacity.bottom));
}

/** Sets how far the top band's layers rise under the page's sticky bar, 0 with none (underBarShift). */
function writeBarShift(haze: HTMLElement, top: HTMLElement): void {
  const bar = document.querySelector(STICKY_FILTER_BAR);
  const box = bar?.getBoundingClientRect();
  // Pixel-valued token: an unpinned short-screen bar has top:auto but keeps this timeline inset.
  const inset = bar
    ? Number.parseFloat(getComputedStyle(bar).getPropertyValue('--sticky-top-gap'))
    : 0;
  const shift = box
    ? underBarShift({
        barTop: box.top,
        barHeight: box.height,
        bandTop: top.offsetTop,
        bandHeight: top.offsetHeight,
        stickyInset: Number.isFinite(inset) ? Math.max(0, inset) : 0,
      })
    : 0;
  haze.style.setProperty(EDGE_HAZE_BAR_SHIFT, `${shift}px`);
}

/**
 * Only where the browser lacks what edge-haze.css needs: without scroll-driven animations
 * (Firefox; Safari before 26) it fades the bands from the scroll position, and without view
 * timelines it raises the top band's layers under a pinned FilterBar. One loop does both, at most
 * once per frame, and again when the page or the window changes size (a client navigation, a
 * filter). Effects never run on the server.
 */
function useScrollFallback(ref: RefObject<HTMLDivElement | null>, path: string): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: navigation can replace a bar without changing scroll or body size.
  useEffect(() => {
    const haze = ref.current;
    if (!haze) return;
    const fade = !supportsScrollTimeline();
    const follow = !supportsBarTimeline();
    const top = haze.querySelector<HTMLElement>('.t');
    const bottom = haze.querySelector<HTMLElement>('.b');
    if ((!fade && !follow) || !top || !bottom) return;

    let frame = 0;
    const update = (): void => {
      frame = 0;
      if (fade) writeFade(haze, top, bottom);
      if (follow) writeBarShift(haze, top);
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
  }, [ref, path]);
}

/**
 * Pauses the pulsing placeholders, live dots, home equaliser and light rays that sit under a band
 * that shows while the haze is mounted, and after each route change lets go of the ones the last
 * route left behind (an observer reports nothing for an element removed clear of the bands).
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
 * a screen reader's attention. While it is mounted, pulsing placeholders, live dots, the home
 * equaliser and the light rays pause under a band that shows, where each of their frames would
 * blur it again; under a band still at opacity 0 (the top one at the top of the page) they move.
 * Under a pinned FilterBar the top band ends at the bar's lower edge, so the first row under the
 * bar stays sharp (edge-haze.css; underBarShift where CSS cannot follow the bar).
 */
export function EdgeHaze({ path }: EdgeHazeProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useScrollFallback(ref, path);
  usePauseUnderEdge(ref, path);

  return (
    <div ref={ref} className="edge-haze" aria-hidden="true">
      <Band edge="t" />
      <Band edge="b" />
    </div>
  );
}
