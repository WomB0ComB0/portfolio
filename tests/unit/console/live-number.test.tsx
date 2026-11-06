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
 * @file LiveNumber prints its final value on the first render (server and client, no count-up),
 * shows a later change at once when motion is unwelcome or pointless, and otherwise glides the
 * visible copy to the new value over the tween duration with an ease-out curve while screen
 * readers get the final value straight away. Unmounting stops the glide.
 *
 * requestAnimationFrame and performance.now are stubbed so frames run only when a test advances
 * the clock.
 */

import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LiveNumber } from '@/components/console/live-number';
import { DURATION_MS } from '@/lib/design/motion';

const FRAME_MS = 16;

let clock = 0;
let nextFrameId = 1;
const frames = new Map<number, FrameRequestCallback>();

const requestFrame = vi.fn((callback: FrameRequestCallback): number => {
  const id = nextFrameId;
  nextFrameId += 1;
  frames.set(id, callback);
  return id;
});
const cancelFrame = vi.fn((id: number): void => {
  frames.delete(id);
});

/** Moves the clock on by `ms`, running one frame per FRAME_MS like a 60 Hz display. */
function advance(ms: number): void {
  const end = clock + ms;
  while (clock < end) {
    clock = Math.min(end, clock + FRAME_MS);
    const due = [...frames.values()];
    frames.clear();
    for (const callback of due) callback(clock);
  }
}

function renderNumber(value: number) {
  const view = render(<LiveNumber value={value} />);
  const visible = view.container.querySelector('[aria-hidden="true"]');
  const spoken = view.container.querySelector('.sr-only');
  if (!visible || !spoken) throw new Error('LiveNumber rendered no copies');
  return { ...view, visible, spoken };
}

const parseShown = (text: string | null): number => Number((text ?? '').replaceAll(',', ''));

