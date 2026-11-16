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
 * @file Another layer opening over the phone's open Filters sheet. The sheet is a native popover,
 * drawn over everything else on the page: a layer a script draws (the command palette, a dialog
 * in a portal) would open under its dimmed backdrop, half covered by it, and the outside-press
 * guard would hold its first press. Such a layer takes focus as it opens, so focus moving into
 * one while the sheet is open closes the sheet first. Native layers need none of this: another
 * auto popover or a modal <dialog> closes the sheet as it opens.
 *
 * The layer may later hand focus back to what had it before: a chip in the now closed sheet. In
 * Chromium the chip cannot take it, so focus falls to the page body; a browser that lets it in
 * would drop it there once the sheet's 0.3s slide out ends. The first time focus the layer lets
 * go of comes to either, it goes to `home` (the Filters button) instead. Focus landing anywhere
 * else outside the layer first ends the wait.
 *
 * Another layer: a box marked as one (outside-press.ts: a dialog, an open <dialog>, another
 * popover), or a box of its own directly under <body> (a portal, as the palette's is) other than
 * the one the sheet is in.
 */

import { focusInPlace } from '@/lib/dom/steady-focus';
import { hideIfOpen, isElement, isPopoverOpen, markedLayerOf } from './outside-press';

/** The box directly under <body> that holds `node`; null for a node outside the body. */
function portalOf(node: Element): Element | null {
  const body = node.ownerDocument.body;
  let box: Element | null = node;
  while (box && box.parentElement !== body) box = box.parentElement;
  return box;
}

/** The other layer that holds `target`: one marked as a layer, or a portal not the sheet's. */
export function otherLayerOf(target: EventTarget | null, sheet: HTMLElement): Element | null {
  if (!isElement(target) || sheet.contains(target)) return null;
  const marked = markedLayerOf(target, sheet);
  if (marked) return marked;
  const portal = portalOf(target);
  return portal && portal !== portalOf(sheet) ? portal : null;
}

/** Whether `target` is inside `box`. */
const within = (box: Element, target: EventTarget | null): boolean =>
  isElement(target) && box.contains(target);

/** Whether `target` is in the closed sheet, which hides everything in it. */
const inClosedSheet = (sheet: HTMLElement, target: EventTarget | null): boolean =>
  within(sheet, target) && !isPopoverOpen(sheet);

/**
 * Sends focus that `layer` lets go of to `home()`, once, if it comes to the page body or back
 * into the closed sheet; focus landing anywhere else outside the layer first ends the wait.
 * Returns the function that stops it.
 */
function returnFocusFrom(
  layer: Element,
  sheet: HTMLElement,
  home: () => HTMLElement | null,
): () => void {
  const page = layer.ownerDocument;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = (): void => {
    clearTimeout(timer);
    page.removeEventListener('focusin', landed, true);
    page.removeEventListener('focusout', letGo, true);
  };
  /** The layer may hand focus on in the same task it lets go of it, so look in the next one. */
  const lookSoon = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const active = page.activeElement;
      if (active !== null && active !== page.body && !inClosedSheet(sheet, active)) return;
      stop();
      focusInPlace(home());
    }, 0);
  };
  const landed = (event: FocusEvent): void => {
    if (within(layer, event.target)) return;
    if (inClosedSheet(sheet, event.target)) lookSoon();
    else stop();
  };
  const letGo = (event: FocusEvent): void => {
    if (event.relatedTarget === null && within(layer, event.target)) lookSoon();
  };
  page.addEventListener('focusin', landed, true);
  page.addEventListener('focusout', letGo, true);
  return stop;
}

/**
 * While `sheet` is open, focus moving into another layer closes it, and focus that layer later
 * lets go of to the page body or the closed sheet goes to `home()`. Returns the function that
 * stops both.
 */
export function closeForOtherLayer(sheet: HTMLElement, home: () => HTMLElement | null): () => void {
  const page = sheet.ownerDocument;
  let stopReturn = (): void => undefined;
  const focusin = (event: FocusEvent): void => {
    if (!isPopoverOpen(sheet)) return;
    const layer = otherLayerOf(event.target, sheet);
    if (!layer) return;
    stopReturn();
    stopReturn = returnFocusFrom(layer, sheet, home);
    hideIfOpen(sheet);
  };
  page.addEventListener('focusin', focusin, true);
  return () => {
    page.removeEventListener('focusin', focusin, true);
    stopReturn();
  };
}
