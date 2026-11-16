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
 * @file The guarded view transition for discrete filter changes: a chip, a token, a checkbox or
 * Clear crossfades the results (named only for the transition, clipped to the clear band under
 * the sticky bar), while typing never does, because a view transition holds input while it
 * runs. Nothing animates under reduced motion, in a hidden tab, while a sheet or picker is open,
 * or where the browser has no view transitions; the change still applies at once.
 *
 * Where a change lands: a visitor who had scrolled into the results is brought back to their
 * top, under the sticky bar, and once the change has applied the bar's edge cuts neither the
 * results nor the results header (the count and the applied filters, which a change adds a line
 * to or takes one from on a phone). Where the bar does not show the filters (a phone, whose chips
 * are in the sheet, or a filter the bar has no control for), the change lands on the header
 * itself, in one move. Reduced motion lands exactly where motion does, whatever the browser's
 * scroll anchoring does to the page while the change applies.
 */

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFilterBar } from '@/components/console/filter-bar';
import { type PageScroll, stubPageScroll } from '../../dom/page-scroll';
import { FullBar } from './harness';
import { hideFiltersButton, wideLayout } from './wide-layout';

type Start = (update: () => void) => { finished: Promise<void> };

let start: ReturnType<typeof vi.fn<Start>>;
let namesDuring: string[];

const setReducedMotion = (reduce: boolean): void => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
};

let narrow: () => void;

beforeEach(() => {
  narrow = wideLayout();
  namesDuring = [];
  start = vi.fn<Start>((update) => {
    const results = document.querySelector<HTMLElement>('[data-filter-part="results"]');
    namesDuring.push(results?.style.viewTransitionName ?? '');
    update();
    return { finished: Promise.resolve() };
  });
  Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true });
  setReducedMotion(false);
});

afterEach(() => {
  cleanup();
  narrow();
  Reflect.deleteProperty(document, 'startViewTransition');
  vi.unstubAllGlobals();
});

const chip = (name: RegExp): HTMLElement =>
  within(screen.getByRole('list', { name: 'Filter by kind' })).getByRole('link', { name });

/** Turns the Python filter on, as a series link on /media turns its series on. */
function SeriesLink(): ReactElement {
  const { change } = useFilterBar();
  return (
    <button
      type="button"
      onClick={() => change((latest) => latest.toggle('tech', 'python'), undefined, { head: true })}
    >
      Show all
    </button>
  );
}
const results = (): HTMLElement[] =>
  within(screen.getByRole('list', { name: 'Results' })).getAllByRole('listitem');
const resultsName = (): string | undefined =>
  document.querySelector<HTMLElement>('[data-filter-part="results"]')?.style.viewTransitionName;

/** The stuck bar's bottom edge and the header's sizes, as measured on /projects at 390px. */
const BAR_BOTTOM = 56;
const COUNT_HEIGHT = 18;
const HEAD_LINE = 28;
const HEAD_ROW_GAP = 8;
const HEAD_TO_RESULTS = 16;
/** The gap the kit keeps between the bar and whatever it brings under it. */
const GAP = 8;

interface PageLayout {
  /** Where the results header starts in the page (not the screen). */
  readonly headTop: number;
  /** A phone: the applied filters take lines of their own under the count, so the header grows. */
  readonly wraps: boolean;
  /** The stuck bar's bottom edge; a phone's 56px unless a test needs another. */
  readonly barBottom?: number;
  /** Room between the header and the results: the map on /places; none elsewhere. */
  readonly between?: number;
  /**
   * Chrome's scroll anchoring: once the results have changed, the first layout read (a box, or
   * the scroll position) finds the page moved here, with no script asking for it.
   */
  readonly anchorTo?: number;
}

interface StubbedPage extends PageScroll {
  /** The top edge, on screen, of a part of the family (its data-filter-part). */
  readonly topOf: (part: 'count' | 'applied' | 'results') => number;
  readonly restoreAll: () => void;
}

