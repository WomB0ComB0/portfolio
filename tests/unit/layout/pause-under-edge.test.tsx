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
 * @file Endless decorative animations pause while they sit under a band of the edge haze.
 *
 * Each frame of an animation under a band makes the compositor blur that band again. Measured on
 * the built site at 390 x 844 (3x), page at rest: a pulsing placeholder under the bottom band
 * cost 199 ms of GPU-process CPU a second in software rendering (12 without the haze, 1.3 paused),
 * 71 on this desktop GPU (16 without, 1.3 paused); the equaliser the same. The haze's watcher
 * finds every such animation by its keyframes' name, as it starts (animationstart) or already
 * running when the haze mounts (document.getAnimations()): Tailwind's pulse (every loading
 * placeholder), ping and live-pulse (live dots), and the home equaliser's `equalise` (hashed by
 * its CSS module). Spinners, marquees and the caret keep moving. Two IntersectionObservers, their
 * roots shrunk to the top band and to the bottom band (on phones the bar below it too), mark an
 * element `data-under-edge` while it overlaps either; edge-haze.css pauses it. Nothing is observed
 * while the haze draws no blur (forced colours, reduced transparency); the bands are measured
 * again when the window's size or those preferences change, and everything goes on unmount.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isPausableAnimation,
  pauseAnimationsUnderEdge,
  UNDER_EDGE_ATTRIBUTE,
} from '@/components/layout/pause-under-edge';

const ROOT = process.cwd();
const WINDOW_PX = 844;
/** Where the top band ends and the bottom band starts (the bar's 72 px below it), in px. */
const TOP_BAND_END = 93;
const BOTTOM_BAND_START = WINDOW_PX - 72 - 93;

interface FakeObserver {
  readonly callback: IntersectionObserverCallback;
  readonly rootMargin: string;
  readonly observed: Set<Element>;
  disconnected: boolean;
}

let observers: FakeObserver[] = [];

/** An IntersectionObserver that reports only what the test tells it to. */
class FakeIntersectionObserver {
  private readonly record: FakeObserver;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.record = {
      callback,
      rootMargin: options?.rootMargin ?? '',
      observed: new Set(),
      disconnected: false,
    };
    observers.push(this.record);
  }

  observe(element: Element) {
    this.record.observed.add(element);
  }

  unobserve(element: Element) {
    this.record.observed.delete(element);
  }

  disconnect() {
    this.record.observed.clear();
    this.record.disconnected = true;
  }

  takeRecords() {
    return [];
  }
}

const live = () => observers.filter((observer) => !observer.disconnected);

const marginFor = (
  edge: 'top' | 'bottom',
  windowPx = WINDOW_PX,
  bottomStart = BOTTOM_BAND_START,
) =>
  edge === 'top' ? `0px 0px ${-(windowPx - TOP_BAND_END)}px 0px` : `${-bottomStart}px 0px 0px 0px`;

/** The live observer whose root is the given band. */
function observerFor(edge: 'top' | 'bottom'): FakeObserver {
  const found = live().find((observer) => observer.rootMargin === marginFor(edge));
  if (!found) {
    throw new Error(
      `no live ${edge} observer; live: ${live()
        .map((o) => o.rootMargin)
        .join(' | ')}`,
    );
  }
  return found;
}

/** Tells an observer that `element` now does or does not overlap its band. */
function report(edge: 'top' | 'bottom', element: Element, isIntersecting: boolean) {
  const observer = observerFor(edge);
  observer.callback(
    [{ target: element, isIntersecting } as IntersectionObserverEntry],
    observer as unknown as IntersectionObserver,
  );
}

const rect = (top: number, bottom: number) =>
  ({ top, bottom, left: 0, right: 390, width: 390, height: bottom - top, x: 0, y: top }) as DOMRect;

/** The shell's haze as the CSS lays it out on a 390 x 844 phone. */
function mountHaze() {
  const haze = document.createElement('div');
  haze.className = 'edge-haze';
  haze.innerHTML = '<div class="t"><i class="l"></i></div><div class="b"><i class="l"></i></div>';
  const [top, bottom] = [...haze.children] as HTMLElement[];
  if (top) top.getBoundingClientRect = () => rect(TOP_BAND_END - 93, TOP_BAND_END);
  if (bottom) bottom.getBoundingClientRect = () => rect(BOTTOM_BAND_START, BOTTOM_BAND_START + 93);
  document.body.append(haze);
  return haze;
}

