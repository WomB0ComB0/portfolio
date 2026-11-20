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
 * @file LiveAge, the /stats strip's age to five decimals. The server and the hydrating browser
 * print the age at the server's moment, so hydration never mismatches; after mount the digits
 * follow the browser's clock about ten times a second (once a second under reduced motion) by
 * writing text, never by rendering React again; a hidden tab stops the clock and catches up when
 * shown; screen readers get the whole years only, from a twin that is not live.
 *
 * Timers, animation frames and Date are faked, so the clock moves only when a test advances it
 * (an animation frame runs every 16 ms of fake time).
 */

import { render } from '@testing-library/react';
import { act, Profiler } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LiveAge,
  REDUCED_TICK_MS,
  TICK_MS,
} from '@/app/(routes)/(dev)/stats/_components/console/live-age';

/** 00:00 UTC on the 2026 birthday, from which the fifth decimal steps every STEP_MS. */
const BIRTHDAY = Date.parse('2026-03-24T00:00:00Z');
/** 1e-5 of the 365-day year from March 24, 2026. */
const STEP_MS = 315_360;
/** 50 ms before the fraction turns from .00999 to .01000. */
const BEFORE_STEP = BIRTHDAY + 1000 * STEP_MS - 50;
/** A moment well inside a step: '22.65753'. */
const SERVER_AT = Date.parse('2026-11-19T00:00:00Z');

function renderAge(at: number) {
  const view = render(<LiveAge at={at} />);
  const spoken = view.container.querySelector('.sr-only');
  const visible = view.container.querySelector('[data-digits]');
  if (!spoken || !visible) throw new Error('LiveAge rendered no copies');
  return { ...view, spoken, visible };
}

function hideTab(hidden: boolean): void {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden);
  document.dispatchEvent(new Event('visibilitychange'));
}

