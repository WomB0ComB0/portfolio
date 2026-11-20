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
 * @file LiveAge, the /stats strip's age to eight decimals. The server and the hydrating browser
 * print the age at the server's moment, so hydration never mismatches; after mount the digits
 * follow the browser's clock about ten times a second by writing text, never by rendering React
 * again, and the last digit visibly ticks (a step every 315.36 ms); a hidden tab stops the clock
 * and catches up when shown; screen readers get the whole years only, from a twin that is not live.
 *
 * Moving content needs a way to stop it (WCAG 2.2.2, audit 2026-11-20 moderate 3): a Pause toggle
 * (LiveAgePause) sits on the strip's label row, in a cell of its own, sharing its state with the
 * figure through LiveAgeProvider; under reduced motion the age holds still (shown once, never
 * ticking) and the toggle's cell, with nothing to pause, is hidden.
 *
 * Timers, animation frames and Date are faked, so the clock moves only when a test advances it
 * (an animation frame runs every 16 ms of fake time).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { act, Profiler } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LiveAge,
  LiveAgePause,
  LiveAgeProvider,
  TICK_MS,
} from '@/app/(routes)/(dev)/stats/_components/console/live-age';

/** 00:00 UTC on the 2026 birthday, from which the eighth decimal steps every 315.36 ms. */
const BIRTHDAY = Date.parse('2026-03-24T00:00:00Z');
/** The 365-day birthday year from March 24, 2026, in milliseconds. */
const YEAR_MS = 365 * 86_400_000;
/** 50 ms before the fraction turns from .00999999 to .01000000 (a hundredth of the year). */
const BEFORE_STEP = BIRTHDAY + YEAR_MS / 100 - 50;
/** A moment well inside a step: '22.65753424'. */
const SERVER_AT = Date.parse('2026-11-19T00:00:00Z');

/** The digits after the point as a number of steps of the last decimal: '22.01000003' -> 1000003. */
const stepsOf = (text: string | null): number => Number(text?.split('.')[1]);

/** The figure and its Pause toggle, as the strip sets them: around them, the state they share. */
const withPause = (at: number) => (
  <LiveAgeProvider>
    <LiveAge at={at} />
    <LiveAgePause />
  </LiveAgeProvider>
);

function renderAge(at: number) {
  const view = render(withPause(at));
  const spoken = view.container.querySelector('.sr-only');
  const visible = view.container.querySelector('[data-digits]');
  if (!spoken || !visible) throw new Error('LiveAge rendered no copies');
  return { ...view, spoken, visible };
}

function hideTab(hidden: boolean): void {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden);
  document.dispatchEvent(new Event('visibilitychange'));
}

/**
 * A reduced-motion setting the test can change, as the OS settings do mid-visit: `set` flips it
 * and tells every listener, as a MediaQueryList's change event does.
 */
function preferReducedMotion(initially = true): { set: (reduced: boolean) => void } {
  let reduced = initially;
  const listeners = new Set<() => void>();
  // The literal query, not the shared constant, so a wrong constant cannot pass here.
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === '(prefers-reduced-motion: reduce)' && reduced;
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }));
  return {
    set: (next) => {
      reduced = next;
      for (const listener of listeners) listener();
    },
  };
}

const pauseButton = (): HTMLElement => screen.getByRole('button', { name: 'Pause age counter' });

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
  it('prints the age at its moment to eight decimals, the whole years alone for readers', () => {
    const root = document.createElement('div');
    root.innerHTML = renderToString(<LiveAge at={SERVER_AT} className="extra" />);
    const figure = root.firstElementChild;
    const digits = root.querySelector('[data-digits]');
    const onScreen = root.querySelector('[aria-hidden="true"]');

    expect(root.querySelector('.sr-only')?.textContent).toBe('22');
    expect(digits?.textContent).toBe('22.65753424');
    // Everything on screen is hidden from screen readers, inside a figure that is never live.
    expect(onScreen?.contains(digits)).toBe(true);
    expect(figure).toHaveAttribute('aria-live', 'off');
    expect(figure).toHaveClass('tabular-nums', 'extra');
    // An unseen '00.00000000' in the digits' grid cell holds the box at the figure's width.
    const template = root.querySelector('.invisible');
    expect(onScreen).toHaveClass('inline-grid');
    expect(template?.textContent).toBe('00.00000000');
    expect(template).toHaveClass('col-start-1', 'row-start-1');
    expect(digits).toHaveClass('col-start-1', 'row-start-1');
    // The digits add no width, so only the template sizes the box, whatever each glyph's advance.
    expect(digits).toHaveClass('w-0', 'whitespace-nowrap');
    // The decimals are muted, as a unit is; the whole years keep the figure's colour.
    const fraction = root.querySelector('.text-muted-foreground');
    expect(fraction?.textContent).toBe('.65753424');
    // On a narrow page the decimals shrink (the whole years do not), and the unseen template's
    // decimals take the same sizes, so the box shrinks with them.
    const templateFraction = template?.querySelector('span');
    expect(templateFraction?.textContent).toBe('.00000000');
    const sizes = Array.from(templateFraction?.classList ?? []);
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.every((name) => name.includes('/page:text-[length:'))).toBe(true);
    expect(fraction).toHaveClass(...sizes);
    expect(digits?.firstElementChild?.className).toBe('');
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
    // The browser reads its clock 2e-4 of a year (about 1 h 45 min) later than the server did.
    vi.setSystemTime(SERVER_AT + YEAR_MS / 5_000);
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
    expect(container.querySelector('[data-digits]')?.textContent).toBe('22.65773424');
    act(() => root?.unmount());
    container.remove();
  });
});

