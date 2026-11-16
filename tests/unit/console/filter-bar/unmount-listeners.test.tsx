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
 * @file Everything the filter bar adds to the document goes when it unmounts, as a route change
 * unmounts it: the outside-press guard's press listeners (outside-press.ts), the layout step's
 * focusin and focusout (bar.tsx), the other-layer guard's focusin and the focusin and focusout of
 * its wait for focus a layer lets go of (layers.ts), that wait included when the bar unmounts in
 * the middle of it; and so do the sticky bar's window listeners (steady-focus.ts). The listeners
 * are counted from every addEventListener and removeEventListener call, matched as the browser
 * matches them: by type, listener and capture flag. jsdom has no popovers (open-sheet.tsx).
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FullBar } from './harness';
import { closed, renderOpenSheet, standInResizeObservers, undo, undoAll } from './open-sheet';

beforeEach(() => {
  undo.push(standInResizeObservers());
});
afterEach(() => {
  cleanup();
  undoAll();
  vi.restoreAllMocks();
});

/** The kinds of listener the bar puts on the document. */
const DOCUMENT_KINDS = [
  'pointerdown',
  'pointercancel',
  'mousedown',
  'click',
  'auxclick',
  'focusin',
  'focusout',
];

/** The kinds the sticky bar puts on the window, to keep the page still as focus moves in. */
const WINDOW_KINDS = ['scroll', 'pointerup', 'pointercancel', 'mouseup'];

/**
 * What the mounted bar keeps on the document, all in the capture phase: the five press listeners,
 * the layout step's focusout and focusin, and the other-layer guard's focusin.
 */
const MOUNTED = {
  'pointerdown:capture': 1,
  'pointercancel:capture': 1,
  'mousedown:capture': 1,
  'click:capture': 1,
  'auxclick:capture': 1,
  'focusin:capture': 2,
  'focusout:capture': 1,
};

type ListenerOptions = boolean | AddEventListenerOptions | EventListenerOptions | undefined;

/** The phase a listener is matched in: a true flag, or options with capture set, is capture. */
const phaseOf = (options: ListenerOptions): string =>
  (typeof options === 'boolean' ? options : options?.capture) ? 'capture' : 'bubble';

interface ListenerCall {
  readonly order: number;
  readonly adds: boolean;
  readonly key: string;
  readonly listener: EventListenerOrEventListenerObject | null;
}

interface ListenerWatch {
  /** The listeners still on the target, counted by "type:phase". */
  attached(): Record<string, number>;
  /** How many add and remove calls each "type:phase" had. */
  calls(): { readonly added: Record<string, number>; readonly removed: Record<string, number> };
}

/** How many times each key comes up, as a plain object. */
function tally(keys: readonly string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return Object.fromEntries(counts);
}

/**
 * Watches the add and remove calls on `target` of the listed kinds, from now on, through
 * spies that still attach and detach the listeners.
 */
function watchListeners(target: EventTarget, kinds: readonly string[]): ListenerWatch {
  const add = vi.spyOn(target, 'addEventListener');
  const remove = vi.spyOn(target, 'removeEventListener');
  const callsOf = (spy: typeof add | typeof remove, adds: boolean): ListenerCall[] =>
    spy.mock.calls.map(([type, listener, options], index) => ({
      order: spy.mock.invocationCallOrder[index] ?? 0,
      adds,
      key: `${type}:${phaseOf(options)}`,
      listener,
    }));
  const inOrder = (): ListenerCall[] =>
    [...callsOf(add, true), ...callsOf(remove, false)]
      .filter((call) => kinds.includes(call.key.split(':')[0] ?? ''))
      .sort((a, b) => a.order - b.order);
  return {
    attached: () => {
      const on = new Map<string, Set<EventListenerOrEventListenerObject>>();
      for (const { adds, key, listener } of inOrder()) {
        if (!listener) continue;
        const listeners = on.get(key) ?? new Set();
        if (adds) listeners.add(listener);
        else listeners.delete(listener);
        on.set(key, listeners);
      }
      return tally([...on].flatMap(([key, listeners]) => Array<string>(listeners.size).fill(key)));
    },
    calls: () => ({
      added: tally(inOrder().flatMap((call) => (call.adds ? [call.key] : []))),
      removed: tally(inOrder().flatMap((call) => (call.adds ? [] : [call.key]))),
    }),
  };
}

/** The command palette: a search field in a box of its own under <body>, outside the bar. */
function openPalette(): HTMLInputElement {
  const layer = document.createElement('div');
  const field = document.createElement('input');
  field.setAttribute('aria-label', 'Search the site');
  layer.append(field);
  document.body.append(layer);
  undo.push(() => layer.remove());
  field.focus();
  return field;
}

/** One task later, when a wait for focus a layer let go of would act. */
const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('the document listeners the filter bar adds', () => {
  it('are the press, focusin and focusout listeners while it is mounted, and all go on unmount', () => {
    const page = watchListeners(document, DOCUMENT_KINDS);
    renderOpenSheet({ open: false });
    expect(page.attached()).toEqual(MOUNTED);

    cleanup();

    expect(page.attached()).toEqual({});
    const { added, removed } = page.calls();
    expect(removed).toEqual(added);
  });

  it("all go when the bar unmounts during the palette's wait (a route change from the palette)", () => {
    const page = watchListeners(document, DOCUMENT_KINDS);
    const { hide } = renderOpenSheet();
    openPalette();
    // The sheet closed for the palette, and the wait for the focus it lets go of has begun.
    expect(hide).toHaveBeenCalledTimes(1);
    expect(page.attached()).toEqual({
      ...MOUNTED,
      'focusin:capture': 3,
      'focusout:capture': 2,
    });

    cleanup();

    expect(page.attached()).toEqual({});
    const { added, removed } = page.calls();
    expect(removed).toEqual(added);
  });

  it('all go, and focus stays put, when the bar unmounts the moment the palette lets go', async () => {
    const page = watchListeners(document, DOCUMENT_KINDS);
    const { sheet } = renderOpenSheet();
    const field = openPalette();
    closed(sheet);
    // The palette closes, dropping focus to the page body: the wait looks again one task later.
    field.blur();

    cleanup();
    await nextTask();

    expect(page.attached()).toEqual({});
    expect(document.activeElement).toBe(document.body);
  });

  it('are added once on the next visit, not on top of the last visit’s', () => {
    const page = watchListeners(document, DOCUMENT_KINDS);
    renderOpenSheet();
    openPalette();
    cleanup();

    render(<FullBar />);

    expect(page.attached()).toEqual(MOUNTED);
  });
});

describe("the sticky bar's window listeners", () => {
  it('are the scroll and press-end listeners while it is mounted, and all go on unmount', () => {
    const view = watchListeners(window, WINDOW_KINDS);
    render(<FullBar />);
    expect(view.attached()).toEqual({
      'scroll:bubble': 1,
      'pointerup:bubble': 1,
      'pointercancel:bubble': 1,
      'mouseup:bubble': 1,
    });

    cleanup();

    expect(view.attached()).toEqual({});
  });
});