beforeEach(() => {
  clock = 0;
  nextFrameId = 1;
  frames.clear();
  requestFrame.mockClear();
  cancelFrame.mockClear();
  vi.stubGlobal('requestAnimationFrame', requestFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('LiveNumber first render', () => {
  it('prints the formatted final value on the server, in both copies', () => {
    const html = renderToString(<LiveNumber value={4159} className="text-foreground" />);

    expect(html.match(/4,159/g)).toHaveLength(2);
    expect(html).toContain('tabular-nums text-foreground');
  });

  it('shows the final value on mount without starting a tween', () => {
    const { visible, spoken } = renderNumber(4159);

    expect(visible.textContent).toBe('4,159');
    expect(spoken.textContent).toBe('4,159');
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it('applies the Intl options', () => {
    const { container } = render(<LiveNumber value={0.25} format={{ style: 'percent' }} />);
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('25%');
  });
});

describe('LiveNumber changes shown at once', () => {
  it('under reduced motion', () => {
    // The literal query, not the shared constant, so a wrong constant cannot pass here.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const { visible, rerender } = renderNumber(10);

    rerender(<LiveNumber value={2000} />);

    expect(visible.textContent).toBe('2,000');
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it('in a hidden tab', () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const { visible, rerender } = renderNumber(10);

    rerender(<LiveNumber value={2000} />);

    expect(visible.textContent).toBe('2,000');
    expect(requestFrame).not.toHaveBeenCalled();
    hidden.mockRestore();
  });

  it('for a non-finite value', () => {
    const { visible, rerender } = renderNumber(10);

    rerender(<LiveNumber value={Number.POSITIVE_INFINITY} />);

    expect(visible.textContent).toBe('∞');
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it('when the value did not change', () => {
    const { rerender } = renderNumber(10);

    rerender(<LiveNumber value={10} format={{}} />);

    expect(requestFrame).not.toHaveBeenCalled();
  });

  // An infinite duration kept progress at 0: frames ran forever on the old number.
  it.each([
    ['a zero', 0],
    ['a negative', -100],
    ['an infinite', Number.POSITIVE_INFINITY],
    ['a NaN', Number.NaN],
  ])('for %s duration', (_case, durationMs) => {
    const { visible, rerender } = renderNumber(10);

    rerender(<LiveNumber value={2000} durationMs={durationMs} />);

    expect(visible.textContent).toBe('2,000');
    expect(requestFrame).not.toHaveBeenCalled();
  });
});

describe('LiveNumber tween', () => {
  it('glides the visible copy to the new value over the tween duration', () => {
    const { visible, spoken, rerender } = renderNumber(0);

    rerender(<LiveNumber value={1000} />);
    // The final text React wrote is replaced by the starting number before paint.
    expect(visible.textContent).toBe('0');
    expect(spoken.textContent).toBe('1,000');

    const seen: number[] = [];
    for (let elapsed = 0; elapsed < DURATION_MS.tween - FRAME_MS * 2; elapsed += FRAME_MS * 4) {
      advance(FRAME_MS * 4);
      seen.push(parseShown(visible.textContent));
      expect(spoken.textContent).toBe('1,000');
    }

    // Ease-out-expo covers the last whole unit early, so only the first frames are strictly between.
    expect(seen.every((shown) => Number.isInteger(shown) && shown > 0 && shown <= 1000)).toBe(true);
    expect(seen.slice(0, 3).every((shown) => shown < 1000)).toBe(true);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(frames.size).toBe(1);

    advance(DURATION_MS.tween);
    expect(visible.textContent).toBe('1,000');
    expect(frames.size).toBe(0);
  });

  it('eases out: more than half the way there at half the duration', () => {
    const { visible, rerender } = renderNumber(0);

    rerender(<LiveNumber value={1000} />);
    advance(DURATION_MS.tween / 2);

    expect(parseShown(visible.textContent)).toBeGreaterThan(800);
  });

  it('a change mid-tween restarts from the number on screen', () => {
    const { visible, rerender } = renderNumber(0);
    rerender(<LiveNumber value={1000} />);
    advance(FRAME_MS * 6);
    const midway = parseShown(visible.textContent);

    rerender(<LiveNumber value={0} />);

    expect(cancelFrame).toHaveBeenCalled();
    expect(parseShown(visible.textContent)).toBe(midway);
    advance(FRAME_MS * 3);
    expect(parseShown(visible.textContent)).toBeLessThan(midway);
    advance(DURATION_MS.tween);
    expect(visible.textContent).toBe('0');
  });

  it('never shows Infinity between far-apart finite values', () => {
    const { visible, rerender } = renderNumber(-1e308);

    rerender(<LiveNumber value={1e308} />);
    const seen: string[] = [];
    for (let elapsed = 0; elapsed < DURATION_MS.tween; elapsed += FRAME_MS) {
      advance(FRAME_MS);
      seen.push(visible.textContent ?? '');
    }

    expect(seen.length).toBeGreaterThan(1);
    expect(seen.every((text) => !text.includes('∞') && Number.isFinite(parseShown(text)))).toBe(
      true,
    );
    expect(parseShown(seen.at(-1) ?? '')).toBe(1e308);
  });

  it('an equivalent format with its keys in another order does not restart the glide', () => {
    const view = render(
      <LiveNumber value={0} format={{ maximumFractionDigits: 0, useGrouping: true }} />,
    );
    view.rerender(
      <LiveNumber value={1000} format={{ maximumFractionDigits: 0, useGrouping: true }} />,
    );
    advance(FRAME_MS * 6);

    view.rerender(
      <LiveNumber value={1000} format={{ useGrouping: true, maximumFractionDigits: 0 }} />,
    );

    expect(cancelFrame).not.toHaveBeenCalled();
    // On the original schedule the glide is over; a restarted one would still be under way.
    advance(DURATION_MS.tween - FRAME_MS * 6);
    expect(view.container.querySelector('[aria-hidden="true"]')?.textContent).toBe('1,000');
    expect(frames.size).toBe(0);
  });

  it('follows a custom duration', () => {
    const { visible, rerender } = renderNumber(0);

    rerender(<LiveNumber value={500} durationMs={200} />);
    advance(208);

    expect(visible.textContent).toBe('500');
    expect(frames.size).toBe(0);
  });

  it('unmounting cancels the pending frame', () => {
    const { rerender, unmount } = renderNumber(0);
    rerender(<LiveNumber value={1000} />);
    advance(FRAME_MS);
    const [pending] = [...frames.keys()];

    unmount();

    expect(cancelFrame).toHaveBeenCalledWith(pending);
    expect(frames.size).toBe(0);
  });
});
