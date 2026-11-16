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
 * @file A sticky FilterBar.Root writes its height twice: on its scope as --filter-bar-h, which the
 * sticky year bars below it stick under, and on <html> as --filter-bar-pinned-h, which the edge
 * haze's top band rises to while the bar is pinned (src/styles/edge-haze.css), so the first row
 * under the bar stays sharp. Both follow the bar as it resizes (chips wrapping, a font loading).
 * On unmount its own values go, but a value a newer bar has written stays. A bar that does not
 * stick writes nothing. jsdom lays nothing out, so the bar's height and the observer are stubbed;
 * e2e/visual/edge-haze.spec.ts measures the band against the real bar.
 */

import { act, cleanup, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FILTER_SCOPE_CLASS, FilterBar } from '@/components/console/filter-bar';
import { PINNED_BAR_HEIGHT_PROPERTY } from '@/components/console/filter-bar/bar';
import { Harness } from './harness';

// tests/setup/vitest.setup.ts defines a writable but non-configurable ResizeObserver: assign it,
// and put the setup's back after each test.
const SETUP_RESIZE_OBSERVER = globalThis.ResizeObserver;

/** Every ResizeObserver callback the code registers, to report a resize by hand. */
let resizeCallbacks: (() => void)[] = [];

/** The height each bar reports, by its label. */
const heights = new Map<string, number>();

beforeEach(() => {
  resizeCallbacks = [];
  globalThis.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      resizeCallbacks.push(() => callback([], this as unknown as ResizeObserver));
    }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  } as unknown as typeof ResizeObserver;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const height = heights.get(this.getAttribute('aria-label') ?? '') ?? 0;
    return { top: 0, bottom: height, height, left: 0, right: 300, width: 300 } as DOMRect;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  heights.clear();
  globalThis.ResizeObserver = SETUP_RESIZE_OBSERVER;
  document.documentElement.removeAttribute('style');
});

const pinnedHeight = (): string =>
  document.documentElement.style.getPropertyValue(PINNED_BAR_HEIGHT_PROPERTY);

/** A FilterBar inside its scope, as the pages compose it. */
function Bar({ label, sticky = true }: { label: string; sticky?: boolean }): ReactElement {
  return (
    <div data-filter-scope="" className={FILTER_SCOPE_CLASS}>
      <Harness>
        {() => (
          <FilterBar.Root label={label} sticky={sticky}>
            <FilterBar.Search />
          </FilterBar.Root>
        )}
      </Harness>
    </div>
  );
}

describe('a sticky FilterBar and the edge haze', () => {
  it('writes its height on <html> for the haze and on its scope for the year bars', () => {
    heights.set('Places', 70);

    const { container } = render(<Bar label="Places" />);

    expect(PINNED_BAR_HEIGHT_PROPERTY).toBe('--filter-bar-pinned-h');
    expect(pinnedHeight()).toBe('70px');
    const scope = container.querySelector<HTMLElement>('[data-filter-scope]');
    expect(scope?.style.getPropertyValue('--filter-bar-h')).toBe('70px');
  });

  it('follows the bar as it resizes', () => {
    heights.set('Projects', 64);
    render(<Bar label="Projects" />);
    expect(pinnedHeight()).toBe('64px');

    heights.set('Projects', 108);
    act(() => {
      for (const report of resizeCallbacks) report();
    });

    expect(pinnedHeight()).toBe('108px');
  });

  it('writes nothing for a bar that does not stick', () => {
    heights.set('Search', 56);

    render(<Bar label="Search" sticky={false} />);

    expect(pinnedHeight()).toBe('');
  });

  it("takes its value away on unmount, but leaves a newer bar's", () => {
    heights.set('Old', 70);
    heights.set('New', 56);
    const old = render(<Bar label="Old" />);
    const fresh = render(<Bar label="New" />);
    expect(pinnedHeight()).toBe('56px');

    old.unmount();
    expect(pinnedHeight()).toBe('56px');

    fresh.unmount();
    expect(pinnedHeight()).toBe('');
  });
});
