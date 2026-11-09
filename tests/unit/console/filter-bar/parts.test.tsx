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
 * @file The FilterBar family's parts, each reading only the FilterModel: the labelled <search>
 * landmark around a GET form (hidden fields for the single facets, so a search without
 * JavaScript keeps them), the search field, link chips with aria-current and disjunctive counts
 * (a chip at 0 stays, quieter, and still works), the sticky bar (the column's width, painted
 * only while stuck, and the page held still when focus moves into it), the phone's Filters button
 * and sheet, the
 * count, the always-present status line and the empty state that names what removed everything.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FilterBar } from '@/components/console/filter-bar';
import { FilterBarSkeleton } from '@/components/console/filter-bar/skeleton';
import { type PageScroll, stubPageScroll } from '../../dom/page-scroll';
import { FullBar, Harness, ResultList } from './harness';
import { wideLayout } from './wide-layout';

let narrow: () => void;

beforeEach(() => {
  narrow = wideLayout();
});
afterEach(() => {
  cleanup();
  narrow();
});

const results = (): string[] =>
  within(screen.getByRole('list', { name: 'Results' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');
const kinds = (): HTMLElement => screen.getByRole('list', { name: 'Filter by kind' });
const chip = (name: RegExp): HTMLElement => within(kinds()).getByRole('link', { name });
const count = (): HTMLElement | null => document.querySelector('[data-filter-part="count"]');

describe('FilterBar.Root and FilterBar.Search', () => {
  it('is a <search> landmark around a GET form that carries the single facets as hidden fields', () => {
    render(<FullBar initial="?category=tools&tech=go&q=cli" />);
    const form = screen
      .getByRole('searchbox', { name: 'Search projects' })
      .closest('form') as HTMLFormElement;

    expect(form.closest('search')).toHaveAttribute('data-filter-part', 'bar');
    expect(form).toHaveAttribute('action', '/projects');
    expect(form).toHaveAttribute('method', 'get');
    expect(form.querySelector('input[type="hidden"][name="category"]')).toHaveValue('tools');
    // A multi-select facet submits through its own checkboxes, never a hidden copy.
    expect(form.querySelector('input[type="hidden"][name="tech"]')).toBeNull();
    expect(form.querySelector('input[type="checkbox"][name="tech"][value="go"]')).toBeChecked();
  });

  it('marks the bar sticky only when asked', () => {
    render(<FullBar />);

    // jsdom's role table predates <search>; browsers map it to the search landmark.
    expect(document.querySelector('search')).toHaveAttribute('data-sticky', '');
  });

  it('sticks at the column’s width, painted with its hairline only while stuck', () => {
    render(<FullBar />);
    const classes = (document.querySelector('search')?.getAttribute('class') ?? '').split(' ');

    expect(classes).toEqual(
      expect.arrayContaining([
        'sticky',
        'z-30',
        'stuck-canvas',
        '[--stuck-edge:0_1px_0_var(--hairline)]',
      ]),
    );
    // One extent with the year bars and labels under it: no bleed into the gutter.
    expect(classes).not.toContain('-mx-(--page-gutter)');
    expect(classes).not.toContain('bg-canvas');
  });

  describe('focus moving into the stuck bar', () => {
    let page: PageScroll;
    beforeEach(() => {
      page = stubPageScroll(0);
    });
    afterEach(() => page.restore());

    /** As Chrome does: html's scroll-padding scrolls the stuck bar's control, then focusin. */
    const focusSearchAfterJump = (): void => {
      page.scrollBy(2200);
      page.jump(1464);
      screen
        .getByRole('searchbox', { name: 'Search projects' })
        .dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    };

    it('keeps the page where it is', () => {
      render(<FullBar />);
      focusSearchAfterJump();

      expect(page.scrollTo).toHaveBeenCalledWith({ top: 2200, behavior: 'instant' });
    });

    it('is left to the browser when the bar does not stick', () => {
      render(
        <Harness>
          {() => (
            <FilterBar.Root>
              <FilterBar.Search />
            </FilterBar.Root>
          )}
        </Harness>,
      );
      focusSearchAfterJump();

      expect(page.scrollTo).not.toHaveBeenCalled();
    });
  });

  it('labels the search by the noun, names it q, and filters as you type', () => {
    render(<FullBar />);
    const search = screen.getByRole('searchbox', { name: 'Search projects' });

    expect(search).toHaveAttribute('name', 'q');
    expect(search).toHaveAttribute('type', 'search');
    expect(search).toHaveAttribute('maxlength', '40');
    fireEvent.change(search, { target: { value: 'typescript' } });

    expect(search).toHaveValue('typescript');
    expect(results()).toEqual(['Beta app', 'Delta site']);
  });

  it('keeps the page on a submit: the field already filtered', () => {
    render(<FullBar />);
    const form = screen
      .getByRole('searchbox', { name: 'Search projects' })
      .closest('form') as HTMLFormElement;

    expect(fireEvent.submit(form)).toBe(false);
  });
});

describe('FilterBar.Chips', () => {
  it('lists All then every option as a link, with its count and noun', () => {
    render(<FullBar />);

    expect(
      within(kinds())
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'All 5 projects',
      'Tools 2 projects',
      'Apps 1 project',
      'Hackathons 1 project',
      'Websites 1 project',
    ]);
    expect(chip(/^All/)).toHaveAttribute('aria-current', 'true');
    expect(chip(/^Tools/)).toHaveAttribute('href', '/projects?category=tools');
    expect(within(kinds()).getAllByRole('link', { current: true })).toHaveLength(1);
  });

  it('counts with the other filters applied and keeps a chip at 0 in place, quieter', () => {
    render(<FullBar initial="?tech=go" />);

    expect(chip(/^Apps/)).toHaveTextContent('Apps 0 projects');
    expect(chip(/^Apps/)).toHaveAttribute('data-zero', '');
    expect(chip(/^Apps/)).not.toHaveAttribute('aria-disabled');
    expect(chip(/^Tools/)).not.toHaveAttribute('data-zero');
  });

  it('filters in place on a plain click, and leaves a modified click to the browser', () => {
    render(<FullBar />);

    expect(fireEvent.click(chip(/^Tools/), { ctrlKey: true })).toBe(true);
    expect(results()).toHaveLength(5);

    expect(fireEvent.click(chip(/^Tools/))).toBe(false);
    expect(results()).toEqual(['Alpha CLI', 'Epsilon bot']);
    expect(chip(/^Tools/)).toHaveAttribute('aria-current', 'true');
    expect(chip(/^All/)).toHaveAttribute('href', '/projects');

    fireEvent.click(chip(/^All/));
    expect(results()).toHaveLength(5);
  });

  it('slides one aria-hidden pill under the current chip once it has measured', () => {
    render(<FullBar initial="?category=apps" />);
    const pill = kinds().querySelector('[data-filter-part="pill"]');

    expect(pill).toHaveAttribute('aria-hidden', 'true');
    expect(kinds()).toHaveAttribute('data-pill', 'on');
    // The pill draws the current chip's fill now; forced colours keep the chip's own cue.
    expect(chip(/^Apps/).className).not.toMatch(/aria-\[current=true\]:bg-brand-subtle/);
    expect(chip(/^Apps/).className).toMatch(
      /forced-colors:aria-\[current=true\]:bg-\[color:Highlight\]/,
    );
  });
});

describe('FilterBar.Facets: the phone sheet', () => {
  it('opens from a Filters button that counts the facet values in use', () => {
    render(<FullBar initial="?category=tools&tech=go&tech=python" />);
    const button = screen.getByRole('button', { name: /^Filters/ });
    const sheet = document.getElementById(button.getAttribute('popovertarget') ?? '');

    expect(button).toHaveTextContent('Filters 3');
    expect(button).toHaveAttribute('data-active', '');
    expect(sheet).toHaveAttribute('popover', 'auto');
    expect(sheet?.contains(kinds())).toBe(true);
    const done = within(sheet as HTMLElement).getByRole('button', { name: 'Show 2 projects' });
    expect(done).toHaveAttribute('popovertargetaction', 'hide');
  });
});

describe('FilterBar.Count, Status and Empty', () => {
  it('counts what shows, and says nothing to screen readers until a change', () => {
    render(<FullBar />);
    const status = screen.getByRole('status');

    expect(count()).toHaveTextContent('5 projects');
    expect(status).toHaveTextContent(/^$/);

    fireEvent.click(chip(/^Tools/));
    expect(count()).toHaveTextContent('2 of 5 projects');
    expect(status).toHaveTextContent('Showing 2 of 5 projects');
  });

  it('names what removed everything and clears back to every item, focus on All', () => {
    render(<FullBar initial="?q=rust&category=tools" />);
    const empty = screen
      .getByRole('heading', { name: 'No projects match' })
      .closest('[data-state]');

    expect(empty).toHaveAttribute('data-state', 'empty');
    expect(empty).toHaveTextContent(
      'Nothing matches “rust” in Tools. Clear the filters to see all 5.',
    );
    const clear = screen.getByRole('link', { name: 'Clear filters' });
    expect(clear).toHaveAttribute('href', '/projects');

    fireEvent.click(clear);
    expect(results()).toHaveLength(5);
    expect(screen.getByRole('searchbox', { name: 'Search projects' })).toHaveValue('');
    expect(document.activeElement).toBe(chip(/^All/));
  });

  it('marks the results for the crossfade', () => {
    render(<Harness>{(found) => <ResultList results={found} />}</Harness>);

    expect(document.querySelector('[data-filter-part="results"]')).not.toBeNull();
  });
});

describe('FilterBar.Skeleton', () => {
  it('renders on the server with the bar’s own boxes, no client code', () => {
    const html = renderToString(<FilterBarSkeleton chips={4} sticky />);

    expect(html).toContain('data-filter-part="bar"');
    expect(html).toContain('aria-busy="true"');
    expect(html.match(/data-filter-part="chip"/g)).toHaveLength(4);
  });
});

describe('FilterBar outside a Provider', () => {
  it('says what is missing instead of rendering nothing', () => {
    expect(() => render(<FilterBar.Search />)).toThrow(/FilterBar\.Provider/);
  });
});
