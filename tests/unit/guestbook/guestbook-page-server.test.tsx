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
 * @file The guestbook page imports its interface directly and awaits nothing, so it needs no
 * loading.tsx: its own server HTML already has the header, the sign-in card and the island's
 * message skeleton. A segment loading.tsx would only show a second, different skeleton first.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Effect } from 'effect';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// t3-env validates on import; the page needs no real configuration here.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// A signed-out visitor, without Firebase.
vi.mock('@/core/auth', () => ({
  useCurrentUser: () => null,
  useSignIn: () => [vi.fn(), false],
  useSignOut: () => [vi.fn(), false],
}));
vi.mock('@/hooks', () => ({
  usePostMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
// The messages never arrive, so the list stays in its loading state.
vi.mock('@/lib/http-clients/effect-fetcher', () => ({ get: () => Effect.never }));

import { Guestbook } from '@/app/(routes)/(main)/(personal)/guestbook/_interface/guestbook/guestbook';
import GuestbookPage from '@/app/(routes)/(main)/(personal)/guestbook/page';

// Vitest runs from the repository root (where vitest.config.ts lives).
const ROUTE_DIR = join(process.cwd(), 'src/app/(routes)/(main)/(personal)/guestbook');
const LOADING_FILES = ['loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js'] as const;

/** The page's server HTML, parsed so it can be queried. */
const renderPageHtml = (): HTMLElement => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement('div');
  container.innerHTML = renderToString(
    <QueryClientProvider client={client}>{GuestbookPage()}</QueryClientProvider>,
  );
  return container;
};

const headingNamed = (root: HTMLElement, level: 'h1' | 'h2' | 'h3', name: string) =>
  Array.from(root.querySelectorAll(level)).find((heading) => heading.textContent?.trim() === name);

describe('guestbook page', () => {
  it('renders the interface directly, with no next/dynamic wrapper', () => {
    const element: ReactElement = GuestbookPage();

    expect(element.type).toBe(Guestbook);
  });

  it('has no loading.tsx, whose skeleton would differ from the one the page shows next', () => {
    const present = LOADING_FILES.filter((file) => existsSync(join(ROUTE_DIR, file)));

    expect(present).toEqual([]);
  });

  it('server-renders the header and the sign-in card before any message loads', () => {
    const page = renderPageHtml();

    expect(headingNamed(page, 'h1', 'Guestbook')).toBeDefined();
    expect(headingNamed(page, 'h3', 'Welcome!')).toBeDefined();
    expect(page.querySelectorAll('button')).toHaveLength(3);
  });

  it("shows the island's own message skeleton while the messages load", () => {
    const page = renderPageHtml();

    const heading = headingNamed(page, 'h2', 'Recent Messages');
    const list = heading?.parentElement?.nextElementSibling;
    expect(list?.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    // The count is a placeholder too, not a "0 messages" that jumps once the list arrives.
    expect(heading?.parentElement?.querySelector('.animate-pulse')).not.toBeNull();
    expect(page.textContent).not.toMatch(/\d+ messages?\b/);
    expect(page.textContent).not.toContain('No messages yet');
    expect(page.textContent).not.toContain('Unable to Load Messages');
  });
});
