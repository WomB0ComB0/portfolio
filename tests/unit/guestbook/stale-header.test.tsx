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
 * @file The header's count agrees with the list after a post. The whole page renders here (the
 * header's count line, the compose tile and the wall), with the auth store mocked as signed in and
 * fetch stubbed (nothing reaches the real guestbook):
 * - a stored post the server list doesn't have yet is counted: 28 notes under "28 notes", also when the
 *   refresh lands on a server instance whose list cache predates the post;
 * - once the server list has it, it is counted once (28, not 29);
 * - a post still sending, or one that failed, never moves the count;
 * - the first post into an empty guestbook gives the count 1 and its month.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  refresh: vi.fn(),
  fetch: vi.fn(),
  /** One synthetic sign-in, the same for every post here. */
  session: { kind: 'synthetic-session' },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock('@/core/auth', () => ({
  useAuth: () => ({
    phase: 'signed-in',
    user: { displayName: 'Jane Example', isAnonymous: false },
    method: null,
    error: null,
  }),
  useSignIn: () => [vi.fn(), false],
  useSignOut: () => [vi.fn(), false],
  prepareSignIn: vi.fn(),
  getIdToken: async () => 'test-header.test-payload.test-signature',
  signOut: vi.fn(),
  currentSession: () => h.session,
  currentUid: () => 'uid-synthetic',
}));

import { Guestbook } from '@/app/(routes)/(main)/(personal)/guestbook/_interface';
import type { GuestbookLoad, GuestbookMessage } from '@/lib/guestbook/types';

/** Synthetic: the 27 messages the server listed before the post, newest first. */
const SERVER_27: readonly GuestbookMessage[] = Array.from({ length: 27 }, (_, i) => ({
  id: `m${27 - i}`,
  authorName: `Visitor ${27 - i}`,
  message: `Message number ${27 - i}`,
  createdAt: new Date(Date.UTC(2025, 9, 27, 9, 19) + (26 - i) * 86_400_000).toISOString(),
}));
const TEXT = 'Hello, testing 123';
/** What the API stores and answers for the post. */
const SAVED: GuestbookMessage = {
  id: 'stored-new',
  authorName: 'Jane Example',
  message: TEXT,
  createdAt: '2026-11-09T07:19:00.000Z',
};

const ready = (messages: readonly GuestbookMessage[]): GuestbookLoad => ({
  state: 'ready',
  messages: [...messages],
  truncated: false,
  loadedAt: null,
});

/** The header's count line, as shown: "27 notes · since Oct 2025". */
const countLine = (): string | undefined =>
  document.querySelector('header [data-byline]')?.textContent?.replace(/\s+/g, ' ').trim();

const rows = () => document.querySelectorAll('li[data-message-row]');

const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** The post's fetch answers when the test says so. */
function heldFetch() {
  let release: (response: Response) => void = () => undefined;
  h.fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  return async (response: Response) => {
    await act(async () => {});
    await act(async () => release(response));
  };
}

const post = (text: string) => {
  fireEvent.change(screen.getByLabelText('Your message'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Post message' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', h.fetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the header after a post', () => {
  it('counts a stored post the server list does not have yet, but not one still sending', async () => {
    const settle = heldFetch();
    const { rerender } = render(<Guestbook load={ready(SERVER_27)} />);
    expect(countLine()).toBe('27 notes · since Oct 2025');

    post(TEXT);
    expect(rows()).toHaveLength(28);
    expect(countLine()).toBe('27 notes · since Oct 2025');

    await settle(answer(201, SAVED));
    expect(rows()).toHaveLength(28);
    expect(countLine()).toBe('28 notes · since Oct 2025');

    // The refresh landed on a server instance whose list cache predates the post.
    rerender(<Guestbook load={ready(SERVER_27)} />);
    expect(h.refresh).toHaveBeenCalled();
    expect(rows()).toHaveLength(28);
    expect(countLine()).toBe('28 notes · since Oct 2025');
  });

  it('counts the post once when the server list has it', async () => {
    h.fetch.mockResolvedValueOnce(answer(201, SAVED));
    const { rerender } = render(<Guestbook load={ready(SERVER_27)} />);
    post(TEXT);
    await act(async () => {});

    rerender(<Guestbook load={ready([SAVED, ...SERVER_27])} />);

    expect(rows()).toHaveLength(28);
    expect(countLine()).toBe('28 notes · since Oct 2025');
  });

  it('leaves the count alone when the post fails', async () => {
    const settle = heldFetch();
    render(<Guestbook load={ready(SERVER_27)} />);
    post(TEXT);

    await settle(answer(400, { error: 'Invalid message' }));

    expect(rows()).toHaveLength(27);
    expect(countLine()).toBe('27 notes · since Oct 2025');
  });

  it('gives the first post into an empty guestbook the count 1 and its month', async () => {
    h.fetch.mockResolvedValueOnce(answer(201, SAVED));
    render(<Guestbook load={ready([])} />);
    expect(countLine()).toBe('0 notes');

    post(TEXT);
    await act(async () => {});

    expect(rows()).toHaveLength(1);
    expect(countLine()).toBe('1 note · since Nov 2026');
  });
});
