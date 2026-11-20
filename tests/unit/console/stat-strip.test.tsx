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
 * @file StatStrip is a description list whose labels come first in the DOM (values first on
 * screen), with en-US numbers, a spoken 'unavailable' for a missing value, optional links that
 * never prefetch, and four placeholders while loading (or, item by item, a placeholder figure
 * under its real label). A blank string or a non-finite number is as missing as null
 * (presentValue, shared with StatTile). The shared number formatter it exports returns one
 * instance per option set.
 *
 * next/link is a plain anchor exposing prefetch as data-prefetch.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  formatStatValue,
  numberFormatter,
  presentValue,
  StatStrip,
  StatStripAction,
  type StatStripItem,
} from '@/components/console/stat-strip';

vi.mock('next/link', () => ({
  default: ({
    href,
    prefetch,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean | null;
    children?: ReactNode;
  }) => (
    <a {...rest} href={href} data-prefetch={String(prefetch)}>
      {children}
    </a>
  ),
}));

// Vitest runs from the repository root; under jsdom import.meta.url is not a file: URL.
const SOURCE = join(process.cwd(), 'src/components/console/stat-strip.tsx');

const ITEMS: readonly StatStripItem[] = [
  { label: 'projects', value: 22, href: '/projects' },
  { label: 'commits', value: 1234 },
  { label: 'uptime', value: '99.9', unit: '%' },
];

function renderStrip(items: readonly StatStripItem[] = ITEMS, loading = false): HTMLElement {
  const { container } = render(<StatStrip items={items} loading={loading} aria-label="Totals" />);
  const list = container.querySelector('dl');
  if (!list) throw new Error('no dl rendered');
  return list;
}

