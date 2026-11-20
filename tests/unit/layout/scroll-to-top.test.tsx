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

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAIN_CONTENT_ID } from '@/components/animations/pages/page-transition';
import { SCROLL_UP_REVEAL_QUERY, ScrollToTop } from '@/components/layout/scroll-to-top';
import { REDUCED_MOTION_QUERY } from '@/lib/design/motion';

const SETUP_RESIZE_OBSERVER = globalThis.ResizeObserver;
const originalMatchMedia = globalThis.matchMedia;
const initialUrl = window.location.href;
const initialState = window.history.state;
let y = 0;
let viewport = 800;
let pageHeight = 3000;
let nextFrame = 0;
let frames = new Map<number, FrameRequestCallback>();
let observers: { resize: () => void; disconnect: ReturnType<typeof vi.fn> }[] = [];
let restore: (() => void)[] = [];

function measure(target: object, key: string, get: () => number): void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, get });
  restore.push(() => {
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  });
}

beforeEach(() => {
  y = 0;
  viewport = 800;
  pageHeight = 3000;
  frames = new Map();
  observers = [];
  restore = [];
  measure(window, 'scrollY', () => y);
  measure(window, 'innerHeight', () => viewport);
  measure(document.documentElement, 'scrollHeight', () => pageHeight);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  globalThis.ResizeObserver = class {
    disconnect = vi.fn();
    observe = vi.fn();
    unobserve = vi.fn();
    constructor(callback: ResizeObserverCallback) {
      observers.push({ disconnect: this.disconnect, resize: () => callback([], this) });
    }
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  globalThis.ResizeObserver = SETUP_RESIZE_OBSERVER;
  globalThis.matchMedia = originalMatchMedia;
  for (const undo of restore.reverse()) undo();
  document.body.removeAttribute('style');
  document.body.removeAttribute('data-scroll-locked');
  document.body.replaceChildren();
  window.history.replaceState(initialState, '', initialUrl);
});

async function frame(): Promise<void> {
  await act(async () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(performance.now());
  });
}

async function scroll(yNext: number): Promise<void> {
  y = yNext;
  fireEvent.scroll(window);
  await frame();
}

const button = () => screen.queryByRole('button', { name: 'Back to top' });
const page = (path = '/projects') => (
  <>
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <h1>Projects</h1>
    </main>
    <footer>Footer status</footer>
    <ScrollToTop path={path} />
  </>
);

async function openControl() {
  y = 1200;
  const result = render(page());
  await frame();
  expect(button()).toBeInTheDocument();
  return result;
}

