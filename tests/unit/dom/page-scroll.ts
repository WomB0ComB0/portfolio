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
 * @file A page scroll position for jsdom, which has none (window.scrollY is always 0 and
 * window.scrollTo only logs "not implemented"). `scrollBy` moves it the way a browser does, firing
 * a scroll event; `jump` moves it silently, as Chrome's focus scroll does before focusin fires
 * (its scroll event comes a frame later). Not a test file.
 */

import { type Mock, vi } from 'vitest';

export interface PageScroll {
  /** window.scrollTo, recording its calls and moving the position. */
  readonly scrollTo: Mock<(options: ScrollToOptions) => void>;
  /** Scrolls to `y` and fires the scroll event, as a wheel or a drag does. */
  readonly scrollBy: (y: number) => void;
  /** Moves to `y` with no event yet, as a browser's focus scroll does. */
  readonly jump: (y: number) => void;
  readonly restore: () => void;
}

/** Gives window a scroll position, starting at `start`. */
export function stubPageScroll(start = 0): PageScroll {
  let y = start;
  const original = Object.getOwnPropertyDescriptor(window, 'scrollY');
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y });
  const scrollTo = vi.fn((options: ScrollToOptions) => {
    y = options.top ?? y;
  });
  const spy = vi.spyOn(window, 'scrollTo').mockImplementation(scrollTo as never);
  return {
    scrollTo,
    scrollBy: (next) => {
      y = next;
      window.dispatchEvent(new Event('scroll'));
    },
    jump: (next) => {
      y = next;
    },
    /** Ends the spy and puts back window's own scrollY, if it had one before the stub. */
    restore: () => {
      spy.mockRestore();
      if (original) Object.defineProperty(window, 'scrollY', original);
    },
  };
}
