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
 * @file The scroll edge haze: its markup contract with src/styles/edge-haze.css, its place in the
 * shell, and the scroll fade's script fallback.
 *
 * The CSS fades each band with a scroll-driven animation, and raises the top band's layers under a
 * pinned FilterBar on the bar's view timeline. Only where the browser has no `animation-timeline`
 * (Firefox, Safari before 26) does the component set the two opacity properties itself, and only
 * where it has no view timeline the layers' rise (underBarShift), in one loop, once per frame; it
 * removes every listener and observer on unmount.
 * jsdom lays nothing out, so the page's scroll size and the bands' heights are stubbed here;
 * e2e/visual/edge-haze.spec.ts measures the real thing.
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EDGE_HAZE_BAR_SHIFT,
  EDGE_HAZE_BOTTOM_OPACITY,
  EDGE_HAZE_LAYERS,
  EDGE_HAZE_TOP_OPACITY,
  EdgeHaze,
  edgeHazeOpacity,
  STICKY_FILTER_BAR,
  underBarShift,
} from '@/components/layout/edge-haze';
import Layout from '@/components/layout/layout';
import { pauseAnimationsUnderEdge } from '@/components/layout/pause-under-edge';

// The animation watcher has its own tests (pause-under-edge.test.tsx): here, only that the haze
// starts it once with itself, sweeps it after each route change and stops it on unmount.
const watcher = vi.hoisted(() => ({ stop: vi.fn(), sweep: vi.fn() }));
vi.mock('@/components/layout/pause-under-edge', () => ({
  pauseAnimationsUnderEdge: vi.fn(() => watcher),
}));
// The route the shell reads: a test may move it.
const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
// The command palette and the tile spotlight's pointer listener are not under test.
vi.mock('@/components/cmd', () => ({ default: () => null }));
vi.mock('@/components/console/spotlight-root', () => ({ SpotlightRoot: () => null }));
// layout.tsx imports the navs and footer directly.
vi.mock('@/components/layout/nav', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/layout/nav')>();
  return { ...actual, NavBar: () => <nav aria-label="Main navigation" /> };
});
vi.mock('@/components/layout/mobile-nav', () => ({
  MobileNavBar: () => <nav aria-label="Mobile navigation" />,
}));
vi.mock('@/components/layout/footer', () => ({ Footer: () => <footer /> }));

/** The band heights the stubs report: 100 px each, as on a short laptop screen. */
const BAND_PX = 100;
const VIEWPORT_PX = 800;
const PAGE_PX = 3000;
const MAX_SCROLL_PX = PAGE_PX - VIEWPORT_PX;

const supportsScrollTimeline = (supported: boolean) =>
  vi.spyOn(CSS, 'supports').mockImplementation(() => supported);

/** Runs requestAnimationFrame callbacks only when the test says so. */
function manualFrames() {
  const queue = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    next += 1;
    queue.set(next, callback);
    return next;
  });
  const cancel = vi.fn((id: number) => {
    queue.delete(id);
  });
  vi.stubGlobal('cancelAnimationFrame', cancel);
  return {
    cancel,
    pending: () => queue.size,
    run: () => {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback(performance.now());
    },
  };
}

// tests/setup/vitest.setup.ts defines a writable but non-configurable ResizeObserver, which
// vi.stubGlobal cannot redefine: assign it, and put the setup's back after each test.
const SETUP_RESIZE_OBSERVER = globalThis.ResizeObserver;

/** Records every ResizeObserver the code creates. */
function recordResizeObservers() {
  const instances: {
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    /** Reports a size change, as the browser does when the observed element resizes. */
    resize: () => void;
  }[] = [];
  globalThis.ResizeObserver = class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    resize: () => void;
    constructor(callback: ResizeObserverCallback) {
      this.resize = () => callback([], this as unknown as ResizeObserver);
      instances.push(this);
    }
  } as unknown as typeof ResizeObserver;
  return instances;
}