describe('StatStrip', () => {
  it('is a dl of dt/dd pairs with each label first in the DOM, shown under its figure', () => {
    const list = renderStrip();
    const groups = Array.from(list.children);

    expect(list).toHaveAttribute('aria-label', 'Totals');
    expect(list).not.toHaveAttribute('aria-busy');
    expect(list).toHaveClass('grid', 'grid-flow-col');
    // Refined: Geist figures, no mono face, nothing in the chrome's 13px meta size.
    expect(list).not.toHaveClass('font-mono', 'text-meta');
    expect(groups).toHaveLength(ITEMS.length);
    for (const group of groups) {
      const [first, second] = Array.from(group.children);
      // A column: the figure on top (order 1), its label under it (order 2).
      expect(group).toHaveClass('flex', 'flex-col');
      expect(first?.tagName).toBe('DT');
      expect(first).toHaveClass('order-2', 'figure-unit', 'text-muted-foreground');
      expect(second?.tagName).toBe('DD');
      expect(second).toHaveClass('order-1', 'figure-sm', 'text-foreground');
      expect(second).not.toHaveClass('font-mono');
    }
  });

  it('formats numbers in en-US and shows strings and units as given', () => {
    const list = renderStrip();

    expect(within(list).getByText('1,234').tagName).toBe('DD');
    expect(within(list).getByText('99.9')).toBeInTheDocument();
    expect(within(list).getByText('%')).toBeInTheDocument();
  });

  it('shows a missing value as an em dash that is read as unavailable', () => {
    const list = renderStrip([{ label: 'repos', value: null, href: '/projects' }]);

    expect(within(list).getByText('—')).toHaveAttribute('aria-hidden', 'true');
    expect(within(list).getByText('unavailable')).toHaveClass('sr-only');
    expect(within(list).queryByRole('link')).toBeNull();
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['an empty string', ''],
    ['a blank string', '   '],
  ])('shows %s as unavailable too, never a made-up figure', (_case, value) => {
    const list = renderStrip([{ label: 'avg hours', value, unit: 'h', href: '/stats' }]);
    const figure = list.querySelector('dd');

    expect(within(list).getByText('—')).toHaveAttribute('aria-hidden', 'true');
    expect(within(list).getByText('unavailable')).toHaveClass('sr-only');
    expect(figure?.textContent).toBe('—unavailable');
    expect(within(list).queryByRole('link')).toBeNull();
  });

  it('shows a figure node in place of the formatted value, with its unit', () => {
    const list = renderStrip([
      { label: 'years old', value: 22, figure: <span data-live="">22.65753424</span>, unit: 'y' },
    ]);
    const figure = list.querySelector('dd');

    expect(figure?.querySelector('[data-live]')?.textContent).toBe('22.65753424');
    expect(figure?.textContent).toBe('22.65753424y');
  });

  it('reads a missing value as unavailable even with a figure node', () => {
    const list = renderStrip([
      { label: 'years old', value: null, figure: <span data-live="">22.65753424</span> },
    ]);

    expect(list.querySelector('[data-live]')).toBeNull();
    expect(within(list).getByText('unavailable')).toHaveClass('sr-only');
  });

  it('links a value with prefetch off, named with its label', () => {
    renderStrip();
    const link = screen.getByRole('link', { name: '22 projects' });

    expect(link).toHaveAttribute('href', '/projects');
    expect(link).toHaveAttribute('data-prefetch', 'false');
    expect(link.closest('dd')).not.toBeNull();
  });

  it('links the href without the spaces and nbsp around it', () => {
    renderStrip([{ label: 'projects', value: 22, href: '  /projects  ' }]);

    expect(screen.getByRole('link', { name: '22 projects' })).toHaveAttribute('href', '/projects');
  });

  it.each(['', '#', '  '])('ignores the empty href %j', (href) => {
    const list = renderStrip([{ label: 'projects', value: 22, href }]);

    expect(within(list).queryByRole('link')).toBeNull();
    expect(within(list).getByText('22')).toBeInTheDocument();
  });

  it('loading marks the list busy and shows 4 hidden placeholders instead of items', () => {
    const list = renderStrip(ITEMS, true);
    const placeholders = list.querySelectorAll('[data-placeholder]');

    expect(list).toHaveAttribute('aria-busy', 'true');
    expect(placeholders).toHaveLength(4);
    for (const placeholder of placeholders) {
      expect(placeholder).toHaveAttribute('aria-hidden', 'true');
    }
    expect(within(list).queryByText('1,234')).toBeNull();
  });

  it('loading shows as many placeholders as asked, so a skeleton matches its loaded strip', () => {
    const { container } = render(<StatStrip items={[]} loading placeholderCount={3} />);
    const placeholders = container.querySelectorAll('[data-placeholder]');

    expect(placeholders).toHaveLength(3);
    for (const placeholder of placeholders) {
      // A figure bar over a label bar, in the loaded item's column.
      expect(placeholder).toHaveClass('flex', 'flex-col');
      expect(placeholder.querySelector('dd span')).toHaveClass('h-7');
    }
  });

  it('keeps an item’s label and puts a busy placeholder in its figure’s place while it loads', () => {
    const list = renderStrip([
      { label: 'years old', value: 25 },
      { label: 'page views in 30 days', value: null, loading: true },
    ]);
    const [ready, loading] = Array.from(list.children);

    expect(list).toHaveAttribute('aria-busy', 'true');
    expect(ready?.querySelector('dd')?.textContent).toBe('25');
    expect(loading?.querySelector('dt')?.textContent).toBe('page views in 30 days');
    // The placeholder item's figure bar, in the figure's own line; read as loading, never as
    // unavailable and never as a number.
    const figure = loading?.querySelector('dd');
    expect(figure).toHaveClass('order-1', 'figure-sm');
    expect(figure?.querySelector('[data-placeholder]')).toHaveClass('h-7');
    expect(figure?.querySelector('[data-placeholder]')).toHaveAttribute('aria-hidden', 'true');
    expect(within(figure as HTMLElement).getByText('Loading')).toHaveClass('sr-only');
    expect(figure?.textContent).not.toMatch(/unavailable|\d/);
  });

  it('is not busy once no item is loading', () => {
    const list = renderStrip([{ label: 'years old', value: 25, loading: false }]);

    expect(list).not.toHaveAttribute('aria-busy');
  });

  it('renders on the server and has no use client directive', () => {
    const html = renderToString(<StatStrip items={ITEMS} />);

    expect(html).toContain('<dl');
    expect(html).toContain('1,234');
    expect(readFileSync(SOURCE, 'utf8')).not.toMatch(/['"]use client['"]/);
  });
});

describe('StatStrip sized by the page container', () => {
  const PAD = 'clamp(0.75rem,2.5cqi,1.5rem)';
  const classOf = (element: Element | null | undefined): string[] =>
    (element?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

  function renderSized(loading = false): HTMLElement {
    const { container } = render(
      <StatStrip
        items={ITEMS}
        loading={loading}
        placeholderCount={3}
        sizing="container"
        aria-label="Totals"
        className="mt-2"
      />,
    );
    const list = container.querySelector('dl');
    if (!list) throw new Error('no dl rendered');
    return list;
  }

  it('is a wrapping row of equal parts, none narrower than its figure or its longest word', () => {
    const list = renderSized();

    expect(classOf(list)).toEqual(expect.arrayContaining(['flex', 'flex-wrap', 'gap-y-3']));
    expect(classOf(list)).not.toContain('grid');
    for (const group of Array.from(list.children)) {
      // Equal parts across the row, with a min-content floor: a figure never crosses its divider.
      expect(classOf(group)).toEqual(
        expect.arrayContaining(['flex-[1_1_0]', 'min-w-min', 'flex-col', `px-[${PAD}]`]),
      );
      expect(classOf(group)).not.toContain('min-w-0');
      expect(classOf(group).join(' ')).not.toMatch(/(?:^|\s)md:/);
    }
  });

  it('makes each item as wide as its words once the page is 29 lines of its text wide', () => {
    for (const group of Array.from(renderSized().children)) {
      expect(classOf(group)).toContain('@min-[29lh]/page:flex-none');
    }
  });

  it('keeps every item’s divider and clips the one that starts a row', () => {
    const list = renderSized();
    const [first] = Array.from(list.children);

    // The first item keeps its divider and padding; the row is pulled left by both under a
    // clipping wrapper, so a wrapped row never opens with a stray rule either.
    expect(classOf(first)).toContain('border-l');
    expect(classOf(first)).not.toContain('first:border-l-0');
    expect(classOf(first)).not.toContain('first:pl-0');
    expect(classOf(list)).toContain(`-ml-[calc(${PAD}+1px)]`);
    expect(list.parentElement?.tagName).toBe('DIV');
    expect(classOf(list.parentElement)).toEqual(['overflow-x-clip']);
  });

  it('balances a label that wraps, and keeps the caller’s classes and name on the list', () => {
    const list = renderSized();

    for (const label of list.querySelectorAll('dt')) {
      expect(classOf(label)).toContain('text-balance');
    }
    expect(list).toHaveAttribute('aria-label', 'Totals');
    expect(classOf(list)).toContain('mt-2');
    expect(classOf(list.parentElement)).not.toContain('mt-2');
  });

  it('gives a loading placeholder the loaded item’s box', () => {
    const list = renderSized(true);
    const placeholders = list.querySelectorAll('[data-placeholder]');

    expect(placeholders).toHaveLength(3);
    for (const placeholder of placeholders) {
      expect(classOf(placeholder)).toEqual(expect.arrayContaining(['flex-[1_1_0]', 'min-w-min']));
    }
  });

  it('is opt-in: the default strip is the list alone, in equal phone columns', () => {
    const { container } = render(<StatStrip items={ITEMS} aria-label="Totals" />);
    const list = container.firstElementChild;

    expect(list?.tagName).toBe('DL');
    expect(classOf(list)).toEqual(expect.arrayContaining(['grid', 'grid-flow-col']));
    expect(classOf(list?.firstElementChild)).toEqual(
      expect.arrayContaining(['min-w-0', 'first:border-l-0', 'first:pl-0', 'md:px-6']),
    );
  });
});

// The live age's Pause toggle sat on the figure's line and, on a phone, wrapped under the digits:
// the age's label dropped a line below its neighbours' (measured in Chromium at 390 to 600 px).
// Kept on that line it would widen the age past what a 320 px strip has room for. So an action
// goes on the label's row, in a cell of its own, and the figure's line never changes.
describe('StatStrip item with an action', () => {
  const classOf = (element: Element | null | undefined): string[] =>
    (element?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

  const ACTION = (
    <StatStripAction className="motion-reduce:hidden">
      <button type="button">Pause</button>
    </StatStripAction>
  );

  function renderWithAction(age: Partial<StatStripItem> = {}): HTMLElement {
    const { container } = render(
      <StatStrip
        sizing="container"
        aria-label="At a glance"
        items={[
          {
            label: 'years old',
            value: 22,
            figure: <span data-live="">22.65753424</span>,
            action: ACTION,
            ...age,
          },
          { label: 'commits', value: 1234 },
        ]}
      />,
    );
    const list = container.querySelector('dl');
    if (!list) throw new Error('no dl rendered');
    return list;
  }

  it('sets the action in a dd of its own after the figure’s, so the list stays valid', () => {
    const [group] = Array.from(renderWithAction().children);
    const [label, value, action] = Array.from(group?.children ?? []);

    expect(Array.from(group?.children ?? [], (child) => child.tagName)).toEqual(['DT', 'DD', 'DD']);
    expect(label).toHaveTextContent('years old');
    expect(value?.querySelector('[data-live]')).not.toBeNull();
    expect(value?.querySelector('button')).toBeNull();
    expect(within(action as HTMLElement).getByRole('button', { name: 'Pause' })).toBeVisible();
  });

  it('lays the figure across the item and the label and action side by side under it', () => {
    const [group] = Array.from(renderWithAction().children);
    const [label, value, action] = Array.from(group?.children ?? []);

    // Two content-sized columns (a flexible one would leave the figure out of the item's floor),
    // packed at the top, as the column is, when the row is taller than the item.
    expect(classOf(group)).toEqual(
      expect.arrayContaining(['grid', 'grid-cols-[auto_auto]', 'content-start', 'gap-x-2']),
    );
    expect(classOf(group)).not.toContain('flex');
    // Still an equal part of the row, never narrower than its figure, with its divider.
    expect(classOf(group)).toEqual(
      expect.arrayContaining(['flex-[1_1_0]', 'min-w-min', 'border-l']),
    );
    expect(classOf(value)).toEqual(expect.arrayContaining(['col-span-2', 'row-start-1']));
    expect(classOf(label)).toEqual(expect.arrayContaining(['col-start-1', 'row-start-2']));
    // The action ends the label's row, one label line tall (whatever it holds is centred on that
    // line), so the label sits where it does in an item without one.
    expect(classOf(action)).toEqual(
      expect.arrayContaining([
        'col-start-2',
        'row-start-2',
        'justify-self-end',
        'self-start',
        'figure-unit',
        'h-lh',
        'flex',
        'items-center',
      ]),
    );
  });

  it('keeps the classes the action is given on its cell, so the cell hides with its control', () => {
    const [group] = Array.from(renderWithAction().children);

    expect(group?.lastElementChild).toHaveClass('motion-reduce:hidden', 'col-start-2');
  });

  it('leaves an item without an action as it was', () => {
    const [, other] = Array.from(renderWithAction().children);

    expect(Array.from(other?.children ?? [], (child) => child.tagName)).toEqual(['DT', 'DD']);
    expect(classOf(other)).toEqual(expect.arrayContaining(['flex', 'flex-col', 'gap-1']));
    expect(classOf(other)).not.toContain('grid');
  });

  it.each([
    ['a missing value', { value: null }],
    ['a figure still loading', { loading: true }],
  ])('shows no action for %s, which shows no figure to act on', (_case, age) => {
    const [group] = Array.from(renderWithAction(age).children);

    expect(group?.querySelector('button')).toBeNull();
    expect(group?.querySelectorAll('dd')).toHaveLength(1);
    expect(classOf(group)).toEqual(expect.arrayContaining(['flex', 'flex-col']));
  });
});

describe('presentValue', () => {
  it.each([
    [0, 0],
    [4159, 4159],
    [-2.5, -2.5],
    ['4.2k', '4.2k'],
    [' 22 ', ' 22 '],
  ])('keeps %j', (value, shown) => {
    expect(presentValue(value)).toBe(shown);
  });

  it.each([
    null,
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    '',
    ' \t ',
  ])('treats %j as no value', (value) => {
    expect(presentValue(value)).toBeNull();
  });
});

describe('number formatting', () => {
  it('returns one formatter per option set', () => {
    expect(numberFormatter({ style: 'percent' })).toBe(numberFormatter({ style: 'percent' }));
    expect(numberFormatter()).toBe(numberFormatter({}));
    expect(numberFormatter()).not.toBe(numberFormatter({ style: 'percent' }));
  });

  it('returns the same formatter for equivalent options in any key order', () => {
    const percent = numberFormatter({ style: 'percent', maximumFractionDigits: 1 });

    expect(numberFormatter({ maximumFractionDigits: 1, style: 'percent' })).toBe(percent);
    // Intl ignores an undefined option, so the cache does too.
    expect(
      numberFormatter({
        maximumFractionDigits: 1,
        style: 'percent',
        minimumFractionDigits: undefined,
      }),
    ).toBe(percent);
    expect(numberFormatter({ style: 'percent', maximumFractionDigits: 2 })).not.toBe(percent);
  });

  it('formats numbers in en-US and passes strings through', () => {
    expect(formatStatValue(4159)).toBe('4,159');
    expect(formatStatValue(0.5, { style: 'percent' })).toBe('50%');
    expect(formatStatValue('n/a')).toBe('n/a');
  });
});
