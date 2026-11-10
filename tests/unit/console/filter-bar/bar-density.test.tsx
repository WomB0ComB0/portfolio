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
 * @file FilterBar.Root's two densities. 'bar' (/places) puts the row on a surface-1 tile and,
 * sticky, holds it in a slimmer band (BAR_STICKY_TILE_CLASS: the same at every width), so the
 * stuck tile ends inside the edge haze's top band and html's scroll-padding (77px and 74px at
 * 1024x640), paints no line of its own when stuck (the tile's border is the edge), and stays in
 * the page under 550px of height; the search field turns canvas on the tile; the single facets
 * still ride in the GET form as hidden fields. 'row' (/certifications, /projects) keeps BAR_STICKY_CLASS and
 * FORM_ROW_CLASS exactly as they were.
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FilterBar } from '@/components/console/filter-bar';
import {
  BAR_STICKY_CLASS,
  BAR_STICKY_TILE_CLASS,
  FORM_ROW_CLASS,
  FORM_TILE_CLASS,
  SEARCH_FIELD_CLASS,
} from '@/components/console/filter-bar/filter-bar-classes';
import { FilterBarSkeleton } from '@/components/console/filter-bar/skeleton';
import { Harness } from './harness';

afterEach(cleanup);

/** An element's classes, one per entry. */
const classesOf = (element: Element | null): string[] =>
  (element?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

/** A sticky bar in `density`, with one category chosen. */
function renderBar(density?: 'row' | 'bar'): HTMLElement {
  render(
    <Harness initial="?category=tools&q=cli">
      {() => (
        <FilterBar.Root sticky density={density}>
          <FilterBar.Search />
          <FilterBar.Facets>
            <FilterBar.Chips facet="category" layout="scroll" />
          </FilterBar.Facets>
        </FilterBar.Root>
      )}
    </Harness>,
  );
  const bar = document.querySelector<HTMLElement>('search[data-filter-part="bar"]');
  if (!bar) throw new Error('no bar');
  return bar;
}

describe("FilterBar.Root density='bar'", () => {
  it('marks the landmark with its density and stickiness', () => {
    const bar = renderBar('bar');

    expect(bar).toHaveAttribute('data-density', 'bar');
    expect(bar).toHaveAttribute('data-sticky', '');
  });

  it('sticks in the slimmer band, the same at every width', () => {
    const classes = classesOf(renderBar('bar'));

    expect(classes).toEqual(expect.arrayContaining(BAR_STICKY_TILE_CLASS.split(' ')));
    expect(classes).not.toContain('@min-[48rem]/page:py-3');
    expect(classes).not.toContain('py-2');
    expect(BAR_STICKY_TILE_CLASS).not.toMatch(/@min-\[48rem\]\/page:p[ty]?-/);
    // Still the kit's sticky bar: the top edge, above the haze, painted only while stuck.
    expect(classes).toEqual(
      expect.arrayContaining([
        'sticky',
        'z-30',
        'stuck-canvas',
        'top-[env(safe-area-inset-top,0px)]',
      ]),
    );
  });

  it('draws no line of its own when stuck: the tile’s border is the edge', () => {
    const classes = classesOf(renderBar('bar'));

    expect(classes.some((name) => name.includes('--stuck-edge'))).toBe(false);
    // Row density keeps its hairline under the band: it has no tile border.
    expect(BAR_STICKY_CLASS).toContain('[--stuck-edge:0_1px_0_var(--hairline)]');
  });

  it('stops sticking on a screen under 550px tall, where it would outgrow the scroll padding', () => {
    // Under 550px of height the top band (and html's scroll-padding) is 14svh: 54.6px at 390px
    // tall, less than the 66-70px stuck tile, so a focused card would scroll in under it.
    expect(classesOf(renderBar('bar'))).toContain('[@media(height<34.375rem)]:static');
    expect(BAR_STICKY_CLASS).not.toContain('34.375rem');
  });

  it('puts the row on a tile whose padding does not grow from 48rem', () => {
    const form = renderBar('bar').querySelector('form');

    expect(form?.getAttribute('class')).toBe(FORM_TILE_CLASS);
    expect(FORM_TILE_CLASS).not.toContain('@min-[48rem]/page:p-3');
    expect(classesOf(form)).toEqual(
      expect.arrayContaining(['rounded-tile', 'border-hairline', 'bg-surface-1', 'p-2']),
    );
  });

  it('turns the search field canvas on the tile', () => {
    const field = renderBar('bar').querySelector('label');

    expect(field?.getAttribute('class')).toBe(SEARCH_FIELD_CLASS);
    expect(SEARCH_FIELD_CLASS).toContain('[[data-density=bar]_&]:bg-canvas');
  });

  it('keeps the chosen category in the GET form as a hidden field', () => {
    const form = renderBar('bar').querySelector('form');

    expect(form).toHaveAttribute('method', 'get');
    expect(form?.querySelector('input[type="hidden"][name="category"]')).toHaveValue('tools');
  });

  it('draws the same band in its skeleton', () => {
    render(<FilterBarSkeleton sticky density="bar" />);
    const skeleton = document.querySelector('[role="status"][data-filter-part="bar"]');

    expect(classesOf(skeleton)).toEqual(expect.arrayContaining(BAR_STICKY_TILE_CLASS.split(' ')));
    expect(classesOf(skeleton)).not.toContain('@min-[48rem]/page:py-3');
  });
});

describe("FilterBar.Root density='row'", () => {
  it('keeps the row bar exactly as it was', () => {
    const bar = renderBar();

    expect(bar).toHaveAttribute('data-density', 'row');
    expect(classesOf(bar)).toEqual(expect.arrayContaining(BAR_STICKY_CLASS.split(' ')));
    expect(BAR_STICKY_CLASS).toContain('@min-[48rem]/page:py-3');
    expect(bar.querySelector('form')?.getAttribute('class')).toBe(FORM_ROW_CLASS);
  });
});