/** A page 3000 px tall in an 800 px window, scrolled to `y`, with 100 px bands. */
function stubLayout(initialY: number) {
  let y = initialY;
  let pageHeight = PAGE_PX;
  const restore: (() => void)[] = [];
  const define = (target: object, key: string, get: () => number) => {
    const own = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, get });
    restore.push(() => {
      if (own) Object.defineProperty(target, key, own);
      else delete (target as Record<string, unknown>)[key];
    });
  };
  define(window, 'scrollY', () => y);
  define(window, 'innerHeight', () => VIEWPORT_PX);
  define(document.documentElement, 'scrollHeight', () => pageHeight);
  define(HTMLElement.prototype, 'offsetHeight', function (this: HTMLElement) {
    return this.classList.contains('t') || this.classList.contains('b') ? BAND_PX : 0;
  } as () => number);
  return {
    scrollTo: (next: number) => {
      y = next;
      window.dispatchEvent(new Event('scroll'));
    },
    /** The page grows or shrinks without a scroll (a filter, streamed content, a navigation). */
    setPageHeight: (next: number) => {
      pageHeight = next;
    },
    restore: () => {
      for (const undo of restore.reverse()) undo();
    },
  };
}

const hazeOf = (container: HTMLElement): HTMLElement => {
  const haze = container.querySelector<HTMLElement>('.edge-haze');
  if (!haze) throw new Error('no .edge-haze rendered');
  return haze;
};

const opacities = (haze: HTMLElement) => ({
  top: haze.style.getPropertyValue(EDGE_HAZE_TOP_OPACITY),
  bottom: haze.style.getPropertyValue(EDGE_HAZE_BOTTOM_OPACITY),
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  globalThis.ResizeObserver = SETUP_RESIZE_OBSERVER;
});

describe('EdgeHaze markup', () => {
  it('renders one decorative .edge-haze holding a top and a bottom band, in that order', () => {
    const { container } = render(<EdgeHaze path="/" />);
    const hazes = container.querySelectorAll('.edge-haze');

    expect(hazes).toHaveLength(1);
    const haze = hazeOf(container);
    expect(haze.tagName).toBe('DIV');
    expect(haze).toHaveAttribute('aria-hidden', 'true');
    expect([...haze.children].map((band) => `${band.tagName}.${band.className}`)).toEqual([
      'DIV.t',
      'DIV.b',
    ]);
  });

  it('gives each band 8 blur layers, then the tint; only the top band ends with the safe-area cap', () => {
    const { container } = render(<EdgeHaze path="/" />);
    const haze = hazeOf(container);
    const layers = Array.from({ length: EDGE_HAZE_LAYERS }, () => 'I.l');

    expect(EDGE_HAZE_LAYERS).toBe(8);
    const childrenOf = (selector: string) =>
      [...(haze.querySelector(selector)?.children ?? [])].map(
        (child) => `${child.tagName}.${child.className}`,
      );
    expect(childrenOf('.t')).toEqual([...layers, 'I.tn', 'I.cap']);
    expect(childrenOf('.b')).toEqual([...layers, 'I.tn']);
  });

  it('holds no text, no focusable element and no inline style before it mounts on a client', () => {
    const html = renderToString(<EdgeHaze path="/" />);
    const host = document.createElement('div');
    host.innerHTML = html;
    const haze = hazeOf(host);

    expect(haze.textContent).toBe('');
    expect(haze.querySelector('a, button, input, select, textarea, [tabindex]')).toBeNull();
    expect(haze.getAttribute('style')).toBeNull();
  });
});

describe('EdgeHaze and the animations under it', () => {
  beforeEach(() => {
    vi.mocked(pauseAnimationsUnderEdge).mockClear();
    watcher.stop.mockClear();
    watcher.sweep.mockClear();
    route.pathname = '/';
  });

  it('starts the animation watcher once with itself, and stops it on unmount', () => {
    const start = vi.mocked(pauseAnimationsUnderEdge);

    const { container, rerender, unmount } = render(<EdgeHaze path="/" />);
    rerender(<EdgeHaze path="/" />);

    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(hazeOf(container));
    expect(watcher.stop).not.toHaveBeenCalled();
    unmount();
    expect(watcher.stop).toHaveBeenCalledTimes(1);
  });

  it('lets the watcher go of what the last route left behind after each route change, and only then', () => {
    const { rerender, unmount } = render(<EdgeHaze path="/" />);
    expect(watcher.sweep).not.toHaveBeenCalled();

    rerender(<EdgeHaze path="/" />);
    expect(watcher.sweep).not.toHaveBeenCalled();
    rerender(<EdgeHaze path="/certifications" />);
    expect(watcher.sweep).toHaveBeenCalledTimes(1);
    rerender(<EdgeHaze path="/projects" />);
    expect(watcher.sweep).toHaveBeenCalledTimes(2);

    // The same watcher throughout: a route change never restarts it.
    expect(vi.mocked(pauseAnimationsUnderEdge)).toHaveBeenCalledTimes(1);
    expect(watcher.stop).not.toHaveBeenCalled();
    unmount();
    expect(watcher.stop).toHaveBeenCalledTimes(1);
  });

  it('gets the route from the shell', () => {
    const { rerender } = render(
      <Layout>
        <p>Page content</p>
      </Layout>,
    );
    expect(watcher.sweep).not.toHaveBeenCalled();

    route.pathname = '/certifications';
    rerender(
      <Layout>
        <p>Other content</p>
      </Layout>,
    );

    expect(watcher.sweep).toHaveBeenCalledTimes(1);
  });
});

