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
 * their roots shrunk to the top band and to the bottom band (on phones the bar below it too),
 * mark each one `data-under-edge` while it overlaps either; edge-haze.css pauses it there.
 * Nothing is observed while the haze draws no blur (forced colours, reduced transparency).
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
 * (live dots), and the home equaliser (equaliser.module.css's `equalise`: Turbopack names it
 * `<hash>_equalise`, webpack `<file>_equalise__<hash>`). Spinners, marquees and the caret keep
 * moving: frozen, they read as broken.
 */
const PAUSABLE_ANIMATION = /^(?:pulse|ping|live-pulse)$|(?:^|_)equalise(?:__[\w-]+)?$/;

/** Whether an animation of this keyframes' name pauses under the haze. */
export function isPausableAnimation(animationName: string): boolean {
  return PAUSABLE_ANIMATION.test(animationName);
}

/** The preferences that turn the blur off or on: the bands are measured again when they change. */
const BLUR_QUERIES = ['(prefers-reduced-transparency: reduce)', '(forced-colors: active)'] as const;

type Edge = 'top' | 'bottom';

const EDGES: readonly Edge[] = ['top', 'bottom'];

interface Overlap {
  readonly top: boolean;
  readonly bottom: boolean;
}

const CLEAR: Overlap = { top: false, bottom: false };

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
 * The root margins that shrink the window to each band: the top band ends `topEnd` px down, the
 * bottom one starts `bottomStart` px down, in a window `windowHeight` px tall.
 */
function bandMargins(
  topEnd: number,
  bottomStart: number,
  windowHeight: number,
): Readonly<Record<Edge, string>> {
  return {
    top: `0px 0px ${-(windowHeight - topEnd)}px 0px`,
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

/** The watched elements, whether each overlaps a band, and the observers of the bands. */
interface WatchState {
  readonly haze: HTMLElement;
  readonly watched: Map<Element, Overlap>;
  bands: BandObservers | null;
}

function mark(state: WatchState, element: Element, overlap: Overlap): void {
  state.watched.set(element, overlap);
  element.toggleAttribute(UNDER_EDGE_ATTRIBUTE, overlap.top || overlap.bottom);
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

/** Measures the bands and observes every element still in the page against them, from scratch. */
function connect(state: WatchState): void {
  state.bands?.disconnect();
  state.bands = null;
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
  const state: WatchState = { haze, watched: new Map(), bands: null };
  const onAnimationStart = (event: AnimationEvent): void => {
    if (event.pseudoElement || !isPausableAnimation(event.animationName)) return;
    if (event.target instanceof Element) watch(state, event.target);
  };
  const remeasure = oncePerFrame(() => connect(state));
  const queries = BLUR_QUERIES.map((query) => window.matchMedia(query));

  document.addEventListener('animationstart', onAnimationStart, true);
  window.addEventListener('resize', remeasure.schedule);
  for (const query of queries) query.addEventListener('change', remeasure.schedule);
  for (const element of runningTargets()) watch(state, element);
  connect(state);

  return {
    sweep: () => sweep(state),
    stop: () => {
      document.removeEventListener('animationstart', onAnimationStart, true);
      window.removeEventListener('resize', remeasure.schedule);
      for (const query of queries) query.removeEventListener('change', remeasure.schedule);
      remeasure.cancel();
      release(state);
    },
  };
}
