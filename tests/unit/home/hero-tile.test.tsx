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
 * @file The home hero as the server sends it: one h1, an avatar that loads first, the ways to get
 * in touch with their spoken names, and the current role line, which streams in behind its own
 * Suspense inside a box that keeps its height (and stays empty when there is no role). Also the
 * "Jump to…" palette button: the shell's shortcut hint and a click that opens the palette.
 *
 * The hero is rendered with react-dom/static's prerender, which waits for the async role line as
 * the server does, then parsed into jsdom to be queried. renderToString gives the first flush
 * (the role line's fallback). jsdom applies no CSS, so sr-only words count in accessible names.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { makeExperience } from '@tests/fixtures/sanity-docs';
import type { AnchorHTMLAttributes, ReactElement, ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ toggle: vi.fn(), loadCurrentRoles: vi.fn() }));

vi.mock('kbar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('kbar')>()),
  useKBar: () => ({ query: { toggle: h.toggle } }),
}));

vi.mock('@/app/_components/home/data/loaders', () => ({
  loadCurrentRoles: h.loadCurrentRoles,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    prefetch,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean | null;
    children?: ReactNode;
  }) => (
    <a {...rest} href={href} data-prefetch={String(prefetch)}>
      {children}
    </a>
  ),
}));

import type { CurrentRoles } from '@/app/_components/home/data/selectors';
import type { TileResult } from '@/app/_components/home/data/tile-result';
import { HERO_POSITIONING, HeroRoleLine, HeroTile } from '@/app/_components/home/tiles/hero-tile';
import { PALETTE_HINT_LABEL, PaletteHint } from '@/app/_components/home/tiles/palette-hint';
import { app } from '@/constants';

const FOUNDER = makeExperience({
  position: 'Founder & CEO',
  company: 'ResQ Systems, Inc.',
  current: true,
  startDate: '2026-03-01',
});

const ROLES: TileResult<CurrentRoles> = {
  status: 'ok',
  data: { roles: [FOUNDER, makeExperience({ current: true })], total: 5 },
  stale: false,
};

/** The hero's HTML once every Suspense boundary has resolved, as the server streams it. */
async function renderHeroHtml(): Promise<void> {
  const { prelude } = await prerender(<HeroTile />);
  document.body.innerHTML = await new Response(prelude).text();
}

/** The box that holds the role line: the h1's next sibling. */
const roleSlot = (): HTMLElement => {
  const slot = screen.getByRole('heading', { level: 1 }).nextElementSibling;
  if (!(slot instanceof HTMLElement)) throw new Error('no role slot after the h1');
  return slot;
};

const setPlatform = (platform: string): void => {
  Object.defineProperty(navigator, 'platform', { value: platform, configurable: true });
};

beforeEach(() => {
  h.loadCurrentRoles.mockResolvedValue(ROLES);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.clearAllMocks();
  Reflect.deleteProperty(navigator, 'platform');
});

