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
 * @file axe on the desktop rail with its "Command menu" tooltip shown (audit 2026-11-20 minor 2,
 * WCAG 1.4.13): the button hovered and focused, the tooltip inside it hidden from the
 * accessibility tree (the button's own name says the same), so it adds no second name and no
 * focusable content under aria-hidden. Set up as palette-rail-tooltip.test.tsx sets it up; jsdom
 * has no :hover, so "shown" is the tooltip's class contract.
 *
 * The tooltip's words ('Command menu Ctrl K') are the button's own text, so its name starts with
 * them, shortcut included (WCAG 2.5.3, label-content-name-mismatch): 'Command menu, Ctrl K'.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NavBar } from '@/components/layout/nav';
import { expectNoAxeViolations } from '../../utils/axe';
import { expectLabelInName } from '../../utils/label-in-name';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

describe('the rail command-menu tooltip under axe', () => {
  it('finds nothing to fix in the rail with the tooltip shown', async () => {
    const { container } = render(
      <KBarProvider>
        <NavBar path="/" />
      </KBarProvider>,
    );
    const button = screen.getByRole('button', { name: 'Command menu, Ctrl K' });
    const tip = button.querySelector<HTMLElement>('[data-palette-tip]');

    fireEvent.pointerEnter(button);
    act(() => button.focus());

    expect(tip).toHaveClass(
      'group-hover/palette:opacity-100',
      'group-focus-visible/palette:opacity-100',
    );
    expect(tip).toHaveAttribute('aria-hidden', 'true');
    expect(button).toHaveFocus();
    // The name starts with the tooltip's words, the shortcut included.
    expectLabelInName(button);
    await expectNoAxeViolations(container, { label: 'the rail with its tooltip shown' });
  });
});
