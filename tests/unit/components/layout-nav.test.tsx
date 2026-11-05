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
 * @file The page shell shows exactly one nav at every width.
 *
 * jsdom applies no Tailwind CSS, so this checks the class contract: the sidebar and the bottom
 * bar switch at the same breakpoint, the hidden one uses display:none (never sr-only, which
 * leaves invisible links in the tab order), and the bar's bottom padding switches with it.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Layout from '@/components/layout/layout';

vi.mock('next/navigation', () => ({ usePathname: () => '/stats' }));
// The command palette and background effect are not under test.
vi.mock('@/components/cmd', () => ({ default: () => null }));
vi.mock('@/components/magicui/light-rays', () => ({ LightRays: () => null }));
// layout.tsx imports the navs and footer from its own barrel.
vi.mock('@/components/layout', () => ({
  NavBar: () => <nav aria-label="Main navigation" />,
  MobileNavBar: () => <nav aria-label="Mobile navigation" />,
  Footer: () => <footer />,
}));

const classesOf = (element: Element | null): string[] =>
  (element?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

const renderShell = () => {
  render(
    <Layout>
      <p>Page content</p>
    </Layout>,
  );
  const sidebar = screen.getByRole('navigation', { name: 'Main navigation' }).parentElement;
  const bottomBar = screen.getByRole('navigation', { name: 'Mobile navigation' }).parentElement;
  const content = screen.getByText('Page content').parentElement;
  const footerWrapper = screen.getByRole('contentinfo').parentElement;
  return {
    sidebar: classesOf(sidebar),
    bottomBar: classesOf(bottomBar),
    content: classesOf(content),
    footerWrapper: classesOf(footerWrapper),
  };
};

describe('Layout navigation', () => {
  it('shows the sidebar only from lg up, with display:none below it', () => {
    const { sidebar } = renderShell();

    expect(sidebar).toEqual(expect.arrayContaining(['hidden', 'lg:block']));
    expect(sidebar.filter((name) => name.includes('sr-only'))).toEqual([]);
    expect(sidebar.filter((name) => name.startsWith('md:'))).toEqual([]);
  });

  it('shows the bottom bar below lg and hides it from lg up', () => {
    const { bottomBar } = renderShell();

    expect(bottomBar).toContain('lg:hidden');
    expect(bottomBar.filter((name) => name.startsWith('md:'))).toEqual([]);
    expect(bottomBar.filter((name) => name.includes('sr-only'))).toEqual([]);
  });

  it('keeps the content and the footer clear of the bottom bar exactly while it shows', () => {
    const { content, footerWrapper } = renderShell();

    for (const classes of [content, footerWrapper]) {
      expect(classes).toEqual(expect.arrayContaining(['pb-16', 'lg:pb-0']));
      expect(classes).not.toContain('md:pb-0');
    }
  });
});
