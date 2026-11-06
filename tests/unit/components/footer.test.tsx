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

    const line = classesOf(screen.getByText(/2024-present/));
    const leftPadding = line.filter((name) => /^(?:[a-z0-9-]+:)?(?:pl|ps|px)-/.test(name));

    expect(leftPadding).toEqual([]);
    expect(line).toEqual(expect.arrayContaining(['text-center', 'sm:text-left']));
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
