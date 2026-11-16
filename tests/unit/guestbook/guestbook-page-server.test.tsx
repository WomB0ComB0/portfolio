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
 * no pagination, no load-more, no infinite scroll, and nothing waits for JavaScript. The header's
 * count line states the count the notes add up to. The notes are a wall cut into year chapters
 * (a year heading and its count), newest first, with the dashed "Your note here" tile first in
 * the newest year. Every note's name, text and date are shown as published (typed line breaks
 * kept, no owner badge made from a name). Messages and names are plain text. The page has
 * designed empty, error and stale states, server-renders the sign-in tile without importing
 * Firebase, and has no loading.tsx (it renders once its loader answers, as /certifications does).
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

/** The header's count line, as shown: "3 notes · since Oct 2025". */
const countLine = (root: HTMLElement): string | undefined =>
  root.querySelector('header [data-byline]')?.textContent?.replace(/\s+/g, ' ').trim();

const rowsOf = (root: HTMLElement) => root.querySelectorAll('li[data-message-row]');
const listOf = (root: HTMLElement) => root.querySelector('section[data-guestbook-notes]');
/** Each year chapter as [its heading, its byline, its notes' texts]. */
const chaptersOf = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('section[data-guestbook-notes] section[data-chapter]')).map(
    (chapter) => [
      chapter.querySelector('h2')?.textContent,
      chapter.querySelector('[data-byline]')?.textContent,
      Array.from(chapter.querySelectorAll('li[data-message-row]')).map(
        (row) => row.querySelector('p')?.textContent,
      ),
    ],
  );

beforeEach(() => {
  h.load.mockReset();
});

