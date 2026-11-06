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
 * @file The site chrome (desktop rail, phone bar, phone menu and ⌘K palette) in the Live Console
 * style: console tokens only, the current page marked with a fill and a brand bar rather than a
 * solid purple, and a phone Search button that opens the palette.
 *
 * jsdom applies no Tailwind CSS, so the styling checks are class contracts. The palette runs on
 * the real kbar store, so "opens the palette" means kbar settles in its showing state with the
 * real search box focused.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type ActionImpl, KBarProvider, useKBar, VisualState } from 'kbar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Palette, ResultItem } from '@/components/cmd';
import { MobileNavBar } from '@/components/layout/mobile-nav';
import { NavBar } from '@/components/layout/nav';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const CHROME_FILES = [
  'src/components/layout/nav.tsx',
  'src/components/layout/mobile-nav.tsx',
  'src/components/layout/mobile-menu-overlay.tsx',
  'src/components/cmd.tsx',
] as const;

const SEARCH_LABEL = 'Search pages and commands';

/**
 * Legacy shadcn and palette colours the chrome no longer uses: the purple primary and accent
 * fills, the card surface, black and white overlays and the neutral scale.
 */
const LEGACY_COLOUR =
  /\b(?:bg|text|border|from|via|to|ring|placeholder|shadow)-(?:primary|accent|card|background|black|white|neutral-\d+)\b/g;

/** Every class on the element. */
const classesOf = (element: Element | null): string[] =>
  (element?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

/** jsdom has no Web Animations API; KBarAnimator only starts and forgets its animations. */
const stubAnimate = (): (() => void) => {
  const original = Element.prototype.animate;
  Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation);
  return () => {
    Element.prototype.animate = original;
  };
};

let restoreAnimate: () => void;

beforeEach(() => {
  restoreAnimate = stubAnimate();
});

afterEach(() => {
  vi.restoreAllMocks();
  restoreAnimate();
});

/** Reports the browser as a Mac, where kbar binds ⌘ rather than Ctrl. */
const onMac = () => vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('MacIntel');

/** Prints kbar's visual state, so a test can tell a palette that stays open from a flash. */
const PaletteStateProbe = () => {
  const { visualState } = useKBar((state) => ({ visualState: state.visualState }));
  return <output data-testid="palette-state">{visualState}</output>;
};

/**
 * The palette reached kbar's settled `showing` state and still has its focused, named search box.
 * kbar renders the portal through the 100 ms animating-out state too, and the search box
 * autofocuses on mount, so a button that toggled twice (open, then straight back to closed) would
 * pass a check for the search box alone. It never reaches `showing`: that comes only after the
 * 200 ms enter timer of a palette left open.
 */
const expectPaletteToStayOpen = async (): Promise<void> => {
  await waitFor(() =>
    expect(screen.getByTestId('palette-state')).toHaveTextContent(VisualState.showing),
  );
  const search = screen.getByRole('combobox');
  expect(search).toHaveAccessibleName(SEARCH_LABEL);
  expect(search).toHaveFocus();
};

describe('Chrome source', () => {
  it.each(CHROME_FILES)('%s has no dead font-clash, no gradient and no legacy colours', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');

    expect(source).not.toContain('font-clash');
    expect(source).not.toContain('from-primary');
    expect(source).not.toContain('bg-linear');
    expect(source.match(LEGACY_COLOUR) ?? []).toEqual([]);
  });
});

