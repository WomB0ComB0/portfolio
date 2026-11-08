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
 * @file Posting from the guestbook's client island, with the API mocked (fetch is stubbed; nothing
 * reaches the real guestbook):
 * - the message shows at the top of the list at once, marked as posting, and the box clears;
 * - the API's answer confirms it (its date replaces "Posting…"), the server list is refreshed,
 *   and once the server lists it the posted copy is not shown twice;
 * - a failure removes the row again (rollback), puts the text back in the box exactly (the box is
 *   read-only while the post is in flight) and says so, without marking the text invalid;
 * - focus never drops to the page: Post stays focusable while it sends (aria-disabled, never
 *   disabled), and afterwards focus is in the box, unless the visitor moved it elsewhere;
 * - text and author go to the API exactly as typed: never HTML-escaped, and no email;
 * - a draft that is empty, too long or only tags is explained and never sent; nothing cuts a
 *   long draft silently (no maxLength), and the counter turns red past 280;
 * - when the check would remove markup or a script prefix, the visitor sees what will be posted
 *   first, and a second press sends it;
 * - a rate-limited post says to wait.
 */

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ refresh: vi.fn(), fetch: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock('@/core/auth', () => ({
  useAuth: () => ({
    phase: 'signed-in',
    user: { displayName: "Ada O'Brien", isAnonymous: false },
    method: null,
    error: null,
  }),
  useSignIn: () => [vi.fn(), false],
  useSignOut: () => [vi.fn(), false],
  prepareSignIn: vi.fn(),
}));

import { GuestbookBoard } from '@/app/(routes)/(main)/(personal)/guestbook/_components/guestbook-board';
import { MessageRow } from '@/app/(routes)/(main)/(personal)/guestbook/_components/message-row';
import type { GuestbookMessage } from '@/lib/guestbook/types';

const EXISTING: GuestbookMessage = {
  id: 'm1',
  authorName: 'Jane Example',
  message: 'An older note',
  createdAt: '2025-10-27T09:19:00.000Z',
};
const SAVED: GuestbookMessage = {
  id: 'new-1',
  authorName: "Ada O'Brien",
  message: "It's me & you",
  createdAt: '2026-11-07T18:00:00.000Z',
};

const board = (messages: readonly GuestbookMessage[], listState: 'ready' | 'empty' = 'ready') => (
  <GuestbookBoard
    knownIds={messages.map((m) => m.id)}
    listState={listState}
    notice={listState === 'empty' ? <p>No messages yet</p> : null}
  >
    {messages.map((m) => (
      <MessageRow key={m.id} message={m} />
    ))}
  </GuestbookBoard>
);

const box = () => screen.getByLabelText('Your message');
const rows = () => Array.from(document.querySelectorAll('li[data-message-row]'));

