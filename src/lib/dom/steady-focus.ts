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
 * @file Focus that never jumps the page. html's scroll-padding (edge-haze.css) keeps focused
 * elements clear of the edge haze's band, but a control in a stuck sticky bar sits inside that
 * band, so the browser scrolls the page by hundreds of pixels to bring it "into view" while it
 * already is (measured: 736px for a FilterBar's search, 368px for a chip).
 * - focusInPlace: for focus a script moves, to an element on screen: no scroll at all.
 * - holdScrollOnFocus: for every other way focus arrives (Shift+Tab, a screen reader's form-field
 *   or landmark jump). Chrome scrolls before focusin fires and sends the scroll event a frame
 *   later, so the last scroll event still holds where the page was; focusin puts it back before
 *   anything paints. A control that would be off screen there (the bar has scrolled away with
 *   its list) keeps the browser's scroll, and a press's focus is never touched.
 */

/** Whether the element's whole box shows in the viewport. */
function onScreen(element: Element): boolean {
  const box = element.getBoundingClientRect();
  const view = element.ownerDocument.defaultView;
  return box.top >= 0 && box.bottom <= (view?.innerHeight ?? 0);
}

/** Focuses `element`, scrolling only if it is not already on screen. */
export function focusInPlace(element: HTMLElement | null | undefined): void {
  element?.focus({ preventScroll: onScreen(element) });
}

/**
 * Keeps the page where it was when focus moving into `element` scrolls it, while the control
 * that took focus shows there. Focus a press brings (mouse, pen, touch) is left alone: it never
 * scrolls the page, and a scroll whose event has not come yet (a fling still moving, a script)
 * would otherwise be undone between the press and the release, sending the click elsewhere.
 * Returns the cleanup.
 */
export function holdScrollOnFocus(element: HTMLElement): () => void {
  const view = element.ownerDocument.defaultView;
  if (!view) return () => undefined;
  let settled = view.scrollY;
  let pressing = false;
  const onScroll = (): void => {
    settled = view.scrollY;
  };
  const press = (): void => {
    pressing = true;
  };
  const release = (): void => {
    pressing = false;
  };
  /**
   * Puts the page back where the last scroll event left it, unless a press brought focus or
   * nothing moved; if the control would be off screen there, the browser's scroll stands.
   */
  const onFocusIn = (event: Event): void => {
    const moved = view.scrollY;
    if (pressing || moved === settled || !(event.target instanceof Element)) return;
    view.scrollTo({ top: settled, behavior: 'instant' });
    if (!onScreen(event.target)) view.scrollTo({ top: moved, behavior: 'instant' });
  };
  // A press starts on the element; it may end anywhere.
  const listeners: readonly (readonly [EventTarget, string, EventListener])[] = [
    [view, 'scroll', onScroll],
    [element, 'pointerdown', press],
    [element, 'mousedown', press],
    [view, 'pointerup', release],
    [view, 'pointercancel', release],
    [view, 'mouseup', release],
    [element, 'focusin', onFocusIn],
  ];
  for (const [target, type, listener] of listeners) {
    target.addEventListener(type, listener, { passive: true });
  }
  return () => {
    for (const [target, type, listener] of listeners) target.removeEventListener(type, listener);
  };
}
