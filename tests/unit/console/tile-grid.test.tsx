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
 * @file TileGrid is a container-query grid (2, 6, then 12 columns of its own width), and
 * tileSpanClass places a tile in it with classes Tailwind can find in the source.
 *
 * jsdom applies no Tailwind CSS, so layout is checked as the classes that produce it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TileGrid, type TileGridProps, tileSpanClass } from '@/components/console/tile-grid';

// Vitest runs from the repository root; under jsdom import.meta.url is not a file: URL.
const SOURCE = join(process.cwd(), 'src/components/console/tile-grid.tsx');

const DEFAULT_SPAN_CLASS = 'col-span-2 @xl/tiles:col-span-3 @[70rem]/tiles:col-span-3';

const range = (to: number): number[] => Array.from({ length: to }, (_, index) => index + 1);

function renderGrid(props: TileGridProps = {}): { wrapper: Element; grid: Element } {
  const { container } = render(<TileGrid {...props} />);
  const wrapper = container.firstElementChild;
  const grid = wrapper?.firstElementChild;
  if (!wrapper || !grid) throw new Error('TileGrid rendered no wrapper and grid');
  return { wrapper, grid };
}

describe('tileSpanClass', () => {
  it('builds one class per breakpoint and the row span', () => {
    expect(tileSpanClass({ base: 2, md: 3, lg: 6, rows: 2 })).toBe(
      'col-span-2 @xl/tiles:col-span-3 @[70rem]/tiles:col-span-6 @[70rem]/tiles:row-span-2',
    );
  });

  it('defaults to the full phone width, half of md and a quarter of lg, with no row span', () => {
    expect(tileSpanClass()).toBe(DEFAULT_SPAN_CLASS);
    expect(tileSpanClass({})).toBe(DEFAULT_SPAN_CLASS);
  });

  it('fills in only the keys a partial span leaves out', () => {
    expect(tileSpanClass({ lg: 12 })).toBe(
      'col-span-2 @xl/tiles:col-span-3 @[70rem]/tiles:col-span-12',
    );
    expect(tileSpanClass({ base: 1, rows: 3 })).toBe(
      'col-span-1 @xl/tiles:col-span-3 @[70rem]/tiles:col-span-3 @[70rem]/tiles:row-span-3',
    );
  });

  it('starts the 12-column spans at a 70rem grid, where 8 columns hold a hero’s wide layout', () => {
    const wide = tileSpanClass({ lg: 8, rows: 2 }).split(' ');

    expect(wide).toEqual(
      expect.arrayContaining(['@[70rem]/tiles:col-span-8', '@[70rem]/tiles:row-span-2']),
    );
    // Not at 56rem, where 8 of 12 columns are about 37rem and a hero falls back to its phone layout.
    expect(wide.join(' ')).not.toContain('@4xl/');
  });

  it('pairs two tiles on a phone row only once the grid holds two halves of text', () => {
    // A row each until the grid is 13.5 lines of its own text wide, then halves until the
    // 6-column tier. The step is in lh, so text a phone enlarges puts the row each back.
    expect(tileSpanClass({ base: 'pair', md: 3, lg: 4 })).toBe(
      'col-span-2 @min-[13.5lh]/tiles:@max-xl/tiles:col-span-1 @xl/tiles:col-span-3 @[70rem]/tiles:col-span-4',
    );
  });

  it('writes every span class literally in the source, so Tailwind emits it', () => {
    const source = readFileSync(SOURCE, 'utf8');

    const literals = [
      "'col-span-2 @min-[13.5lh]/tiles:@max-xl/tiles:col-span-1'",
      ...range(2).map((n) => `'col-span-${n}'`),
      ...range(6).map((n) => `'@xl/tiles:col-span-${n}'`),
      ...range(12).map((n) => `'@[70rem]/tiles:col-span-${n}'`),
      ...range(3).map((n) => `'@[70rem]/tiles:row-span-${n}'`),
    ];

    for (const literal of literals) expect(source).toContain(literal);
  });
});

describe('TileGrid', () => {
  it('wraps the grid in the tiles container, since an element cannot query itself', () => {
    const { wrapper, grid } = renderGrid();

    expect(wrapper.tagName).toBe('DIV');
    expect(wrapper).toHaveClass('@container/tiles');
    expect(grid).not.toHaveClass('@container/tiles');
  });

  it('steps from 2 to 6 to 12 columns of the container, with rows at least --tile-row tall', () => {
    const { grid } = renderGrid();

    expect(grid).toHaveClass(
      'grid',
      'grid-cols-2',
      '@xl/tiles:grid-cols-6',
      '@[70rem]/tiles:grid-cols-12',
      '@[70rem]/tiles:auto-rows-[minmax(var(--tile-row),auto)]',
    );
  });

  it('back-fills holes only when dense', () => {
    expect(renderGrid().grid).not.toHaveClass('@[70rem]/tiles:grid-flow-row-dense');
    expect(renderGrid({ dense: true }).grid).toHaveClass('@[70rem]/tiles:grid-flow-row-dense');
  });

  it('renders the grid as the requested element with its label and classes', () => {
    render(
      <TileGrid as="ul" aria-label="Highlights" className="mt-6">
        <li>One</li>
      </TileGrid>,
    );

    const list = screen.getByRole('list', { name: 'Highlights' });
    expect(list.tagName).toBe('UL');
    // Safari drops list semantics from a list-style:none ul unless it says role="list".
    expect(list).toHaveAttribute('role', 'list');
    expect(list).toHaveClass('mt-6', 'grid-cols-2');
    expect(list.parentElement).toHaveClass('@container/tiles');
    expect(screen.getByRole('listitem')).toHaveTextContent('One');
  });

  it.each(['div', 'section'] as const)('adds no role to a %s grid', (as) => {
    expect(renderGrid({ as }).grid).not.toHaveAttribute('role');
  });

  it("lets the caller's role win over the list default", () => {
    expect(renderGrid({ as: 'ul', role: 'presentation' }).grid).toHaveAttribute(
      'role',
      'presentation',
    );
  });

  it('is a server component (no directive)', () => {
    expect(readFileSync(SOURCE, 'utf8')).not.toMatch(/['"]use client['"]/);
  });
});