describe('MobileNavBar', () => {
  const renderBarWithPalette = () =>
    render(
      <KBarProvider>
        <Palette />
        <PaletteStateProbe />
        <MobileNavBar path="/" />
      </KBarProvider>,
    );

  it('puts a Search button beside the Menu button, which keeps its dialog state', () => {
    renderBarWithPalette();

    const bar = screen.getByRole('navigation', { name: 'Mobile navigation' });
    const menu = within(bar).getByRole('button', { name: 'Open navigation menu' });
    expect(within(bar).getByRole('button', { name: SEARCH_LABEL })).toBeInTheDocument();
    expect(menu).toHaveAttribute('aria-haspopup', 'dialog');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveAttribute('aria-controls', 'mobile-menu-dialog');
  });

  it('opens the palette from the Search button, and it stays open on its focused search box', async () => {
    renderBarWithPalette();

    fireEvent.click(screen.getByRole('button', { name: SEARCH_LABEL }));

    await expectPaletteToStayOpen();
  });

  it('shows Ctrl K off Apple devices, hidden on touch screens, and names the keys for AT', () => {
    renderBarWithPalette();

    const search = screen.getByRole('button', { name: SEARCH_LABEL });
    expect(search).toHaveAttribute('aria-keyshortcuts', 'Control+K');
    expect(within(search).getByText('Ctrl K')).toHaveClass('pointer-coarse:hidden');
  });

  it('shows ⌘K on a Mac', () => {
    onMac();
    renderBarWithPalette();

    const search = screen.getByRole('button', { name: SEARCH_LABEL });
    expect(search).toHaveAttribute('aria-keyshortcuts', 'Meta+K');
    expect(within(search).getByText('⌘K')).toBeInTheDocument();
  });

  it('styles the Menu button as a hairline pill on surface-2, not the lavender gradient', () => {
    renderBarWithPalette();

    const menu = classesOf(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(menu).toEqual(
      expect.arrayContaining(['bg-surface-2', 'border-hairline', 'rounded-full']),
    );
    expect(menu.filter((name) => /primary|linear/.test(name))).toEqual([]);
  });
});

describe('NavBar rail', () => {
  const renderRail = (path: string) =>
    render(
      <KBarProvider>
        <NavBar path={path} />
      </KBarProvider>,
    );

  const railItem = (name: string) =>
    within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole(
      /section$/.test(name) ? 'button' : 'link',
      { name },
    );

  it('marks the current page group with surface-3 and a brand bar, the rest muted', () => {
    renderRail('/projects/some-id');

    expect(railItem('Professional section')).toHaveClass('bg-surface-3', 'before:bg-brand');
    for (const name of ['Developer section', 'Personal section', 'Legal section', 'Home']) {
      expect(railItem(name)).toHaveClass('text-muted-foreground', 'hover:bg-surface-2');
      expect(railItem(name)).not.toHaveClass('before:bg-brand');
    }
  });

  it('marks Home like any current page, with no solid primary fill', () => {
    renderRail('/');

    const home = railItem('Home');
    expect(home).toHaveAttribute('aria-current', 'page');
    expect(home).toHaveClass('bg-surface-3', 'text-foreground', 'before:bg-brand');
    expect(classesOf(home).filter((name) => name.includes('primary'))).toEqual([]);
  });

  it('marks the current page in the flyout with brand-ink on brand-subtle', () => {
    renderRail('/projects');

    fireEvent.click(railItem('Professional section'));

    const panel = document.getElementById('nav-flyout-professional');
    if (!panel) throw new Error('Professional flyout is not rendered');
    expect(panel).toHaveClass('bg-surface-2', 'border-hairline', 'rounded-tile');
    const current = within(panel).getByRole('link', { name: 'Projects' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveClass('bg-brand-subtle', 'text-brand-ink');
    expect(within(panel).getByRole('link', { name: 'Resume' })).toHaveClass(
      'text-foreground',
      'hover:bg-surface-3',
    );
  });

  it('gives the command menu button its shortcut, for AT and in its tooltip', () => {
    onMac();
    renderRail('/');

    const button = screen.getByRole('button', { name: 'Open command menu' });
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Meta+K');
    expect(button).toHaveTextContent('⌘K');
  });

  it('opens the palette from the command menu button, and it stays open on its search box', async () => {
    render(
      <KBarProvider>
        <Palette />
        <PaletteStateProbe />
        <NavBar path="/" />
      </KBarProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open command menu' }));

    await expectPaletteToStayOpen();
  });
});

describe('Palette', () => {
  it('opens as a surface-2 panel over a canvas scrim, with key hints for pointer users', async () => {
    render(
      <KBarProvider>
        <Palette />
      </KBarProvider>,
    );

    act(() => {
      fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', ctrlKey: true });
    });
    const search = await screen.findByRole('combobox');

    expect(search).toHaveAccessibleName(SEARCH_LABEL);
    // KBarAnimator renders an outer panel and an inner wrapper around the search box.
    const panel = search.parentElement?.parentElement ?? null;
    expect(classesOf(panel)).toEqual(
      expect.arrayContaining(['bg-surface-2', 'border-hairline', 'rounded-tile', 'shadow-raised']),
    );
    expect(classesOf(panel?.parentElement ?? null)).toContain('bg-canvas/70');
    const hints = within(panel as HTMLElement).getByText('↑↓ navigate').parentElement;
    expect(hints).toHaveAttribute('aria-hidden', 'true');
    expect(hints).toHaveClass('pointer-coarse:hidden');
  });
});

describe('Palette ResultItem', () => {
  const action = (id: string, name: string) =>
    ({ id, name, ancestors: [], icon: <svg aria-hidden /> }) as unknown as ActionImpl;

  it('gives the active row surface-3 and a brand bar, and inactive rows muted text', () => {
    render(
      <>
        <ResultItem action={action('guestbook', 'Guestbook')} active />
        <ResultItem action={action('places', 'Places')} active={false} />
      </>,
    );

    const activeRow = screen.getByText('Guestbook').closest('.rounded-md');
    const idleRow = screen.getByText('Places').closest('.rounded-md');
    expect(activeRow).toHaveClass('bg-surface-3', 'text-foreground', 'before:bg-brand');
    expect(idleRow).toHaveClass('text-muted-foreground');
    expect(idleRow).not.toHaveClass('bg-surface-3');
  });
});
