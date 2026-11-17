// @vitest-environment node
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
 * Next's server-action 404 path renders the root not-found without the root layout. Keep the
 * real shell and kbar hooks: replacing the palette or navs with stubs hides the missing context.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KBarProvider } from 'kbar';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));
// The footer imports the shared fetcher; no external service is used by this server render.
vi.mock('@/env', () => ({ env: { NODE_ENV: 'test' }, default: { NODE_ENV: 'test' } }));

import NotFoundPage from '@/app/not-found';

describe('root not-found server rendering', () => {
  it.each([
    ['no providers', (page: ReactNode) => page],
    ['only kbar', (page: ReactNode) => <KBarProvider>{page}</KBarProvider>],
    [
      'only queries',
      (page: ReactNode) => (
        <QueryClientProvider client={new QueryClient()}>{page}</QueryClientProvider>
      ),
    ],
  ])('renders the recovery links with %s', (_name, wrap) => {
    const html = renderToString(wrap(<NotFoundPage />));

    expect(html).toContain('Page not found');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/projects"');
    expect(html).toContain('href="https://status.mikeodnis.dev"');
    expect(html).toContain('<main');
    expect(html).not.toContain('Search pages and commands');
    expect(html).not.toContain('to search');
  });

  it('still renders inside the root layout for an ordinary unmatched URL', () => {
    const html = renderToString(
      <KBarProvider>
        <QueryClientProvider client={new QueryClient()}>
          <NotFoundPage />
        </QueryClientProvider>
      </KBarProvider>,
    );

    expect(html).toContain('Page not found');
    expect(html).toContain('id="main-content"');
    expect(html).toContain('Search pages and commands');
    expect(html).toContain('Skip to content');
  });
});
