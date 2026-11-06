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
 * never prefetch, and four placeholders while loading. A blank string or a non-finite number is
 * as missing as null (presentValue, shared with StatTile). The shared number formatter it exports
 * returns one instance per option set.
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
  it('is a dl of dt/dd pairs with each label first in the DOM', () => {
    const list = renderStrip();
    const groups = Array.from(list.children);

    expect(list).toHaveAttribute('aria-label', 'Totals');
    expect(list).not.toHaveAttribute('aria-busy');
    expect(list).toHaveClass('flex', 'font-mono', 'text-meta', 'text-muted-foreground');
    expect(groups).toHaveLength(ITEMS.length);
    for (const group of groups) {
      const [first, second] = Array.from(group.children);
      expect(first?.tagName).toBe('DT');
      expect(first).toHaveClass('order-2');
      expect(second?.tagName).toBe('DD');
      expect(second).toHaveClass('order-1', 'font-semibold', 'text-foreground', 'tabular-nums');
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

  it('links a value with prefetch off, named with its label', () => {
    renderStrip();
    const link = screen.getByRole('link', { name: '22 projects' });

    expect(link).toHaveAttribute('href', '/projects');
    expect(link).toHaveAttribute('data-prefetch', 'false');
    expect(link.closest('dd')).not.toBeNull();
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

  it('renders on the server and has no use client directive', () => {
    const html = renderToString(<StatStrip items={ITEMS} />);

    expect(html).toContain('<dl');
    expect(html).toContain('1,234');
    expect(readFileSync(SOURCE, 'utf8')).not.toMatch(/['"]use client['"]/);
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

  it('formats numbers in en-US and passes strings through', () => {
    expect(formatStatValue(4159)).toBe('4,159');
    expect(formatStatValue(0.5, { style: 'percent' })).toBe('50%');
    expect(formatStatValue('n/a')).toBe('n/a');
  });
});
