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
 * @file The FilterBar family in the server HTML. A shared link's filters show before JavaScript
 * runs (the current chip, the checked option, the typed search), every control is named there,
 * and hydrating that HTML raises no mismatch. These checks moved here from the old select bar
 * (src/components/ui/filter-bar.tsx), retired once /places joined the family.
 */

import { act, within } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FullBar } from './harness';
import { wideLayout } from './wide-layout';

/** A shared link with a chip, a checked option and a search. */
const LINK = '?category=tools&tech=go&q=cli';

/** The server HTML for the bar at `initial`, parsed into a container on the page. */
const serverRender = (initial: string): HTMLElement => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(<FullBar initial={initial} />);
  document.body.append(container);
  return container;
};

let narrow: () => void;

// From a 48rem page the chips sit in the bar; jsdom computes no container query.
beforeEach(() => {
  narrow = wideLayout();
});
afterEach(() => {
  document.body.innerHTML = '';
  narrow();
});

describe('FilterBar in the server HTML', () => {
  it('names the search and the chip list before hydration', () => {
    const html = within(serverRender(''));

    expect(html.getByRole('searchbox', { name: 'Search projects' })).toBeTruthy();
    expect(html.getByRole('list', { name: 'Filter by kind' })).toBeTruthy();
  });

  it('shows a shared link’s filters: the current chip, the checked option, the search', () => {
    const container = serverRender(LINK);
    const html = within(container);
    const kinds = html.getByRole('list', { name: 'Filter by kind' });

    expect(within(kinds).getByRole('link', { current: true })).toHaveTextContent(/^Tools/);
    expect(container.querySelector('input[name="tech"][value="go"]')).toBeChecked();
    expect(html.getByRole('searchbox', { name: 'Search projects' })).toHaveValue('cli');
  });

  it('hydrates that HTML without a mismatch', async () => {
    const container = serverRender(LINK);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onRecoverableError = vi.fn();

    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, <FullBar initial={LINK} />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    act(() => root?.unmount());
    consoleError.mockRestore();
  });
});
