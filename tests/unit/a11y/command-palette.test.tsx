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
 * @file axe on the open ⌘K palette (audit 2026-11-20 moderate 1 and minor 1): a named modal
 * dialog over an inert page, section names that are not options, a named results region, and,
 * with no matches, a "No results" status and no aria-activedescendant pointing at a missing row.
 * The palette renders in a portal, so the whole body is checked.
 *
 * Set up as command-palette-dialog.test.tsx sets it up: jsdom has no Web Animations API (the
 * animator's animate is stubbed) and lays nothing out (every box is given a size, so the
 * virtualised list renders its rows).
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { Palette } from '@/components/cmd';
import { expectNoAxeViolations } from '../../utils/axe';

const originalAnimate = Element.prototype.animate;
const LAID_OUT_PX = 400;

beforeEach(() => {
  Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation);
  for (const property of ['clientHeight', 'clientWidth', 'offsetHeight', 'offsetWidth'] as const) {
    vi.spyOn(HTMLElement.prototype, property, 'get').mockReturnValue(LAID_OUT_PX);
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Element.prototype.animate = originalAnimate;
});

/** The palette as the site mounts it, after a control on the page behind it. */
const renderPalette = () =>
  render(
    <main>
      <h1>Behind the palette</h1>
      <button type="button">A control behind it</button>
      <KBarProvider>
        <Palette />
      </KBarProvider>
    </main>,
  );

/** Opens the palette with Ctrl+K and returns its search box once kbar has finished opening. */
const openPalette = async (): Promise<HTMLElement> => {
  act(() => {
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'k',
      code: 'KeyK',
      ctrlKey: true,
    });
  });
  const search = await screen.findByRole('combobox');
  await waitFor(() => expect(search).toHaveAttribute('aria-expanded', 'true'));
  return search;
};

describe('the command palette under axe', () => {
  it('finds nothing to fix while open with results', async () => {
    renderPalette();
    await openPalette();

    expect(screen.getByRole('dialog', { name: 'Command menu' })).toBeInTheDocument();
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
    await expectNoAxeViolations(document.body, { label: 'the open command menu' });
  });

  it('finds nothing to fix while open with no results', async () => {
    renderPalette();
    const search = await openPalette();

    fireEvent.change(search, { target: { value: 'zzqxj' } });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No results'));

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    await expectNoAxeViolations(document.body, { label: 'the command menu with no results' });
  });
});