/** An element in the page, outside the haze. */
function pageElement(): HTMLElement {
  const element = document.createElement('span');
  document.body.prepend(element);
  return element;
}

/** What a CSS animation's start looks like to the document. */
function animationStart(target: Element, animationName: string, pseudoElement = '') {
  const event = new Event('animationstart', { bubbles: true });
  Object.defineProperties(event, {
    animationName: { value: animationName },
    pseudoElement: { value: pseudoElement },
  });
  target.dispatchEvent(event);
}

/** Runs requestAnimationFrame callbacks only when the test says so. */
function manualFrames() {
  const queue = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    next += 1;
    queue.set(next, callback);
    return next;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id));
  return {
    pending: () => queue.size,
    run: () => {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback(performance.now());
    },
  };
}

/** matchMedia lists whose change listeners the test can fire. */
function recordMediaQueries() {
  const listeners = new Map<string, Set<() => void>>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: (_type: string, listener: () => void) => {
      listeners.set(query, (listeners.get(query) ?? new Set()).add(listener));
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.get(query)?.delete(listener);
    },
  }));
  return {
    change: (query: string) => {
      for (const listener of listeners.get(query) ?? []) listener();
    },
    count: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  };
}

/** Every watcher a test started, stopped after it even when an assertion failed first. */
const running: (() => void)[] = [];

/** Starts the watcher on `haze`, as the haze does once it mounts. */
function watchHaze(haze: HTMLElement): ReturnType<typeof pauseAnimationsUnderEdge> {
  const watch = pauseAnimationsUnderEdge(haze);
  running.push(watch.stop);
  return watch;
}

// tests/setup/vitest.setup.ts defines a writable but non-configurable IntersectionObserver, which
// vi.stubGlobal cannot redefine: assign it, and put the setup's back after each test.
const SETUP_INTERSECTION_OBSERVER = globalThis.IntersectionObserver;

beforeEach(() => {
  observers = [];
  globalThis.IntersectionObserver =
    FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  vi.stubGlobal('innerHeight', WINDOW_PX);
});

afterEach(() => {
  for (const stop of running.splice(0)) stop();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  globalThis.IntersectionObserver = SETUP_INTERSECTION_OBSERVER;
});

