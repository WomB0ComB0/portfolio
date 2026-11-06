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
 * @file The phone bottom bar's height and the page column's bottom clearance are one value.
 *
 * The column's bottom padding has to equal the fixed bar's full height: shorter and the end of
 * the footer sits under the bar, taller and a dead band shows above it on notched phones. Both
 * read --mobile-bar-total (globals.css), so restyling the bar cannot leave the column behind.
 * The real MobileNavBar renders here inside the real Layout; only the rail, the footer and the
 * spotlight listener are stand-ins. e2e/visual/shell-grid.spec.ts measures the real boxes, but
 * every Playwright device has a zero safe-area inset, so only this test sees that part.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import { compile } from 'tailwindcss';
import { describe, expect, it, vi } from 'vitest';

import Layout from '@/components/layout/layout';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/components/console/spotlight-root', () => ({ SpotlightRoot: () => null }));
// layout.tsx imports the navs and footer from its own barrel. The bottom bar is the real one.
vi.mock('@/components/layout', async () => {
  const { MobileNavBar } = await import('@/components/layout/mobile-nav');
  return {
    NavBar: () => <nav aria-label="Main navigation" />,
    MobileNavBar,
    Footer: () => <footer />,
  };
});

const ROOT = process.cwd();
const LAYOUT_DIR = join(ROOT, 'src/components/layout');

/** The bar's full height as globals.css defines it: the controls band above the inset. */
const BAR_TOTAL =
  /--mobile-bar-total:\s*calc\(var\(--mobile-bar-h\) \+ env\(safe-area-inset-bottom\)\);/;

const classesOf = (element: Element | null): string[] =>
  (element?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

/** The value of the one unprefixed `<utility>-...` class on `element`, such as `(--x)`. */
const utilityValue = (element: Element | null, utility: 'h' | 'pb'): string => {
  const values = classesOf(element)
    .filter((name) => name.startsWith(`${utility}-`))
    .map((name) => name.slice(utility.length + 1));
  if (values.length !== 1) throw new Error(`expected one ${utility}-* class, got ${values}`);
  return values[0] ?? '';
};

const renderShell = () => {
  render(
    <KBarProvider>
      <Layout>
        <p>Page content</p>
      </Layout>
    </KBarProvider>,
  );
  return {
    bar: screen.getByRole('navigation', { name: 'Mobile navigation' }),
    column: screen.getByRole('main').parentElement,
  };
};

describe('bottom bar clearance', () => {
  it("gives the real bar's height and the column's bottom padding the same value", () => {
    const { bar, column } = renderShell();

    expect(utilityValue(bar, 'h')).toBe(utilityValue(column, 'pb'));
    expect(utilityValue(bar, 'h')).toBe('(--mobile-bar-total)');
    // From lg up the bar is hidden and the column drops the clearance.
    expect(classesOf(column)).toContain('lg:pb-0');
  });

  it('keeps the bar controls in the --mobile-bar-h band above the home indicator', () => {
    const { bar } = renderShell();

    // Border-box (preflight): the inset is padding inside the full height, not added below it.
    expect(utilityValue(bar, 'pb')).toBe('[env(safe-area-inset-bottom)]');
  });

  it('defines the full height once in globals.css, from the bar token and the inset', () => {
    const css = readFileSync(join(ROOT, 'src/styles/globals.css'), 'utf8');

    expect(css.match(/--mobile-bar-total\s*:/g)).toHaveLength(1);
    expect(css).toMatch(BAR_TOTAL);
  });

  it('leaves no copy of the sum in the layout components', () => {
    const copies = readdirSync(LAYOUT_DIR)
      .filter((file) => file.endsWith('.tsx'))
      .filter((file) =>
        readFileSync(join(LAYOUT_DIR, file), 'utf8').includes('var(--mobile-bar-h)'),
      );

    expect(copies).toEqual([]);
  });

  it('compiles both classes to the custom property', async () => {
    const theme = readFileSync(join(ROOT, 'node_modules/tailwindcss/theme.css'), 'utf8');
    const { build } = await compile(`${theme}\n@tailwind utilities;`);
    const css = build(['h-(--mobile-bar-total)', 'pb-(--mobile-bar-total)']).replace(/\s+/g, ' ');

    expect(css).toContain('height: var(--mobile-bar-total);');
    expect(css).toContain('padding-bottom: var(--mobile-bar-total);');
  });
});
