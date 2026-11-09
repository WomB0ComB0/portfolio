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
 * @file The chips' sliding pill stays on the current chip when a count changes its width: the
 * counts follow the search (disjunctive), so "Tools 12" becoming "Tools 0" narrows that chip and
 * moves the ones after it while the row's own box stays the same size. And it slides to a newly
 * current chip: a browser cancels the clip-path transition the moment the pill is placed at once
 * (data-instant turns transitions off), so nothing may place it at once in the frame after.
 *
 * jsdom has no layout, so a chip's box is stubbed from its text (8px a character, a 6px gap) and
 * ResizeObserver reports, as a browser does, every target on its first frame, then only the
 * targets whose box changed since its last report (a removed chip as 0x0).
 */

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildFilterModel, FilterBar } from '@/components/console/filter-bar';
import { defineFilters, type FilterState } from '@/lib/filters';
import type { Project } from '../../filters/filters-fixture';
import { Harness } from './harness';
import { wideLayout } from './wide-layout';

/** `count` synthetic projects of one kind, so the counts run into two digits. */
const many = (count: number, kind: string, title: string): Project[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${kind}-${index}`,
    title: `${title} ${index}`,
    kind,
    techs: ['go'],
  }));
const ITEMS: readonly Project[] = [
  ...many(12, 'tools', 'Alpha tool'),
  ...many(3, 'apps', 'Beta app'),
  ...many(1, 'hackathons', 'Gamma hack'),
  ...many(1, 'websites', 'Delta site'),
];

/** A synthetic entry for the stand-in schema below. */
interface Entry {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
}
/** `count` synthetic entries of one kind. */
const entries = (count: number, kind: string, title: string): Entry[] =>
  Array.from({ length: count }, (_, index) => ({ id: `${kind}-${index}`, title, kind }));
/** The kinds that show under Other, as one-off issuers do on /certifications. */
const MINOR = new Set(['bots', 'sites']);
const KIND_LABELS: Readonly<Record<string, string>> = {
  tools: 'Tools',
  other: 'Other',
  bots: 'Bots',
  sites: 'Sites',
};
/** 12 tools and 11 under Other; "common" keeps every tool but only one of Other's. */
const ENTRIES: readonly Entry[] = [
  ...entries(12, 'tools', 'Tool common'),
  ...entries(10, 'bots', 'Bot'),
  ...entries(1, 'sites', 'Site common'),
];
/** A kind facet whose minor kinds stand in for Other's chip while chosen (groupOf). */
const standIns = defineFilters<Entry, 'category'>({
  path: '/entries',
  noun: { one: 'entry', many: 'entries' },
  search: { haystack: (entry) => entry.title },
  facets: {
    category: {
      label: 'Kind',
      /** A minor kind is itself and Other, so both ?category=bots and ?category=other keep it. */
      valuesOf: (entry) => (MINOR.has(entry.kind) ? [entry.kind, 'other'] : [entry.kind]),
      /** A kind's label, else the slug. */
      labelOf: (slug) => KIND_LABELS[slug] ?? slug,
      values: ['tools', 'other'],
      /** The chip a minor kind shows under: Other. */
      groupOf: (slug) => (MINOR.has(slug) ? 'other' : null),
      /** A known kind, else dropped. */
      resolve: (raw) => (Object.hasOwn(KIND_LABELS, raw) ? raw : null),
    },
  },
});

const ROW_WIDTH = 600;
const ROW_HEIGHT = 32;
const GAP = 6;
const CHAR_WIDTH = 8;

/** Whether an element is a chip's link. */
const isChip = (element: Element): boolean => element.matches('a[data-filter-part="chip"]');
/** Whether an element is the chip row. */
const isRow = (element: Element): boolean => element.matches('ul[data-filter-part="chips"]');
/** A chip's width, from its text. */
const widthOf = (element: Element): number => CHAR_WIDTH * (element.textContent ?? '').length;
/** A chip's left edge: the chips before it in its row, each with the gap after it. */
const leftOf = (element: Element): number => {
  const items = [...(element.closest('ul')?.children ?? [])];
  return items
    .slice(0, items.indexOf(element.parentElement as Element))
    .map((item) => item.querySelector('a[data-filter-part="chip"]'))
    .reduce((sum, chip) => sum + (chip ? widthOf(chip) + GAP : 0), 0);
};

type Getter = readonly [object, string, (this: HTMLElement) => number];
/** The layout jsdom lacks: chips sized from their text, side by side in a fixed row. */
const GETTERS: readonly Getter[] = [
  [
    HTMLElement.prototype,
    'offsetWidth',
    /** A chip's text width, the row's fixed width, nothing else. */
    function (this: HTMLElement) {
      if (isChip(this)) return widthOf(this);
      return isRow(this) ? ROW_WIDTH : 0;
    },
  ],
  [HTMLElement.prototype, 'offsetHeight', () => ROW_HEIGHT],
  [
    HTMLElement.prototype,
    'offsetLeft',
    /** A chip's left edge in its row; nothing else is offset. */
    function (this: HTMLElement) {
      return isChip(this) ? leftOf(this) : 0;
    },
  ],
  [HTMLElement.prototype, 'offsetTop', () => 0],
  [
    Element.prototype,
    'scrollWidth',
    /** The row never overflows. */
    function (this: HTMLElement) {
      return isRow(this) ? ROW_WIDTH : 0;
    },
  ],
  [
    Element.prototype,
    'clientHeight',
    /** The row is one line tall. */
    function (this: HTMLElement) {
      return isRow(this) ? ROW_HEIGHT : 0;
    },
  ],
];
const SAVED = GETTERS.map(
  ([proto, key]) => [proto, key, Object.getOwnPropertyDescriptor(proto, key)] as const,
);

const observers = new Set<BoxResizeObserver>();
/** An element's box as a comparable string; a removed element has none, as in a browser. */
const sizeOf = (element: Element): string =>
  element.isConnected
    ? `${(element as HTMLElement).offsetWidth}x${(element as HTMLElement).offsetHeight}`
    : '0x0';

/** A ResizeObserver that, on each frame, reports only the targets whose box has changed. */
class BoxResizeObserver {
  private readonly last = new Map<Element, string>();

  constructor(private readonly callback: ResizeObserverCallback) {
    observers.add(this);
  }

  /** Starts watching a target; its first frame always reports it, as a browser does. */
  observe(target: Element): void {
    this.last.set(target, 'unreported');
  }

  /** Stops watching a target. */
  unobserve(target: Element): void {
    this.last.delete(target);
  }

  /** Stops watching everything and leaves the frame loop. */
  disconnect(): void {
    this.last.clear();
    observers.delete(this);
  }

  /** Reports the targets whose box changed since the last report, if any did. */
  flush(): void {
    const changed = [...this.last]
      .filter(([target, size]) => sizeOf(target) !== size)
      .map(([target]) => target);
    if (changed.length === 0) return;
    for (const target of changed) this.last.set(target, sizeOf(target));
    this.callback(
      changed.map((target) => ({ target }) as ResizeObserverEntry),
      this as unknown as ResizeObserver,
    );
  }
}

/** The next frame: every observer reports the boxes that changed. */
const frame = (): void =>
  act(() => {
    for (const observer of observers) observer.flush();
  });

let narrow: () => void;
let savedObserver: typeof ResizeObserver;

beforeEach(() => {
  narrow = wideLayout();
  for (const [proto, key, get] of GETTERS) {
    Object.defineProperty(proto, key, { configurable: true, get });
  }
  savedObserver = globalThis.ResizeObserver;
  // The setup's stub is writable but not configurable: replace it by assignment.
  globalThis.ResizeObserver = BoxResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  narrow();
  observers.clear();
  for (const [proto, key, descriptor] of SAVED) {
    if (descriptor) Object.defineProperty(proto, key, descriptor);
    else Reflect.deleteProperty(proto, key);
  }
  globalThis.ResizeObserver = savedObserver;
});

/** The kind chips alone, over the synthetic items. */
function Bar({ initial = '' }: { readonly initial?: string }) {
  return (
    <Harness initial={initial} items={ITEMS}>
      {() => (
        <FilterBar.Root>
          <FilterBar.Search />
          <FilterBar.Facets>
            <FilterBar.Chips facet="category" />
          </FilterBar.Facets>
        </FilterBar.Root>
      )}
    </Harness>
  );
}

/** The kind chips over the stand-in schema, with their state in React. */
function StandInBar({ initial }: { readonly initial: string }): ReactNode {
  const [state, setState] = useState<FilterState<'category'>>(() => standIns.parse(initial));
  const { model } = buildFilterModel({
    schema: standIns,
    items: ENTRIES,
    draft: state,
    active: state,
    touched: true,
    actions: {
      setQuery: (q) => setState({ ...state, q }),
      submit: () => undefined,
      choose: (key, slug) => setState(standIns.choose(state, key, slug)),
      toggle: (key, slug) => setState(standIns.toggle(state, key, slug)),
      clearAll: () => setState(standIns.empty()),
    },
  });
  return (
    <FilterBar.Provider model={model}>
      <FilterBar.Root>
        <FilterBar.Search />
        <FilterBar.Facets>
          <FilterBar.Chips facet="category" />
        </FilterBar.Facets>
      </FilterBar.Root>
    </FilterBar.Provider>
  );
}

/** The kind chips' row. */
const row = (): HTMLElement => screen.getByRole('list', { name: 'Filter by kind' });
/** One chip, by its accessible name. */
const chip = (name: RegExp): HTMLElement => within(row()).getByRole('link', { name });
/** Where the pill is clipped to, as it writes it. */
const pillBox = (): { l: string; r: string } => {
  const pill = row().querySelector<HTMLElement>('[data-filter-part="pill"]');
  return {
    l: pill?.style.getPropertyValue('--pill-l') ?? '',
    r: pill?.style.getPropertyValue('--pill-r') ?? '',
  };
};
/** Where a chip is, as the pill would clip to it. */
const boxOf = (element: HTMLElement): { l: string; r: string } => ({
  l: `${element.offsetLeft}px`,
  r: `${ROW_WIDTH - element.offsetLeft - element.offsetWidth}px`,
});
/**
 * Watches the pill for a placement at once (data-instant set, however briefly); the returned
 * function says how many times it was touched and stops watching.
 */
const watchInstant = (): (() => number) => {
  const pill = row().querySelector('[data-filter-part="pill"]') as HTMLElement;
  const watcher = new MutationObserver(() => undefined);
  watcher.observe(pill, { attributes: true, attributeFilter: ['data-instant'] });
  return () => {
    const touched = watcher.takeRecords().length;
    watcher.disconnect();
    return touched;
  };
};
/** Types a search, then lets a frame pass. */
const search = (query: string): void => {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: query } });
  frame();
};

describe('the pill when a count changes a chip’s width', () => {
  it('follows the current chip when the chips before it narrow', () => {
    render(<Bar initial="?category=apps" />);
    frame();
    const before = boxOf(chip(/^Apps/));
    expect(pillBox()).toEqual(before);

    search('beta');

    expect(chip(/^All/)).toHaveTextContent('All 3');
    expect(chip(/^Tools/)).toHaveTextContent('Tools 0');
    expect(boxOf(chip(/^Apps/))).not.toEqual(before);
    expect(pillBox()).toEqual(boxOf(chip(/^Apps/)));
  });

  it('fits the current chip when its own count narrows it', () => {
    render(<Bar />);
    frame();
    expect(pillBox()).toEqual(boxOf(chip(/^All/)));

    search('beta');

    expect(pillBox()).toEqual(boxOf(chip(/^All/)));
  });
});

describe('the pill when the current chip changes', () => {
  it('slides to the new chip, and nothing places it at once in the frame after', () => {
    render(<Bar />);
    frame();
    const instant = watchInstant();

    fireEvent.click(chip(/^Apps/));
    frame();

    expect(instant()).toBe(0);
    expect(pillBox()).toEqual(boxOf(chip(/^Apps/)));
  });

  it('then follows a count change on the new chip', () => {
    render(<Bar />);
    frame();
    fireEvent.click(chip(/^Apps/));
    frame();
    const before = boxOf(chip(/^Apps/));

    search('beta');

    expect(boxOf(chip(/^Apps/))).not.toEqual(before);
    expect(pillBox()).toEqual(boxOf(chip(/^Apps/)));
  });

  it('slides when a stand-in gives its place back to its group’s chip in the same change', () => {
    render(<StandInBar initial="?category=bots" />);
    frame();
    expect(chip(/^Bots/)).toHaveAttribute('aria-current', 'true');
    const instant = watchInstant();

    fireEvent.click(chip(/^All/));
    frame();

    expect(within(row()).queryByRole('link', { name: /^Bots/ })).toBeNull();
    expect(chip(/^Other/)).toHaveTextContent('Other 11');
    expect(instant()).toBe(0);
    expect(pillBox()).toEqual(boxOf(chip(/^All/)));
  });

  it('fits a chip that arrived after the first measure when its own count narrows it', () => {
    render(<StandInBar initial="?category=bots" />);
    frame();
    fireEvent.click(chip(/^All/));
    frame();
    fireEvent.click(chip(/^Other/));
    frame();
    const before = boxOf(chip(/^Other/));

    search('common');

    expect(chip(/^Tools/)).toHaveTextContent('Tools 12');
    expect(chip(/^Other/)).toHaveTextContent('Other 1');
    expect(boxOf(chip(/^Other/))).not.toEqual(before);
    expect(pillBox()).toEqual(boxOf(chip(/^Other/)));
  });
});