/**
 * A page for jsdom, which lays nothing out: the bar stuck over the top of the screen and, under
 * it in the page, the results header (the count, and the applied filters while any are applied:
 * beside the count on a wide page, under it on a phone) and then the results. Every box but the
 * bar's follows the stubbed scroll position, and the header is as tall as what is in the DOM.
 */
function stubPage(
  scrollY: number,
  { headTop, wraps, barBottom = BAR_BOTTOM, between = 0, anchorTo }: PageLayout,
): StubbedPage {
  const page = stubPageScroll(scrollY);
  const items = (): number => document.querySelectorAll('[data-filter-part="results"] li').length;
  let before: number | null = null;
  let anchored = anchorTo === undefined;
  /** Moves the page once, at the first layout read after the results changed. */
  const anchor = (): void => {
    if (anchored) return;
    if (before === null) before = items();
    else if (items() !== before) {
      anchored = true;
      page.jump(anchorTo ?? 0);
    }
  };
  const position = Object.getOwnPropertyDescriptor(window, 'scrollY');
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    get: () => {
      anchor();
      return position?.get?.call(window) ?? 0;
    },
  });
  const rect = (top: number, height: number): DOMRect =>
    ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top }) as DOMRect;
  /** A part's box in the page: its offset under the header's top, and its height. */
  const inPage = (part: string | null): readonly [number, number] | null => {
    const applied = document.querySelector('[data-filter-part="applied"]') !== null;
    const grown = wraps && applied;
    const centred = (HEAD_LINE - COUNT_HEIGHT) / 2;
    // The row around the count and the applied filters: one 28px line, or two on a phone.
    if (part === 'head') return [0, grown ? COUNT_HEIGHT + HEAD_ROW_GAP + HEAD_LINE : HEAD_LINE];
    if (part === 'count') return [grown ? 0 : centred, COUNT_HEIGHT];
    if (part === 'applied') return [wraps ? COUNT_HEIGHT + HEAD_ROW_GAP : 0, HEAD_LINE];
    if (part === 'results') {
      const head = grown ? COUNT_HEIGHT + HEAD_ROW_GAP + HEAD_LINE : HEAD_LINE;
      return [head + HEAD_TO_RESULTS + between, 3000];
    }
    return null;
  };
  const boxOf = (part: string | null): DOMRect => {
    if (part === 'bar') return rect(0, barBottom);
    const box = inPage(part);
    return box ? rect(headTop + box[0] - window.scrollY, box[1]) : rect(0, 0);
  };
  const spy = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function measure(this: Element): DOMRect {
      anchor();
      const isHead = this.querySelector(':scope > [data-filter-part="count"]') !== null;
      return boxOf(isHead ? 'head' : this.getAttribute('data-filter-part'));
    });
  return {
    ...page,
    topOf: (part) => boxOf(part).top,
    restoreAll: () => {
      spy.mockRestore();
      page.restore();
    },
  };
}