describe('EdgeHaze in the shell', () => {
  it('mounts once, after the page column and before the bottom bar', () => {
    const { container } = render(
      <Layout>
        <p>Page content</p>
      </Layout>,
    );
    const hazes = container.querySelectorAll('.edge-haze');
    const column = screen.getByRole('main').parentElement;
    const bottomBar = screen.getByRole('navigation', { name: 'Mobile navigation' }).parentElement;

    expect(hazes).toHaveLength(1);
    const haze = hazes[0];
    expect(haze?.parentElement).toBe(column?.parentElement);
    expect(column?.nextElementSibling).toBe(haze);
    expect(haze?.nextElementSibling).toBe(bottomBar);
    // Out of the page: nothing in main or the footer, nothing in the navs.
    expect(screen.getByRole('main')).not.toContainElement(haze as HTMLElement);
  });
});

describe('edgeHazeOpacity', () => {
  const at = (scrollY: number, maxScroll = MAX_SCROLL_PX) =>
    edgeHazeOpacity({ scrollY, maxScroll, topHeight: BAND_PX, bottomHeight: BAND_PX });

  it('hides the top band at the top of the page and shows the bottom one', () => {
    expect(at(0)).toEqual({ top: 0, bottom: 1 });
  });

  it('fades the top band in over the first band height of scroll', () => {
    expect(at(25)).toEqual({ top: 0.25, bottom: 1 });
    expect(at(BAND_PX)).toEqual({ top: 1, bottom: 1 });
  });

  it('shows both bands mid-page', () => {
    expect(at(MAX_SCROLL_PX / 2)).toEqual({ top: 1, bottom: 1 });
  });

  it('fades the bottom band out over the last band height of scroll', () => {
    expect(at(MAX_SCROLL_PX - 75)).toEqual({ top: 1, bottom: 0.75 });
    expect(at(MAX_SCROLL_PX)).toEqual({ top: 1, bottom: 0 });
  });

  it('hides both bands on a page that does not scroll', () => {
    expect(at(0, 0)).toEqual({ top: 0, bottom: 0 });
    expect(at(0, -40)).toEqual({ top: 0, bottom: 0 });
  });

  it('stays within 0 and 1 past either end (overscroll) and with bands of no height', () => {
    expect(at(-30)).toEqual({ top: 0, bottom: 1 });
    expect(at(MAX_SCROLL_PX + 30)).toEqual({ top: 1, bottom: 0 });
    expect(edgeHazeOpacity({ scrollY: 0, maxScroll: 500, topHeight: 0, bottomHeight: 0 })).toEqual({
      top: 0,
      bottom: 1,
    });
    expect(
      edgeHazeOpacity({ scrollY: 500, maxScroll: 500, topHeight: 0, bottomHeight: 0 }),
    ).toEqual({ top: 1, bottom: 0 });
  });
});

