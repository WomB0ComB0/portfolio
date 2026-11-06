/**
 * Copyright 2026 Mike Odnis
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
 * @file src/app/(routes)/layout.tsx is the one shell every route renders in, under one
 * long-lived QueryClient.
 *
 * The route-group layout owns the landmarks (pages render none of their own), so each route has
 * one `<main>`, one footer and one nav per breakpoint. GlobalProvider sits above it in the root
 * layout and re-renders on navigation; its QueryClient must survive that, or every re-render
 * drops the query cache and refetches the page's data.
 */

import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GlobalProvider } from '@/app/_providers/global-provider';
import SiteLayout from '@/app/(routes)/layout';

const { passThrough } = vi.hoisted(() => ({
  passThrough: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/projects' }));
// The command palette and the tile spotlight's pointer listener are not under test.
vi.mock('@/components/cmd', () => ({ default: () => null }));
vi.mock('@/components/console/spotlight-root', () => ({ SpotlightRoot: () => null }));
// layout.tsx imports the navs and footer from its own barrel.
vi.mock('@/components/layout', () => ({
  NavBar: () => <nav aria-label="Main navigation" />,
  MobileNavBar: () => <nav aria-label="Mobile navigation" />,
  Footer: () => <footer />,
}));
// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// The real factory module also pulls in the Elysia API app, which Vitest can't load. Like the
// real one in a client component (React's cache() memoizes nothing there), every call of the
// factory builds a new client.
vi.mock('@/providers/server', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  return { createQueryClient: () => () => new QueryClient() };
});
// Browser-only or analytics children of the provider; they play no part here.
vi.mock('@/app/_components', () => ({ WebVitals: () => null }));
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));
vi.mock('@tanstack/react-query-devtools', () => ({ ReactQueryDevtools: () => null }));
vi.mock('nuqs/adapters/next/app', () => ({ NuqsAdapter: passThrough }));
vi.mock('kbar', () => ({ KBarProvider: passThrough }));

/** Whether CSS hides this element at the given side of the `lg` breakpoint (Tailwind classes). */
const hiddenBelowLg = (element: Element): boolean => element.closest('.hidden') !== null;
const hiddenFromLg = (element: Element): boolean => element.closest('.lg\\:hidden') !== null;

/** Page content that records the QueryClient it reads on every render. */
const seenClient = vi.fn<(client: QueryClient) => void>();
const ClientProbe = () => {
  seenClient(useQueryClient());
  return <p>Page content</p>;
};

/** The whole tree under the root layout's `<body>`: providers, shell, page. */
const site = () => (
  <GlobalProvider>
    <SiteLayout>
      <ClientProbe />
    </SiteLayout>
  </GlobalProvider>
);

describe('route-group layout', () => {
  it('renders one main, one footer and one nav landmark per breakpoint', () => {
    render(
      <SiteLayout>
        <h1>Projects</h1>
      </SiteLayout>,
    );

    const [main, ...extraMains] = screen.getAllByRole('main');
    expect(extraMains).toEqual([]);
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toContainElement(screen.getByRole('heading', { name: 'Projects' }));
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);

    const navs = screen.getAllByRole('navigation');
    expect(navs.filter((nav) => !hiddenFromLg(nav))).toEqual([
      screen.getByRole('navigation', { name: 'Main navigation' }),
    ]);
    expect(navs.filter((nav) => !hiddenBelowLg(nav))).toEqual([
      screen.getByRole('navigation', { name: 'Mobile navigation' }),
    ]);
  });
});

describe('GlobalProvider around the route-group layout', () => {
  it('keeps one QueryClient when it re-renders', () => {
    const { rerender } = render(site());
    const main = screen.getByRole('main');
    rerender(site());

    const clients = seenClient.mock.calls.map(([client]) => client);
    expect(clients.length).toBeGreaterThanOrEqual(2);
    expect(new Set(clients).size).toBe(1);
    // The shell survives the provider's re-render too.
    expect(screen.getByRole('main')).toBe(main);
  });
});