describe('discrete changes crossfade the results', () => {
  it('a chip runs its change inside a view transition, with the results named for it', async () => {
    render(<FullBar />);

    fireEvent.click(chip(/^Tools/));

    expect(start).toHaveBeenCalledTimes(1);
    expect(namesDuring).toEqual(['filter-results']);
    expect(results()).toHaveLength(2);
    // The name is the transition's only: it is gone once the transition has finished.
    await vi.waitFor(() => expect(resultsName()).toBe(''));
  });

  it('a checkbox and Clear all do too', () => {
    render(<FullBar initial="?category=tools" />);

    fireEvent.click(screen.getByRole('checkbox', { name: /^Go/ }));
    fireEvent.click(screen.getByRole('link', { name: 'Clear all' }));

    expect(start).toHaveBeenCalledTimes(2);
    expect(results()).toHaveLength(5);
  });

  // The browser runs the update a frame after the click; typing can land in between. The change
  // must act on the filters as they are then, or the typed search would be put back to before.
  it('applies a deferred change to the filters as they are when it runs, typing included', () => {
    let pending: (() => void) | null = null;
    start.mockImplementation((update) => {
      pending = update;
      return { finished: Promise.resolve() };
    });
    render(<FullBar />);
    const search = screen.getByRole('searchbox', { name: 'Search projects' });

    fireEvent.click(chip(/^Tools/));
    fireEvent.change(search, { target: { value: 'bot' } });
    act(() => pending?.());

    expect(search).toHaveValue('bot');
    expect(results().map((item) => item.textContent)).toEqual(['Epsilon bot']);
    expect(chip(/^Tools/)).toHaveAttribute('aria-current', 'true');
  });

  // Starting a transition skips the one still running, whose `finished` then settles before the
  // newer one captures: its end must not strip the newer one's name and root flag.
  it('a later change keeps its name when the earlier transition it skipped ends', async () => {
    const ends: Array<() => void> = [];
    start.mockImplementation((update) => {
      update();
      return { finished: new Promise<void>((resolve) => ends.push(resolve)) };
    });
    render(<FullBar />);

    fireEvent.click(chip(/^Tools/));
    fireEvent.click(chip(/^Apps/));
    ends[0]?.();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(resultsName()).toBe('filter-results');
    expect(document.documentElement).toHaveAttribute('data-filter-transition');
    ends[1]?.();
    await vi.waitFor(() => expect(resultsName()).toBe(''));
    expect(document.documentElement).not.toHaveAttribute('data-filter-transition');
  });

  // With two bars on a page, each change names its own results. A skipped change's results must
  // not keep the name: a capture that finds one name twice is skipped, and so would every later one.
  it('a change skipped by another bar’s change gives up its own results’ name', async () => {
    const ends: Array<() => void> = [];
    start.mockImplementation((update) => {
      update();
      return { finished: new Promise<void>((resolve) => ends.push(resolve)) };
    });
    const first = render(<FullBar />).container;
    const second = render(<FullBar />).container;
    /** A kind chip in one bar's tree. */
    const kindChip = (root: HTMLElement, name: RegExp): HTMLElement =>
      within(within(root).getByRole('list', { name: 'Filter by kind' })).getByRole('link', {
        name,
      });
    /** The view-transition-name on one bar's results. */
    const nameIn = (root: HTMLElement): string | undefined =>
      root.querySelector<HTMLElement>('[data-filter-part="results"]')?.style.viewTransitionName;

    fireEvent.click(kindChip(first, /^Tools/));
    fireEvent.click(kindChip(second, /^Apps/));
    ends[0]?.();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(nameIn(first)).toBe('');
    expect(nameIn(second)).toBe('filter-results');
    expect(document.documentElement).toHaveAttribute('data-filter-transition');
    ends[1]?.();
    await vi.waitFor(() => expect(nameIn(second)).toBe(''));
    expect(document.documentElement).not.toHaveAttribute('data-filter-transition');
  });
});

describe('never while typing, and never when motion is unwelcome', () => {
  it('typing filters at once with no transition', () => {
    render(<FullBar />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search projects' }), {
      target: { value: 'delta' },
    });

    expect(start).not.toHaveBeenCalled();
    expect(results()).toHaveLength(1);
  });

  it('under reduced motion the change applies at once', () => {
    setReducedMotion(true);
    render(<FullBar />);

    fireEvent.click(chip(/^Tools/));

    expect(start).not.toHaveBeenCalled();
    expect(results()).toHaveLength(2);
  });

  // Where a change lands is not motion: an instant scroll in the same handler as the change paints
  // once, so a phone (chips in the sheet) and reduced motion land on the results' top too.
  it('under reduced motion a change made while scrolled into the results still lands on their top', () => {
    setReducedMotion(true);
    // A wide page: the results start 2500px down it, and the visitor is 500px into them.
    const page = stubPage(3000, { headTop: 2456, wraps: false, barBottom: 64 });
    const wide = hideFiltersButton();
    render(<FullBar />);

    try {
      fireEvent.click(chip(/^Tools/));

      expect(start).not.toHaveBeenCalled();
      expect(page.scrollTo).toHaveBeenCalledTimes(1);
      expect(page.scrollTo).toHaveBeenCalledWith({ top: 3000 - 500 - 64 - 8, behavior: 'instant' });
      expect(page.topOf('results')).toBe(64 + GAP);
      expect(results()).toHaveLength(2);
    } finally {
      wide();
      page.restoreAll();
    }
  });

  it('where the browser has no view transitions the change applies at once', () => {
    Reflect.deleteProperty(document, 'startViewTransition');
    render(<FullBar />);

    fireEvent.click(chip(/^Apps/));

    expect(results()).toHaveLength(1);
  });

  it('a transition the browser refuses still applies the change', () => {
    start.mockImplementation(() => {
      throw new DOMException('refused', 'InvalidStateError');
    });
    render(<FullBar />);

    fireEvent.click(chip(/^Apps/));

    expect(results()).toHaveLength(1);
    expect(resultsName()).toBe('');
  });
});

