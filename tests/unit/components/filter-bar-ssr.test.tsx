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
 * @file FilterBar names the applied filter in the server HTML. Radix fills a select's trigger
 * from the chosen item through a portal that exists only after hydration, so without the label
 * passed in, a shared ?category= link showed a blank, unnamed combobox until JavaScript ran.
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { type ReactElement, useState } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterBar, type FilterConfig } from '@/components/ui/filter-bar';

const CATEGORY_PLACEHOLDER = 'All Categories';
const ISSUER_PLACEHOLDER = 'All Issuers';
const ISSUER_OPTIONS = [
  { value: 'aws', label: 'Amazon Web Services' },
  { value: 'gcp', label: 'Google Cloud' },
];

const noop = (): void => undefined;

const categoryFilter = (value: string, onChange: (value: string) => void = noop): FilterConfig => ({
  value,
  onChange,
  options: ['Mobile', 'Web'],
  placeholder: CATEGORY_PLACEHOLDER,
  icon: <span aria-hidden="true">#</span>,
});

const issuerFilter = (value: string): FilterConfig => ({
  value,
  onChange: noop,
  options: ISSUER_OPTIONS,
  placeholder: ISSUER_PLACEHOLDER,
  icon: <span aria-hidden="true">@</span>,
});

const bar = (filters: FilterConfig[]): ReactElement => (
  <FilterBar
    searchQuery=""
    onSearchChange={noop}
    filters={filters}
    onClear={noop}
    hasActiveFilters={false}
    resultsCount={3}
    totalCount={3}
    entityName="projects"
  />
);

/** The server HTML parsed into a detached container, so the triggers can be queried. */
const serverRender = (element: ReactElement): HTMLElement => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(element);
  return container;
};

const triggersIn = (container: HTMLElement): HTMLElement[] =>
  within(container).getAllByRole('combobox');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('FilterBar in the server HTML', () => {
  it('names the "all" choice with the placeholder', () => {
    const [trigger] = triggersIn(serverRender(bar([categoryFilter('all')])));

    expect(trigger).toHaveTextContent(CATEGORY_PLACEHOLDER);
  });

  it('names a chosen plain option with its text', () => {
    const [trigger] = triggersIn(serverRender(bar([categoryFilter('Web')])));

    expect(trigger).toHaveTextContent('Web');
    expect(trigger).not.toHaveTextContent(CATEGORY_PLACEHOLDER);
  });

  it('names a chosen labelled option with its label, not its value', () => {
    const [trigger] = triggersIn(serverRender(bar([issuerFilter('gcp')])));

    expect(trigger).toHaveTextContent('Google Cloud');
    expect(trigger?.textContent ?? '').not.toContain('gcp');
  });

  it('shows the raw value when it is not among the options', () => {
    const [trigger] = triggersIn(serverRender(bar([categoryFilter('Retro')])));

    expect(trigger).toHaveTextContent('Retro');
  });

  it('shows the placeholder for an empty value', () => {
    const [trigger] = triggersIn(serverRender(bar([categoryFilter('')])));

    expect(trigger).toHaveTextContent(CATEGORY_PLACEHOLDER);
  });

  it('names each select independently', () => {
    const [category, issuer] = triggersIn(
      serverRender(bar([categoryFilter('Mobile'), issuerFilter('all')])),
    );

    expect(category).toHaveTextContent('Mobile');
    expect(issuer).toHaveTextContent(ISSUER_PLACEHOLDER);
  });
});

/** A FilterBar whose one category select is controlled, as the explorers control it from ?category. */
function ControlledBar({ onChange }: { onChange: (value: string) => void }): ReactElement {
  const [category, setCategory] = useState('all');
  return bar([
    categoryFilter(category, (value) => {
      onChange(value);
      setCategory(value);
    }),
  ]);
}

describe('FilterBar on the client', () => {
  it('hydrates the server HTML for a chosen value without a mismatch', async () => {
    const tree = bar([categoryFilter('Web'), issuerFilter('aws')]);
    const container = serverRender(tree);
    document.body.append(container);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onRecoverableError = vi.fn();

    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    const [category, issuer] = triggersIn(container);
    expect(category).toHaveTextContent('Web');
    expect(issuer).toHaveTextContent('Amazon Web Services');
    act(() => root?.unmount());
    consoleError.mockRestore();
  });

  it('still opens, picks an option, and names the new choice once', () => {
    const onChange = vi.fn<(value: string) => void>();
    render(<ControlledBar onChange={onChange} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent(CATEGORY_PLACEHOLDER);

    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Web' }));

    expect(onChange).toHaveBeenCalledWith('Web');
    expect(trigger.textContent).toBe('#Web');
  });
});
