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
 * @file 404s render inside the site shell.
 *
 * notFound() under (routes) renders (routes)/not-found inside the (routes) layout, so that file
 * adds only the view. Unmatched URLs render the root not-found outside route-group layouts, so it
 * wraps the shell itself. The view is a server component that renders with no providers.
 */

import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/no-such-page' }));
// The command palette and background effect are not under test.
vi.mock('@/components/cmd', () => ({ default: () => null }));
vi.mock('@/components/magicui/light-rays', () => ({ LightRays: () => null }));
// layout.tsx imports the navs and footer from its own barrel.
vi.mock('@/components/layout', () => ({
  NavBar: () => <nav aria-label="Main navigation" />,
  MobileNavBar: () => <nav aria-label="Mobile navigation" />,
  Footer: () => <footer />,
}));

import { NotFoundView } from '@/app/_components/errors';
import RouteGroupNotFound from '@/app/(routes)/not-found';
import RootNotFound, { metadata } from '@/app/not-found';

/** The view's own content: one heading and a way back to Home and Projects. */
const expectNotFoundView = (scope: HTMLElement): void => {
  const headings = within(scope).getAllByRole('heading', { level: 1 });
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent('Page not found');
  expect(within(scope).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  expect(within(scope).getByRole('link', { name: 'Projects' })).toHaveAttribute(
    'href',
    '/projects',
  );
};

describe('src/app/(routes)/not-found.tsx', () => {
  it('renders only the not-found view: the (routes) layout provides the shell', () => {
    const { container } = render(<RouteGroupNotFound />);

    expectNotFoundView(container);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('contentinfo')).toBeNull();
    expect(container.querySelector('main')).toBeNull();
  });
});

describe('src/app/not-found.tsx', () => {
  it('wraps the view in the shell, so an unmatched URL keeps the nav and main#main-content', () => {
    const { container } = render(<RootNotFound />);

    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(container.querySelectorAll('main')).toHaveLength(1);
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expectNotFoundView(main);
  });

  it('offers the skip link to the 404 content', () => {
    render(<RootNotFound />);

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
  });

  it('keeps the 404 metadata', () => {
    expect(metadata.title).toEqual(expect.objectContaining({ default: '404' }));
    expect(metadata.description).toBe('This page does not exist');
  });
});

describe('NotFoundView', () => {
  it('renders to a string with no providers, as a server component', () => {
    const html = renderToString(<NotFoundView />);

    expect(html).toContain('Page not found');
    expect(html).toContain('href="/projects"');
    // No entrance motion: server HTML must never hide the content.
    expect(html).not.toMatch(/opacity:\s*0/);
    expect(html).not.toContain('min-h-screen');
  });

  it('hides the decorative 404 numeral from assistive tech', () => {
    const { container } = render(<NotFoundView />);

    const numeral = within(container).getByText('404');
    expect(numeral).toHaveAttribute('aria-hidden', 'true');
  });

  it('names its section after the heading and points to the command palette', () => {
    render(<NotFoundView />);

    const region = screen.getByRole('region', { name: 'Page not found' });
    expect(region).toHaveTextContent('Press ⌘K (Ctrl K on Windows and Linux) to search');
    expect(region).toHaveTextContent("This page doesn't exist, or it moved.");
  });
});
