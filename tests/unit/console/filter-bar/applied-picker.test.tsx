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
 * @file FilterBar.Applied (one removable token per facet value, then Clear all, each a link
 * that works without JavaScript) with its focus rules: after a token goes, focus moves to the
 * next token, then the previous one, then the current chip, then the search, never scrolling the
 * page to reach what is already on screen. And
 * FilterBar.Picker, the multi-select: a button that opens a popover (natively, without
 * JavaScript), checkboxes named for the facet, its own search with a status line, the most-used
 * options first, and an Apply button only for visitors without JavaScript.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FullBar } from './harness';
import { wideLayout } from './wide-layout';

let narrow: () => void;

beforeEach(() => {
  narrow = wideLayout();
});
afterEach(() => {
  cleanup();
  narrow();
});

const applied = (): HTMLElement => screen.getByRole('list', { name: 'Applied filters' });
const token = (name: string): HTMLElement => within(applied()).getByRole('link', { name });
const results = (): string[] =>
  within(screen.getByRole('list', { name: 'Results' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');

describe('FilterBar.Applied', () => {
  it('shows nothing while no facet narrows the list (the search shows in its field)', () => {
    render(<FullBar initial="?q=a" />);

    expect(screen.queryByRole('list', { name: 'Applied filters' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Clear all' })).toBeNull();
  });

  it('names each value with its facet, as a link to the URL without it', () => {
    render(<FullBar initial="?category=tools&tech=go&tech=python&q=a" />);

    expect(
      within(applied())
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Kind: Tools', 'Technology: Go', 'Technology: Python']);
    expect(token('Remove Kind: Tools')).toHaveAttribute(
      'href',
      '/projects?tech=go&tech=python&q=a',
    );
    expect(token('Remove Technology: Go')).toHaveAttribute(
      'href',
      '/projects?category=tools&tech=python&q=a',
    );
    expect(screen.getByRole('link', { name: 'Clear all' })).toHaveAttribute('href', '/projects');
  });

  it('moves focus to the next token, then the previous one, then the current chip', () => {
    render(<FullBar initial="?category=tools&tech=go&tech=python" />);

    fireEvent.click(token('Remove Technology: Go'));
    expect(document.activeElement).toBe(token('Remove Technology: Python'));

    fireEvent.click(token('Remove Technology: Python'));
    expect(document.activeElement).toBe(token('Remove Kind: Tools'));

    fireEvent.click(token('Remove Kind: Tools'));
    const all = within(screen.getByRole('list', { name: 'Filter by kind' })).getByRole('link', {
      name: /^All/,
    });
    expect(document.activeElement).toBe(all);
    expect(results()).toHaveLength(5);
  });

  it('moves focus without scrolling the page: the next token and the bar are on screen', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    render(<FullBar initial="?category=tools&tech=go" />);

    fireEvent.click(token('Remove Technology: Go'));
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });

    fireEvent.click(token('Remove Kind: Tools'));
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(document.activeElement).toHaveAttribute('aria-current', 'true');
    focus.mockRestore();
  });

  it('Clear all removes every filter, the search too, and hands focus to the current chip', () => {
    render(<FullBar initial="?category=tools&tech=python&q=bot" />);

    fireEvent.click(screen.getByRole('link', { name: 'Clear all' }));

    expect(results()).toHaveLength(5);
    expect(screen.getByRole('searchbox', { name: 'Search projects' })).toHaveValue('');
    expect(document.activeElement).toHaveAttribute('aria-current', 'true');
  });
});

describe('FilterBar.Picker', () => {
  const trigger = (): HTMLElement => screen.getByRole('button', { name: /^Technology/ });
  const panel = (): HTMLElement =>
    document.getElementById(trigger().getAttribute('popovertarget') ?? '') as HTMLElement;
  const options = (): string[] =>
    within(panel())
      .getAllByRole('checkbox')
      .filter((box) => !box.closest('[hidden]'))
      .map((box) => box.closest('label')?.textContent ?? '');

  it('opens a popover of checkboxes named for the facet, with a legend', () => {
    render(<FullBar initial="?tech=go" />);

    expect(panel()).toHaveAttribute('popover', 'auto');
    expect(within(panel()).getByRole('group', { name: 'Technology' })).toBeInTheDocument();
    expect(trigger()).toHaveTextContent('Technology 1');
    const boxes = within(panel()).getAllByRole('checkbox');
    expect(boxes.every((box) => box.getAttribute('name') === 'tech')).toBe(true);
    expect(within(panel()).getByRole('checkbox', { name: /^Go/ })).toBeChecked();
  });

  it('lists options by use with live counts, a checked one first', () => {
    render(<FullBar initial="?tech=go" />);

    expect(options()).toEqual([
      'Go 1',
      'React 3',
      'Python 2',
      'TypeScript 2',
      'Cobra 1',
      'Tailwind CSS 1',
    ]);
  });

  it('toggles a value at once: OR within the facet', () => {
    render(<FullBar />);

    fireEvent.click(within(panel()).getByRole('checkbox', { name: /^Go/ }));
    expect(results()).toEqual(['Alpha CLI']);
    fireEvent.click(within(panel()).getByRole('checkbox', { name: /^Python/ }));
    expect(results()).toEqual(['Alpha CLI', 'Gamma hack', 'Epsilon bot']);
    fireEvent.click(within(panel()).getByRole('checkbox', { name: /^Go/ }));
    expect(results()).toEqual(['Gamma hack', 'Epsilon bot']);
  });

  it('narrows its own options with its own search, and says how many show', () => {
    render(<FullBar />);
    const find = within(panel()).getByRole('searchbox', { name: 'Filter technologies' });

    fireEvent.change(find, { target: { value: 'ty' } });

    expect(options()).toEqual(['TypeScript 2']);
    // A polite line, not a second status role: the page's FilterBar.Status is the one status.
    expect(panel().querySelector('[aria-live="polite"]')).toHaveTextContent('1 of 6 shown');
  });

  it('offers an Apply button only to visitors without JavaScript', () => {
    render(<FullBar />);

    expect(panel().querySelector('noscript')).not.toBeNull();
    expect(within(panel()).queryByRole('button', { name: 'Apply' })).toBeNull();
  });
});
