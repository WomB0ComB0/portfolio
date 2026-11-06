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
 * @file FilterBar sticks only from lg. H2's shell stopped clipping the column (overflow-y-hidden
 * broke position: sticky), which switched on the bar's old `sticky top-24`: on a phone the
 * 163 px bar stayed on screen with the bottom bar and left a few hundred pixels for the list.
 * Below lg the bar is static now; from lg it sticks 1rem from the top, and the results count
 * that hangs under it (over the cards while it sticks) is an opaque chip, not bare text. The
 * /projects loading skeleton repeats the bar's box, so it must not drift from the real one.
 * Whether the bar really scrolls away is a layout question for the browser checks.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectsListSkeleton } from '@/app/(routes)/(main)/(professioal)/projects/_components/projects-skeleton';
import { FilterBar } from '@/components/ui/filter-bar';

const noop = (): void => undefined;

/** Position, inset and stacking classes that apply at every width (no breakpoint prefix). */
const UNPREFIXED_STICKY = /^(?:sticky|fixed|-?top-|z-)/;

/** An opacity-modified colour (bg-primary/30, bg-background/60): see the H1 contrast lesson. */
const OPACITY_MODIFIED_BG = /^bg-[a-z-]+\/\d+$/;

const renderBar = (hasActiveFilters: boolean): HTMLElement => {
  const { container } = render(
    <FilterBar
      searchQuery={hasActiveFilters ? 'cloud' : ''}
      onSearchChange={noop}
      filters={[]}
      onClear={noop}
      hasActiveFilters={hasActiveFilters}
      resultsCount={2}
      totalCount={15}
      entityName="projects"
    />,
  );
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) throw new Error('FilterBar rendered no root element');
  return root;
};

const classesOf = (element: Element): string[] => [...element.classList];

afterEach(cleanup);

describe("FilterBar's outer box", () => {
  it('is static below lg: no unprefixed sticky, offset or z-index', () => {
    const root = renderBar(false);

    expect(classesOf(root).filter((name) => UNPREFIXED_STICKY.test(name))).toEqual([]);
  });

  it('sticks from lg, 1rem from the top, under the rail (z-40)', () => {
    const root = renderBar(false);

    expect(root).toHaveClass('lg:sticky', 'lg:top-4', 'lg:z-30');
  });

  it('stays positioned at every width, so the results count hangs from the bar', () => {
    const root = renderBar(true);

    expect(root).toHaveClass('relative');
    expect(root).toContainElement(screen.getByText('Showing 2 of 15 projects'));
  });
});

describe("FilterBar's results count", () => {
  const chipOf = (): HTMLElement => {
    const text = screen.getByText('Showing 2 of 15 projects');
    const chip = text.parentElement;
    if (!chip) throw new Error('the count has no wrapper');
    return chip;
  };

  it('is an opaque chip, readable over the cards while the bar sticks', () => {
    renderBar(true);
    const chip = chipOf();

    expect(chip).toHaveClass('absolute', 'bg-surface-1', 'border-hairline', 'rounded-full');
    expect(classesOf(chip).filter((name) => OPACITY_MODIFIED_BG.test(name))).toEqual([]);
  });

  it('keeps its muted text and tabular figures', () => {
    renderBar(true);

    expect(chipOf()).toHaveClass('text-muted-foreground');
    expect(screen.getByText('Showing 2 of 15 projects')).toHaveClass('tabular-nums');
  });
});

describe('the /projects loading skeleton', () => {
  it("uses the filter bar's own outer box, so loading never sticks where the bar does not", () => {
    const barClass = renderBar(false).className;
    cleanup();

    render(<ProjectsListSkeleton />);
    const status = screen.getByRole('status', { name: 'Loading projects' });
    const skeletonBar = status.firstElementChild;

    expect(skeletonBar?.className).toBe(barClass);
  });
});
