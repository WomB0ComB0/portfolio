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
 * @file Another layer over the phone's open Filters sheet (the command palette, a dialog):
 * - focus moving into it closes the sheet first, so the layer never opens under the sheet's
 *   dimmed backdrop; focus moving anywhere else on the page leaves the sheet open;
 * - focus the layer drops to the page body as it goes (the palette hands it back to a chip in the
 *   now closed sheet, which cannot take it) comes back to the Filters button, and focus it hands
 *   to anything else stays there;
 * - a press inside another open layer is never held by the outside-press guard.
 * jsdom has no popovers and no layout (open-sheet.tsx draws both).
 */

import { cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  closed,
  kindChip,
  renderOpenSheet,
  standInResizeObservers,
  undo,
  undoAll,
} from './open-sheet';

beforeEach(() => {
  undo.push(standInResizeObservers());
});
afterEach(() => {
  cleanup();
  undoAll();
  vi.restoreAllMocks();
});

/**
 * A layer drawn by a script with a search field and an option button: a box of its own under
 * <body> (a portal, as the palette's is), or, with `role`, a box inside the page marked as one.
 */
function addLayer({ role, inside }: { readonly role?: string; readonly inside?: Element } = {}): {
  readonly field: HTMLInputElement;
  readonly option: HTMLButtonElement;
} {
  const layer = document.createElement('div');
  if (role) layer.setAttribute('role', role);
  const field = document.createElement('input');
  field.setAttribute('aria-label', 'Search the site');
  const option = document.createElement('button');
  option.type = 'button';
  option.textContent = 'Experience';
  layer.append(field, option);
  (inside ?? document.body).append(layer);
  undo.push(() => layer.remove());
  return { field, option };
}

/** One task later: the layer may hand focus on in the same task it lets go of it. */
const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * The sheet just closed: its display slides to none over 0.3s (transition-behavior:
 * allow-discrete), so its chips still show for that long. Returns the undo.
 */
function sheetSliding(): () => void {
  const style = document.createElement('style');
  style.textContent = '[data-filter-part="sheet"]{display:flex!important}';
  document.head.append(style);
  return () => style.remove();
}

describe('focus moving into another layer over the open sheet', () => {
  it('closes the sheet first when the layer is a portal of its own (the command palette)', () => {
    const { hide } = renderOpenSheet();
    const { field } = addLayer();

    field.focus();

    expect(hide).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(field);
  });

  it('closes the sheet first when the layer is a dialog inside the page', () => {
    const { hide, link } = renderOpenSheet();
    const { field } = addLayer({ role: 'dialog', inside: link.parentElement ?? undefined });

    field.focus();

    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('leaves the sheet open when focus moves elsewhere on the page', () => {
    const { hide, link } = renderOpenSheet();

    link.focus();

    expect(hide).not.toHaveBeenCalled();
  });

  it('does nothing while the sheet is closed', () => {
    const { hide } = renderOpenSheet({ open: false });
    const { field } = addLayer();

    field.focus();

    expect(hide).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(field);
  });
});

describe('focus the layer lets go of once the sheet has closed for it', () => {
  it('comes back to the Filters button when the layer drops it to the page body', async () => {
    const { sheet, button } = renderOpenSheet();
    const { field } = addLayer();
    field.focus();
    closed(sheet);
    expect(document.activeElement).toBe(field);

    // The palette closes: it blurs its field and hands focus back to a chip the closed sheet hides.
    field.blur();
    await nextTask();

    expect(document.activeElement).toBe(button);
  });

  it('comes back to the Filters button while the closed sheet still slides out (its chips show)', async () => {
    const { sheet, button } = renderOpenSheet();
    const { field } = addLayer();
    field.focus();
    undo.push(sheetSliding());
    closed(sheet);

    field.blur();
    await nextTask();

    expect(document.activeElement).toBe(button);
  });

  it('goes on to the Filters button when the layer hands it back to a chip in the sliding sheet', async () => {
    const { sheet, button } = renderOpenSheet();
    const { field } = addLayer();
    field.focus();
    undo.push(sheetSliding());
    closed(sheet);

    field.blur();
    kindChip(sheet, /^All/).focus();
    await nextTask();

    expect(document.activeElement).toBe(button);
  });

  it('stays where the layer hands it, outside the layer', async () => {
    const { sheet, link } = renderOpenSheet();
    const { field } = addLayer();
    field.focus();
    closed(sheet);

    link.focus();
    link.blur();
    await nextTask();

    expect(document.activeElement).toBe(document.body);
  });

  it('moving inside the layer keeps the wait, until the layer drops it', async () => {
    const { sheet, button } = renderOpenSheet();
    const { field, option } = addLayer();
    field.focus();
    closed(sheet);

    option.focus();
    await nextTask();
    expect(document.activeElement).toBe(option);
    option.blur();
    await nextTask();

    expect(document.activeElement).toBe(button);
  });
});

describe('a press inside another open layer while the sheet is open', () => {
  it('is never held: its mousedown and click reach the layer', () => {
    const { link } = renderOpenSheet();
    const { option } = addLayer({ role: 'dialog', inside: link.parentElement ?? undefined });
    const landed = vi.fn();
    option.addEventListener('click', landed);

    fireEvent.pointerDown(option);
    const mousedown = fireEvent.mouseDown(option, { detail: 1 });
    const click = fireEvent.click(option, { detail: 1 });

    expect({ mousedown, click }).toEqual({ mousedown: true, click: true });
    expect(landed).toHaveBeenCalledTimes(1);
  });

  it('a press on the page outside every layer is still held', () => {
    const { link } = renderOpenSheet();
    addLayer({ role: 'dialog' });

    fireEvent.pointerDown(link);
    const mousedown = fireEvent.mouseDown(link, { detail: 1 });
    const click = fireEvent.click(link, { detail: 1 });

    expect({ mousedown, click }).toEqual({ mousedown: false, click: false });
  });
});
