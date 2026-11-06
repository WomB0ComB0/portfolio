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
 * @file The ⌘K palette on a phone keeps its results above the on-screen keyboard.
 *
 * The phone bar's Search button opens the palette, whose search box autofocuses, so the keyboard
 * opens with it. Under interactive-widget=resizes-visual only the visual viewport shrinks for the
 * keyboard, so kbar's fixed 400 px list (and its inline 14vh top padding) ran under it. jsdom has
 * no layout and no visualViewport, so these tests stand in a visual viewport and the two boxes the
 * palette measures; e2e or a phone checks the real geometry.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import { compile } from 'tailwindcss';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fitResultsHeight,
  Palette,
  RESULTS_MAX_HEIGHT,
  RESULTS_MIN_HEIGHT,
} from '@/components/cmd';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

/** A phone's layout viewport height (iPhone SE portrait). */
const PHONE_HEIGHT = 667;
/** Where the results list starts on a phone: 12 px top padding, the search box, 6 px padding. */
const LIST_TOP = 77;
/** What the panel draws under the list on a phone: 6 px padding and the 1 px border. */
const BELOW_LIST = 7;
/** The gap the palette keeps above the visual viewport's bottom edge. */
const BOTTOM_GAP = 16;

/** A stand-in for window.visualViewport that the test resizes and pans like a keyboard would. */
class FakeVisualViewport extends EventTarget {
  height = PHONE_HEIGHT;
  offsetTop = 0;

  resizeTo(height: number): void {
    this.height = height;
    this.dispatchEvent(new Event('resize'));
  }

  panTo(offsetTop: number): void {
    this.offsetTop = offsetTop;
    this.dispatchEvent(new Event('scroll'));
  }
}

const rect = (top: number, bottom: number): DOMRect =>
  ({
    top,
    bottom,
    y: top,
    height: bottom - top,
    left: 0,
    right: 360,
    x: 0,
    width: 360,
    toJSON: () => ({}),
  }) as DOMRect;

/**
 * Lays out the two boxes the palette measures: kbar's scroll box (the listbox's parent) from
 * LIST_TOP, and KBarAnimator's inner box ending BELOW_LIST under it. Everything else keeps
 * jsdom's empty box.
 */
const layOutPalette = (): void => {
  const original = Element.prototype.getBoundingClientRect;
  const listBottom = LIST_TOP + RESULTS_MAX_HEIGHT;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.firstElementChild?.getAttribute('role') === 'listbox') {
      return rect(LIST_TOP, listBottom);
    }
    if (this.querySelector(':scope > div > div > [role="listbox"]')) {
      return rect(0, listBottom + BELOW_LIST);
    }
    return original.call(this);
  });
};

const viewportDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport');

const setVisualViewport = (value: FakeVisualViewport | undefined): void => {
  Object.defineProperty(window, 'visualViewport', { configurable: true, value });
};

/** jsdom has no Web Animations API; KBarAnimator only starts and forgets its animations. */
const originalAnimate = Element.prototype.animate;

beforeEach(() => {
  Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation);
});

afterEach(() => {
  vi.restoreAllMocks();
  Element.prototype.animate = originalAnimate;
  if (viewportDescriptor) Object.defineProperty(window, 'visualViewport', viewportDescriptor);
  else Reflect.deleteProperty(window, 'visualViewport');
});

/** Opens the palette with Ctrl+K and returns kbar's scroll box around the results. */
const openPalette = async (): Promise<HTMLElement> => {
  render(
    <KBarProvider>
      <Palette />
    </KBarProvider>,
  );
  act(() => {
    fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', ctrlKey: true });
  });
  await screen.findByRole('combobox');
  const scrollBox = screen.getByRole('listbox').parentElement;
  if (!scrollBox) throw new Error('kbar rendered no scroll box around the results');
  return scrollBox;
};

