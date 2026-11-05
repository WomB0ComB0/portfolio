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
 * @file The page shell's landmarks, skip link and hydration.
 *
 * Each page renders its own Layout, which owns the page's `<main>`. The server HTML must already
 * contain that one `<main>` (around the page content only, not the nav or footer), and hydrating
 * it must keep the same DOM instead of remounting the page.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Layout from '@/components/layout/layout';

vi.mock('next/navigation', () => ({ usePathname: () => '/stats' }));
// The command palette and background effect are not under test.
vi.mock('@/components/cmd', () => ({ default: () => null }));
vi.mock('@/components/magicui/light-rays', () => ({ LightRays: () => null }));
// layout.tsx imports the navs and footer from its own barrel. Each nav has a link, so the
// skip link has something to come before.
vi.mock('@/components/layout', () => ({
  NavBar: () => (
    <nav aria-label="Main navigation">
      <a href="/projects">Projects</a>
    </nav>
  ),
  MobileNavBar: () => (
    <nav aria-label="Mobile navigation">
      <a href="/experience">Experience</a>
    </nav>
  ),
  Footer: () => (
    <footer>
      <a href="/privacy">Privacy</a>
    </footer>
  ),
}));

/** The tree every page renders inside GlobalProvider (which adds no wrapper): its Layout. */
const Page = ({ children }: { children: React.ReactNode }) => <Layout>{children}</Layout>;

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Page content that counts its mounts: a remount runs its effect again. */
const mounts = vi.fn();
const Probe = () => {
  useEffect(() => {
    mounts();
  }, []);
  return <p>Page content</p>;
};

// jsdom has no scrollIntoView; the skip link test stubs it.
const originalScrollIntoView = Element.prototype.scrollIntoView;

/**
 * Resolves once a link click's navigation has run: jsdom follows a link in a setImmediate task,
 * and setImmediate callbacks run in the order they were queued.
 */
const afterLinkNavigation = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

afterEach(() => {
  document.body.innerHTML = '';
  mounts.mockClear();
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

describe('Layout landmarks', () => {
  it('renders exactly one main#main-content around the page content only', () => {
    const { container } = render(
      <Page>
        <p>Page content</p>
      </Page>,
    );

    const mains = container.querySelectorAll('main');
    expect(mains).toHaveLength(1);
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveAttribute('tabindex', '-1');
    expect(within(main).getByText('Page content')).toBeInTheDocument();

    for (const outside of [
      screen.getByRole('navigation', { name: 'Main navigation' }),
      screen.getByRole('navigation', { name: 'Mobile navigation' }),
      screen.getByRole('contentinfo'),
    ]) {
      expect(main.contains(outside)).toBe(false);
    }
    expect(main.closest('header')).toBeNull();
  });

  it('starts with a skip link to #main-content, before every other focusable element', () => {
    const { container } = render(
      <Page>
        <button type="button">Page action</button>
      </Page>,
    );

    const [first] = container.querySelectorAll(FOCUSABLE);
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(first).toBe(skip);
    expect(skip).toHaveAttribute('href', '#main-content');
    // Hidden until focused, then shown: the sr-only utility is undone on focus.
    expect(skip).toHaveClass('sr-only');
    expect(skip.className).toMatch(/(?:^|\s)focus:not-sr-only(?:\s|$)/);
  });

  // A native jump to #main-content adds a history entry with null state, which Next's app router
  // ignores on popstate: after a later client navigation, Back would change the URL and leave the
  // newer page on screen.
  it('moves focus to main without a fragment navigation, so Back still works', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <Page>
        <p>Page content</p>
      </Page>,
    );
    const historyLength = window.history.length;
    const hash = window.location.hash;

    const notCancelled = fireEvent.click(screen.getByRole('link', { name: 'Skip to content' }));
    await afterLinkNavigation();

    const main = screen.getByRole('main');
    expect(main).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView.mock.contexts[0]).toBe(main);
    expect(notCancelled).toBe(false);
    expect(window.history.length).toBe(historyLength);
    expect(window.location.hash).toBe(hash);
  });
});

describe('Server HTML and hydration', () => {
  it('server-renders the main landmark, visible without JavaScript', () => {
    const html = renderToString(
      <Page>
        <p>Page content</p>
      </Page>,
    );

    expect(html.match(/<main\b/g)).toHaveLength(1);
    expect(html).toMatch(/<main\b[^>]*\bid="main-content"/);
    expect(html).not.toMatch(/opacity:\s*0(?:[;"]|\s)/);
  });

  it('hydrates the server HTML in place, without remounting the page', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(
      <Page>
        <Probe />
      </Page>,
    );
    document.body.append(container);
    const serverMain = container.querySelector('main');
    const serverContent = screen.getByText('Page content');

    render(
      <Page>
        <Probe />
      </Page>,
      { container, hydrate: true },
    );
    await act(async () => {});

    expect(serverMain).not.toBeNull();
    expect(container.querySelector('main')).toBe(serverMain);
    expect(screen.getByText('Page content')).toBe(serverContent);
    expect(mounts).toHaveBeenCalledTimes(1);
  });

  it('plays the entrance animation for a page mounted by a client-side navigation', async () => {
    render(
      <Page>
        <p>Page content</p>
      </Page>,
    );

    expect(screen.getByRole('main').style.opacity).toBe('0');
    // It must also finish: a page left at opacity 0 is invisible.
    await waitFor(() => expect(screen.getByRole('main').style.opacity).toBe('1'));
  });
});
