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
 * @file The Waterfall's masonry island, with a fake ResizeObserver and a fake animation frame: it
 * renders the server's slots as given, observes each one, writes a slot's measured span
 * (--rows-js) one frame after the observer reports it and never inside the callback, flushes once
 * per frame, writes only when a span changes, keeps a hidden slot's last span, follows slots that
 * join or leave the grid, cleans everything up on unmount, and does nothing at all where the
 * browser has native grid-lanes.
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MEASURED_ROWS_PROPERTY, rowsFor } from '@/app/_components/home/bento-layout';
import { BentoMasonry } from '@/app/_components/home/bento-masonry';

/** A ResizeObserver whose callback the test calls, with the targets it was told to observe. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];

  readonly observed = new Set<Element>();
  readonly observe = vi.fn((target: Element) => this.observed.add(target));
  readonly unobserve = vi.fn((target: Element) => this.observed.delete(target));
  readonly disconnect = vi.fn(() => this.observed.clear());

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  /** Reports these border-box block sizes, as the browser does after layout. */
  report(sizes: ReadonlyMap<Element, number>): void {
    const entries = [...sizes].map(
      ([target, blockSize]) =>
        ({
          target,
          borderBoxSize: [{ blockSize, inlineSize: 100 }],
        }) as unknown as ResizeObserverEntry,
    );
    this.callback(entries, this as unknown as ResizeObserver);
  }
}

/** Animation frames the test runs by hand. */
const frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
const requestFrame = vi.fn((callback: FrameRequestCallback): number => {
  const id = nextFrameId;
  nextFrameId += 1;
  frames.set(id, callback);
  return id;
});
const cancelFrame = vi.fn((id: number): void => {
  frames.delete(id);
});

function runFrame(): void {
  const due = [...frames.values()];
  frames.clear();
  for (const callback of due) callback(16);
}

const supports = vi.fn((_property: string, _value?: string) => false);

const AREAS = ['hero', 'now', 'status'] as const;

function renderGrid() {
  const view = render(
    <BentoMasonry className="bento-grid">
      {AREAS.map((area) => (
        <div key={area} data-bento-slot={area} />
      ))}
    </BentoMasonry>,
  );
  const grid = view.container.firstElementChild as HTMLElement;
  const slot = (area: string): HTMLElement => {
    const found = grid.querySelector<HTMLElement>(`[data-bento-slot="${area}"]`);
    if (!found) throw new Error(`no ${area} slot`);
    return found;
  };
  return { ...view, grid, slot };
}

function observer(): FakeResizeObserver {
  const [only, ...others] = FakeResizeObserver.instances;
  if (!only || others.length > 0) {
    throw new Error(`expected one ResizeObserver, got ${FakeResizeObserver.instances.length}`);
  }
  return only;
}

const rowsOf = (slot: HTMLElement): string => slot.style.getPropertyValue(MEASURED_ROWS_PROPERTY);

/**
 * The setup file defines ResizeObserver as writable but not configurable, so vi.stubGlobal (which
 * redefines it) cannot replace it: assign it, and put the setup's back afterwards.
 */
const SETUP_RESIZE_OBSERVER = globalThis.ResizeObserver;
const setResizeObserver = (value: unknown): void => {
  globalThis.ResizeObserver = value as typeof ResizeObserver;
};

