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
 * @file Pauses endless decorative animations while they sit under a band of the edge haze.
 *
 * Every frame of an animation under a band makes the compositor blur that band again: a pulsing
 * placeholder parked under the bottom band of a phone at rest costs as much as scrolling. The
 * haze starts one watcher, which finds such animations by their keyframes' name as they start
 * (animationstart) or already running (document.getAnimations()), and two IntersectionObservers,
 * their roots shrunk to the top band (and the strip just above the window, where a light ray's
 * blur still reaches into it) and to the bottom band (on phones the bar below it too), mark each
 * one `data-under-edge` while it overlaps a band that shows; edge-haze.css pauses it there. A band
 * at opacity 0 draws no blur, so nothing pauses under it: the top band at the top of the page,
 * where the light rays hang and keep moving, the bottom one at the end, both on a page too short
 * to scroll. The watcher reads the scroll position at most once a frame as the page scrolls or
 * changes size. Nothing is observed while the haze draws no blur (forced colours, reduced
 * transparency).
 *
 * Streamed placeholders leave the page once their content arrives, and a route change removes
 * the rest, while an observer reports nothing for an element that leaves clear of the bands. So
 * the watcher lets go of every element no longer in the page whenever it next acts: a pulse
 * starts, a band reports, the bands are measured again, or the haze calls sweep() after a route
 * change. Until then a removed element stays referenced, at most one route's worth.
 */

export const UNDER_EDGE_ATTRIBUTE = 'data-under-edge';

/**
 * The animations that pause: Tailwind's pulse (every loading placeholder), ping and live-pulse
 * (live dots), the shell's light rays (light-rays.css's `light-ray`), and the home equaliser
 * (equaliser.module.css's `equalise`: Turbopack names it `<hash>_equalise`, webpack
 * `<file>_equalise__<hash>`). Spinners, marquees and the caret keep moving: frozen, they read as
 * broken.
 */
const PAUSABLE_ANIMATION = /^(?:pulse|ping|live-pulse|light-ray)$|(?:^|_)equalise(?:__[\w-]+)?$/;

/** Whether an animation of this keyframes' name pauses under the haze. */
export function isPausableAnimation(animationName: string): boolean {
  return PAUSABLE_ANIMATION.test(animationName);
}

/** The preferences that turn the blur off or on: the bands are measured again when they change. */
const BLUR_QUERIES = ['(prefers-reduced-transparency: reduce)', '(forced-colors: active)'] as const;

type Edge = 'top' | 'bottom';

const EDGES: readonly Edge[] = ['top', 'bottom'];

/** Whether something holds at each band: an element overlaps it, or the band shows. */
export interface Overlap {
  readonly top: boolean;
  readonly bottom: boolean;
}

const CLEAR: Overlap = { top: false, bottom: false };

/** Where the page is scrolled, in px, and how far it scrolls: its height less the window's. */
export interface PageScroll {
  readonly scrollY: number;
  readonly maxScroll: number;
}

/**
 * Which bands show now. edge-haze.css fades the top band in over the first band height of scroll
 * and the bottom one out over the last, but at any opacity above 0 a band draws its blur, so it
 * shows from the first pixel: the top one once the page has scrolled at all, the bottom one until
 * the end, neither on a page too short to scroll. edge-haze.tsx's edgeHazeOpacity gives the same
 * answer (tests/unit/layout/pause-under-edge.test.tsx checks they agree).
 */
export function bandsShowing({ scrollY, maxScroll }: PageScroll): Overlap {
  if (maxScroll <= 0) return CLEAR;
  return { top: scrollY > 0, bottom: scrollY < maxScroll };
}

/** The page's scroll now, as the bands' scroll timeline reads it. */
const pageScroll = (): PageScroll => ({
  scrollY: window.scrollY,
  maxScroll: document.documentElement.scrollHeight - window.innerHeight,
});

/** Whether an element that overlaps the bands in `overlap` sits under one that shows. */
const underShownBand = (overlap: Overlap, showing: Overlap): boolean =>
  (overlap.top && showing.top) || (overlap.bottom && showing.bottom);

/** Whether the haze draws its blur layers: not under forced colours or reduced transparency. */
function blurs(haze: HTMLElement): boolean {
  const layer = haze.querySelector('.l');
  return (
    layer !== null &&
    getComputedStyle(haze).display !== 'none' &&
    getComputedStyle(layer).display !== 'none'
  );
}

