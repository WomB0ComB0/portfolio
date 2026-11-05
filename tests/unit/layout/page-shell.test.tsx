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
 * @file The persistent page shell: landmarks, skip link, hydration and the per-page fade.
 *
 * Every route renders inside src/app/(routes)/layout.tsx, which is
 * `<Layout><PageEnter>{page}</PageEnter></Layout>`. Layout mounts once and stays mounted across
 * client navigations, and its one `<main>` wraps the page content only (not the navs or the
 * footer). The server HTML must already contain that `<main>`, hydrating it must keep the same
 * DOM, and only a page mounted by a client navigation fades in.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SiteLayout from '@/app/(routes)/layout';

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => '/stats') }));
vi.mock('next/navigation', () => ({ usePathname }));
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

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** An inline `opacity: 0` in server HTML: content hidden until JavaScript runs. */
const HIDDEN_OPACITY = /opacity:\s*0(?:[;"]|\s)/;

/** Page content that counts its mounts: a remount runs its effect again. */
const mounts = vi.fn();
const Probe = () => {
  useEffect(() => {
    mounts();
  }, []);
  return <p>Page content</p>;
};

/** The element PageEnter puts between `<main>` and the page: the one that fades. */
const frameOf = (main: HTMLElement): HTMLElement => {
  const frame = main.firstElementChild;
  if (!(frame instanceof HTMLElement)) throw new Error('<main> has no page frame');
  return frame;
};

/** The parts of the shell that must outlive a navigation, in a fixed order. */
const shellNodes = (): HTMLElement[] => [
  screen.getByRole('main'),
  screen.getByRole('navigation', { name: 'Main navigation' }),
  screen.getByRole('navigation', { name: 'Mobile navigation' }),
  screen.getByRole('contentinfo'),
];

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

beforeEach(() => {
  usePathname.mockReturnValue('/stats');
});

afterEach(() => {
  document.body.innerHTML = '';
  mounts.mockClear();
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

describe('Shell landmarks', () => {
  it('renders exactly one main#main-content around the page content only', () => {
    const { container } = render(
      <SiteLayout>
        <p>Page content</p>
      </SiteLayout>,
    );

    expect(container.querySelectorAll('main')).toHaveLength(1);
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
      <SiteLayout>
        <button type="button">Page action</button>
      </SiteLayout>,
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
      <SiteLayout>
        <p>Page content</p>
      </SiteLayout>,
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
  it('server-renders one main landmark, with nothing hidden until JavaScript runs', () => {
    const html = renderToString(
      <SiteLayout>
        <p>Page content</p>
      </SiteLayout>,
    );

    expect(html.match(/<main\b/g)).toHaveLength(1);
    expect(html).toMatch(/<main\b[^>]*\bid="main-content"/);
    expect(html).toContain('Page content');
    expect(html).not.toMatch(HIDDEN_OPACITY);
  });

  it('hydrates the server HTML in place: same <main> and page nodes, one page mount', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(
      <SiteLayout>
        <Probe />
      </SiteLayout>,
    );
    document.body.append(container);
    const serverMain = container.querySelector('main');
    const serverContent = screen.getByText('Page content');
    const onRecoverableError = vi.fn();
    let root: Root | undefined;

    try {
      await act(async () => {
        root = hydrateRoot(
          container,
          <SiteLayout>
            <Probe />
          </SiteLayout>,
          { onRecoverableError },
        );
      });

      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(serverMain).not.toBeNull();
      expect(container.querySelector('main')).toBe(serverMain);
      expect(screen.getByText('Page content')).toBe(serverContent);
      expect(mounts).toHaveBeenCalledTimes(1);
      // Hydration does not start the fade: the page stays fully visible.
      expect(frameOf(screen.getByRole('main')).style.opacity).toBe('1');
    } finally {
      act(() => {
        root?.unmount();
      });
    }
  });
});

describe('Per-page fade', () => {
  it('fades in a page mounted on the client, while <main> itself never animates', async () => {
    render(
      <SiteLayout>
        <p>Page content</p>
      </SiteLayout>,
    );
    const main = screen.getByRole('main');
    const frame = frameOf(main);

    expect(frame.style.opacity).toBe('0');
    expect(frame.style.transform).toBe('');
    expect(main).not.toHaveAttribute('style');
    // It must also finish: a page left at opacity 0 is invisible.
    await waitFor(() => expect(frame.style.opacity).toBe('1'));
    expect(main).not.toHaveAttribute('style');
  });

  it('remounts the page on a pathname change but keeps the same <main>, navs and footer', async () => {
    const { rerender } = render(
      <SiteLayout>
        <Probe />
      </SiteLayout>,
    );
    const before = shellNodes();
    const firstFrame = frameOf(screen.getByRole('main'));
    await waitFor(() => expect(firstFrame.style.opacity).toBe('1'));

    usePathname.mockReturnValue('/projects');
    rerender(
      <SiteLayout>
        <Probe />
      </SiteLayout>,
    );

    expect(mounts).toHaveBeenCalledTimes(2);
    for (const [index, node] of shellNodes().entries()) {
      expect(node).toBe(before[index]);
    }
    const nextFrame = frameOf(screen.getByRole('main'));
    expect(nextFrame).not.toBe(firstFrame);
    expect(nextFrame.style.opacity).toBe('0');
    await waitFor(() => expect(nextFrame.style.opacity).toBe('1'));
  });

  it('keeps the page mounted when only the search params change (same pathname)', () => {
    const { rerender } = render(
      <SiteLayout>
        <Probe />
      </SiteLayout>,
    );
    const frame = frameOf(screen.getByRole('main'));

    rerender(
      <SiteLayout>
        <Probe />
      </SiteLayout>,
    );

    expect(mounts).toHaveBeenCalledTimes(1);
    expect(frameOf(screen.getByRole('main'))).toBe(frame);
  });
});