describe('isPausableAnimation', () => {
  it.each([
    'pulse',
    'ping',
    'live-pulse',
    'XaKMhG_equalise',
    'equaliser-module__Xa_KMhG__equalise',
  ])('pauses %s', (name) => {
    expect(isPausableAnimation(name)).toBe(true);
  });

  it.each([
    'spin',
    'scroll',
    'caret-blink',
    'rotate',
    'enter',
    'edge-haze-in',
    'equaliser',
    'pulse-ring',
    'unequalise',
  ])('leaves %s moving', (name) => {
    expect(isPausableAnimation(name)).toBe(false);
  });

  it('matches the keyframes the placeholders, live dots and equaliser are drawn with', () => {
    const theme = readFileSync(join(ROOT, 'node_modules/tailwindcss/theme.css'), 'utf8');
    const globals = readFileSync(join(ROOT, 'src/styles/globals.css'), 'utf8');
    const equaliser = readFileSync(
      join(ROOT, 'src/app/_components/home/live/equaliser.module.css'),
      'utf8',
    );

    expect(theme).toMatch(/--animate-pulse:\s*pulse\s/);
    expect(theme).toMatch(/--animate-ping:\s*ping\s/);
    expect(globals).toMatch(/--animate-live-pulse:\s*live-pulse\s/);
    expect(equaliser).toMatch(/@keyframes equalise\s*\{/);
  });
});

describe('pauseAnimationsUnderEdge', () => {
  it('watches each pausable animation as it starts, against the top band and the bottom band', () => {
    const haze = mountHaze();
    const { stop } = watchHaze(haze);
    const placeholder = pageElement();

    animationStart(placeholder, 'pulse');

    expect(live()).toHaveLength(2);
    expect(observerFor('top').observed.has(placeholder)).toBe(true);
    expect(observerFor('bottom').observed.has(placeholder)).toBe(true);
    stop();
  });

  it('leaves other animations, pseudo-elements and the haze itself alone', () => {
    const haze = mountHaze();
    const { stop } = watchHaze(haze);
    const spinner = pageElement();
    const glow = pageElement();
    const layer = haze.querySelector('.l');
    if (!layer) throw new Error('no layer');

    animationStart(spinner, 'spin');
    animationStart(glow, 'pulse', '::before');
    animationStart(layer, 'pulse');

    expect(observerFor('top').observed.size).toBe(0);
    expect(observerFor('bottom').observed.size).toBe(0);
    stop();
  });

  it('watches animations already running when it starts (server HTML)', () => {
    const haze = mountHaze();
    const bar = pageElement();
    const marquee = pageElement();
    // jsdom has no Web Animations: stand in for what Chromium reports.
    Object.defineProperty(document, 'getAnimations', {
      configurable: true,
      value: () => [
        { animationName: 'XaKMhG_equalise', effect: { target: bar, pseudoElement: null } },
        { animationName: 'scroll', effect: { target: marquee, pseudoElement: null } },
      ],
    });

    const { stop } = watchHaze(haze);

    expect([...observerFor('bottom').observed]).toEqual([bar]);
    stop();
    delete (document as { getAnimations?: unknown }).getAnimations;
  });

  it('marks the element while it overlaps either band, and clears the mark when it leaves', () => {
    const haze = mountHaze();
    const { stop } = watchHaze(haze);
    const element = pageElement();
    animationStart(element, 'live-pulse');

    report('bottom', element, true);
    expect(element.hasAttribute(UNDER_EDGE_ATTRIBUTE)).toBe(true);
    report('top', element, false);
    expect(element.hasAttribute(UNDER_EDGE_ATTRIBUTE)).toBe(true);
    report('bottom', element, false);
    expect(element.hasAttribute(UNDER_EDGE_ATTRIBUTE)).toBe(false);
    report('top', element, true);
    expect(element.hasAttribute(UNDER_EDGE_ATTRIBUTE)).toBe(true);
    stop();
  });

  describe('lets go of elements that left the page (a streamed placeholder swapped for content, a route change)', () => {
    /** Measures the bands again, which observes every element still watched from scratch. */
    function remeasure(frames: ReturnType<typeof manualFrames>) {
      window.dispatchEvent(new Event('resize'));
      frames.run();
    }

    /** Whether either live band observer still holds `element`. */
    const observed = (element: Element) =>
      live().some((observer) => observer.observed.has(element));

    it('when the next pulse starts', () => {
      const haze = mountHaze();
      const { stop } = watchHaze(haze);
      const old = pageElement();
      animationStart(old, 'pulse');
      old.remove();

      animationStart(pageElement(), 'pulse');

      expect(observerFor('bottom').observed.has(old)).toBe(false);
      expect(observerFor('bottom').observed.size).toBe(1);
      stop();
    });

    it('when a band reports it gone, with no later pulse, and keeps it out of the next measurement', () => {
      const frames = manualFrames();
      const haze = mountHaze();
      const { stop } = watchHaze(haze);
      const placeholder = pageElement();
      animationStart(placeholder, 'pulse');
      report('bottom', placeholder, true);
      expect(placeholder.hasAttribute(UNDER_EDGE_ATTRIBUTE)).toBe(true);

      // Chromium reports a removed element that overlapped a band as no longer overlapping it.
      placeholder.remove();
      report('bottom', placeholder, false);

      expect(observed(placeholder)).toBe(false);
      expect(placeholder.hasAttribute(UNDER_EDGE_ATTRIBUTE)).toBe(false);
      remeasure(frames);
      expect(observed(placeholder)).toBe(false);
      stop();
    });

    it('whenever a band reports anything, for removed elements no band reported', () => {
      const frames = manualFrames();
      const haze = mountHaze();
      const { stop } = watchHaze(haze);
      const equaliser = pageElement();
      const placeholder = pageElement();
      animationStart(equaliser, 'XaKMhG_equalise');
      animationStart(placeholder, 'pulse');

      // Clear of both bands when it goes, so no observer reports it.
      placeholder.remove();
      report('top', equaliser, true);

      expect(observed(placeholder)).toBe(false);
      expect(observerFor('top').observed.has(equaliser)).toBe(true);
      expect(equaliser.hasAttribute(UNDER_EDGE_ATTRIBUTE)).toBe(true);
      remeasure(frames);
      expect(observed(placeholder)).toBe(false);
      expect(observed(equaliser)).toBe(true);
      stop();
    });

    it('when the bands are measured again', () => {
      const frames = manualFrames();
      const haze = mountHaze();
      const { stop } = watchHaze(haze);
      const placeholder = pageElement();
      animationStart(placeholder, 'pulse');
      placeholder.remove();

      remeasure(frames);

      expect(observerFor('top').observed.size).toBe(0);
      expect(observerFor('bottom').observed.size).toBe(0);
      stop();
    });

    it('on sweep(), which the haze calls after each route change, with nothing else happening', () => {
      const frames = manualFrames();
      const haze = mountHaze();
      const watch = watchHaze(haze);
      const gone = [pageElement(), pageElement()];
      const kept = pageElement();
      for (const element of [...gone, kept]) animationStart(element, 'pulse');
      for (const element of gone) element.remove();

      watch.sweep();

      for (const element of gone) expect(observed(element)).toBe(false);
      expect(observed(kept)).toBe(true);
      remeasure(frames);
      for (const element of gone) expect(observed(element)).toBe(false);
      expect(observed(kept)).toBe(true);
      watch.stop();
      expect(() => watch.sweep()).not.toThrow();
    });
  });

  it.each([
    [
      'the haze is hidden (forced colours)',
      (haze: HTMLElement) => {
        haze.style.display = 'none';
      },
    ],
    [
      'its blur layers are hidden (reduced transparency, no backdrop-filter)',
      (haze: HTMLElement) => {
        for (const layer of haze.querySelectorAll<HTMLElement>('.l')) layer.style.display = 'none';
      },
    ],
  ])('observes nothing while %s, and starts when that changes', (_case, hide) => {
    const media = recordMediaQueries();
    const frames = manualFrames();
    const haze = mountHaze();
    hide(haze);
    const { stop } = watchHaze(haze);
    const element = pageElement();
    animationStart(element, 'pulse');

    expect(observers).toHaveLength(0);
    expect(element.hasAttribute(UNDER_EDGE_ATTRIBUTE)).toBe(false);

    haze.style.display = '';
    for (const layer of haze.querySelectorAll<HTMLElement>('.l')) layer.style.display = '';
    media.change('(prefers-reduced-transparency: reduce)');
    frames.run();

    expect(observerFor('bottom').observed.has(element)).toBe(true);
    stop();
  });

  it('measures the bands again when the window changes size, once per frame', () => {
    const frames = manualFrames();
    const haze = mountHaze();
    const { stop } = watchHaze(haze);
    const element = pageElement();
    animationStart(element, 'pulse');
    report('bottom', element, true);

    // A shorter window: the bottom band moves up.
    vi.stubGlobal('innerHeight', 700);
    const bottom = haze.querySelector<HTMLElement>('.b');
    if (bottom) bottom.getBoundingClientRect = () => rect(535, 628);
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    expect(frames.pending()).toBe(1);
    frames.run();

    expect(live().map((observer) => observer.rootMargin)).toEqual([
      marginFor('top', 700),
      marginFor('bottom', 700, 535),
    ]);
    expect(live().every((observer) => observer.observed.has(element))).toBe(true);
    // The old verdict is dropped until the new observers report.
    expect(element.hasAttribute(UNDER_EDGE_ATTRIBUTE)).toBe(false);
    stop();
  });

  it('removes every listener, observer, mark and pending frame when it stops', () => {
    const media = recordMediaQueries();
    const frames = manualFrames();
    const haze = mountHaze();
    const unlisten = vi.spyOn(document, 'removeEventListener');
    const unlistenWindow = vi.spyOn(window, 'removeEventListener');
    const { stop } = watchHaze(haze);
    const element = pageElement();
    animationStart(element, 'pulse');
    report('top', element, true);
    window.dispatchEvent(new Event('resize'));
    expect(media.count()).toBe(2);

    stop();

    expect(live()).toHaveLength(0);
    expect(element.hasAttribute(UNDER_EDGE_ATTRIBUTE)).toBe(false);
    expect(frames.pending()).toBe(0);
    expect(media.count()).toBe(0);
    expect(unlisten.mock.calls.map(([type]) => type)).toContain('animationstart');
    expect(unlistenWindow.mock.calls.map(([type]) => type)).toContain('resize');
    animationStart(pageElement(), 'pulse');
    expect(observers.every((observer) => observer.observed.size === 0)).toBe(true);
  });
});
