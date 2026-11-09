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
 * @file Focus that never jumps the page. html's scroll-padding (the edge haze's band) makes Chrome
 * scroll a control in a stuck sticky bar "into view" by hundreds of pixels, before focusin fires.
 * - focusInPlace focuses an element already on screen without scrolling, and lets the browser
 *   bring an off-screen one into view.
 * - holdScrollOnFocus puts the page back where the last scroll event left it when focus moving
 *   into its element scrolled it, unless the control would then be off screen (the bar scrolled
 *   away with its list), and stops when cleaned up.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { focusInPlace, holdScrollOnFocus } from '@/lib/dom/steady-focus';
import { type PageScroll, stubPageScroll } from './page-scroll';

/** An element whose box is at `top` (and 40px tall), whatever the scroll. */
function boxAt(element: HTMLElement, top: () => number): void {
  element.getBoundingClientRect = () =>
    DOMRect.fromRect({ x: 0, y: top(), width: 200, height: 40 });
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('focusInPlace', () => {
  it('focuses an element already on screen without scrolling the page', () => {
    const button = document.body.appendChild(document.createElement('button'));
    boxAt(button, () => 12);
    const focus = vi.spyOn(button, 'focus');

    focusInPlace(button);

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(button);
  });

  it('lets the browser bring an element off screen into view', () => {
    const button = document.body.appendChild(document.createElement('button'));
    boxAt(button, () => window.innerHeight + 200);
    const focus = vi.spyOn(button, 'focus');

    focusInPlace(button);

    expect(focus).toHaveBeenCalledWith({ preventScroll: false });
  });

  it('does nothing without an element', () => {
    expect(() => focusInPlace(null)).not.toThrow();
    expect(() => focusInPlace(undefined)).not.toThrow();
  });
});

describe('holdScrollOnFocus', () => {
  let page: PageScroll;
  let field: HTMLInputElement;
  let release: () => void;

  /** What a browser does: the focus scroll first, then focusin, the scroll event a frame later. */
  const focusAfterJump = (to: number): void => {
    page.jump(to);
    field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  };

  beforeEach(() => {
    page = stubPageScroll(0);
    const bar = document.body.appendChild(document.createElement('search'));
    field = bar.appendChild(document.createElement('input'));
    boxAt(field, () => 12);
    release = holdScrollOnFocus(bar);
    page.scrollBy(2200);
  });
  afterEach(() => {
    release();
    page.restore();
  });

  it('puts the page back when focus moving into the element scrolled it', () => {
    focusAfterJump(1464);

    expect(page.scrollTo).toHaveBeenCalledWith({ top: 2200, behavior: 'instant' });
    expect(window.scrollY).toBe(2200);
  });

  it('leaves alone a focus that scrolled nothing', () => {
    focusAfterJump(2200);

    expect(page.scrollTo).not.toHaveBeenCalled();
  });

  it('keeps the browser’s scroll when the control would be off screen where the page was', () => {
    // The bar has scrolled away with its list: at 2200 the field is far above the screen.
    boxAt(field, () => (window.scrollY === 2200 ? -900 : 12));

    focusAfterJump(1464);

    expect(page.scrollTo).toHaveBeenLastCalledWith({ top: 1464, behavior: 'instant' });
    expect(window.scrollY).toBe(1464);
  });

  it('leaves alone the focus a pointer brings, so a click lands where it was aimed', () => {
    // A scroll whose event has not come yet (a fling, a script) then a press on a control: putting
    // the page back between the press and the release would send the click somewhere else.
    for (const [down, up] of [
      ['pointerdown', 'pointerup'],
      ['mousedown', 'mouseup'],
    ] as const) {
      page.jump(2293);
      field.dispatchEvent(new Event(down, { bubbles: true }));
      field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      field.dispatchEvent(new Event(up, { bubbles: true }));
    }

    expect(page.scrollTo).not.toHaveBeenCalled();
    // The press is over: a keyboard's focus is held again.
    page.scrollBy(2200);
    focusAfterJump(1464);
    expect(page.scrollTo).toHaveBeenCalledWith({ top: 2200, behavior: 'instant' });
  });

  it('ignores focus that lands outside the element', () => {
    const elsewhere = document.body.appendChild(document.createElement('a'));
    page.jump(1464);
    elsewhere.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(page.scrollTo).not.toHaveBeenCalled();
  });

  it('stops once cleaned up', () => {
    release();
    focusAfterJump(1464);

    expect(page.scrollTo).not.toHaveBeenCalled();
  });
});
