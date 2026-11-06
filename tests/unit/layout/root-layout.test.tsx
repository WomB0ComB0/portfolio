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
 * @file What the root layout adds to every page: no global click handling, one theme colour.
 *
 * Renders the children of the root layout's `<head>` and `<body>` (everything it mounts, minus
 * the document elements) around a real page Layout, then clicks internal links the way people
 * do. A listener on window runs after every handler on the page, so it sees whether anything
 * cancelled the browser's default (open in a new tab, follow the link) before it stops jsdom's
 * own navigation.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import Link from 'next/link';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RootLayout from '@/app/layout';
import Layout from '@/components/layout/layout';

// Vitest would run the stylesheet through the app's Tailwind PostCSS setup; no CSS is under test.
vi.mock('@/styles/globals.css', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-url': '/' }) }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// The real factory module also pulls in the Elysia API app, which Vitest can't load.
vi.mock('@/providers/server', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  return { createQueryClient: () => () => new QueryClient() };
});
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));
vi.mock('@vercel/speed-insights/next', () => ({ SpeedInsights: () => null }));
vi.mock('@tanstack/react-query-devtools', () => ({ ReactQueryDevtools: () => null }));
// The command palette, the tile spotlight's pointer listener and the real navs are not under test.
vi.mock('@/components/cmd', () => ({ default: () => null }));
vi.mock('@/components/console/spotlight-root', () => ({ SpotlightRoot: () => null }));
vi.mock('@/components/layout', () => ({
  NavBar: () => <nav aria-label="Main navigation" />,
  MobileNavBar: () => <nav aria-label="Mobile navigation" />,
  Footer: () => <footer />,
}));

type WithChildren = { children?: ReactNode };

const childrenOf = (node: ReactNode): ReactNode =>
  isValidElement<WithChildren>(node) ? node.props.children : null;

/** The root layout's `<head>` and `<body>` elements, as it returns them. */
const documentParts = async (page: ReactNode): Promise<ReactElement<WithChildren>[]> => {
  const html = await RootLayout({ children: page });
  return Children.toArray(childrenOf(html)).filter((part) => isValidElement<WithChildren>(part));
};

/** Every element in a React element tree, depth first. */
const elementsIn = (node: ReactNode): ReactElement<Record<string, unknown>>[] =>
  Children.toArray(node).flatMap((child) =>
    isValidElement<Record<string, unknown>>(child)
      ? [child, ...elementsIn(child.props.children as ReactNode)]
      : [],
  );

/** A browser that supports view transitions (Chromium, Safari 18, Firefox 144+). */
const supportViewTransitions = () => {
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: (update?: () => void) => {
      update?.();
      const done = Promise.resolve();
      return { finished: done, ready: done, updateCallbackDone: done, skipTransition: () => {} };
    },
  });
};

const renderSite = async () => {
  const page = (
    <Layout>
      <Link href="/projects">Projects</Link>
      <a href="/cookies">Cookie Policy</a>
    </Layout>
  );
  const [head, body] = await documentParts(page);
  render(
    <>
      {head?.props.children}
      {body?.props.children}
    </>,
  );
};

const cancelled: boolean[] = [];
const recordAndStop = (event: MouseEvent) => {
  cancelled.push(event.defaultPrevented);
  event.preventDefault();
};

beforeEach(() => {
  cancelled.length = 0;
  supportViewTransitions();
  window.addEventListener('click', recordAndStop);
});

afterEach(() => {
  window.removeEventListener('click', recordAndStop);
  Reflect.deleteProperty(document, 'startViewTransition');
});

describe('internal links on every page', () => {
  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
    ['Shift', { shiftKey: true }],
  ])('leave a %s-click on a next/link to the browser (new tab or window)', async (_, keys) => {
    await renderSite();

    fireEvent.click(screen.getByRole('link', { name: 'Projects' }), keys);

    expect(cancelled).toEqual([false]);
  });

  it('let a plain left-click follow a plain internal anchor', async () => {
    await renderSite();

    fireEvent.click(screen.getByRole('link', { name: 'Cookie Policy' }));

    expect(cancelled).toEqual([false]);
  });
});

describe('root layout <head>', () => {
  it('leaves theme-color to the viewport export instead of adding its own tag', async () => {
    const [head] = await documentParts(null);

    const themeColorTags = elementsIn(childrenOf(head)).filter(
      (element) => element.type === 'meta' && element.props.name === 'theme-color',
    );
    expect(themeColorTags).toEqual([]);
  });
});
