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
