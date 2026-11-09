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
 * @file The guarded view transition for discrete filter changes: a chip, a token, a checkbox or
 * Clear crossfades the results (named only for the transition, clipped to the clear band under
 * the sticky bar), while typing never does, because a view transition holds input while it
 * runs. Nothing animates under reduced motion, in a hidden tab, while a sheet or picker is open,
 * or where the browser has no view transitions; the change still applies at once.
 */

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubPageScroll } from '../../dom/page-scroll';
import { FullBar } from './harness';
import { wideLayout } from './wide-layout';

type Start = (update: () => void) => { finished: Promise<void> };

let start: ReturnType<typeof vi.fn<Start>>;
let namesDuring: string[];

const setReducedMotion = (reduce: boolean): void => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
};

let narrow: () => void;

beforeEach(() => {
  narrow = wideLayout();
  namesDuring = [];
  start = vi.fn<Start>((update) => {
    const results = document.querySelector<HTMLElement>('[data-filter-part="results"]');
    namesDuring.push(results?.style.viewTransitionName ?? '');
    update();
    return { finished: Promise.resolve() };
  });
  Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true });
  setReducedMotion(false);
});

afterEach(() => {
  cleanup();
  narrow();
  Reflect.deleteProperty(document, 'startViewTransition');
  vi.unstubAllGlobals();
});

const chip = (name: RegExp): HTMLElement =>
  within(screen.getByRole('list', { name: 'Filter by kind' })).getByRole('link', { name });
const results = (): HTMLElement[] =>
  within(screen.getByRole('list', { name: 'Results' })).getAllByRole('listitem');
const resultsName = (): string | undefined =>
  document.querySelector<HTMLElement>('[data-filter-part="results"]')?.style.viewTransitionName;

describe('discrete changes crossfade the results', () => {
  it('a chip runs its change inside a view transition, with the results named for it', async () => {
    render(<FullBar />);

    fireEvent.click(chip(/^Tools/));

    expect(start).toHaveBeenCalledTimes(1);
    expect(namesDuring).toEqual(['filter-results']);
    expect(results()).toHaveLength(2);
    // The name is the transition's only: it is gone once the transition has finished.
    await vi.waitFor(() => expect(resultsName()).toBe(''));
  });

  it('a checkbox and Clear all do too', () => {
    render(<FullBar initial="?category=tools" />);

    fireEvent.click(screen.getByRole('checkbox', { name: /^Go/ }));
    fireEvent.click(screen.getByRole('link', { name: 'Clear all' }));

    expect(start).toHaveBeenCalledTimes(2);
    expect(results()).toHaveLength(5);
  });

  // The browser runs the update a frame after the click; typing can land in between. The change
  // must act on the filters as they are then, or the typed search would be put back to before.
  it('applies a deferred change to the filters as they are when it runs, typing included', () => {
    let pending: (() => void) | null = null;
    start.mockImplementation((update) => {
      pending = update;
      return { finished: Promise.resolve() };
    });
    render(<FullBar />);
    const search = screen.getByRole('searchbox', { name: 'Search projects' });

    fireEvent.click(chip(/^Tools/));
    fireEvent.change(search, { target: { value: 'bot' } });
    act(() => pending?.());

    expect(search).toHaveValue('bot');
    expect(results().map((item) => item.textContent)).toEqual(['Epsilon bot']);
    expect(chip(/^Tools/)).toHaveAttribute('aria-current', 'true');
  });

  // Starting a transition skips the one still running, whose `finished` then settles before the
  // newer one captures: its end must not strip the newer one's name and root flag.
  it('a later change keeps its name when the earlier transition it skipped ends', async () => {
    const ends: Array<() => void> = [];
    start.mockImplementation((update) => {
      update();
      return { finished: new Promise<void>((resolve) => ends.push(resolve)) };
    });
    render(<FullBar />);

    fireEvent.click(chip(/^Tools/));
    fireEvent.click(chip(/^Apps/));
    ends[0]?.();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(resultsName()).toBe('filter-results');
    expect(document.documentElement).toHaveAttribute('data-filter-transition');
    ends[1]?.();
    await vi.waitFor(() => expect(resultsName()).toBe(''));
    expect(document.documentElement).not.toHaveAttribute('data-filter-transition');
  });

  // With two bars on a page, each change names its own results. A skipped change's results must
  // not keep the name: a capture that finds one name twice is skipped, and so would every later one.
  it('a change skipped by another bar’s change gives up its own results’ name', async () => {
    const ends: Array<() => void> = [];
    start.mockImplementation((update) => {
      update();
      return { finished: new Promise<void>((resolve) => ends.push(resolve)) };
    });
    const first = render(<FullBar />).container;
    const second = render(<FullBar />).container;
    /** A kind chip in one bar's tree. */
    const kindChip = (root: HTMLElement, name: RegExp): HTMLElement =>
      within(within(root).getByRole('list', { name: 'Filter by kind' })).getByRole('link', {
        name,
      });
    /** The view-transition-name on one bar's results. */
    const nameIn = (root: HTMLElement): string | undefined =>
      root.querySelector<HTMLElement>('[data-filter-part="results"]')?.style.viewTransitionName;

    fireEvent.click(kindChip(first, /^Tools/));
    fireEvent.click(kindChip(second, /^Apps/));
    ends[0]?.();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(nameIn(first)).toBe('');
    expect(nameIn(second)).toBe('filter-results');
    expect(document.documentElement).toHaveAttribute('data-filter-transition');
    ends[1]?.();
    await vi.waitFor(() => expect(nameIn(second)).toBe(''));
    expect(document.documentElement).not.toHaveAttribute('data-filter-transition');
  });
});

