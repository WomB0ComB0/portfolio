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
 * @file How the phone's Filters sheet closes, beyond its own buttons, and where focus goes when
 * the page steps across 48rem:
 * - wherever it closes from, focus that was inside it or nowhere comes back to the Filters
 *   button (the browser's light dismiss, a tap on the dimmed page, restores none), and focus the
 *   visitor put elsewhere stays there;
 * - a middle-click on the dimmed page opens nothing and closes the sheet, as a left click does;
 * - when the page grows past 48rem (a phone turned on its side), the sheet closes, since that
 *   layout has no Filters button and no Show N to close it with; a closed sheet is left alone;
 * - a step across 48rem that hides the control focus is on moves focus to its counterpart: a chip
 *   the closed sheet now hides to the Filters button, the hidden Filters button to the current
 *   chip; focus anywhere else stays.
 * jsdom has no popovers and no layout (open-sheet.tsx draws both).
 */

import { cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  closed,
  kindChip,
  renderOpenSheet,
  resize,
  standInResizeObservers,
  stepTo,
  undo,
  undoAll,
} from './open-sheet';
import { hideFiltersButton } from './wide-layout';

beforeEach(() => {
  undo.push(standInResizeObservers());
});
afterEach(() => {
  cleanup();
  undoAll();
  vi.restoreAllMocks();
});

describe('focus when the phone sheet closes', () => {
  it('comes back to the Filters button when the close left it nowhere (a tap outside)', () => {
    const { sheet, button } = renderOpenSheet();
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);

    closed(sheet);

    expect(document.activeElement).toBe(button);
  });

  it('comes back to the Filters button from a chip inside the closing sheet', () => {
    const { sheet, button } = renderOpenSheet();
    const tools = kindChip(sheet, /^Tools/);
    tools.focus();
    // Mid-slide the chip still shows, so focus has not fallen to the page yet.
    expect(document.activeElement).toBe(tools);

    closed(sheet);

    expect(document.activeElement).toBe(button);
  });

  it('stays where the visitor put it outside the sheet', () => {
    const { sheet, link } = renderOpenSheet();
    link.focus();

    closed(sheet);

    expect(document.activeElement).toBe(link);
  });

  it('from 48rem, where the chips sit in the bar, stays on the chip it was on', () => {
    const { sheet } = renderOpenSheet({ wide: true });
    const tools = kindChip(sheet, /^Tools/);
    tools.focus();
    expect(document.activeElement).toBe(tools);

    closed(sheet);

    expect(document.activeElement).toBe(tools);
  });

  it('from 48rem, with focus nowhere, takes the current chip in the bar', () => {
    const { sheet } = renderOpenSheet({ wide: true });
    (document.activeElement as HTMLElement | null)?.blur();

    closed(sheet);

    expect(document.activeElement).toBe(kindChip(sheet, /^All/));
  });
});

describe('a middle-click on the dimmed page', () => {
  /** A press of `button` on `target`: pointerdown, mousedown, then its auxclick. */
  const auxPress = (target: HTMLElement, button: number) => {
    fireEvent.pointerDown(target, { button });
    const mousedown = fireEvent.mouseDown(target, { button, detail: 1 });
    const auxclick = fireEvent(
      target,
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button, detail: 1 }),
    );
    return { mousedown, auxclick };
  };

  it('opens nothing: its auxclick is cancelled before the link sees it', () => {
    const { link } = renderOpenSheet();
    const landed = vi.fn();
    link.addEventListener('auxclick', landed);

    const { mousedown, auxclick } = auxPress(link, 1);

    expect(mousedown).toBe(false);
    expect(auxclick).toBe(false);
    expect(landed).not.toHaveBeenCalled();
  });

  it('closes the sheet, as a left click’s light dismiss does (the browser’s ignores it)', () => {
    const { link, hide } = renderOpenSheet();

    auxPress(link, 1);

    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('leaves a right press to the browser: it does not close the sheet', () => {
    const { link, hide } = renderOpenSheet();

    auxPress(link, 2);

    expect(hide).not.toHaveBeenCalled();
  });

  it('lets the next middle-click through once the press is over', () => {
    const { link, setOpen } = renderOpenSheet();
    auxPress(link, 1);
    setOpen(false);

    expect(auxPress(link, 1)).toEqual({ mousedown: true, auxclick: true });
  });
});