describe('fitResultsHeight', () => {
  it("keeps kbar's 400 px wherever the viewport has the room", () => {
    expect(fitResultsHeight({ viewportBottom: 900, listTop: 191, belowList: 41 })).toBe(400);
    expect(
      fitResultsHeight({ viewportBottom: PHONE_HEIGHT, listTop: LIST_TOP, belowList: BELOW_LIST }),
    ).toBe(RESULTS_MAX_HEIGHT);
  });

  it('ends the panel a gap above the visual viewport bottom when the keyboard is up', () => {
    expect(
      fitResultsHeight({ viewportBottom: 360, listTop: LIST_TOP, belowList: BELOW_LIST }),
    ).toBe(360 - LIST_TOP - BELOW_LIST - BOTTOM_GAP);
  });

  it('never shrinks below two rows, and rounds down to whole pixels', () => {
    expect(
      fitResultsHeight({ viewportBottom: 120, listTop: LIST_TOP, belowList: BELOW_LIST }),
    ).toBe(RESULTS_MIN_HEIGHT);
    expect(fitResultsHeight({ viewportBottom: 300.6, listTop: 77, belowList: 7 })).toBe(200);
  });
});

describe('Palette results above the on-screen keyboard', () => {
  it('caps the list to the room above the keyboard and follows it as it opens and closes', async () => {
    const viewport = new FakeVisualViewport();
    setVisualViewport(viewport);
    layOutPalette();

    const scrollBox = await openPalette();
    expect(scrollBox.style.maxHeight).toBe('400px');

    // The keyboard opens: the visual viewport is 360 px tall.
    act(() => viewport.resizeTo(360));
    expect(scrollBox.style.maxHeight).toBe(`${360 - LIST_TOP - BELOW_LIST - BOTTOM_GAP}px`);

    // The browser pans the visual viewport 40 px down: 40 more pixels of the list are visible.
    act(() => viewport.panTo(40));
    expect(scrollBox.style.maxHeight).toBe(`${400 - LIST_TOP - BELOW_LIST - BOTTOM_GAP}px`);

    // Landscape with the keyboard up leaves almost nothing: the list keeps two rows.
    act(() => {
      viewport.panTo(0);
      viewport.resizeTo(150);
    });
    expect(scrollBox.style.maxHeight).toBe(`${RESULTS_MIN_HEIGHT}px`);

    // The keyboard closes.
    act(() => viewport.resizeTo(PHONE_HEIGHT));
    expect(scrollBox.style.maxHeight).toBe('400px');
  });

  it('fits the list the moment it opens when the keyboard is already up', async () => {
    // The viewport shrinks before the palette mounts, so no resize reaches its listeners: only
    // the measurement made on mount can fit the list.
    const viewport = new FakeVisualViewport();
    viewport.resizeTo(360);
    setVisualViewport(viewport);
    layOutPalette();

    const scrollBox = await openPalette();

    expect(scrollBox.style.maxHeight).toBe(`${360 - LIST_TOP - BELOW_LIST - BOTTOM_GAP}px`);
  });

  it("keeps kbar's 400 px list where the browser has no visualViewport", async () => {
    setVisualViewport(undefined);
    layOutPalette();

    const scrollBox = await openPalette();

    expect(scrollBox.style.maxHeight).toBe('400px');
  });
});

describe('Palette top padding', () => {
  const compileCandidate = async (candidate: string): Promise<string> => {
    const theme = readFileSync(join(process.cwd(), 'node_modules/tailwindcss/theme.css'), 'utf8');
    const { build } = await compile(`${theme}\n@tailwind utilities;`);
    return build([candidate]).replace(/\s+/g, ' ');
  };

  it("keeps kbar's 14vh on desktop and moves up under the top inset on touch screens", async () => {
    setVisualViewport(undefined);
    await openPalette();
    const positioner = screen.getByRole('combobox').parentElement?.parentElement?.parentElement;
    if (!positioner) throw new Error('kbar rendered no positioner');

    // kbar's inline padding stays: a fine pointer (desktop) sees no change.
    expect(positioner.style.padding).toBe('14vh 16px 16px');
    const coarse = [...positioner.classList].filter((name) => name.startsWith('pointer-coarse:'));
    expect(coarse).toHaveLength(1);

    // Inline styles beat every normal declaration, so the touch padding has to be !important.
    const css = await compileCandidate(coarse[0] ?? '');
    expect(css).toMatch(/@media \(pointer: coarse\)/);
    expect(css).toMatch(/padding-top: calc\(0\.75rem \+ env\(safe-area-inset-top\)\) !important/);
  });
});
