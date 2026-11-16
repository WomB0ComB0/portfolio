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
 * @file A press outside an open popover only closes it. The phone's Filters sheet is a native
 * popover over a dimmed ::backdrop, which is not a hit target: the browser's light dismiss closes
 * the sheet on the press's pointerup, and the press's click then lands on whatever the backdrop
 * dimmed, a link under the finger included. A visitor who taps the dimmed page to put the sheet
 * away expects to stay where they are, so a press that starts outside the open sheet has its
 * click cancelled before anything on the page sees it, and its mousedown too (which would move
 * focus to what it landed on). A light dismiss restores no focus, so the sheet's own toggle
 * listener (FilterBar.Facets, bar.tsx) hands it back to the Filters button. A middle press's
 * auxclick is cancelled the same way: it would open the link in a new tab. The browser's light
 * dismiss answers only a left press, so a middle press closes the sheet here.
 *
 * Left alone: a press inside the sheet; one inside another layer (a dialog, an open <dialog>,
 * another popover), which the press is meant for; one on a button that toggles it (the Filters
 * button, whose own click closes it); a press that turns into a scroll (pointercancel); and a
 * click from the keyboard (detail 0), which no press started. Each press is judged afresh, so the
 * next tap, the sheet closed, works as normal.
 */

/** Whether the popover is open; false where the browser has no popovers. */
export function isPopoverOpen(popover: HTMLElement): boolean {
  try {
    return popover.matches(':popover-open');
  } catch {
    return false;
  }
}

/** Whether `target` is a node that can be searched upwards (an element, not the document). */
export const isElement = (target: EventTarget | null): target is Element =>
  typeof (target as Element | null)?.closest === 'function';

/**
 * Boxes that are a layer of their own over the page. A closed one is not drawn, so no press or
 * focus reaches anything in it.
 */
const LAYER_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open], [popover]';

/**
 * The box marked as a layer (LAYER_SELECTOR) that holds `target`, if it is neither `popover` nor
 * a box around it; else null.
 */
export function markedLayerOf(target: Element, popover: HTMLElement): Element | null {
  const layer = target.closest(LAYER_SELECTOR);
  return layer && layer !== popover && !layer.contains(popover) ? layer : null;
}

/**
 * Whether a press on `target` is one to hold: outside the popover, outside any other layer, and
 * not on a button that toggles the popover.
 */
function outside(target: EventTarget | null, popover: HTMLElement): boolean {
  if (!isElement(target)) return true;
  if (popover.contains(target) || markedLayerOf(target, popover)) return false;
  const invoker = target.closest('[popovertarget]');
  return !(invoker && popover.id !== '' && invoker.getAttribute('popovertarget') === popover.id);
}

/** Closes the popover if it is open (its toggle listener then places focus). */
export function hideIfOpen(popover: HTMLElement): void {
  if (isPopoverOpen(popover)) popover.hidePopover();
}

/** MouseEvent.button for the middle button (the wheel). */
const MIDDLE_BUTTON = 1;

/** Cancels an event and keeps it from every handler past the document's capture phase. */
const swallow = (event: Event): void => {
  event.preventDefault();
  event.stopPropagation();
};

/**
 * Cancels the mousedown and the click (or a middle press's auxclick) of every press that starts
 * outside `popover` while it is open, from the document's capture phase, so no handler on the
 * page sees them. Returns the function that stops it.
 */
export function closeOnlyOnOutsidePress(popover: HTMLElement): () => void {
  const page = popover.ownerDocument;
  let holding = false;
  const press = (event: Event): void => {
    holding = isPopoverOpen(popover) && outside(event.target, popover);
  };
  const forget = (): void => {
    holding = false;
  };
  const mousedown = (event: Event): void => {
    if (holding) swallow(event);
  };
  /**
   * The press's click (or auxclick): cancelled once, then the next press is judged afresh. A
   * middle press, which the browser's light dismiss ignores, closes the popover too.
   */
  const click = (event: MouseEvent): void => {
    if (!holding || event.detail === 0) return;
    holding = false;
    swallow(event);
    if (event.type === 'auxclick' && event.button === MIDDLE_BUTTON) hideIfOpen(popover);
  };
  const listeners = [
    ['pointerdown', press],
    ['pointercancel', forget],
    ['mousedown', mousedown],
    ['click', click],
    ['auxclick', click],
  ] as const;
  for (const [type, listener] of listeners) page.addEventListener(type, listener, true);
  return () => {
    for (const [type, listener] of listeners) page.removeEventListener(type, listener, true);
  };
}