beforeEach(() => {
  FakeResizeObserver.instances = [];
  frames.clear();
  nextFrameId = 1;
  supports.mockReturnValue(false);
  setResizeObserver(FakeResizeObserver);
  vi.stubGlobal('requestAnimationFrame', requestFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  vi.stubGlobal('CSS', { supports });
});

afterEach(() => {
  cleanup();
  setResizeObserver(SETUP_RESIZE_OBSERVER);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('BentoMasonry', () => {
  it('renders one grid element with the given class around the slots, as given', () => {
    const { container, grid } = renderGrid();

    expect(container.children).toHaveLength(1);
    expect(grid.tagName).toBe('DIV');
    expect(grid).toHaveClass('bento-grid');
    expect([...grid.children].map((child) => child.getAttribute('data-bento-slot'))).toEqual([
      ...AREAS,
    ]);
  });

  it('observes every slot once mounted', () => {
    const { slot } = renderGrid();

    expect([...observer().observed]).toEqual(AREAS.map(slot));
  });

  it('writes a slot’s measured span one frame after the observer reports it, never inside', () => {
    const { slot } = renderGrid();

    observer().report(new Map([[slot('hero'), 292]]));

    expect(rowsOf(slot('hero'))).toBe('');
    expect(requestFrame).toHaveBeenCalledTimes(1);

    runFrame();

    expect(rowsOf(slot('hero'))).toBe(String(rowsFor(292)));
    expect(rowsOf(slot('hero'))).toBe('146');
  });

  it('flushes once per frame, with the latest size of every slot reported in it', () => {
    const { slot } = renderGrid();

    observer().report(new Map([[slot('hero'), 292]]));
    observer().report(
      new Map([
        [slot('hero'), 300],
        [slot('now'), 114],
      ]),
    );
    observer().report(new Map([[slot('status'), 80]]));

    expect(requestFrame).toHaveBeenCalledTimes(1);
    runFrame();

    expect(rowsOf(slot('hero'))).toBe('150');
    expect(rowsOf(slot('now'))).toBe('57');
    expect(rowsOf(slot('status'))).toBe('40');

    // The next report asks for a new frame.
    observer().report(new Map([[slot('now'), 130]]));
    expect(requestFrame).toHaveBeenCalledTimes(2);
  });

  it('writes only when a span changes', () => {
    const { slot } = renderGrid();
    const hero = slot('hero');
    const setProperty = vi.spyOn(hero.style, 'setProperty');

    observer().report(new Map([[hero, 292]]));
    runFrame();
    // 291.5 px is still 146 rows of 2 px.
    observer().report(new Map([[hero, 291.5]]));
    runFrame();
    observer().report(new Map([[hero, 292]]));
    runFrame();

    expect(setProperty).toHaveBeenCalledTimes(1);

    observer().report(new Map([[hero, 340]]));
    runFrame();

    expect(setProperty).toHaveBeenCalledTimes(2);
    expect(setProperty).toHaveBeenLastCalledWith(MEASURED_ROWS_PROPERTY, '170');
  });

  it('rounds a span up to whole rows, ignoring float noise', () => {
    const { slot } = renderGrid();

    observer().report(
      new Map([
        [slot('hero'), 117.4],
        [slot('now'), 104.000_01],
      ]),
    );
    runFrame();

    expect(rowsOf(slot('hero'))).toBe('59');
    expect(rowsOf(slot('now'))).toBe('52');
  });

  it('keeps a hidden slot’s last span instead of collapsing it', () => {
    const { slot } = renderGrid();

    observer().report(new Map([[slot('now'), 114]]));
    runFrame();
    observer().report(new Map([[slot('now'), 0]]));
    runFrame();

    expect(rowsOf(slot('now'))).toBe('57');
  });

  it('observes a slot that joins the grid later, and lets go of one that leaves', async () => {
    const { grid, slot } = renderGrid();
    const late = document.createElement('div');
    late.dataset.bentoSlot = 'strip';

    grid.append(late);
    await vi.waitFor(() => expect(observer().observe).toHaveBeenCalledWith(late));

    observer().report(new Map([[late, 76]]));
    runFrame();
    expect(rowsOf(late)).toBe('38');

    const status = slot('status');
    observer().report(new Map([[status, 80]]));
    status.remove();
    await vi.waitFor(() => expect(observer().unobserve).toHaveBeenCalledWith(status));
    runFrame();

    // Reported before it left, but gone by the frame: not written.
    expect(rowsOf(status)).toBe('');
  });

  it('disconnects both observers and cancels a pending frame on unmount', async () => {
    const { grid, slot, unmount } = renderGrid();
    const sizes = observer();

    sizes.report(new Map([[slot('hero'), 292]]));
    const [pendingFrame] = [...frames.keys()];
    unmount();

    expect(sizes.disconnect).toHaveBeenCalledTimes(1);
    expect(cancelFrame).toHaveBeenCalledWith(pendingFrame);
    expect(frames.size).toBe(0);

    // The grid's child list is no longer watched.
    grid.append(document.createElement('div'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sizes.observe).toHaveBeenCalledTimes(AREAS.length);
  });

  it('does nothing where the browser lays out grid-lanes natively', () => {
    supports.mockImplementation(
      (property: string, value?: string) => property === 'display' && value === 'grid-lanes',
    );
    const { slot } = renderGrid();

    expect(supports).toHaveBeenCalledWith('display', 'grid-lanes');
    expect(FakeResizeObserver.instances).toHaveLength(0);
    expect(requestFrame).not.toHaveBeenCalled();
    for (const area of AREAS) expect(rowsOf(slot(area))).toBe('');
  });

  it('does nothing without ResizeObserver, leaving the server’s estimates in charge', () => {
    setResizeObserver(undefined);

    expect(() => renderGrid()).not.toThrow();
    expect(requestFrame).not.toHaveBeenCalled();
  });
});