describe('the page growing past 48rem with the sheet open', () => {
  it('closes the sheet once the Filters button is gone (the wide layout)', () => {
    const { button, hide } = renderOpenSheet();
    undo.push(hideFiltersButton());

    resize(button);

    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('leaves the sheet open while the Filters button shows (still a phone)', () => {
    const { button, hide } = renderOpenSheet();

    resize(button);

    expect(hide).not.toHaveBeenCalled();
  });

  it('does nothing on a resize while the sheet is closed', () => {
    const { button, hide, setOpen } = renderOpenSheet();
    setOpen(false);
    undo.push(hideFiltersButton());

    resize(button);

    expect(hide).not.toHaveBeenCalled();
  });
});

/**
 * The closed sheet just after a step under 48rem: its display slides to none over 0.3s
 * (transition-behavior: allow-discrete), so its chips still show for that long. Returns the undo.
 */
function sheetSliding(): () => void {
  const style = document.createElement('style');
  style.textContent = '[data-filter-part="sheet"]{display:contents!important}';
  document.head.append(style);
  return () => style.remove();
}

describe('focus on a control that a step across 48rem hides', () => {
  it('a phone turned on its side and back: the chip the closed sheet hides again hands focus to the Filters button', () => {
    const { sheet, button, hide } = renderOpenSheet();
    const all = kindChip(sheet, /^All/);
    all.focus();
    undo.push(stepTo('wide'));
    resize(button);
    expect(hide).toHaveBeenCalledTimes(1);
    closed(sheet);
    // In the bar now, the chip keeps focus.
    expect(document.activeElement).toBe(all);

    stepTo('phone');
    resize(button);

    expect(document.activeElement).toBe(button);
  });

  it('a window narrowed under 48rem with a chip focused in the bar: focus goes to the Filters button', () => {
    const { sheet, button } = renderOpenSheet({ wide: true, open: false });
    kindChip(sheet, /^Tools/).focus();

    stepTo('phone');
    resize(button);

    expect(document.activeElement).toBe(button);
  });

  it('the same while the closed sheet is still sliding its display to none (the chip still shows)', () => {
    const { sheet, button } = renderOpenSheet({ wide: true, open: false });
    kindChip(sheet, /^Tools/).focus();

    stepTo('phone');
    undo.push(sheetSliding());
    resize(button);

    expect(document.activeElement).toBe(button);
  });

  it('the same when the browser dropped that focus to the page body mid-slide', () => {
    const { sheet, button } = renderOpenSheet({ wide: true, open: false });
    const tools = kindChip(sheet, /^Tools/);
    tools.focus();

    stepTo('phone');
    undo.push(sheetSliding());
    tools.blur();
    expect(document.activeElement).toBe(document.body);
    resize(button);

    expect(document.activeElement).toBe(button);
  });

  it('the same when the browser has already dropped that focus to the page body', () => {
    const { sheet, button } = renderOpenSheet({ wide: true, open: false });
    const tools = kindChip(sheet, /^Tools/);
    tools.focus();

    stepTo('phone');
    // A browser that blurs a box as it hides, before the observers run.
    tools.blur();
    expect(document.activeElement).toBe(document.body);
    resize(button);

    expect(document.activeElement).toBe(button);
  });

  it('grown to 48rem with focus on the Filters button: focus goes to the current chip in the bar', () => {
    const { sheet, button } = renderOpenSheet({ open: false });
    button.focus();

    undo.push(stepTo('wide'));
    resize(button);

    expect(document.activeElement).toBe(kindChip(sheet, /^All/));
  });

  it('focus outside the bar stays where it is, either way', () => {
    const { button, link } = renderOpenSheet({ wide: true, open: false });
    link.focus();

    stepTo('phone');
    resize(button);
    expect(document.activeElement).toBe(link);

    undo.push(stepTo('wide'));
    resize(button);
    expect(document.activeElement).toBe(link);
  });

  it('focus on the page body that no hidden control let go of stays there', () => {
    const { sheet, button, link } = renderOpenSheet({ wide: true, open: false });
    // A chip the visitor left by clicking the page (it still showed), then a link, then nothing.
    const tools = kindChip(sheet, /^Tools/);
    tools.focus();
    tools.blur();
    link.focus();
    link.blur();

    stepTo('phone');
    resize(button);

    expect(document.activeElement).toBe(document.body);
  });
});