describe('LiveAge ticking', () => {
  it('shows the current age on mount and moves the last decimal within a tick of it changing', () => {
    const { visible, spoken } = renderAge(BEFORE_STEP);

    expect(visible.textContent).toBe('22.00999999');
    vi.advanceTimersByTime(TICK_MS + 50);

    expect(visible.textContent).toBe('22.01000000');
    expect(spoken.textContent).toBe('22');
  });

  it('visibly ticks: the last digit moves about three times a second, one step at a time', () => {
    const { visible } = renderAge(BEFORE_STEP);
    const shown = [stepsOf(visible.textContent)];

    for (let elapsed = 0; elapsed < 2_000; elapsed += TICK_MS) {
      vi.advanceTimersByTime(TICK_MS);
      const steps = stepsOf(visible.textContent);
      if (steps !== shown.at(-1)) shown.push(steps);
    }

    // 2 s holds six steps of 315.36 ms after the first, 50 ms in: at least seven values shown,
    // each one step after the last (a tick is shorter than a step, so none is skipped).
    expect(shown.length).toBeGreaterThanOrEqual(7);
    expect(shown.slice(1).map((steps, index) => steps - (shown[index] ?? Number.NaN))).toEqual(
      Array.from({ length: shown.length - 1 }, () => 1),
    );
    // Within the first second alone the last digit has already moved three times.
    expect(shown[0]).toBe(999_999);
    expect(shown[3]).toBe(1_000_002);
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

    // Six steps after the hundredth of the year (or the last tick fell just before the sixth).
    expect(container.querySelector('[data-digits]')?.textContent).toMatch(/^22\.0100000[56]$/);
    expect(onRender).toHaveBeenCalledTimes(commits);
  });

  it('turns the whole years over at 00:00 UTC on the birthday, for readers too', () => {
    vi.setSystemTime(BIRTHDAY - 100);
    const { visible, spoken } = renderAge(BIRTHDAY - 100);

    expect(visible.textContent).toBe('21.99999999');
    expect(spoken.textContent).toBe('21');

    vi.advanceTimersByTime(TICK_MS + 50);

    expect(visible.textContent).toBe('22.00000000');
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
    // A ten-thousandth of the year (about 53 min) goes by unseen.
    vi.advanceTimersByTime(YEAR_MS / 10_000);
    expect(visible.textContent).toBe('22.00999999');

    hideTab(false);

    // At once, without waiting for a tick: 50 ms short of .0101.
    expect(visible.textContent).toBe('22.01009999');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it('starts stopped in a tab that is hidden when it mounts', () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const { visible } = renderAge(SERVER_AT);

    expect(vi.getTimerCount()).toBe(0);
    expect(visible.textContent).toBe('22.65753424');
  });
});

describe('LiveAge under reduced motion', () => {
  it('never ticks: the age is shown once, as of mount, and holds still', () => {
    preferReducedMotion();
    const frame = vi.spyOn(globalThis, 'requestAnimationFrame');
    const { visible } = renderAge(BEFORE_STEP);

    expect(visible.textContent).toBe('22.00999999');
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5_000);

    // Five seconds on, past sixteen steps of the last decimal: the same digits, no frame asked for.
    expect(visible.textContent).toBe('22.00999999');
    expect(frame).not.toHaveBeenCalled();
  });

  it('stops when the visitor turns reduced motion on, and starts when they turn it off', () => {
    const setting = preferReducedMotion(false);
    const { visible } = renderAge(BEFORE_STEP);
    vi.advanceTimersByTime(TICK_MS + 50);
    expect(visible.textContent).toBe('22.01000000');

    act(() => setting.set(true));
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(2_000);
    expect(visible.textContent).toBe('22.01000000');

    act(() => setting.set(false));
    // Caught up at once (2.15 s past the hundredth of the year: six steps), then ticking again.
    expect(visible.textContent).toBe('22.01000006');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it('hides the pause control and its cell, which has nothing to pause there', () => {
    renderAge(BEFORE_STEP);

    // The cell goes with it, so no empty dd is left in the list for a screen reader to land on.
    expect(pauseButton().closest('dd')).toHaveClass('motion-reduce:hidden');
  });
});

describe('LiveAge pause control', () => {
  it('is a toggle button in a strip cell of its own, in the server HTML, not pressed', () => {
    const root = document.createElement('div');
    root.innerHTML = renderToString(withPause(SERVER_AT));
    document.body.append(root);

    const pause = screen.getByRole('button', { name: 'Pause age counter' });
    expect(pause).toHaveAttribute('type', 'button');
    expect(pause).toHaveAttribute('aria-pressed', 'false');
    // Geist Mono, as the palette's key caps and the site's machine tokens are.
    expect(pause).toHaveClass('mono-token');
    // Outside the digits that screen readers skip, and after them.
    const digits = root.querySelector('[data-digits]');
    if (!digits) throw new Error('LiveAge rendered no digits');
    expect(root.querySelector('[aria-hidden="true"]')?.contains(pause)).toBe(false);
    expect(digits.compareDocumentPosition(pause) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Its own dd (StatStripAction), which the strip sets on the label's row, so the figure's line
    // never holds it; without scripting, where the clock never starts, the cell is hidden.
    const cell = pause.closest('dd');
    expect(cell).not.toBeNull();
    expect(cell?.contains(digits)).toBe(false);
    expect(cell).toHaveClass('col-start-2', 'row-start-2', '[@media(scripting:none)]:hidden');
    // A 24 px key cap: the target size, centred on the label's 20 px line.
    expect(pause).toHaveClass('h-6');
    root.remove();
  });

  it('is not part of the figure, which LiveAge renders alone', () => {
    const root = document.createElement('div');
    root.innerHTML = renderToString(<LiveAge at={SERVER_AT} />);

    expect(root.querySelector('button')).toBeNull();
    expect(root.querySelector('[data-digits]')?.textContent).toBe('22.65753424');
  });

  it('needs the provider it shares its state through, and says so', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<LiveAgePause />)).toThrow(/LiveAgeProvider/);
  });

  it('stops the clock when pressed and catches up at once when pressed again', () => {
    const { visible, spoken } = renderAge(BEFORE_STEP);

    fireEvent.click(pauseButton());

    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true');
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(2_000);
    // Paused past the hundredth of the year: the digits hold what they showed.
    expect(visible.textContent).toBe('22.00999999');
    expect(spoken.textContent).toBe('22');

    fireEvent.click(pauseButton());

    expect(pauseButton()).toHaveAttribute('aria-pressed', 'false');
    // 1.95 s past the hundredth of the year: six steps of 315.36 ms.
    expect(visible.textContent).toBe('22.01000006');
    vi.advanceTimersByTime(TICK_MS * 4);
    expect(visible.textContent).toBe('22.01000007');
  });

  // On /stats the strip's skeleton gives way to the loaded strip when its figures stream in: a new
  // figure and toggle under the provider the two share. Each had its own provider, so a Pause
  // pressed on the skeleton was undone as the figures landed.
  it('keeps the pause, and the digits it froze, when the figure and toggle are replaced', () => {
    const strip = (key: string, at: number) => (
      <LiveAgeProvider>
        <div key={key}>
          <LiveAge at={at} />
          <LiveAgePause />
        </div>
      </LiveAgeProvider>
    );
    const view = render(strip('skeleton', BEFORE_STEP));
    fireEvent.click(pauseButton());
    vi.advanceTimersByTime(2_000);

    // The loaded strip, rendered by the server a second after the skeleton.
    view.rerender(strip('loaded', BEFORE_STEP + 1_000));

    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true');
    expect(view.container.querySelector('[data-digits]')?.textContent).toBe('22.00999999');
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(pauseButton());
    // Caught up at once: 1.95 s past the hundredth of the year, six steps.
    expect(view.container.querySelector('[data-digits]')?.textContent).toBe('22.01000006');
  });

  it('stays paused when a hidden tab is shown again', () => {
    const { visible } = renderAge(BEFORE_STEP);
    fireEvent.click(pauseButton());

    hideTab(true);
    vi.advanceTimersByTime(YEAR_MS / 10_000);
    hideTab(false);

    expect(vi.getTimerCount()).toBe(0);
    expect(visible.textContent).toBe('22.00999999');
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true');
  });
});