/**
 * How far above the window the top band's root reaches, in px. An observer judges overlap by an
 * element's box, but light-rays.css blurs each ray by 20px, which draws about three standard
 * deviations (60 px) past it: a ray whose box ends just above the window still draws under the
 * band, and each of its frames would blur the band again. Anything up there is off screen, so
 * pausing it costs nothing. tests/unit/layout/pause-under-edge.test.tsx holds this to 3 x the blur.
 */
export const UNDER_EDGE_INK_OUTSET = 64;

/**
 * The root margins that shrink the window to each band: the top band ends `topEnd` px down, the
 * bottom one starts `bottomStart` px down, in a window `windowHeight` px tall. The top band's root
 * also reaches UNDER_EDGE_INK_OUTSET px above the window, for the rays' blur. The bottom one stays
 * at the band: grown upwards it would pause pulses on screen above it, and no ray reaches it.
 */
function bandMargins(
  topEnd: number,
  bottomStart: number,
  windowHeight: number,
): Readonly<Record<Edge, string>> {
  return {
    top: `${UNDER_EDGE_INK_OUTSET}px 0px ${-(windowHeight - topEnd)}px 0px`,
    bottom: `${-bottomStart}px 0px 0px 0px`,
  };
}

/** One IntersectionObserver per band, observing and letting go of the same elements. */
interface BandObservers {
  readonly observe: (element: Element) => void;
  readonly unobserve: (element: Element) => void;
  readonly disconnect: () => void;
}

type OnBandEntries = (edge: Edge, entries: readonly IntersectionObserverEntry[]) => void;

/** Observers for the bands where the haze lays them out now, or null while it draws no blur. */
function createBandObservers(haze: HTMLElement, onEntries: OnBandEntries): BandObservers | null {
  const top = haze.querySelector(':scope > .t');
  const bottom = haze.querySelector(':scope > .b');
  if (!top || !bottom || !blurs(haze)) return null;
  const margins = bandMargins(
    top.getBoundingClientRect().bottom,
    bottom.getBoundingClientRect().top,
    window.innerHeight,
  );
  const observers = EDGES.map(
    (edge) =>
      new IntersectionObserver((entries) => onEntries(edge, entries), {
        rootMargin: margins[edge],
      }),
  );
  return {
    observe: (element) => {
      for (const observer of observers) observer.observe(element);
    },
    unobserve: (element) => {
      for (const observer of observers) observer.unobserve(element);
    },
    disconnect: () => {
      for (const observer of observers) observer.disconnect();
    },
  };
}

/**
 * The watched elements, whether each overlaps a band, the observers of the bands, and which bands
 * show.
 */
interface WatchState {
  readonly haze: HTMLElement;
  readonly watched: Map<Element, Overlap>;
  bands: BandObservers | null;
  showing: Overlap;
}

function mark(state: WatchState, element: Element, overlap: Overlap): void {
  state.watched.set(element, overlap);
  element.toggleAttribute(UNDER_EDGE_ATTRIBUTE, underShownBand(overlap, state.showing));
}

/** Reads which bands show; when that changes, marks every watched element again. */
function reshow(state: WatchState): void {
  const showing = bandsShowing(pageScroll());
  if (showing.top === state.showing.top && showing.bottom === state.showing.bottom) return;
  state.showing = showing;
  for (const [element, overlap] of [...state.watched]) mark(state, element, overlap);
}

function forget(state: WatchState, element: Element): void {
  state.bands?.unobserve(element);
  element.removeAttribute(UNDER_EDGE_ATTRIBUTE);
  state.watched.delete(element);
}

/** Lets go of every watched element no longer in the page. */
function sweep(state: WatchState): void {
  for (const element of [...state.watched.keys()]) {
    if (!element.isConnected) forget(state, element);
  }
}

/** A band's report: drop what left the page (reported or not), then mark the rest. */
function onBandEntries(
  state: WatchState,
  edge: Edge,
  entries: readonly IntersectionObserverEntry[],
): void {
  sweep(state);
  for (const { target, isIntersecting } of entries) {
    const overlap = state.watched.get(target);
    if (overlap) mark(state, target, { ...overlap, [edge]: isIntersecting });
  }
}

/**
 * Measures the bands and observes every element still in the page against them, from scratch,
 * reading again which bands show (a new window height moves the end of the page).
 */
