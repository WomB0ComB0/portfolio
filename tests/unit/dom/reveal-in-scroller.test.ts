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
 * @file revealInScroller: a FilterBar chip row that scrolls sideways (`layout="scroll"`) brings
 * a chip that sits past its edge, such as a shared link's current chip, into view by scrolling the
 * row (never the page), inside the row's padding. A chip already in view, or a row that does not scroll, is
 * left alone.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { revealInScroller } from '@/lib/dom/reveal-in-scroller';

interface Box {
  readonly left: number;
  readonly right: number;
}

/** The scrollers a test attached, removed after it. */
const attached: HTMLElement[] = [];

afterEach(() => {
  for (const element of attached.splice(0)) element.remove();
});

/**
 * A sideways scroller 390 px wide with 16 px padding, holding a target at `target`. It is attached
 * to the document, as the chip row always is when it scrolls: a detached element has no computed
 * style (jsdom 31, like browsers), so its padding would read as 0.
 */
function setup(target: Box, { scrollWidth = 1100, scrollLeft = 0 } = {}) {
  const scroller = document.createElement('div');
  const chip = document.createElement('a');
  scroller.append(chip);
  document.body.append(scroller);
  attached.push(scroller);
  scroller.style.paddingLeft = '16px';
  scroller.style.paddingRight = '16px';
  Object.defineProperty(scroller, 'clientWidth', { value: 390 });
  Object.defineProperty(scroller, 'scrollWidth', { value: scrollWidth });
  scroller.scrollLeft = scrollLeft;
  scroller.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 100, width: 390, height: 40 });
  chip.getBoundingClientRect = () =>
    DOMRect.fromRect({ x: target.left, y: 104, width: target.right - target.left, height: 32 });
  return { scroller, chip };
}

describe('revealInScroller', () => {
  it('scrolls a chip past the right edge in, to the row’s inner edge', () => {
    const { scroller, chip } = setup({ left: 979, right: 1042 });

    revealInScroller(scroller, chip);

    expect(scroller.scrollLeft).toBe(1042 - (390 - 16));
  });

  it('scrolls back for a chip past the left edge', () => {
    const { scroller, chip } = setup({ left: -120, right: -60 }, { scrollLeft: 300 });

    revealInScroller(scroller, chip);

    expect(scroller.scrollLeft).toBe(300 + (-120 - 16));
  });

  it('keeps an inset clear inside the padding, for a fade over the end', () => {
    const right = setup({ left: 979, right: 1042 });
    revealInScroller(right.scroller, right.chip, 24);
    expect(right.scroller.scrollLeft).toBe(1042 - (390 - 16 - 24));

    const left = setup({ left: -120, right: -60 }, { scrollLeft: 300 });
    revealInScroller(left.scroller, left.chip, 24);
    expect(left.scroller.scrollLeft).toBe(300 + (-120 - 16 - 24));
  });

  it('never scrolls past either end of the row', () => {
    const last = setup({ left: 1040, right: 1100 }, { scrollWidth: 1100 });
    revealInScroller(last.scroller, last.chip, 24);
    expect(last.scroller.scrollLeft).toBe(1100 - 390);

    const first = setup({ left: 2, right: 60 }, { scrollLeft: 10 });
    revealInScroller(first.scroller, first.chip, 24);
    expect(first.scroller.scrollLeft).toBe(0);
  });

  it('leaves a chip already in view, and a row that does not scroll, alone', () => {
    const inView = setup({ left: 100, right: 180 }, { scrollLeft: 40 });
    revealInScroller(inView.scroller, inView.chip);
    expect(inView.scroller.scrollLeft).toBe(40);

    const still = setup({ left: 979, right: 1042 }, { scrollWidth: 390 });
    revealInScroller(still.scroller, still.chip);
    expect(still.scroller.scrollLeft).toBe(0);
  });
});
