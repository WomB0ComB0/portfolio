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
 * @file The guestbook page loads its messages on the server, so its HTML has every one of them:
 * no pagination, no load-more, no infinite scroll, and nothing waits for JavaScript. The header
 * states the count the rows add up to. Messages and names are plain text. The page has designed
 * empty, error and stale states, server-renders the sign-in card without importing Firebase, and
 * has no loading.tsx (it renders once its loader answers, as /certifications does).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GuestbookLoad, GuestbookMessage } from '@/lib/guestbook/types';

const h = vi.hoisted(() => ({ load: vi.fn(), appLoaded: false, authLoaded: false }));

// t3-env validates on import; the page needs no real configuration here.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/guestbook/messages', () => ({ loadGuestbook: h.load }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('firebase/app', () => {
  h.appLoaded = true;
  return {};
});
vi.mock('firebase/auth', () => {
  h.authLoaded = true;
  return {};
});

import GuestbookPage from '@/app/(routes)/(main)/(personal)/guestbook/page';

// Vitest runs from the repository root (where vitest.config.ts lives).
const ROUTE_DIR = join(process.cwd(), 'src/app/(routes)/(main)/(personal)/guestbook');
const LOADING_FILES = ['loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js'] as const;

const message = (index: number, fields: Partial<GuestbookMessage> = {}): GuestbookMessage => ({
  id: `m${index}`,
  authorName: `Visitor ${index}`,
  message: `Message number ${index}`,
  createdAt: new Date(Date.UTC(2025, 9, 27, 9, 19) + index * 86_400_000).toISOString(),
  ...fields,
});

const ready = (messages: GuestbookMessage[], truncated = false): GuestbookLoad => ({
  state: 'ready',
  messages,
  truncated,
  loadedAt: null,
});

/** The page's server HTML, parsed so it can be queried. */
async function renderPage(load: GuestbookLoad): Promise<HTMLElement> {
  h.load.mockResolvedValueOnce(load);
  const container = document.createElement('div');
  container.innerHTML = renderToString(await GuestbookPage());
  return container;
}

/** A header figure by its label, as shown. */
const figure = (root: HTMLElement, label: string): string | undefined =>
  Array.from(root.querySelectorAll('dl[aria-label="Guestbook totals"] > div'))
    .find((item) => item.querySelector('dt')?.textContent === label)
    ?.querySelector('dd')
    ?.textContent?.trim();

const rowsOf = (root: HTMLElement) => root.querySelectorAll('li[data-message-row]');
const listOf = (root: HTMLElement) =>
  root.querySelector('section[aria-labelledby="guestbook-messages"]');

beforeEach(() => {
  h.load.mockReset();
});

describe('guestbook page on the server', () => {
  it('renders every message in the HTML, with no pagination or load-more', async () => {
    const page = await renderPage(ready(Array.from({ length: 60 }, (_, i) => message(i))));

    expect(rowsOf(page)).toHaveLength(60);
    expect(page.textContent).not.toMatch(/load more/i);
    expect(listOf(page)).toHaveAttribute('data-state', 'ready');
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(page.querySelector('h1')?.textContent).toBe('Guestbook');
  });

  it('states the count the rows add up to, and the month of the first message', async () => {
    const page = await renderPage(ready([message(2), message(1), message(0)]));

    expect(figure(page, 'messages')).toBe('3');
    expect(figure(page, 'first message')).toBe('Oct 2025');
    expect(rowsOf(page)).toHaveLength(3);
  });

  // The loader hands the page plain text (it decodes legacy records itself, see
  // messages-loader.test.ts); the page renders it as text, escaped once by React.
  it('renders messages and names as text, never as markup or entities', async () => {
    const page = await renderPage(
      ready([
        message(1, { message: '<script>alert(1)</script>', authorName: "D'Angelo" }),
        message(2, { message: "It's a <b>test</b> & more" }),
      ]),
    );

    expect(page.querySelector('script')).toBeNull();
    expect(page.querySelector('li b')).toBeNull();
    expect(page.textContent).toContain('<script>alert(1)</script>');
    expect(page.textContent).toContain("D'Angelo");
    expect(page.textContent).toContain("It's a <b>test</b> & more");
    expect(page.textContent).not.toMatch(/&(amp|lt|gt|quot|#0?39);/);
  });

  it('server-renders the sign-in card without importing Firebase', async () => {
    const page = await renderPage(ready([message(1)]));

    expect(page.textContent).toContain('Sign the guestbook');
    expect(Array.from(page.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
      'Sign in',
    ]);
    expect(h.appLoaded).toBe(false);
    expect(h.authLoaded).toBe(false);
  });

  it('has no entrance animation and no MagicCard left in the HTML', async () => {
    const page = await renderPage(ready([message(1), message(2)]));

    expect(page.querySelectorAll('[style*="opacity"]')).toHaveLength(0);
    expect(page.innerHTML).not.toMatch(/magic|framer|motion/i);
  });

  it('shows a designed empty state', async () => {
    const page = await renderPage(ready([]));

    expect(listOf(page)).toHaveAttribute('data-state', 'empty');
    expect(page.textContent).toContain('No messages yet');
    expect(figure(page, 'messages')).toBe('0');
    expect(rowsOf(page)).toHaveLength(0);
  });

  it('shows a designed error state, and keeps the sign-in card', async () => {
    const page = await renderPage({
      state: 'error',
      messages: [],
      truncated: false,
      loadedAt: null,
    });

    expect(listOf(page)).toHaveAttribute('data-state', 'error');
    expect(page.textContent).toContain("Messages couldn't load");
    expect(figure(page, 'messages')).toMatch(/unavailable/);
    expect(page.textContent).toContain('Sign the guestbook');
  });

  it('marks a stale list and says so', async () => {
    const page = await renderPage({
      state: 'stale',
      messages: [message(1)],
      truncated: false,
      loadedAt: Date.now() - 5 * 60_000,
    });

    expect(listOf(page)).toHaveAttribute('data-state', 'stale');
    expect(page.textContent).toMatch(/newer messages may be missing/i);
    expect(rowsOf(page)).toHaveLength(1);
  });

  it('says when the safety cap cut the list', async () => {
    const page = await renderPage(ready([message(1), message(2)], true));

    expect(page.textContent).toContain('Showing the newest 2 messages.');
    expect(figure(page, 'messages')).toBe('2+');
  });

  it('has no loading.tsx: the page renders once its loader answers', () => {
    const present = LOADING_FILES.filter((file) => existsSync(join(ROUTE_DIR, file)));

    expect(present).toEqual([]);
  });
});
