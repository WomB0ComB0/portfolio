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
 * @file The shell's grid: one max-width page column, centred beside the 64 px rail.
 *
 * The old shell squeezed every page into a 60% (lg) or 2/3 (md) column with a 6% rail offset,
 * which broke layouts between 768 and 1279 px, and hid vertical overflow (which breaks
 * position: sticky). jsdom applies no Tailwind CSS, so this checks the class contract;
 * e2e/visual/shell-grid.spec.ts measures the real boxes in a browser.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Layout from '@/components/layout/layout';

vi.mock('next/navigation', () => ({ usePathname: () => '/projects' }));
// The command palette is not under test.
vi.mock('@/components/cmd', () => ({ default: () => null }));
// A visible stand-in, so the test can count how many the shell mounts.
vi.mock('@/components/console/spotlight-root', () => ({
  SpotlightRoot: () => <span data-testid="spotlight-root" />,
}));
// The status badge polls the status API; it is not under test.
vi.mock('@/components/custom/status-badge', () => ({ StatusBadge: () => null }));
// layout.tsx imports the navs and footer from its own barrel. The footer is the real one: its
// width has to match the page column's.
vi.mock('@/components/layout', async () => {
  const { Footer } = await import('@/components/layout/footer');
  return {
    NavBar: () => <nav aria-label="Main navigation" />,
    MobileNavBar: () => <nav aria-label="Mobile navigation" />,
    Footer,
  };
});

/** The old column and rail sizes, the old display font, and overflow that breaks sticky. */
const LEGACY_SHELL_CLASS = /w-\[\d+%\]|w-2\/3|pl-\[6%\]|font-clash|overflow-(?:y-)?hidden/;

/** Horizontal padding at any breakpoint: px-4, md:px-8, lg:pl-[6%], ... */
const HORIZONTAL_PADDING = /^(?:[a-z0-9-]+:)?p[xlrse]-/;

/**
 * The bottom bar's full height (--mobile-bar-h above the safe-area inset), the one custom property
 * the bar's height reads too (tests/unit/h2-chrome/mobile-bar-clearance.test.tsx).
 */
const BOTTOM_BAR_CLEARANCE = 'pb-(--mobile-bar-total)';

const MAGICUI_DIR = join(process.cwd(), 'src/components/magicui');