describe('shared scroll-to-top control', () => {
  it('appears after a capped meaningful scroll and is absent from the tab order near the top', async () => {
    render(page());
    expect(button()).not.toBeInTheDocument();
    await frame();
    await scroll(319);
    expect(button()).not.toBeInTheDocument();
    await scroll(320);
    expect(button()).toHaveAttribute('type', 'button');
    await scroll(0);
    expect(button()).not.toBeInTheDocument();
  });

  it('shows when a long page has less than one viewport of total scroll, as Spotify on a tall display', async () => {
    viewport = 1150;
    pageHeight = 2058;
    render(page('/spotify'));
    await frame();
    await scroll(pageHeight - viewport);
    expect(button()).toBeInTheDocument();
  });

  it('reserves space above a visible footer, then releases it when the footer moves away', async () => {
    viewport = 1150;
    pageHeight = 2058;
    y = 908;
    const { container } = render(page('/spotify'));
    const footer = screen.getByRole('contentinfo');
    let top = 1050;
    vi.spyOn(footer, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          top,
          bottom: top + 100,
          height: 100,
          left: 0,
          right: 1440,
          width: 1440,
        }) as DOMRect,
    );
    await frame();
    expect(button()).toBeInTheDocument();
    const position = (): HTMLElement | null =>
      container.querySelector('[data-scroll-top-position]');
    expect(position()?.style.getPropertyValue('--scroll-top-footer-clearance')).toBe('100px');
    top = 1200;
    act(() => {
      for (const observer of observers) observer.resize();
    });
    await frame();
    expect(button()).toBeInTheDocument();
    expect(position()?.style.getPropertyValue('--scroll-top-footer-clearance')).toBe('0px');
  });

  it('stays absent on a short page with less than the meaningful scroll available', async () => {
    pageHeight = 1000;
    render(page());
    await frame();
    await scroll(pageHeight - viewport);
    expect(button()).not.toBeInTheDocument();
  });

  it('does not show on a non-scrollable page even with an old restored scroll position', async () => {
    pageHeight = viewport;
    y = 1200;
    render(page());
    await frame();
    expect(button()).not.toBeInTheDocument();
  });

  it('rechecks the half-viewport threshold and filtered content height without another scroll', async () => {
    viewport = 400;
    y = 250;
    render(page());
    await frame();
    expect(button()).toBeInTheDocument();
    viewport = 800;
    fireEvent.resize(window);
    await frame();
    expect(button()).not.toBeInTheDocument();
    viewport = 300;
    fireEvent.resize(window);
    await frame();
    expect(button()).toBeInTheDocument();
    pageHeight = 300;
    act(() => {
      for (const observer of observers) observer.resize();
    });
    await frame();
    expect(button()).not.toBeInTheDocument();
  });

  it('resets on navigation and honors a restored position without moving the new page', async () => {
    const { rerender } = await openControl();
    y = 0;
    rerender(page('/privacy'));
    expect(button()).not.toBeInTheDocument();
    await frame();
    expect(button()).not.toBeInTheDocument();
    y = 1600;
    rerender(page('/projects'));
    expect(button()).not.toBeInTheDocument();
    await frame();
    expect(button()).toBeInTheDocument();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('keeps the URL query and router state while replacing only the anchor, then focuses main', async () => {
    const state = { __NA: true, tree: ['media'], marker: 7 };
    window.history.replaceState(state, '', '/media?kind=video&q=web%20dev#series');
    const length = window.history.length;
    await openControl();
    const replace = vi.spyOn(window.history, 'replaceState');
    const main = screen.getByRole('main');
    const focus = vi.spyOn(main, 'focus');
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(main).toHaveFocus();
    expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'smooth' });
    expect(replace).toHaveBeenCalledExactlyOnceWith(state, '', '/media?kind=video&q=web%20dev');
    expect(window.history.state).toEqual(state);
    expect(window.history.length).toBe(length);
    expect(window.location.hash).toBe('');
  });

  it('uses instant scrolling under reduced motion and does not write history without a hash', async () => {
    window.history.replaceState({ __NA: true }, '', '/projects?kind=web');
    globalThis.matchMedia = (query) => ({
      ...originalMatchMedia(query),
      matches: query === REDUCED_MOTION_QUERY,
    });
    await openControl();
    const replace = vi.spyOn(window.history, 'replaceState');
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));
    expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'instant' });
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?kind=web');
  });

  it.each(['overflow', 'data-scroll-locked'])(
    'hides while a %s body lock owns the page',
    async (lock) => {
      await openControl();
      await act(async () => {
        if (lock === 'overflow') document.body.style.overflow = 'hidden';
        else document.body.setAttribute('data-scroll-locked', '1');
      });
      await frame();
      expect(button()).not.toBeInTheDocument();
      await act(async () => {
        document.body.removeAttribute('style');
        document.body.removeAttribute('data-scroll-locked');
      });
      await frame();
      expect(button()).toBeInTheDocument();
    },
  );

  it('hides for an open dialog and returns when it closes without another scroll', async () => {
    await openControl();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    await act(async () => {
      document.body.append(dialog);
    });
    await frame();
    expect(button()).not.toBeInTheDocument();
    await act(async () => {
      dialog.setAttribute('data-state', 'closed');
    });
    await frame();
    expect(button()).toBeInTheDocument();
    dialog.remove();
  });

  it('hides for a native popover and returns when its toggle closes it', async () => {
    const popover = document.createElement('div');
    popover.setAttribute('popover', 'auto');
    let open = false;
    vi.spyOn(popover, 'matches').mockImplementation(
      (selector) => selector === ':popover-open' && open,
    );
    document.body.append(popover);
    await openControl();
    open = true;
    popover.dispatchEvent(new Event('toggle'));
    await frame();
    expect(button()).not.toBeInTheDocument();
    open = false;
    popover.dispatchEvent(new Event('toggle'));
    await frame();
    expect(button()).toBeInTheDocument();
  });

  it('does not activate if an overlay opens before visibility has caught up', async () => {
    await openControl();
    document.body.style.overflow = 'hidden';
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(screen.getByRole('main')).not.toHaveFocus();
  });

  it('stays mounted while hidden, inert and out of the accessibility tree, so it can fade out', async () => {
    const { container } = await openControl();
    const node = container.querySelector<HTMLElement>('[data-scroll-top]');
    const position = container.querySelector<HTMLElement>('[data-scroll-top-position]');
    expect(node).toHaveAttribute('data-shown', 'true');
    expect(position).not.toHaveAttribute('inert');
    expect(position).not.toHaveAttribute('aria-hidden');

    await scroll(0);

    expect(button()).not.toBeInTheDocument();
    expect(container.querySelector('[data-scroll-top]')).toBe(node);
    expect(node).toHaveAttribute('data-shown', 'false');
    expect(node).toHaveAttribute('tabindex', '-1');
    expect(position).toHaveAttribute('inert');
    expect(position).toHaveAttribute('aria-hidden', 'true');
  });

  it('never moves its fixed box: one bottom, a footer lift by translate, entry by opacity and transform', async () => {
    const { container } = await openControl();
    const position = container.querySelector<HTMLElement>('[data-scroll-top-position]');
    const lift = container.querySelector<HTMLElement>('[data-scroll-top-lift]');
    const classes = position?.className.split(' ') ?? [];

    // The bottom is one variable, set per breakpoint, never the footer's scroll-driven clearance.
    expect(classes).toContain('bottom-(--scroll-top-base)');
    expect(position?.className).not.toContain('scroll-top-footer-bottom');
    expect(lift?.style.translate).toBe(
      '0 calc(-1 * max(0px, var(--scroll-top-footer-bottom) - var(--scroll-top-base)))',
    );
    const buttonClasses = button()?.className.split(' ') ?? [];
    expect(buttonClasses).toEqual(
      expect.arrayContaining([
        'transition-[opacity,translate,scale,color,background-color,border-color]',
        'data-[shown=false]:opacity-0',
        'data-[shown=false]:translate-y-2',
        'data-[shown=false]:scale-90',
        'motion-reduce:transition-none',
      ]),
    );
    // Nothing that sizes or places the box is ever transitioned.
    expect(button()?.className).not.toMatch(
      /transition-(all|\[[^\]]*(width|height|bottom|top|inset))/,
    );
  });

  describe('on a page narrower than the side rail', () => {
    beforeEach(() => {
      globalThis.matchMedia = (query) => ({
        ...originalMatchMedia(query),
        matches: query === SCROLL_UP_REVEAL_QUERY,
      });
    });

    it('stays out of the way while reading down and shows on a scroll back up', async () => {
      render(page());
      await frame();
      await scroll(600);
      await scroll(1200);
      expect(button()).not.toBeInTheDocument();
      await scroll(1190);
      // Under the slop: a jitter is not a change of direction.
      expect(button()).not.toBeInTheDocument();
      await scroll(1100);
      expect(button()).toBeInTheDocument();
      await scroll(1105);
      expect(button()).toBeInTheDocument();
      await scroll(1400);
      expect(button()).not.toBeInTheDocument();
    });

    it('waits for a scroll up even at a restored position, and still needs the threshold', async () => {
      y = 1600;
      render(page());
      await frame();
      expect(button()).not.toBeInTheDocument();
      await scroll(1500);
      expect(button()).toBeInTheDocument();
      await scroll(200);
      expect(button()).not.toBeInTheDocument();
    });

    it('shows at the foot of the page, with the footer in view, whichever way the page moved', async () => {
      viewport = 800;
      pageHeight = 3000;
      render(page());
      const footer = screen.getByRole('contentinfo');
      let top = 2000;
      vi.spyOn(footer, 'getBoundingClientRect').mockImplementation(
        () =>
          ({
            top,
            bottom: top + 100,
            height: 100,
            left: 0,
            right: 390,
            width: 390,
          }) as DOMRect,
      );
      await frame();
      await scroll(1500);
      expect(button()).not.toBeInTheDocument();
      top = 700;
      await scroll(2200);
      expect(button()).toBeInTheDocument();
    });
  });

  it('disconnects observers and cancels pending work on unmount', async () => {
    const { unmount } = await openControl();
    fireEvent.scroll(window);
    expect(frames.size).toBeGreaterThan(0);
    unmount();
    expect(frames.size).toBe(0);
    for (const observer of observers) expect(observer.disconnect).toHaveBeenCalledOnce();
    await act(async () => {
      document.body.style.overflow = 'hidden';
    });
    fireEvent.scroll(window);
    fireEvent.resize(window);
    expect(frames.size).toBe(0);
  });
});
