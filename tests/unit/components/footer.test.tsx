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
 * @file The site footer names the project's real license and sits centred on phones.
 *
 * jsdom applies no Tailwind CSS, so the spacing check is a class contract: the footer is as wide
 * as the page column and centred under it, and it adds no offset of its own for the desktop rail
 * (the shell's column beside the rail already clears it).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Footer from '@/components/layout/footer';

// The status badge polls the status API; it is not under test.
vi.mock('@/components/custom/status-badge', () => ({ StatusBadge: () => null }));

const PACKAGE_LICENSE = (
  JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { license: string }
).license;

const classesOf = (element: Element | null): string[] =>
  (element?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

describe('Footer', () => {
  it('names the license from package.json and links it to the in-site licenses page', () => {
    render(<Footer />);

    const license = screen.getByRole('link', { name: PACKAGE_LICENSE });

    expect(PACKAGE_LICENSE).toBe('Apache-2.0');
    expect(license).toHaveAttribute('href', '/licenses');
    expect(license).not.toHaveAttribute('target');
  });

  it('never claims the MIT license', () => {
    render(<Footer />);

    expect(screen.getByRole('contentinfo').textContent).not.toMatch(/\bMIT\b/);
    expect(screen.queryByRole('link', { name: /MIT/ })).toBeNull();
  });

  it('keeps the copyright line centred on phones, with no rail offset at any width', () => {
    render(<Footer />);

    const line = classesOf(screen.getByText(/2024–present/));
    const leftPadding = line.filter((name) => /^(?:[a-z0-9-]+:)?(?:pl|ps|px)-/.test(name));

    expect(leftPadding).toEqual([]);
    expect(line).toEqual(expect.arrayContaining(['text-center', '@min-[52rem]/footer:text-left']));
  });

  it('writes the year range with an en dash', () => {
    render(<Footer />);

    expect(screen.getByRole('contentinfo').textContent).toContain('2024–present');
    expect(screen.getByRole('contentinfo').textContent).not.toContain('2024-present');
  });

  // The shell's other nav landmarks are named ("Main navigation", "Mobile navigation", "All
  // pages"), so a screen reader's landmark list must not show this one as a bare "navigation".
  it('names its links landmark "Legal", for the three legal pages it holds', () => {
    render(<Footer />);

    const legal = screen.getByRole('navigation', { name: 'Legal' });
    const links = [...legal.querySelectorAll('a')].map((link) => [
      link.textContent,
      link.getAttribute('href'),
    ]);

    expect(links).toEqual([
      ['Licenses', '/licenses'],
      ['Privacy Policy', '/privacy'],
      ['Cookie Policy', '/cookies'],
    ]);
  });

  it('says the external profile link opens in a new tab', () => {
    render(<Footer />);

    const profile = screen.getByRole('link', { name: 'Mike Odnis (opens in a new tab)' });

    expect(profile).toHaveAttribute('target', '_blank');
    expect(profile).toHaveAttribute('href', 'https://github.com/WomB0ComB0');
  });

  it('offers consulting outside the legal landmark with a spoken new-tab notice', () => {
    render(<Footer />);
    const link = screen.getByRole('link', {
      name: 'Available for consulting (opens in a new tab)',
    });
    expect(link).toHaveAttribute('href', 'https://atroviola.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('navigation', { name: 'Legal' })).not.toContainElement(link);
  });

  // A separator shows only where its row cannot wrap, so none can end a line or sit alone.
  it('shows the separators only from the width that keeps the links on one line', () => {
    render(<Footer />);

    const footer = screen.getByRole('contentinfo');
    const nav = classesOf(footer.querySelector('nav'));
    const separators = [...footer.querySelectorAll('span[aria-hidden="true"]')].map(classesOf);

    expect(classesOf(footer)).toContain('@container/footer');
    expect(nav).toEqual(expect.arrayContaining(['flex-wrap', '@min-[34rem]/footer:flex-nowrap']));
    expect(separators).toHaveLength(3);
    for (const separator of separators) {
      expect(separator).toEqual(expect.arrayContaining(['hidden', '@min-[34rem]/footer:inline']));
      expect(separator.filter((name) => name.startsWith('sm:'))).toEqual([]);
    }
  });

  // The status pill shows its word at every width now, so on a phone the links and the pill no
  // longer fit one line: the pill wraps below the links, centred, instead of squeezing them.
  it('lets the status pill wrap below the links, centred, where they do not fit one line', () => {
    render(<Footer />);

    const row = screen.getByRole('contentinfo').querySelector('nav')?.parentElement ?? null;

    expect(classesOf(row)).toEqual(
      expect.arrayContaining(['flex', 'flex-wrap', 'justify-center', 'items-center']),
    );
  });

  it('spans the page column, centred, with the page gutter inside', () => {
    render(<Footer />);

    const footer = classesOf(screen.getByRole('contentinfo'));

    expect(footer).toEqual(
      expect.arrayContaining(['mx-auto', 'w-full', 'max-w-shell', 'px-(--page-gutter)']),
    );
    expect(footer.filter((name) => /^lg:(?:pl|ps|px)-/.test(name))).toEqual([]);
  });
});