describe('where a change lands', () => {
  /** The results header starts 322px down the page, as on /projects at 390px. */
  const HEAD_TOP = 322;
  const clearAll = (): HTMLElement => screen.getByRole('link', { name: 'Clear all' });

  // The page is aligned before the change applies, when the applied line is not there yet. On a
  // phone that line then pushed the results down and stayed half under the bar itself.
  it.each([
    ['inside a view transition', false],
    ['under reduced motion', true],
  ])(
    'a change that adds the applied line on a phone shows the whole header under the bar, %s',
    (_name, reduce) => {
      setReducedMotion(reduce);
      const page = stubPage(1010, { headTop: HEAD_TOP, wraps: true });
      render(<FullBar />);

      try {
        fireEvent.click(chip(/^Tools/));

        expect(start).toHaveBeenCalledTimes(reduce ? 0 : 1);
        expect(screen.getByRole('list', { name: 'Applied filters' })).toBeInTheDocument();
        expect(page.topOf('count')).toBe(BAR_BOTTOM + GAP);
        expect(page.topOf('applied')).toBeGreaterThan(BAR_BOTTOM);
        expect(window.scrollY).toBe(HEAD_TOP - BAR_BOTTOM - GAP);
        // One move: the page goes straight to the header, before the change, not to the
        // results' top and then up again once the change has grown the header.
        expect(page.scrollTo).toHaveBeenCalledTimes(1);
      } finally {
        page.restoreAll();
      }
    },
  );

  // Clearing takes the applied line away again, so the results rise by its height after the page
  // was aligned. On a phone the change lands on the header (the count), the results whole under
  // it. (Focus then moves into the stuck bar, whose scroll hold may put the page back where it
  // was before the alignment: held where it was aligned, it lands there.)
  it.each([
    ['inside a view transition', false],
    ['under reduced motion', true],
  ])(
    'clearing on a phone while scrolled into the results lands on the header, %s',
    (_name, reduce) => {
      setReducedMotion(reduce);
      const page = stubPage(900, { headTop: HEAD_TOP, wraps: true });
      render(<FullBar initial="?category=tools" />);

      try {
        fireEvent.click(clearAll());

        expect(results()).toHaveLength(5);
        expect(page.topOf('count')).toBeGreaterThanOrEqual(BAR_BOTTOM + GAP);
        expect(page.topOf('count')).toBeLessThanOrEqual(BAR_BOTTOM + GAP + HEAD_LINE);
        expect(page.topOf('results')).toBeGreaterThan(BAR_BOTTOM + GAP);
      } finally {
        page.restoreAll();
      }
    },
  );

  // On a phone the chips are in the sheet, so nothing on screen says which filter is on but the
  // header: a one-line header must not be left wholly behind the bar either.
  it.each([
    ['inside a view transition', false],
    ['under reduced motion', true],
  ])('a one-line header on a phone lands whole under the bar, in one move, %s', (_name, reduce) => {
    setReducedMotion(reduce);
    const page = stubPage(1010, { headTop: HEAD_TOP, wraps: false });
    render(<FullBar />);

    try {
      fireEvent.click(chip(/^Tools/));

      expect(page.topOf('applied')).toBe(BAR_BOTTOM + GAP);
      expect(page.topOf('results')).toBeGreaterThan(BAR_BOTTOM);
      expect(page.scrollTo).toHaveBeenCalledTimes(1);
    } finally {
      page.restoreAll();
    }
  });

  /**
   * /places on a phone: the header (count and applied filters) sits above the map, far above the
   * results, so it is never chased; but the applied line it gains pushes the results down after
   * the page was aligned (measured: the first card 62px under the bar, the map's edge showing).
   */
  describe('a header far above the results (the map between them)', () => {
    /** The header 300px down the page, a 500px map, then the results. */
    const PLACES = { headTop: 300, wraps: true, between: 500 } as const;
    /** Where the results start in the page while the header is one line. */
    const RESULTS_AT = 300 + HEAD_LINE + HEAD_TO_RESULTS + 500;

    it.each([
      ['inside a view transition', false],
      ['under reduced motion', true],
    ])('a change that grows it lands on the results’ top all the same, %s', (_name, reduce) => {
      setReducedMotion(reduce);
      const page = stubPage(RESULTS_AT + 800, PLACES);
      render(<FullBar />);

      try {
        fireEvent.click(chip(/^Tools/));

        expect(screen.getByRole('list', { name: 'Applied filters' })).toBeInTheDocument();
        expect(page.topOf('results')).toBe(BAR_BOTTOM + GAP);
        // The header is never chased: it stays above the screen.
        expect(page.topOf('applied') + HEAD_LINE).toBeLessThan(0);
      } finally {
        page.restoreAll();
      }
    });

    it('a visitor already at the results’ top stays there through the next change', () => {
      setReducedMotion(true);
      const page = stubPage(RESULTS_AT - BAR_BOTTOM - GAP, PLACES);
      render(<FullBar />);

      try {
        fireEvent.click(chip(/^Tools/));

        expect(page.topOf('results')).toBe(BAR_BOTTOM + GAP);
      } finally {
        page.restoreAll();
      }
    });

    it('a visitor near the top, the results below the bar, is never moved', () => {
      setReducedMotion(true);
      const page = stubPage(100, PLACES);
      render(<FullBar />);

      try {
        fireEvent.click(chip(/^Tools/));

        expect(page.scrollTo).not.toHaveBeenCalled();
      } finally {
        page.restoreAll();
      }
    });
  });

  it('a header the visitor had left half under the bar is whole after the change', () => {
    setReducedMotion(true);
    // The results are still under the bar, so nothing is aligned before the change.
    const page = stubPage(HEAD_TOP - 40, { headTop: HEAD_TOP, wraps: true });
    render(<FullBar />);

    try {
      fireEvent.click(chip(/^Tools/));

      expect(page.topOf('count')).toBe(BAR_BOTTOM + GAP);
    } finally {
      page.restoreAll();
    }
  });

  // A wide page keeps the applied filters beside the count and its chips in the bar, which shows
  // the filter: the header is one line before and after, and lands wholly under the bar. That
  // stays exactly as it was.
  it('a header that lands wholly under the bar on a wide page is left there', () => {
    const page = stubPage(1010, { headTop: HEAD_TOP, wraps: false });
    const wide = hideFiltersButton();
    render(<FullBar />);

    try {
      fireEvent.click(chip(/^Tools/));

      expect(page.scrollTo).toHaveBeenCalledTimes(1);
      expect(page.topOf('results')).toBe(BAR_BOTTOM + GAP);
      expect(page.topOf('applied') + HEAD_LINE).toBeLessThanOrEqual(BAR_BOTTOM);
    } finally {
      wide();
      page.restoreAll();
    }
  });

  // A filter the bar has no control for (a series on /media) shows only in the header.
  it.each([
    ['inside a view transition', false],
    ['under reduced motion', true],
  ])(
    'on a wide page, a header holding a filter the bar does not show lands whole, %s',
    (_name, reduce) => {
      setReducedMotion(reduce);
      const page = stubPage(1010, { headTop: HEAD_TOP, wraps: false });
      const wide = hideFiltersButton();
      render(<FullBar kindOnly initial="?tech=python" />);

      try {
        fireEvent.click(chip(/^Tools/));

        expect(screen.getByRole('link', { name: 'Remove Technology: Python' })).toBeVisible();
        expect(page.topOf('applied')).toBe(BAR_BOTTOM + GAP);
      } finally {
        wide();
        page.restoreAll();
      }
    },
  );

  // A link that only filters the list (a series' "Show all", far down the page) says that it
  // lands on a filter the bar does not show, so the page goes straight to the header: one move.
  it('a change that says it lands on the header moves the page once, even on a wide page', () => {
    const page = stubPage(1010, { headTop: HEAD_TOP, wraps: false });
    const wide = hideFiltersButton();
    render(<FullBar kindOnly extra={<SeriesLink />} />);

    try {
      fireEvent.click(screen.getByRole('button', { name: 'Show all' }));

      expect(page.topOf('applied')).toBe(BAR_BOTTOM + GAP);
      expect(page.scrollTo).toHaveBeenCalledTimes(1);
    } finally {
      wide();
      page.restoreAll();
    }
  });

  it.each([
    ['a chip', (): HTMLElement => chip(/^Apps/), ''],
    ['Clear all', clearAll, '?category=tools'],
  ])(
    '%s leaves the page where it is while the header and the results show whole',
    (_name, control, initial) => {
      setReducedMotion(true);
      for (const wraps of [true, false]) {
        const page = stubPage(HEAD_TOP - BAR_BOTTOM - 20, { headTop: HEAD_TOP, wraps });
        const view = render(<FullBar initial={initial} />);

        try {
          fireEvent.click(control());

          expect(page.scrollTo).not.toHaveBeenCalled();
        } finally {
          view.unmount();
          page.restoreAll();
        }
      }
    },
  );
});