function connect(state: WatchState): void {
  state.bands?.disconnect();
  state.bands = null;
  state.showing = bandsShowing(pageScroll());
  sweep(state);
  for (const element of state.watched.keys()) mark(state, element, CLEAR);
  state.bands = createBandObservers(state.haze, (edge, entries) =>
    onBandEntries(state, edge, entries),
  );
  for (const element of state.watched.keys()) state.bands?.observe(element);
}

function watch(state: WatchState, element: Element): void {
  if (state.watched.has(element) || state.haze.contains(element)) return;
  sweep(state);
  state.watched.set(element, CLEAR);
  state.bands?.observe(element);
}

/** Stops observing, clears every mark and lets go of every element. Safe to call twice. */
function release(state: WatchState): void {
  state.bands?.disconnect();
  state.bands = null;
  for (const element of state.watched.keys()) element.removeAttribute(UNDER_EDGE_ATTRIBUTE);
  state.watched.clear();
}

/** Work scheduled for the next frame, at most once however often it is asked for. */
interface FrameTask {
  readonly schedule: () => void;
  readonly cancel: () => void;
}

function oncePerFrame(callback: () => void): FrameTask {
  let frame = 0;
  return {
    schedule: () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        callback();
      });
    },
    cancel: () => {
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}

/** A running CSS animation as document.getAnimations() lists it. */
interface RunningAnimation {
  readonly animationName?: string;
  readonly effect?: {
    readonly target?: Element | null;
    readonly pseudoElement?: string | null;
  } | null;
}

/** The elements of the pausable animations already running (server HTML), outside pseudo-elements. */
function runningTargets(): Element[] {
  if (typeof document.getAnimations !== 'function') return [];
  return (document.getAnimations() as RunningAnimation[]).flatMap((animation) => {
    const target = animation.effect?.target;
    const pausable = isPausableAnimation(animation.animationName ?? '');
    return pausable && target && !animation.effect?.pseudoElement ? [target] : [];
  });
}

/** A running watcher, as pauseAnimationsUnderEdge returns it. */
export interface UnderEdgeWatch {
  /** Lets go of every watched element no longer in the page: the haze calls it on a route change. */
  readonly sweep: () => void;
  /** Stops watching, and clears every mark. */
  readonly stop: () => void;
}

/**
 * Watches every pausable animation outside `haze` and pauses it while it overlaps a band. Call it
 * once the haze is in the page. The bands are measured again, once per frame, when the window's
 * size (11svh) or the preferences that turn the blur off change.
 */
export function pauseAnimationsUnderEdge(haze: HTMLElement): UnderEdgeWatch {
  const state: WatchState = { haze, watched: new Map(), bands: null, showing: CLEAR };
  const onAnimationStart = (event: AnimationEvent): void => {
    if (event.pseudoElement || !isPausableAnimation(event.animationName)) return;
    if (event.target instanceof Element) watch(state, event.target);
  };
  const remeasure = oncePerFrame(() => connect(state));
  const queries = BLUR_QUERIES.map((query) => window.matchMedia(query));

  document.addEventListener('animationstart', onAnimationStart, true);
  window.addEventListener('resize', remeasure.schedule);
  for (const query of queries) query.addEventListener('change', remeasure.schedule);
  const unfollow = followScroll(state);
  for (const element of runningTargets()) watch(state, element);
  connect(state);

  return {
    sweep: () => sweep(state),
    stop: () => {
      document.removeEventListener('animationstart', onAnimationStart, true);
      window.removeEventListener('resize', remeasure.schedule);
      for (const query of queries) query.removeEventListener('change', remeasure.schedule);
      remeasure.cancel();
      unfollow();
      release(state);
    },
  };
}

/**
 * Reads again which bands show, at most once per frame, as the page scrolls or changes size: a
 * streamed section or a filter moves the end of the page with no scroll at all. A window resize
 * measures everything again instead (connect). Returns the function that stops it.
 */
function followScroll(state: WatchState): () => void {
  const task = oncePerFrame(() => reshow(state));
  const pageSize = typeof ResizeObserver === 'function' ? new ResizeObserver(task.schedule) : null;

  window.addEventListener('scroll', task.schedule, { passive: true });
  pageSize?.observe(document.body);

  return () => {
    window.removeEventListener('scroll', task.schedule);
    pageSize?.disconnect();
    task.cancel();
  };
}