describe('underBarShift', () => {
  it('tracks the raised sticky edge and releases from that edge when the bar leaves', () => {
    const geometry = { barHeight: 70, bandTop: 0, bandHeight: 99, stickyInset: 8 };
    expect(underBarShift({ ...geometry, barTop: 8 })).toBe(21);
    expect(underBarShift({ ...geometry, barTop: 18 })).toBe(11);
    expect(underBarShift({ ...geometry, barTop: -27 })).toBe(10.5);
    expect(underBarShift({ ...geometry, bandTop: 47, barTop: 55 })).toBe(21);
  });

  /** The owner's band at 1440 x 900 (99 px) over /places' 70 px bar, at the top of the window. */
  const at = (barTop: number, { bandTop = 0, bandHeight = 99, barHeight = 70 } = {}) =>
    underBarShift({ barTop, barHeight, bandTop, bandHeight });

  it('leaves the band alone while the bar is clear of it, down to its lower edge meeting the band end', () => {
    expect(at(400)).toBe(0);
    expect(at(29)).toBe(0);
  });

  it('rises with the bar px for px as it comes up, so the band always ends at the bar', () => {
    expect(at(28)).toBe(1);
    expect(at(15)).toBe(14);
    for (let barTop = 0; barTop <= 200; barTop += 1) {
      expect(99 - at(barTop), `bar at ${barTop}`).toBe(Math.min(99, barTop + 70));
    }
  });

  it('holds the whole way, the band height less the bar, while the bar is pinned', () => {
    expect(at(0)).toBe(29);
    // Under a notch: the band and the stuck bar both start below the safe-area inset.
    expect(at(47, { bandTop: 47 })).toBe(29);
    expect(at(57, { bandTop: 47 })).toBe(19);
  });

  it('comes back down over the bar height as the bar leaves at the end of its list', () => {
    expect(at(-35)).toBe(14.5);
    expect(at(-70)).toBe(0);
    expect(at(-400)).toBe(0);
  });

  it('never rises under a bar as tall as the band or taller (a short screen)', () => {
    for (const barTop of [-30, 0, 10, 80]) {
      expect(at(barTop, { bandHeight: 54.6, barHeight: 66 })).toBe(0);
      expect(at(barTop, { bandHeight: 70, barHeight: 70 })).toBe(0);
    }
  });
});

/** A sticky FilterBar in the page, 70 px tall, at `top` px in the window (a test may move it). */
function stubStickyBar(initialTop: number) {
  let top = initialTop;
  const bar = document.createElement('search');
  bar.setAttribute('data-filter-part', 'bar');
  bar.setAttribute('data-sticky', '');
  bar.getBoundingClientRect = () =>
    ({ top, bottom: top + 70, height: 70, left: 0, right: 300, width: 300 }) as DOMRect;
  document.body.append(bar);
  return {
    moveTo: (next: number) => {
      top = next;
    },
    remove: () => bar.remove(),
  };
}

const barShift = (haze: HTMLElement) => haze.style.getPropertyValue(EDGE_HAZE_BAR_SHIFT);

