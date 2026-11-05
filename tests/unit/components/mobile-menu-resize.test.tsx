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

/**
 * @file The mobile menu closes itself only once the sidebar takes over, which layout.tsx does at
 * Tailwind's `lg`, `(min-width: 64rem)`. A rem follows the browser's font size, so that is 1024 px
 * only at the default 16 px. jsdom has no layout, so a fake matchMedia evaluates rem min-width
 * queries against a viewport the tests resize, and fires `change` when a result flips, as browsers
 * do. Each resize also sets innerWidth and fires `resize`, so a pixel check would be caught too.
 */

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MobileMenuOverlay } from '@/components/layout/mobile-menu-overlay';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

type OverlayQuery = Parameters<typeof MobileMenuOverlay>[0]['query'];

const LG_QUERY = '(min-width: 64rem)';
const DEFAULT_ROOT_FONT_PX = 16;
const PHONE_WIDTH_PX = 390;

interface FakeQuery {
  readonly media: string;
  readonly minWidthRem: number;
  readonly listeners: Set<EventListener>;
  wasMatching: boolean;
}

const viewport = { width: PHONE_WIDTH_PX, rootFontPx: DEFAULT_ROOT_FONT_PX };
const queries: FakeQuery[] = [];
const originalWidth = window.innerWidth;

const evaluate = ({ minWidthRem }: FakeQuery): boolean =>
  viewport.width >= minWidthRem * viewport.rootFontPx;

const parseMinWidthRem = (media: string): number => {
  const match = /^\(min-width: (\d+(?:\.\d+)?)rem\)$/.exec(media);
  if (!match) throw new Error(`the fake only answers rem min-width queries, got: ${media}`);
  return Number(match[1]);
};

const fakeMatchMedia = (media: string): MediaQueryList => {
  const query: FakeQuery = {
    media,
    minWidthRem: parseMinWidthRem(media),
    listeners: new Set(),
    wasMatching: false,
  };
  query.wasMatching = evaluate(query);
  queries.push(query);

  const list = {
    media,
    onchange: null,
    get matches() {
      return evaluate(query);
    },
    addEventListener: (type: string, listener: EventListener) => {
      if (type === 'change') query.listeners.add(listener);
    },
    removeEventListener: (type: string, listener: EventListener) => {
      if (type === 'change') query.listeners.delete(listener);
    },
    addListener: (listener: EventListener) => query.listeners.add(listener),
    removeListener: (listener: EventListener) => query.listeners.delete(listener),
    dispatchEvent: () => false,
  };
  return list as unknown as MediaQueryList;
};

/** Fires `change` on every query whose result flipped, as a browser does after a resize. */
const notifyChangedQueries = (): void => {
  for (const query of queries) {
    const matches = evaluate(query);
    if (matches === query.wasMatching) continue;
    query.wasMatching = matches;
    for (const listener of [...query.listeners]) listener(new Event('change'));
  }
};

const resizeTo = (width: number): void => {
  viewport.width = width;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
  notifyChangedQueries();
};

const listenerCount = (): number =>
  queries.reduce((count, query) => count + query.listeners.size, 0);

const overlay = (isOpen: boolean, onClose: () => void) => (
  <MobileMenuOverlay
    isOpen={isOpen}
    onClose={onClose}
    pathname="/"
    query={{ toggle: vi.fn() } as unknown as OverlayQuery}
  />
);

/** Renders the overlay open on a phone-width window with the given root font size. */
const renderOpenOverlay = (rootFontPx = DEFAULT_ROOT_FONT_PX) => {
  viewport.rootFontPx = rootFontPx;
  const onClose = vi.fn();
  const view = render(overlay(true, onClose));
  return { onClose, rerender: view.rerender };
};

beforeEach(() => {
  viewport.width = PHONE_WIDTH_PX;
  viewport.rootFontPx = DEFAULT_ROOT_FONT_PX;
  queries.length = 0;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: PHONE_WIDTH_PX });
  vi.stubGlobal('matchMedia', fakeMatchMedia);
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
});

describe('MobileMenuOverlay resize', () => {
  it("asks for the same rem query as Tailwind's lg, which layout.tsx swaps the nav at", () => {
    renderOpenOverlay();

    expect(queries.map((query) => query.media)).toEqual([LG_QUERY]);
  });

  it('stays open within the tablet range, where the bottom bar still shows', () => {
    const { onClose } = renderOpenOverlay();

    resizeTo(820);
    resizeTo(1023);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes at 1024 px with the default 16 px font, once the sidebar replaces the bar', () => {
    const { onClose } = renderOpenOverlay();

    resizeTo(1024);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('with a 20 px root font stays open at 1100 px and closes at 1280 px, where 64rem is', () => {
    const { onClose } = renderOpenOverlay(20);

    resizeTo(1100);
    expect(onClose).not.toHaveBeenCalled();

    resizeTo(1280);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('with a 12 px root font closes at 800 px, since 64rem is only 768 px', () => {
    const { onClose } = renderOpenOverlay(12);

    resizeTo(800);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stops listening once the overlay is closed', () => {
    const { onClose, rerender } = renderOpenOverlay();
    expect(listenerCount()).toBe(1);

    rerender(overlay(false, onClose));
    resizeTo(1024);

    expect(listenerCount()).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });
});
