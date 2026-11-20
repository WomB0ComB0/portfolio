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
 * @file axe on the phone's bottom bar and its Menu button, closed and open (the 2026-11-20
 * verification: aria-controls named the dialog's id while no element had it, an invalid
 * reference). Open, the menu is a modal dialog in a portal, so the whole body is checked. Set up
 * as mobile-menu-overlay.test.tsx sets it up.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MobileNavBar } from '@/components/layout/mobile-nav';
import { expectNoAxeViolations } from '../../utils/axe';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

const renderBar = () =>
  render(
    <KBarProvider>
      <MobileNavBar path="/places" />
    </KBarProvider>,
  );

const menuButton = (): HTMLElement => screen.getByRole('button', { name: 'Open navigation menu' });

describe('the phone menu under axe', () => {
  it('finds nothing to fix with the menu closed', async () => {
    const { container } = renderBar();

    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton()).not.toHaveAttribute('aria-controls');
    await expectNoAxeViolations(container, { label: 'the phone bar, menu closed' });
  });

  it('finds nothing to fix with the menu open', async () => {
    renderBar();

    fireEvent.click(menuButton());
    // The overlay moves focus into itself on the next task, as a browser would run it.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByRole('dialog', { name: 'Site menu' })).toBeInTheDocument();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    await expectNoAxeViolations(document.body, { label: 'the phone bar, menu open' });
  });
});
