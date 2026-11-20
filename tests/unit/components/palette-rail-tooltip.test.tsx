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
 * @file The rail's "Command menu" tooltip shows on hover and on keyboard focus, and Escape hides
 * it without moving focus or the pointer (WCAG 1.4.13, audit 2026-11-20 minor 2). It stays hidden
 * until both the pointer and focus have left the button; the next hover or focus shows it again.
 * While shown on hover it takes the pointer, and a transparent bridge spans the gap to the button,
 * so the pointer can move onto it without it fading (1.4.13's "hoverable").
 *
 * jsdom applies no Tailwind CSS and has no :hover or :focus-visible, so "shown" is the class
 * contract: the hover and focus-visible classes are on the tooltip, or left off it.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NavBar } from '@/components/layout/nav';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

const SHOWN = [
  'group-hover/palette:opacity-100',
  'group-focus-visible/palette:opacity-100',
  'group-hover/palette:pointer-events-auto',
];

function renderRail() {
  render(
    <KBarProvider>
      <NavBar path="/" />
    </KBarProvider>,
  );
  const button = screen.getByRole('button', { name: 'Open command menu' });
  const tip = button.querySelector<HTMLElement>('[data-palette-tip]');
  if (!tip) throw new Error('no tooltip in the command menu button');
  return { button, tip };
}

const isShowable = (tip: HTMLElement): boolean =>
  SHOWN.every((name) => tip.classList.contains(name));

describe('the command menu tooltip', () => {
  it('shows on hover and on keyboard focus, and stays out of the accessibility tree', () => {
    const { tip } = renderRail();

    expect(isShowable(tip)).toBe(true);
    expect(tip).toHaveAttribute('aria-hidden', 'true');
    expect(tip).toHaveTextContent('Command menu');
  });

  it('can be hovered: it takes the pointer only while shown, across a bridge to the button', () => {
    const { button, tip } = renderRail();

    // At rest, and once dismissed, an invisible tooltip never catches a hover or a click.
    expect(tip).toHaveClass('pointer-events-none', 'group-hover/palette:pointer-events-auto');
    // The 16px gap (ml-4) is covered from the tooltip's left edge back onto the button, which
    // owns the tooltip, so the pointer crossing it keeps the button hovered.
    expect(tip).toHaveClass(
      'before:absolute',
      'before:inset-y-0',
      'before:right-full',
      'before:w-5',
      'before:content-[""]',
    );

    fireEvent.pointerEnter(button);
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(tip).not.toHaveClass('group-hover/palette:pointer-events-auto');
    expect(tip).toHaveClass('pointer-events-none');
  });

  it('hides on Escape while the button has focus, and focus stays on the button', () => {
    const { button, tip } = renderRail();
    act(() => button.focus());

    fireEvent.keyDown(button, { key: 'Escape' });

    expect(isShowable(tip)).toBe(false);
    expect(tip).toHaveClass('opacity-0');
    expect(button).toHaveFocus();
  });

  it('hides on Escape while the pointer rests on the button, wherever focus is', () => {
    const { button, tip } = renderRail();
    fireEvent.pointerEnter(button);

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(isShowable(tip)).toBe(false);
  });

  it('shows again once both the pointer and focus have left and one comes back', () => {
    const { button, tip } = renderRail();
    act(() => button.focus());
    fireEvent.pointerEnter(button);
    fireEvent.keyDown(button, { key: 'Escape' });

    fireEvent.pointerLeave(button);
    expect(isShowable(tip)).toBe(false);

    act(() => button.blur());
    expect(isShowable(tip)).toBe(true);
  });

  it('ignores Escape when the button is neither hovered nor focused', () => {
    const { tip } = renderRail();

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(isShowable(tip)).toBe(true);
  });
});