describe('HeroTile', () => {
  it('has exactly one h1, named Mike Odnis, in the foreground colour', async () => {
    await renderHeroHtml();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName('Mike Odnis');
    expect(headings[0]).toHaveAttribute('id', 'home-title');
    expect(headings[0]).toHaveClass('text-foreground');
    expect(headings[0]?.className).not.toMatch(/text-brand|text-primary/);
  });

  it('loads the avatar first: eager, high fetch priority, drawn at 96 px', async () => {
    await renderHeroHtml();
    const avatar = screen.getByRole('img', {
      name: "Mike Odnis's avatar: a painting of a scholar writing at his desk",
    });
    expect(avatar).toHaveAttribute('loading', 'eager');
    expect(avatar).toHaveAttribute('fetchpriority', 'high');
    expect(avatar).toHaveAttribute('sizes', '96px');
    expect(avatar).toHaveAttribute('width', '96');
    expect(avatar).toHaveAttribute('height', '96');
  });

  it('lists the contact links with their spoken names, in a list and not a nav', async () => {
    await renderHeroHtml();
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('link')).toHaveLength(4);
    expect(screen.queryByRole('navigation')).toBeNull();

    expect(screen.getByRole('link', { name: 'Email me' })).toHaveAttribute(
      'href',
      `mailto:${app.email}`,
    );
    for (const [name, href] of [
      ['GitHub (opens in a new tab)', 'https://github.com/WomB0ComB0'],
      ['LinkedIn (opens in a new tab)', 'https://www.linkedin.com/in/mikeodnis/'],
    ] as const) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    const resume = screen.getByRole('link', { name: 'Résumé' });
    expect(resume).toHaveAttribute('href', '/resume');
    expect(resume).toHaveAttribute('data-prefetch', 'false');
    expect(resume).not.toHaveAttribute('target');
  });

  it('gives every link a 44 px tall target', async () => {
    await renderHeroHtml();
    for (const link of screen.getAllByRole('link')) expect(link).toHaveClass('h-11');
    expect(screen.getByRole('button', { name: PALETTE_HINT_LABEL })).toHaveClass('h-11');
  });

  it('shows the positioning line', async () => {
    await renderHeroHtml();
    expect(HERO_POSITIONING).toBe('Building web software end to end.');
    expect(screen.getByText(HERO_POSITIONING).tagName).toBe('P');
  });

  it('streams in the first current role beside the word Now and a still amber dot', async () => {
    await renderHeroHtml();
    const slot = roleSlot();
    expect(within(slot).getByText('Founder & CEO at ResQ Systems, Inc.')).toBeInTheDocument();
    expect(within(slot).getByText('Now')).toHaveClass('text-ongoing');
    const dot = slot.querySelector('[data-status-dot]');
    expect(dot).toHaveAttribute('data-tone', 'ongoing');
    expect(dot?.className).not.toMatch(/animate/);
  });

  it.each([
    ['empty', { status: 'empty' }],
    ['error', { status: 'error' }],
  ] as const)(
    'renders no role line when roles are %s, keeping the reserved box',
    async (_, result) => {
      h.loadCurrentRoles.mockResolvedValue(result);
      await renderHeroHtml();
      const slot = roleSlot();
      expect(slot).toHaveClass('min-h-[3em]', '@xl:min-h-[1.5em]');
      expect(slot.textContent).toBe('');
      expect(slot.querySelector('p, [aria-hidden]')).toBeNull();
    },
  );

  it('puts the h1 in the first flush and a placeholder bar in the role box', () => {
    h.loadCurrentRoles.mockReturnValue(new Promise(() => {}));
    document.body.innerHTML = renderToString(<HeroTile />);
    expect(screen.getByRole('heading', { level: 1, name: 'Mike Odnis' })).toBeInTheDocument();
    const bar = roleSlot().querySelector('span[aria-hidden="true"]');
    expect(bar).toHaveClass('h-[1.5em]', 'bg-surface-3');
  });
});

describe('HeroRoleLine', () => {
  it('reads "{position} at {company}" from the first role in Studio order', async () => {
    render((await HeroRoleLine()) as ReactElement);
    expect(screen.getByText('Founder & CEO at ResQ Systems, Inc.')).toBeInTheDocument();
  });

  it('renders nothing without a current role', async () => {
    h.loadCurrentRoles.mockResolvedValue({ status: 'empty' });
    expect(await HeroRoleLine()).toBeNull();
    h.loadCurrentRoles.mockResolvedValue({ status: 'error' });
    expect(await HeroRoleLine()).toBeNull();
  });
});

describe('PaletteHint', () => {
  it('prints the shell hint ⌘K in the server HTML, like the rail and phone bar', () => {
    const html = renderToString(<PaletteHint />);
    expect(html).toContain('⌘K');
    expect(html).toContain('aria-keyshortcuts="Meta+K"');
  });

  it('switches to Ctrl K after hydrating on a non-Apple platform', () => {
    setPlatform('Linux x86_64');
    render(<PaletteHint />);
    const button = screen.getByRole('button', { name: PALETTE_HINT_LABEL });
    expect(button).toHaveTextContent('Ctrl K');
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+K');
  });

  it('keeps ⌘K on Apple platforms and hides the hint on touch screens', () => {
    setPlatform('MacIntel');
    render(<PaletteHint />);
    const button = screen.getByRole('button', { name: PALETTE_HINT_LABEL });
    const hint = button.querySelector('kbd');
    expect(hint).toHaveTextContent('⌘K');
    expect(hint).toHaveClass('pointer-coarse:hidden');
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Meta+K');
  });

  it('toggles the command palette on click', () => {
    render(<PaletteHint />);
    fireEvent.click(screen.getByRole('button', { name: PALETTE_HINT_LABEL }));
    expect(h.toggle).toHaveBeenCalledTimes(1);
  });
});