function preferReducedMotion(): void {
  // The literal query, not the shared constant, so a wrong constant cannot pass here.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  vi.useFakeTimers({
    now: BEFORE_STEP,
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'],
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('LiveAge on the server', () => {
  it('prints the age at its moment to five decimals, the whole years alone for readers', () => {
    const root = document.createElement('div');
    root.innerHTML = renderToString(<LiveAge at={SERVER_AT} className="extra" />);
    const figure = root.firstElementChild;
    const digits = root.querySelector('[data-digits]');
    const onScreen = root.querySelector('[aria-hidden="true"]');

    expect(root.querySelector('.sr-only')?.textContent).toBe('22');
    expect(digits?.textContent).toBe('22.65753');
    // Everything on screen is hidden from screen readers, inside a figure that is never live.
    expect(onScreen?.contains(digits)).toBe(true);
    expect(figure).toHaveAttribute('aria-live', 'off');
    expect(figure).toHaveClass('tabular-nums', 'extra');
    // An unseen '00.00000' in the digits' grid cell holds the box at the figure's width.
    const template = root.querySelector('.invisible');
    expect(onScreen).toHaveClass('inline-grid');
    expect(template?.textContent).toBe('00.00000');
    expect(template).toHaveClass('col-start-1', 'row-start-1');
    expect(digits).toHaveClass('col-start-1', 'row-start-1');
    // The decimals are muted, as a unit is; the whole years keep the figure's colour.
    expect(root.querySelector('.text-muted-foreground')?.textContent).toBe('.65753');
  });

  it('starts no clock', () => {
    renderToString(<LiveAge at={SERVER_AT} />);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('renders nothing for an invalid moment', () => {
    expect(renderToString(<LiveAge at={Number.NaN} />)).toBe('');
  });
});

describe('LiveAge hydration', () => {
  it('hydrates the server HTML without a mismatch when the browser clock has moved on', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<LiveAge at={SERVER_AT} />);
    document.body.append(container);
    // The browser reads its clock twenty steps (about 1 h 45 min) later than the server did.
    vi.setSystemTime(SERVER_AT + 20 * STEP_MS);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const recoverable = vi.fn();
    let root: Root | undefined;

    act(() => {
      root = hydrateRoot(container, <LiveAge at={SERVER_AT} />, {
        onRecoverableError: recoverable,
      });
    });

    expect(errors).not.toHaveBeenCalled();
    expect(recoverable).not.toHaveBeenCalled();
    // After mount it shows the browser's own clock.
    expect(container.querySelector('[data-digits]')?.textContent).toBe('22.65773');
    act(() => root?.unmount());
    container.remove();
  });
});

describe('LiveAge ticking', () => {
  it('shows the current age on mount and moves the fifth decimal within a tick of it changing', () => {
    const { visible, spoken } = renderAge(BEFORE_STEP);

    expect(visible.textContent).toBe('22.00999');
    vi.advanceTimersByTime(TICK_MS + 50);

    expect(visible.textContent).toBe('22.01000');
    expect(spoken.textContent).toBe('22');
  });

  it('updates about ten times a second, on animation frames', () => {
    const frame = vi.spyOn(globalThis, 'requestAnimationFrame');
    renderAge(BEFORE_STEP);

    vi.advanceTimersByTime(1_000);

    // A tick waits TICK_MS, then the next frame (up to 16 ms): 8 to 10 in a second.
    expect(frame.mock.calls.length).toBeGreaterThanOrEqual(8);
    expect(frame.mock.calls.length).toBeLessThanOrEqual(1_000 / TICK_MS);
  });

  it('never renders React again: each tick writes the text itself', () => {
    const onRender = vi.fn();
    const { container } = render(
      <Profiler id="age" onRender={onRender}>
        <LiveAge at={BEFORE_STEP} />
      </Profiler>,
    );
    const commits = onRender.mock.calls.length;

    vi.advanceTimersByTime(2_000);

    expect(container.querySelector('[data-digits]')?.textContent).toBe('22.01000');
    expect(onRender).toHaveBeenCalledTimes(commits);
  });

  it('turns the whole years over at 00:00 UTC on the birthday, for readers too', () => {
    vi.setSystemTime(BIRTHDAY - 100);
    const { visible, spoken } = renderAge(BIRTHDAY - 100);

    expect(visible.textContent).toBe('21.99999');
    expect(spoken.textContent).toBe('21');

    vi.advanceTimersByTime(TICK_MS + 50);

    expect(visible.textContent).toBe('22.00000');
    expect(spoken.textContent).toBe('22');
  });

  it('stops when unmounted', () => {
    const { unmount } = renderAge(BEFORE_STEP);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    document.dispatchEvent(new Event('visibilitychange'));

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('LiveAge in a hidden tab', () => {
  it('stops while the tab is hidden and catches up the moment it shows', () => {
    const { visible } = renderAge(BEFORE_STEP);

    hideTab(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10 * STEP_MS);
    expect(visible.textContent).toBe('22.00999');

    hideTab(false);

    // At once, without waiting for a tick: 50 ms short of eleven steps on.
    expect(visible.textContent).toBe('22.01009');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it('starts stopped in a tab that is hidden when it mounts', () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const { visible } = renderAge(SERVER_AT);

    expect(vi.getTimerCount()).toBe(0);
    expect(visible.textContent).toBe('22.65753');
  });
});

describe('LiveAge under reduced motion', () => {
  it('updates at most once a second', () => {
    preferReducedMotion();
    const frame = vi.spyOn(globalThis, 'requestAnimationFrame');
    const { visible } = renderAge(BEFORE_STEP);

    vi.advanceTimersByTime(TICK_MS + 50);
    // The step has passed, but the next update is a second away.
    expect(visible.textContent).toBe('22.00999');

    vi.advanceTimersByTime(REDUCED_TICK_MS);
    expect(visible.textContent).toBe('22.01000');

    vi.advanceTimersByTime(5 * REDUCED_TICK_MS);
    expect(frame.mock.calls.length).toBeLessThanOrEqual(6);
  });
});
