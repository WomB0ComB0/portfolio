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

import { describe, expect, it } from 'vitest';

import { revealInScroller } from '@/lib/dom/reveal-in-scroller';

interface Box {
  readonly left: number;
  readonly right: number;
}

/** A sideways scroller 390 px wide with 16 px padding, holding a target at `target`. */
function setup(target: Box, { scrollWidth = 1100, scrollLeft = 0 } = {}) {
  const scroller = document.createElement('div');
  const chip = document.createElement('a');
  scroller.append(chip);
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

  it('leaves a chip already in view, and a row that does not scroll, alone', () => {
    const inView = setup({ left: 100, right: 180 }, { scrollLeft: 40 });
    revealInScroller(inView.scroller, inView.chip);
    expect(inView.scroller.scrollLeft).toBe(40);

    const still = setup({ left: 979, right: 1042 }, { scrollWidth: 390 });
    revealInScroller(still.scroller, still.chip);
    expect(still.scroller.scrollLeft).toBe(0);
  });
});