const send = (text: string) => {
  fireEvent.change(box(), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Post message' }));
};

const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A fetch that settles when the test says so. */
function deferredFetch() {
  let settle: (response: Response | Error) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve, reject) => {
        settle = (value) => (value instanceof Error ? reject(value) : resolve(value));
      }),
  );
  return (value: Response | Error) => act(async () => settle(value));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', h.fetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('posting a guestbook message', () => {
  it('shows the message at once, then confirms it and refreshes the server list', async () => {
    const settle = deferredFetch();
    render(board([EXISTING]));

    send("It's me & you");

    const [first] = rows();
    expect(rows()).toHaveLength(2);
    expect(first).toHaveAttribute('data-state', 'loading');
    expect(first).toHaveTextContent("It's me & you");
    expect(first).toHaveTextContent('Posting…');
    expect(box()).toHaveValue('');

    const [url, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/messages');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      authorName: "Ada O'Brien",
      message: "It's me & you",
    });

    await settle(answer(201, SAVED));

    expect(rows()[0]).toHaveAttribute('data-state', 'ready');
    expect(within(rows()[0] as HTMLElement).getByText('Nov 2026')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Posted. Thanks for signing.');
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it('shows a posted message once after the server list includes it', async () => {
    h.fetch.mockResolvedValueOnce(answer(201, SAVED));
    const { rerender } = render(board([EXISTING]));
    send("It's me & you");
    await act(async () => {});

    rerender(board([SAVED, EXISTING]));

    expect(rows()).toHaveLength(2);
    expect(rows().filter((row) => row.textContent?.includes("It's me & you"))).toHaveLength(1);
  });

  it('rolls the row back, keeps the text and says so when the API fails', async () => {
    const settle = deferredFetch();
    render(board([EXISTING]));

    send("It's me & you");
    expect(rows()).toHaveLength(2);
    await settle(answer(500, { error: 'boom' }));

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('An older note');
    expect(box()).toHaveValue("It's me & you");
    expect(screen.getByRole('alert')).toHaveTextContent("Your message wasn't posted");
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('rolls back on a network error and on an answer that is not a message', async () => {
    h.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(board([EXISTING]));

    send('First try');
    await act(async () => {});
    expect(rows()).toHaveLength(1);
    expect(box()).toHaveValue('First try');

    h.fetch.mockResolvedValueOnce(answer(201, { unexpected: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Post message' }));
    await act(async () => {});
    expect(rows()).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent("Your message wasn't posted");
  });

  it('replaces the empty state with the first message posted', async () => {
    h.fetch.mockResolvedValueOnce(answer(201, SAVED));
    render(board([], 'empty'));
    expect(screen.getByText('No messages yet')).toBeInTheDocument();

    send("It's me & you");
    await act(async () => {});

    expect(screen.queryByText('No messages yet')).toBeNull();
    expect(rows()).toHaveLength(1);
  });

  it.each([
    ['only tags', '<b></b>', 'only HTML tags'],
    ['too long', 'a'.repeat(281), 'Keep it to 280 characters.'],
  ])('explains a draft that is %s and sends nothing', (_case, text, error) => {
    render(board([EXISTING]));

    send(text);

    expect(screen.getByRole('alert')).toHaveTextContent(error);
    expect(h.fetch).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(1);
  });

  it('keeps the counter in tabular figures', () => {
    render(board([EXISTING]));

    fireEvent.change(box(), { target: { value: 'Hello' } });

    expect(screen.getByText('5 / 280')).toHaveClass('tabular-nums');
  });
});

describe('the compose box while a post is in flight', () => {
  const post = () => screen.getByRole('button', { name: /Post message|Posting/ });

  it('keeps Post focusable while it sends, then puts focus in the box', async () => {
    const settle = deferredFetch();
    render(board([EXISTING]));
    fireEvent.change(box(), { target: { value: 'Hello there' } });
    post().focus();

    fireEvent.click(post());

    expect(post()).toHaveAttribute('aria-disabled', 'true');
    expect(post()).not.toBeDisabled();
    expect(post()).toHaveFocus();
    await settle(answer(201, SAVED));
    expect(box()).toHaveFocus();
  });

  it('makes the box read-only while sending, so a failed post comes back exactly', async () => {
    const settle = deferredFetch();
    render(board([EXISTING]));
    send('Hello from the review');

    expect(box()).toHaveAttribute('readonly');
    await settle(new TypeError('Failed to fetch'));

    expect(box()).not.toHaveAttribute('readonly');
    expect(box()).toHaveValue('Hello from the review');
    expect(box()).toHaveFocus();
  });

  it('says a failed post failed without marking the text invalid', async () => {
    const settle = deferredFetch();
    render(board([EXISTING]));
    send('Perfectly valid');
    await settle(new TypeError('Failed to fetch'));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("Your message wasn't posted");
    expect(box()).not.toHaveAttribute('aria-invalid');
    expect(box().getAttribute('aria-describedby')?.split(' ')).toContain(alert.id);
  });

  it('leaves focus where the visitor moved it during the post', async () => {
    const settle = deferredFetch();
    render(board([EXISTING]));
    send('Hello there');
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    elsewhere.focus();

    await settle(answer(201, SAVED));

    expect(elsewhere).toHaveFocus();
    elsewhere.remove();
  });

  it('says to wait when the guestbook is rate limited', async () => {
    h.fetch.mockResolvedValueOnce(answer(429, { error: 'Too many requests' }));
    render(board([EXISTING]));

    send('Hello there');
    await act(async () => {});

    expect(screen.getByRole('alert')).toHaveTextContent('a few minutes');
    expect(box()).toHaveValue('Hello there');
  });
});

describe('drafts the check would change', () => {
  it('never cuts a long draft: no maxLength, a red counter, and an invalid field on Post', () => {
    render(board([EXISTING]));

    fireEvent.change(box(), { target: { value: 'a'.repeat(285) } });

    expect(box()).not.toHaveAttribute('maxLength');
    expect(screen.getByText('285 / 280')).toHaveClass('text-down');
    fireEvent.click(screen.getByRole('button', { name: 'Post message' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Keep it to 280 characters.');
    expect(box()).toHaveAttribute('aria-invalid', 'true');
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it('shows what will be posted when markup or a script prefix goes, and sends on a second press', async () => {
    h.fetch.mockResolvedValueOnce(answer(201, { ...SAVED, message: 'Love the animations' }));
    render(board([EXISTING]));

    send('Love the javascript: animations <3 ->');

    expect(h.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Love the animations');
    expect(box()).toHaveValue('Love the javascript: animations <3 ->');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Post message' }));
    });

    const [, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).message).toBe('Love the animations');
  });

  it('asks again when the draft changes after the notice', () => {
    render(board([EXISTING]));
    send('<i>hi</i> there');
    expect(screen.getByRole('status')).toHaveTextContent('hi there');

    send('<b>bye</b> now');

    expect(h.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('bye now');
  });

  it('sends a draft that only loses whitespace at once', async () => {
    h.fetch.mockResolvedValueOnce(answer(201, SAVED));
    render(board([EXISTING]));

    send('  Hello\n\n   there  ');
    await act(async () => {});

    const [, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).message).toBe('Hello there');
  });
});
