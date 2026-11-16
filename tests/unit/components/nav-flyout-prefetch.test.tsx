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
 * @file A closed flyout's links do not prefetch.
 *
 * next/link prefetches a link once its box is within the viewport, which it tells from an
 * IntersectionObserver: geometry, not visibility. A closed flyout is visibility: hidden but
 * still laid out beside the rail, so without the opt-out every desktop page view would
 * prefetch all thirteen routes. The links take the default again when their flyout opens, which
 * is when they used to mount.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { NavBar } from '@/components/layout/nav';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

interface LinkStandInProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  readonly href: string;
  readonly prefetch?: boolean | 'auto' | null;
}

// Stands in for next/link and writes the prefetch prop where the test can read it.
vi.mock('next/link', () => ({
  default: ({ prefetch, ...anchor }: LinkStandInProps) => (
    <a {...anchor} data-prefetch={prefetch === undefined ? 'default' : String(prefetch)} />
  ),
}));

const renderRail = () =>
  render(
    <KBarProvider>
      <NavBar path="/" />
    </KBarProvider>,
  );

const prefetchOf = (panelId: string): string[] =>
  [...document.querySelectorAll(`#${panelId} a`)].map(
    (anchor) => anchor.getAttribute('data-prefetch') ?? '',
  );

describe('NavBar flyout links and prefetching', () => {
  it('opts every closed flyout link out of prefetching', () => {
    renderRail();

    const closed = [...document.querySelectorAll('[inert] a')];
    expect(closed).toHaveLength(13);
    for (const anchor of closed) expect(anchor).toHaveAttribute('data-prefetch', 'false');
  });

  it("gives an open flyout's links the default prefetch, and takes it back on close", () => {
    renderRail();
    const trigger = screen.getByRole('button', { name: 'Developer section' });

    fireEvent.click(trigger);

    expect(prefetchOf('nav-flyout-developer')).toEqual(['default', 'default', 'default']);
    expect(prefetchOf('nav-flyout-personal')).toEqual(['false', 'false', 'false']);

    fireEvent.click(trigger);

    expect(prefetchOf('nav-flyout-developer')).toEqual(['false', 'false', 'false']);
  });

  it('leaves the Home link, which always shows, on the default', () => {
    renderRail();

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('data-prefetch', 'default');
  });
});