describe('never while typing, and never when motion is unwelcome', () => {
  it('typing filters at once with no transition', () => {
    render(<FullBar />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search projects' }), {
      target: { value: 'delta' },
    });

    expect(start).not.toHaveBeenCalled();
    expect(results()).toHaveLength(1);
  });

  it('under reduced motion the change applies at once', () => {
    setReducedMotion(true);
    render(<FullBar />);

    fireEvent.click(chip(/^Tools/));

    expect(start).not.toHaveBeenCalled();
    expect(results()).toHaveLength(2);
  });

  // Where a change lands is not motion: an instant scroll in the same handler as the change paints
  // once, so a phone (chips in the sheet) and reduced motion land on the results' top too.
  it('under reduced motion a change made while scrolled into the results still lands on their top', () => {
    setReducedMotion(true);
    const page = stubPageScroll(3000);
    render(<FullBar />);
    /** A box with only its top and bottom edges, which is all the alignment reads. */
    const box = (top: number, bottom: number) => () => ({ top, bottom }) as DOMRect;
    const resultsBox = document.querySelector<HTMLElement>('[data-filter-part="results"]');
    const barBox = document.querySelector<HTMLElement>('[data-filter-part="bar"]');
    if (resultsBox) resultsBox.getBoundingClientRect = box(-500, 3500);
    if (barBox) barBox.getBoundingClientRect = box(0, 64);

    try {
      fireEvent.click(chip(/^Tools/));

      expect(start).not.toHaveBeenCalled();
      expect(page.scrollTo).toHaveBeenCalledWith({ top: 3000 - 500 - 64 - 8, behavior: 'instant' });
      expect(results()).toHaveLength(2);
    } finally {
      page.restore();
    }
  });

  it('where the browser has no view transitions the change applies at once', () => {
    Reflect.deleteProperty(document, 'startViewTransition');
    render(<FullBar />);

    fireEvent.click(chip(/^Apps/));

    expect(results()).toHaveLength(1);
  });

  it('a transition the browser refuses still applies the change', () => {
    start.mockImplementation(() => {
      throw new DOMException('refused', 'InvalidStateError');
    });
    render(<FullBar />);

    fireEvent.click(chip(/^Apps/));

    expect(results()).toHaveLength(1);
    expect(resultsName()).toBe('');
  });
});
