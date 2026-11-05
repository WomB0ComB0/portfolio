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
 * @file The phone and tablet menu reaches every page the desktop rail does, is a named modal
 * dialog, marks the current page, and hands focus back to the Menu button when it closes.
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { Palette } from '@/components/cmd';
import { MobileMenuOverlay } from '@/components/layout/mobile-menu-overlay';
import { MobileNavBar } from '@/components/layout/mobile-nav';
import { NavbarItems } from '@/constants/client';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

type OverlayQuery = Parameters<typeof MobileMenuOverlay>[0]['query'];

const SITE_MENU = 'Site menu';

const renderOverlay = (pathname: string) =>
  render(
    <MobileMenuOverlay
      isOpen
      onClose={() => {}}
      pathname={pathname}
      query={{ toggle: vi.fn() } as unknown as OverlayQuery}
    />,
  );

const renderBar = (path = '/') =>
  render(
    <KBarProvider>
      <MobileNavBar path={path} />
    </KBarProvider>,
  );

const menuButton = () => screen.getByRole('button', { name: 'Open navigation menu' });

const openMenu = () => {
  fireEvent.click(menuButton());
  return screen.getByRole('dialog', { name: SITE_MENU });
};

/** Lets the overlay's deferred focus move run, as a browser would on the next task. */
const flushFocus = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe('MobileMenuOverlay contents', () => {
  it('is a modal dialog named "Site menu"', () => {
    renderOverlay('/');

    const dialog = screen.getByRole('dialog', { name: SITE_MENU });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('links every page in the nav data, the legal and personal pages included', () => {
    renderOverlay('/');

    const dialog = screen.getByRole('dialog', { name: SITE_MENU });
    for (const name of ['Guestbook', 'Places', 'Spotify', 'Privacy', 'Cookies', 'Licenses']) {
      expect(within(dialog).getByRole('link', { name })).toBeInTheDocument();
    }
    for (const item of NavbarItems) {
      expect(within(dialog).getByRole('link', { name: item.name })).toHaveAttribute(
        'href',
        item.slug,
      );
    }
  });

  it('puts each page under a heading for its group, in the rail order', () => {
    renderOverlay('/');

    const dialog = screen.getByRole('dialog', { name: SITE_MENU });
    const headings = within(dialog)
      .getAllByRole('heading')
      .map((heading) => heading.textContent?.trim());
    expect(headings).toEqual([SITE_MENU, 'Professional', 'Developer', 'Personal', 'Legal']);

    const legal = within(dialog).getByRole('list', { name: 'Legal' });
    expect(
      within(legal)
        .getAllByRole('link')
        .map((link) => link.textContent?.trim()),
    ).toEqual(['Cookies', 'Privacy', 'Licenses']);
  });

  it('marks only the current page with aria-current="page"', () => {
    renderOverlay('/places');

    const dialog = screen.getByRole('dialog', { name: SITE_MENU });
    expect(within(dialog).getByRole('link', { name: 'Places' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const current = within(dialog)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
  });
});

describe('MobileNavBar menu button', () => {
  it('reports the menu state and points at the dialog it opens', () => {
    renderBar();

    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton()).toHaveAttribute('aria-haspopup', 'dialog');

    const dialog = openMenu();

    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    expect(menuButton()).toHaveAttribute('aria-controls', dialog.id);
  });

  it('moves focus into the dialog when it opens', async () => {
    renderBar();

    const dialog = openMenu();
    await flushFocus();

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('returns focus to the Menu button when the Close button closes the menu', async () => {
    renderBar();
    const dialog = openMenu();
    await flushFocus();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close menu' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(menuButton()).toHaveFocus();
  });

  it('returns focus to the Menu button when Escape closes the menu', async () => {
    renderBar();
    openMenu();
    await flushFocus();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(menuButton()).toHaveFocus();
  });

  it('closes when a page link is followed, handing focus back too', async () => {
    renderBar('/');
    const dialog = openMenu();
    await flushFocus();

    fireEvent.click(within(dialog).getByRole('link', { name: 'Guestbook' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(menuButton()).toHaveFocus();
  });

  it('leaves focus in the palette search when its Command Menu item opens the palette', async () => {
    // jsdom has no Web Animations API; KBarAnimator only starts and forgets its animations.
    const originalAnimate = Element.prototype.animate;
    Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation);
    onTestFinished(() => {
      Element.prototype.animate = originalAnimate;
    });
    render(
      <KBarProvider>
        <Palette />
        <MobileNavBar path="/" />
      </KBarProvider>,
    );
    const dialog = openMenu();
    await flushFocus();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Open command menu' }));
    await flushFocus();

    expect(screen.queryByRole('dialog', { name: SITE_MENU })).not.toBeInTheDocument();
    expect(await screen.findByRole('combobox')).toHaveFocus();
  });
});