// Without a view transition the change applies in the click's own task, and the browser's scroll
// anchoring then moves the page on its own at the first layout read (measured on /media: 174 to
// 260; on /certifications, All after scrolling into the list: to the very top). Motion lands where
// the kit puts it; reduced motion must land in the same place.
describe('reduced motion lands where motion lands', () => {
  /** The results header starts 322px down the page. */
  const HEAD_TOP = 322;
  const modes = [
    ['inside a view transition', false],
    ['under reduced motion', true],
  ] as const;
  let wide: () => void;
  beforeEach(() => {
    wide = hideFiltersButton();
  });
  afterEach(() => wide());

  it.each(modes)(
    'a chip pressed with the header in view moves nothing, whatever anchoring does, %s',
    (_name, reduce) => {
      setReducedMotion(reduce);
      const scrolled = HEAD_TOP - BAR_BOTTOM - 20;
      const page = stubPage(scrolled, { headTop: HEAD_TOP, wraps: false, anchorTo: scrolled + 86 });
      render(<FullBar />);

      try {
        fireEvent.click(chip(/^Tools/));

        expect(results()).toHaveLength(2);
        expect(window.scrollY).toBe(scrolled);
      } finally {
        page.restoreAll();
      }
    },
  );

  it.each(modes)(
    'All after scrolling into the results lands on their top, even if anchoring throws the page up, %s',
    (_name, reduce) => {
      setReducedMotion(reduce);
      const page = stubPage(1010, { headTop: HEAD_TOP, wraps: false, anchorTo: 0 });
      render(<FullBar initial="?category=tools" />);

      try {
        fireEvent.click(chip(/^All/));

        expect(results()).toHaveLength(5);
        expect(page.topOf('results')).toBe(BAR_BOTTOM + GAP);
      } finally {
        page.restoreAll();
      }
    },
  );
});
