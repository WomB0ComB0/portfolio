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
 * @file FilterBar.Chips in `scroll` layout (/projects' Kind chips). From a 48rem page it is one
 * line that scrolls sideways inside itself, with a visible cue wherever chips sit past an end
 * (the row fades there: data-overflow start, end or both), room inside its clip for a focused
 * chip's ring, and the current chip scrolled back into view once focus leaves the row. Below
 * 48rem (the phone sheet) its chips wrap like every other chip set.
 *
 * jsdom has no layout, so the row's scroll box is stubbed: five 100px chips side by side in a
 * row 300px wide, each chip's box moving left as the row scrolls.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FilterBar } from '@/components/console/filter-bar';
import type { ChipsLayout } from '@/components/console/filter-bar/chips';
import { CHIP_LIST_SCROLL_CLASS } from '@/components/console/filter-bar/filter-bar-classes';
import { Harness } from './harness';
import { wideLayout } from './wide-layout';

const CHIP_WIDTH = 100;
const ROW_WIDTH = 300;

const isRow = (element: Element): boolean => element.matches('ul[data-filter-part="chips"]');
const isChip = (element: Element): boolean => element.matches('a[data-filter-part="chip"]');
/** The chips' total width; a test narrows it to make the row fit. */
let contentWidth = 5 * CHIP_WIDTH;

/** A chip's left edge inside its row: its index times the chip width. */
const chipLeft = (chip: Element): number => {
  const items = [...(chip.closest('ul')?.children ?? [])];
  return items.indexOf(chip.parentElement as Element) * CHIP_WIDTH;
};

type Getter = readonly [object, string, (this: HTMLElement) => number];
const GETTERS: readonly Getter[] = [
  [
    Element.prototype,
    'scrollWidth',
    /** The row holds every chip; nothing else scrolls. */
    function (this: HTMLElement) {
      return isRow(this) ? contentWidth : 0;
    },
  ],
  [
    Element.prototype,
    'clientWidth',
    /** The row shows 300px of its chips. */
    function (this: HTMLElement) {
      return isRow(this) ? ROW_WIDTH : 0;
    },
  ],
];
const SAVED = GETTERS.map(
  ([proto, key]) => [proto, key, Object.getOwnPropertyDescriptor(proto, key)] as const,
);
const savedRect = Element.prototype.getBoundingClientRect;

let narrow: () => void;

beforeEach(() => {
  contentWidth = 5 * CHIP_WIDTH;
  narrow = wideLayout();
  for (const [proto, key, get] of GETTERS) {
    Object.defineProperty(proto, key, { configurable: true, get });
  }
  Element.prototype.getBoundingClientRect = function rect(this: Element) {
    if (isRow(this)) return DOMRect.fromRect({ x: 0, y: 0, width: ROW_WIDTH, height: 40 });
    if (isChip(this)) {
      const row = this.closest('ul') as HTMLElement;
      const x = chipLeft(this) - row.scrollLeft;
      return DOMRect.fromRect({ x, y: 4, width: CHIP_WIDTH, height: 32 });
    }
    return DOMRect.fromRect();
  };
});

afterEach(() => {
  cleanup();
  narrow();
  for (const [proto, key, descriptor] of SAVED) {
    if (descriptor) Object.defineProperty(proto, key, descriptor);
    else Reflect.deleteProperty(proto, key);
  }
  Element.prototype.getBoundingClientRect = savedRect;
});

/** The kind chips in `layout`, beside the search. */
function Bar({ layout }: { readonly layout: ChipsLayout }): ReactNode {
  return (
    <Harness>
      {() => (
        <FilterBar.Root>
          <FilterBar.Search />
          <FilterBar.Facets>
            <FilterBar.Chips facet="category" layout={layout} />
          </FilterBar.Facets>
        </FilterBar.Root>
      )}
    </Harness>
  );
}

const row = (): HTMLElement => screen.getByRole('list', { name: 'Filter by kind' });
const chip = (name: RegExp): HTMLElement => within(row()).getByRole('link', { name });
/** Scrolls the row to `left`, as a wheel or a swipe would. */
const scrollTo = (left: number): void => {
  row().scrollLeft = left;
  fireEvent.scroll(row());
};

describe('the scroll layout’s classes', () => {
  const classes = CHIP_LIST_SCROLL_CLASS.split(' ');

  it('wraps below 48rem (the phone sheet), like the other chip sets', () => {
    expect(classes).toContain('flex-wrap');
    expect(classes.filter((name) => /^(?:overflow-|flex-nowrap$)/.test(name))).toEqual([]);
    expect(classes).toContain('@min-[48rem]/page:flex-nowrap');
    expect(classes).toContain('@min-[48rem]/page:overflow-x-auto');
  });

  it('keeps 4px inside its clip on every side, for a focused chip’s 2px ring at a 2px offset', () => {
    expect(classes).toContain('@min-[48rem]/page:p-1');
    // A matching negative margin keeps the chips where the old 2px padding put them.
    expect(classes).toContain('@min-[48rem]/page:-m-0.5');
  });

  it('fades each end that has chips past it (a mask: alpha only, no colour)', () => {
    for (const edge of ['start', 'end', 'both']) {
      expect(classes.some((name) => name.startsWith(`data-[overflow=${edge}]:[mask-image:`))).toBe(
        true,
      );
    }
  });
});

describe('the overflow cue', () => {
  it('marks the end with chips past it, then both ends, then the start, as the row scrolls', () => {
    render(<Bar layout="scroll" />);
    expect(row()).toHaveAttribute('data-overflow', 'end');

    scrollTo(100);
    expect(row()).toHaveAttribute('data-overflow', 'both');

    scrollTo(5 * CHIP_WIDTH - ROW_WIDTH);
    expect(row()).toHaveAttribute('data-overflow', 'start');
  });

  it('marks nothing when every chip fits', () => {
    contentWidth = ROW_WIDTH;
    render(<Bar layout="scroll" />);

    expect(row()).not.toHaveAttribute('data-overflow');
  });

  it('marks nothing in the wrap layout', () => {
    render(<Bar layout="wrap" />);

    expect(row()).not.toHaveAttribute('data-overflow');
  });
});

describe('the current chip after focus has passed through the row', () => {
  it('scrolls back into view once focus leaves the row', () => {
    render(<Bar layout="scroll" />);
    expect(chip(/^All/)).toHaveAttribute('aria-current', 'true');
    scrollTo(5 * CHIP_WIDTH - ROW_WIDTH);

    fireEvent.focusOut(chip(/^Websites/), { relatedTarget: screen.getByRole('searchbox') });
    // A browser fires scroll for that programmatic scroll; jsdom does not.
    fireEvent.scroll(row());

    expect(row().scrollLeft).toBe(0);
    expect(row()).toHaveAttribute('data-overflow', 'end');
  });

  it('stays put while focus moves between chips', () => {
    render(<Bar layout="scroll" />);
    scrollTo(200);

    fireEvent.focusOut(chip(/^Websites/), { relatedTarget: chip(/^Hackathons/) });

    expect(row().scrollLeft).toBe(200);
  });
});