describe('the scroll fade fallback', () => {
  let layout: ReturnType<typeof stubLayout>;

  beforeEach(() => {
    layout = stubLayout(0);
  });

  afterEach(() => {
    layout.restore();
  });

  it('does nothing where CSS runs the scroll timeline', () => {
    const supports = supportsScrollTimeline(true);
    const frames = manualFrames();
    const observers = recordResizeObservers();
    const listen = vi.spyOn(window, 'addEventListener');

    const { container } = render(<EdgeHaze path="/" />);
    layout.scrollTo(1200);
    frames.run();

    expect(supports).toHaveBeenCalledWith('animation-timeline: scroll()');
    expect(supports).toHaveBeenCalledWith('timeline-scope: --filter-bar');
    expect(opacities(hazeOf(container))).toEqual({ top: '', bottom: '' });
    expect(barShift(hazeOf(container))).toBe('');
    expect(listen.mock.calls.map(([type]) => type)).not.toEqual(expect.arrayContaining(['scroll']));
    expect(observers).toHaveLength(0);
    expect(frames.pending()).toBe(0);
  });

  it('sets both opacities at once without the scroll timeline, then follows the scroll once per frame', () => {
    supportsScrollTimeline(false);
    const frames = manualFrames();
    recordResizeObservers();

    const { container } = render(<EdgeHaze path="/" />);
    const haze = hazeOf(container);

    expect(opacities(haze)).toEqual({ top: '0', bottom: '1' });

    act(() => {
      layout.scrollTo(40);
      layout.scrollTo(50);
    });
    // Two scroll events, one frame.
    expect(frames.pending()).toBe(1);
    expect(opacities(haze)).toEqual({ top: '0', bottom: '1' });
    frames.run();
    expect(opacities(haze)).toEqual({ top: '0.5', bottom: '1' });

    act(() => layout.scrollTo(MAX_SCROLL_PX));
    frames.run();
    expect(opacities(haze)).toEqual({ top: '1', bottom: '0' });
  });

  it('updates when the page or the window changes size', () => {
    supportsScrollTimeline(false);
    const frames = manualFrames();
    const observers = recordResizeObservers();

    render(<EdgeHaze path="/" />);

    expect(observers).toHaveLength(1);
    expect(observers[0]?.observe).toHaveBeenCalledWith(document.body);
    window.dispatchEvent(new Event('resize'));
    expect(frames.pending()).toBe(1);
  });

  // CodeRabbit on #614: the observer's callback must refresh the bands when the page changes
  // height with no scroll, or the bottom band keeps the opacity of the old page.
  it('fades the bottom band back in when the page grows under a reader at its end', () => {
    supportsScrollTimeline(false);
    const frames = manualFrames();
    const observers = recordResizeObservers();

    const { container } = render(<EdgeHaze path="/" />);
    const haze = hazeOf(container);
    act(() => layout.scrollTo(MAX_SCROLL_PX));
    frames.run();
    expect(opacities(haze).bottom).toBe('0');

    layout.setPageHeight(PAGE_PX + 1000);
    act(() => observers[0]?.resize());
    expect(frames.pending()).toBe(1);
    frames.run();

    expect(opacities(haze).bottom).toBe('1');
  });

  it('raises the top band under a sticky bar where CSS fades it but has no view timeline, in the same loop', () => {
    vi.spyOn(CSS, 'supports').mockImplementation(
      (condition: string) => condition === 'animation-timeline: scroll()',
    );
    const frames = manualFrames();
    const observers = recordResizeObservers();
    const bar = stubStickyBar(0);

    const { container } = render(<EdgeHaze path="/places" />);
    const haze = hazeOf(container);

    // Pinned at the top: the 100 px band rises by 30 px to end at the bar's 70 px edge. CSS still
    // fades the bands, so the script sets no opacity.
    expect(barShift(haze)).toBe('30px');
    expect(opacities(haze)).toEqual({ top: '', bottom: '' });

    bar.moveTo(20);
    act(() => layout.scrollTo(500));
    expect(frames.pending()).toBe(1);
    frames.run();
    expect(barShift(haze)).toBe('10px');

    bar.moveTo(400);
    act(() => layout.scrollTo(100));
    frames.run();
    expect(barShift(haze)).toBe('0px');
    expect(observers).toHaveLength(1);
    bar.remove();
  });

  it('keeps the shared inset when a short-screen bar is unpinned and top resolves to zero', () => {
    supportsScrollTimeline(false);
    manualFrames();
    recordResizeObservers();
    const bar = stubStickyBar(0);
    const element = document.querySelector<HTMLElement>(STICKY_FILTER_BAR);
    if (!element) throw new Error('missing test bar');
    element.style.position = 'relative';
    element.style.top = '0px';
    element.style.setProperty('--sticky-top-gap', '8px');
    const { container } = render(<EdgeHaze path="/places" />);
    try {
      expect(Number.parseFloat(barShift(hazeOf(container)))).toBeCloseTo(22 * (1 - 8 / 70));
    } finally {
      bar.remove();
    }
  });

  it('resets the bar shift on navigation without a scroll or size change', () => {
    supportsScrollTimeline(false);
    manualFrames();
    recordResizeObservers();
    const bar = stubStickyBar(0);
    const { container, rerender } = render(<EdgeHaze path="/places" />);
    expect(barShift(hazeOf(container))).toBe('30px');
    bar.remove();
    rerender(<EdgeHaze path="/" />);
    expect(barShift(hazeOf(container))).toBe('0px');
  });

  it('keeps the band down on a page without a sticky bar', () => {
    supportsScrollTimeline(false);
    manualFrames();
    recordResizeObservers();

    const { container } = render(<EdgeHaze path="/" />);

    expect(barShift(hazeOf(container))).toBe('0px');
  });

  it('removes its listeners, its observer and a pending frame on unmount', () => {
    supportsScrollTimeline(false);
    const frames = manualFrames();
    const observers = recordResizeObservers();
    const listen = vi.spyOn(window, 'addEventListener');
    const unlisten = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<EdgeHaze path="/" />);
    layout.scrollTo(300);
    expect(frames.pending()).toBe(1);
    unmount();

    for (const type of ['scroll', 'resize']) {
      const added = listen.mock.calls.find(([name]) => name === type);
      expect(added, `no ${type} listener was added`).toBeDefined();
      expect(unlisten).toHaveBeenCalledWith(type, added?.[1]);
    }
    expect(observers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(frames.cancel).toHaveBeenCalled();
    expect(frames.pending()).toBe(0);
  });
});
