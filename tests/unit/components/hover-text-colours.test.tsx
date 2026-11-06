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
 * @file Hover colours that must stay readable now that spans inherit their parent's colour.
 *
 * `--primary-foreground` is a near-black text colour meant for primary backgrounds. Text that
 * switches to it on hover without a primary background, or keeps it while the background
 * switches to another surface, ends up dark on dark. The mobile menu's current page is a
 * brand-subtle fill with brand-ink text (tested at 4.5:1 in token-contrast.test.ts), which no
 * hover changes; other pages keep the light foreground on the surface-3 hover.
 */

import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Licenses } from '@/app/(routes)/(legal)/licenses/_interface/licenses';
import { MobileMenuOverlay } from '@/components/layout/mobile-menu-overlay';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// The full '@/components' barrel initialises Firebase; the licenses page only needs MagicCard.
vi.mock('@/components', async () => ({
  MagicCard: (await import('@/components/magicui')).MagicCard,
}));
// The page shell (nav, footer, command palette) is not under test.
vi.mock('@/components/layout/layout', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

type OverlayQuery = Parameters<typeof MobileMenuOverlay>[0]['query'];

const renderOverlay = (pathname: string) =>
  render(
    <MobileMenuOverlay
      isOpen
      onClose={() => {}}
      pathname={pathname}
      query={{ toggle: vi.fn() } as unknown as OverlayQuery}
    />,
  );

const homeNavLink = (): HTMLElement =>
  within(screen.getByRole('navigation')).getByRole('link', { name: 'Home' });

/** Every class on the element and its descendants. */
const classesWithin = (element: HTMLElement): string[] =>
  [element, ...element.querySelectorAll('*')].flatMap((node) =>
    (node.getAttribute('class') ?? '').split(/\s+/).filter(Boolean),
  );

describe('MobileMenuOverlay Home item', () => {
  it('marks Home with brand-ink on brand-subtle while it is the current page, with no hover swap', () => {
    renderOverlay('/');

    const link = homeNavLink();
    expect(link).toHaveClass('bg-brand-subtle', 'text-brand-ink');
    expect(link).not.toHaveClass('bg-primary/95');
    const classes = classesWithin(link);
    expect(classes.filter((name) => name.startsWith('hover:'))).toEqual([]);
    expect(classes.filter((name) => name.includes('primary-foreground'))).toEqual([]);
  });

  it('uses the surface-3 hover and the light foreground on other pages', () => {
    renderOverlay('/projects');

    const link = homeNavLink();
    expect(link).toHaveClass('hover:bg-surface-3', 'text-foreground');
    expect(link).not.toHaveClass('bg-primary/95');
    expect(link).not.toHaveClass('bg-brand-subtle');
    expect(classesWithin(link).filter((name) => name.includes('primary-foreground'))).toEqual([]);
  });
});

describe('Licenses links', () => {
  it('never hover to the dark primary-foreground colour on the card surface', () => {
    render(<Licenses />);

    const links = [
      screen.getByText('CC BY 4.0').closest('a'),
      screen.getByText('contact me').closest('a'),
    ];
    for (const link of links) {
      expect(link).toHaveClass('text-primary', 'hover:text-foreground');
      expect(link).not.toHaveClass('hover:text-primary-foreground');
    }
  });
});