const classesOf = (element: Element | null): string[] =>
  (element?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

const renderShell = () => {
  const { container } = render(
    <Layout>
      <p>Page content</p>
    </Layout>,
  );
  const root = container.firstElementChild;
  const main = screen.getByRole('main');
  const column = main.parentElement;
  if (!(root instanceof HTMLElement) || !column) throw new Error('the shell did not render');
  return { container, root, main, column };
};

describe('shell grid', () => {
  it('keeps none of the old percentage column, rail offset, display font or hidden overflow', () => {
    const { container } = renderShell();

    const offenders = [...container.querySelectorAll('[class]')]
      .flatMap(classesOf)
      .filter((name) => LEGACY_SHELL_CLASS.test(name));

    expect(offenders).toEqual([]);
  });

  it('caps main at the shell width, centred, as the page container, with no side padding', () => {
    const { main } = renderShell();
    const classes = classesOf(main);

    expect(main).toHaveAttribute('id', 'main-content');
    expect(classes).toEqual(
      expect.arrayContaining(['max-w-shell', 'mx-auto', 'w-full', '@container/page']),
    );
    // Legacy pages keep their own padding and PageShell/TileGrid add the gutter: none stacks here.
    expect(classes.filter((name) => HORIZONTAL_PADDING.test(name))).toEqual([]);
  });

  it('offsets the column by the rail from lg up and clears the bottom bar below lg', () => {
    const { column } = renderShell();
    const rail = screen.getByRole('navigation', { name: 'Main navigation' }).parentElement;

    // The rail is w-16 (64 px) and the column's offset is the same 16 spacing units.
    expect(classesOf(rail)).toEqual(
      expect.arrayContaining(['fixed', 'w-16', 'hidden', 'lg:block']),
    );
    expect(classesOf(column)).toEqual(
      expect.arrayContaining(['lg:pl-16', BOTTOM_BAR_CLEARANCE, 'lg:pb-0']),
    );
  });

  it('stacks the rail, and so its flyouts, above the sticky filter bar but under z-50 overlays', () => {
    renderShell();
    const rail = screen.getByRole('navigation', { name: 'Main navigation' }).parentElement;
    // A z-index class at any breakpoint: z-40, lg:z-30.
    const zIndexOf = (classes: readonly string[]): number =>
      Number(/(?:^|:)z-(\d+)$/.exec(classes.find((name) => /(?:^|:)z-\d+$/.test(name)) ?? '')?.[1]);
    // FilterBar's sticky wrapper (projects, certifications, places) shares the root stacking
    // context with the rail now that main is not a stacking context. Its class string is found
    // by its sticky class at any breakpoint, in the source with comments (and their apostrophes)
    // removed.
    const filterBarCode = readFileSync(
      join(process.cwd(), 'src/components/ui/filter-bar.tsx'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const stickyClasses =
      [...filterBarCode.matchAll(/'([^'\n]*)'/g)]
        .map(([, literal = '']) => literal.split(/\s+/))
        .find((classes) => classes.some((name) => /(?:^|:)sticky$/.test(name))) ?? [];

    const railZ = zIndexOf(classesOf(rail));
    expect(railZ).toBeGreaterThan(zIndexOf(stickyClasses));
    expect(railZ).toBeLessThan(50);
  });

  it('puts the footer in the column under main, as wide as main and centred the same way', () => {
    const { main, column } = renderShell();
    const footer = screen.getByRole('contentinfo');

    expect(column).toContainElement(footer);
    expect(main).not.toContainElement(footer);
    expect(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(classesOf(footer)).toEqual(expect.arrayContaining(['max-w-shell', 'mx-auto', 'w-full']));
  });

  it('paints the canvas and the two LightRays glows on the root, sized to the page as before #603', () => {
    const { root } = renderShell();
    const classes = classesOf(root);

    expect(classes).toEqual(
      expect.arrayContaining(['light-glows', 'overflow-x-clip', 'bg-canvas', 'min-h-dvh']),
    );
    // The glows replace the one-screen atmosphere; the page-sized box is LightRays' own.
    expect(classes).not.toContain('atmosphere');
    expect(classes).not.toContain('bg-size-[100%_100svh]');
  });

  it('lays the light rays first in the root, under everything else, before the skip link', () => {
    const { root } = renderShell();
    const rays = root.querySelectorAll('.light-rays');

    // `relative isolate`: the root is the box and the stacking context the rays sit in at -1.
    expect(classesOf(root)).toEqual(expect.arrayContaining(['relative', 'isolate']));
    expect(rays).toHaveLength(1);
    expect(root.firstElementChild).toBe(rays[0]);
    expect(rays[0]).toHaveAttribute('aria-hidden', 'true');
    expect(rays[0]?.querySelectorAll('i')).toHaveLength(5);
    // The skip link is still the first thing to focus.
    expect(root.querySelector('a, button, [tabindex]')).toHaveTextContent('Skip to content');
  });

  it('mounts the tile spotlight listener exactly once', () => {
    renderShell();

    expect(screen.getAllByTestId('spotlight-root')).toHaveLength(1);
  });

  it('no longer ships the client LightRays (motion/react, Math.random) from magicui', () => {
    expect(existsSync(join(MAGICUI_DIR, 'light-rays.tsx'))).toBe(false);
    expect(existsSync(join(MAGICUI_DIR, 'light-rays.types.ts'))).toBe(false);
    expect(readFileSync(join(MAGICUI_DIR, 'index.ts'), 'utf8')).not.toMatch(/light-rays/);
  });
});