describe('guestbook page on the server', () => {
  it('renders every message in the HTML, with no pagination or load-more', async () => {
    const page = await renderPage(ready(Array.from({ length: 60 }, (_, i) => message(i))));

    expect(rowsOf(page)).toHaveLength(60);
    expect(page.textContent).not.toMatch(/load more/i);
    expect(listOf(page)).toHaveAttribute('data-state', 'ready');
    expect(listOf(page)).toHaveAttribute('aria-label', 'Notes, newest first');
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(page.querySelector('h1')?.textContent).toBe('Guestbook');
  });

  it('states the count the notes add up to, and the month of the first one', async () => {
    const page = await renderPage(ready([message(2), message(1), message(0)]));

    expect(countLine(page)).toBe('3 notes · since Oct 2025');
    expect(rowsOf(page)).toHaveLength(3);
    // A count line, not stat tiles.
    expect(page.querySelector('dl')).toBeNull();
  });

  it('cuts the wall into years, newest first, each with a heading and its count', async () => {
    const page = await renderPage(
      ready([
        message(1, { message: 'Newest', createdAt: '2026-11-09T07:19:00.000Z' }),
        message(2, { message: 'Second', createdAt: '2025-11-18T10:00:00.000Z' }),
        message(3, { message: 'Third', createdAt: '2025-10-27T09:19:00.000Z' }),
      ]),
    );

    expect(chaptersOf(page)).toEqual([
      ['2026', '1 note', ['Newest']],
      ['2025', '2 notes', ['Second', 'Third']],
    ]);
  });

  it('sizes each year by the chapter system, its count beside it on the rule', async () => {
    const sizesOf = (root: HTMLElement) =>
      Array.from(root.querySelectorAll('section[data-guestbook-notes] section[data-chapter]')).map(
        (chapter) => chapter.getAttribute('data-chapter'),
      );
    const oneNoteFirst = await renderPage(
      ready([
        message(1, { createdAt: '2026-11-09T07:19:00.000Z' }),
        message(2, { createdAt: '2025-11-18T10:00:00.000Z' }),
        message(3, { createdAt: '2025-10-27T09:19:00.000Z' }),
      ]),
    );
    const fullerFirst = await renderPage(
      ready([
        message(1, { createdAt: '2026-11-09T07:19:00.000Z' }),
        message(2, { createdAt: '2026-01-02T10:00:00.000Z' }),
        message(3, { createdAt: '2025-10-27T09:19:00.000Z' }),
      ]),
    );

    // A one-note year is a heading on the rule, never a numeral over one note.
    expect(sizesOf(oneNoteFirst)).toEqual(['inline', 'step']);
    expect(sizesOf(fullerFirst)).toEqual(['lead', 'inline']);
    // The count follows its year in the same heading line, not alone in a far column.
    for (const heading of oneNoteFirst.querySelectorAll('section[data-chapter] h2')) {
      expect(heading.nextElementSibling).toHaveAttribute('data-byline');
      expect(heading.parentElement?.tagName).toBe('HEADER');
    }
  });

  it('puts the dashed "Your note here" tile first in the newest year', async () => {
    const page = await renderPage(ready([message(2), message(1)]));
    const firstWall = page.querySelector('section[data-chapter] ol');

    expect(firstWall?.firstElementChild).toHaveAttribute('data-compose-tile');
    expect(firstWall?.firstElementChild?.querySelector('h3')?.textContent).toBe('Your note here');
    expect(page.querySelectorAll('[data-compose-tile]')).toHaveLength(1);
  });

  it("shows every note's name, text and date as published, line breaks kept, no badge", async () => {
    const page = await renderPage(
      ready([
        message(1, {
          authorName: 'Mike Odnis',
          message: 'Hello, testing 123',
          createdAt: '2026-11-09T07:19:00.000Z',
        }),
        message(2, {
          authorName: 'Anonymous',
          message: 'W port.\n\n-V',
          createdAt: '2025-10-27T09:19:00.000Z',
        }),
      ]),
    );
    const [first, second] = Array.from(rowsOf(page));

    expect(first?.querySelector('p')?.textContent).toBe('Hello, testing 123');
    expect(first?.textContent).toMatch(/Mike Odnis\s*·\s*Nov 2026$/);
    expect(first?.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-09');
    expect(second?.querySelector('p')?.textContent).toBe('W port.\n\n-V');
    expect(second?.textContent).toMatch(/Anonymous\s*·\s*Oct 2025$/);
    // The owner's notes are not marked from a display name anyone could take.
    expect(page.textContent).not.toMatch(/site owner/i);
  });

  // The loader hands the page plain text (it decodes legacy author names itself, see
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

  it('server-renders the sign-in tile without importing Firebase', async () => {
    const page = await renderPage(ready([message(1)]));

    expect(page.textContent).toContain('Your note here');
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

  it('shows a designed empty state over the sign-in tile', async () => {
    const page = await renderPage(ready([]));

    expect(listOf(page)).toHaveAttribute('data-state', 'empty');
    expect(chaptersOf(page)).toEqual([['No messages yet', undefined, []]]);
    expect(page.textContent).toContain('Be the first to sign the guestbook.');
    expect(countLine(page)).toBe('0 notes');
    expect(rowsOf(page)).toHaveLength(0);
    expect(page.querySelectorAll('[data-compose-tile]')).toHaveLength(1);
  });

  it('shows a designed error state, and keeps the sign-in tile', async () => {
    const page = await renderPage({
      state: 'error',
      messages: [],
      truncated: false,
      loadedAt: null,
    });

    expect(listOf(page)).toHaveAttribute('data-state', 'error');
    expect(page.querySelector('section[data-chapter] h2')?.textContent).toBe(
      "Messages couldn't load",
    );
    expect(countLine(page)).toMatch(/unavailable/);
    expect(page.textContent).toContain('Your note here');
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

  it('keeps the stale warning when the last good list was empty', async () => {
    const page = await renderPage({
      state: 'stale',
      messages: [],
      truncated: false,
      loadedAt: Date.now() - 5 * 60_000,
    });

    expect(listOf(page)).toHaveAttribute('data-state', 'stale');
    expect(page.textContent).toContain(
      "The guestbook's database isn't answering. It had no messages when it last answered, 5 min ago; newer ones may be missing.",
    );
    expect(page.textContent).not.toContain('these are the messages');
    expect(page.textContent).not.toContain('No messages yet');
    expect(rowsOf(page)).toHaveLength(0);
  });

  it('says when the safety cap cut the list', async () => {
    const page = await renderPage(ready([message(1), message(2)], true));

    expect(page.textContent).toContain('Showing the newest 2 messages.');
    expect(countLine(page)).toBe('2+ notes · since Oct 2025');
  });

  it('has no loading.tsx: the page renders once its loader answers', () => {
    const present = LOADING_FILES.filter((file) => existsSync(join(ROUTE_DIR, file)));

    expect(present).toEqual([]);
  });
});
