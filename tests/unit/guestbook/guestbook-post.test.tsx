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
 * - only an answer that refused the post (4xx) says it wasn't posted; a timeout, a dropped
 *   connection, a 5xx or an unreadable answer may follow a stored write, so the card says the post
 *   couldn't be confirmed (never "try again" for a stored post) and that posting it again as it is
 *   won't add it twice (or, for a post sent without a requestId, to check the list before posting
 *   again), the server list is refreshed at once, and once more after the server's list cache has
 *   expired;
 * - every post carries a requestId (a UUID), which the API stores once per poster: the same
 *   visitor posting the same text again after an unconfirmed outcome sends the same one (kept
 *   through other texts, unconfirmed ones included, through answers that stored nothing, such as a
 *   429 or a 401's resend, and through someone else's posts on this page; a rate-limited repeat
 *   still says the post couldn't be confirmed), and a confirmed post, a changed text or a 409
 *   (the API had that requestId for other text) gets a new one; a browser without
 *   crypto.randomUUID posts without one;
 * - focus never drops to the page: Post stays focusable while it sends (aria-disabled, never
 *   disabled), and afterwards focus is in the box, unless the visitor moved it elsewhere;
 * - the text goes to the API exactly as typed (never HTML-escaped, no email, no author: the server
 *   takes the name from the sign-in), with its requestId and the visitor's Firebase ID token as a
 *   bearer token;
 * - a 401 stores nothing, so the post is sent once more with a token Firebase refreshes on
 *   purpose (a skewed clock can make the cached one look expired to the server); when that is
 *   refused too, the visitor is signed out, so the card offers sign-in as its message says (a
 *   sign-out that never finishes is waited for only as long as the post, then the 401 is answered);
 * - when the sign-in is not accepted (401 twice, or there is no token to send) nothing is posted,
 *   the text is kept in the box and the card says to sign in again; when the token cannot be
 *   fetched (offline), nothing is sent and the card says it wasn't posted;
 * - a draft that is empty, too long or only tags is explained and never sent; nothing cuts a
 *   long draft silently (no maxLength), and the counter turns red past 280;
 * - when the check would remove markup or a script prefix, the visitor sees what will be posted
 *   first, and a second press sends it;
 * - a rate-limited post says to wait.
 */

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  refresh: vi.fn(),
  fetch: vi.fn(),
  getIdToken: vi.fn(),
  signOut: vi.fn(),
  /** Ada's one sign-in, the same for every post here. */
  session: { kind: 'synthetic-session' },
  /** Synthetic: the signed-in visitor's uid, which a test may switch to someone else's. */
  uid: { current: 'uid-ada' },
}));

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
  getIdToken: h.getIdToken,
  signOut: h.signOut,
  currentSession: () => h.session,
  currentUid: () => h.uid.current,
}));

import { GuestbookBoard } from '@/app/(routes)/(main)/(personal)/guestbook/_components/guestbook-board';
import { MessageRow } from '@/app/(routes)/(main)/(personal)/guestbook/_components/message-row';
import { LIST_RECHECK_MS } from '@/app/(routes)/(main)/(personal)/guestbook/_components/use-posted-messages';
import {
  isOutcomeUnknown,
  POST_TIMEOUT_MS,
  PostFailedError,
  PostNotSentError,
} from '@/app/(routes)/(main)/(personal)/guestbook/_lib/post';
import { GUESTBOOK_TTL_MS } from '@/lib/guestbook/limits';
import type { GuestbookMessage } from '@/lib/guestbook/types';
import { logger } from '@/utils/logging';

/** JWT-shaped, synthetic: what the mocked auth store hands the post. */
const TOKEN = 'test-header.test-payload.test-signature';
/** A version 4 UUID, as crypto.randomUUID() gives: the post's requestId. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

/** Lets the post get its token and reach fetch. */
const tokenFetched = () => act(async () => {});

/** A fetch that settles when the test says so (once the post has reached it). */
function deferredFetch() {
  let settle: (response: Response | Error) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve, reject) => {
        settle = (value) => (value instanceof Error ? reject(value) : resolve(value));
      }),
  );
  return async (value: Response | Error) => {
    await tokenFetched();
    await act(async () => settle(value));
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', h.fetch);
  h.getIdToken.mockResolvedValue(TOKEN);
  h.signOut.mockResolvedValue(undefined);
  h.uid.current = 'uid-ada';
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
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

    await tokenFetched();
    const [url, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/messages');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(String(init.body))).toEqual({
      message: "It's me & you",
      requestId: expect.stringMatching(UUID),
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

  it('rolls the row back, keeps the text and says it was not posted when the API refuses it', async () => {
    const settle = deferredFetch();
    render(board([EXISTING]));

    send("It's me & you");
    expect(rows()).toHaveLength(2);
    await settle(answer(400, { error: 'Invalid message' }));

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('An older note');
    expect(box()).toHaveValue("It's me & you");
    expect(screen.getByRole('alert')).toHaveTextContent("Your message wasn't posted");
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('says a post the API failed (500) could not be confirmed, and refreshes the list', async () => {
    const settle = deferredFetch();
    render(board([EXISTING]));

    send("It's me & you");
    await settle(answer(500, { error: 'boom' }));

    expect(rows()).toHaveLength(1);
    expect(box()).toHaveValue("It's me & you");
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't confirm your message was posted",
    );
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it('says a timed-out post could not be confirmed, keeps the text and refreshes the list', async () => {
    h.fetch.mockRejectedValueOnce(new DOMException('signal timed out', 'TimeoutError'));
    render(board([EXISTING]));

    send('hello');
    await act(async () => {});

    expect(rows()).toHaveLength(1);
    expect(box()).toHaveValue('hello');
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't confirm your message was posted",
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent("wasn't posted");
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it('says posting it again as it is will not add it twice, and that the list will update', async () => {
    h.fetch.mockRejectedValueOnce(new DOMException('signal timed out', 'TimeoutError'));
    render(board([EXISTING]));

    send('hello');
    await act(async () => {});

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("posting it again as it is won't add it twice");
    expect(alert).toHaveTextContent('The list will update in about a minute');
    expect(alert).not.toHaveTextContent("if your message isn't there then");
    expect(alert).not.toHaveTextContent('in a moment');
  });

  it('rolls back on a network error and on an answer that is not a message, unconfirmed', async () => {
    h.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(board([EXISTING]));

    send('First try');
    await act(async () => {});
    expect(rows()).toHaveLength(1);
    expect(box()).toHaveValue('First try');
    expect(h.refresh).toHaveBeenCalledTimes(1);

    h.fetch.mockResolvedValueOnce(answer(201, { unexpected: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Post message' }));
    await act(async () => {});
    expect(rows()).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't confirm your message was posted",
    );
    expect(h.refresh).toHaveBeenCalledTimes(2);
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
    expect(alert).toHaveTextContent("We couldn't confirm your message was posted");
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

    expect(screen.getByRole('alert')).toHaveTextContent("Your message wasn't posted");
    expect(screen.getByRole('alert')).toHaveTextContent('a few minutes');
    expect(box()).toHaveValue('Hello there');
    expect(h.refresh).not.toHaveBeenCalled();
  });
});

describe('checking the list again after a post that could not be confirmed', () => {
  const timedOut = () => new DOMException('signal timed out', 'TimeoutError');
  const wait = (ms: number) =>
    act(async () => {
      vi.advanceTimersByTime(ms);
    });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits out the server list cache on every instance before it checks', () => {
    expect(LIST_RECHECK_MS).toBeGreaterThan(GUESTBOOK_TTL_MS);
    // The card says "in about a minute".
    expect(LIST_RECHECK_MS).toBeLessThanOrEqual(90_000);
  });

  it('refreshes once more after the cache has expired, and keeps the text in the box', async () => {
    h.fetch.mockRejectedValueOnce(timedOut());
    render(board([EXISTING]));
    send('hello');
    await act(async () => {});
    expect(h.refresh).toHaveBeenCalledTimes(1);

    await wait(GUESTBOOK_TTL_MS);
    expect(h.refresh).toHaveBeenCalledTimes(1);
    await wait(LIST_RECHECK_MS - GUESTBOOK_TTL_MS);
    expect(h.refresh).toHaveBeenCalledTimes(2);
    await wait(LIST_RECHECK_MS * 2);
    expect(h.refresh).toHaveBeenCalledTimes(2);
    expect(box()).toHaveValue('hello');
  });

  it('checks once, counted from the latest unconfirmed post', async () => {
    h.fetch.mockRejectedValueOnce(timedOut());
    render(board([EXISTING]));
    send('hello');
    await act(async () => {});
    await wait(LIST_RECHECK_MS / 2);

    h.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fireEvent.click(screen.getByRole('button', { name: 'Post message' }));
    await act(async () => {});
    expect(h.refresh).toHaveBeenCalledTimes(2);

    await wait(LIST_RECHECK_MS / 2);
    expect(h.refresh).toHaveBeenCalledTimes(2);
    await wait(LIST_RECHECK_MS / 2);
    expect(h.refresh).toHaveBeenCalledTimes(3);
  });

  it('drops the later check when the page goes away', async () => {
    h.fetch.mockRejectedValueOnce(timedOut());
    const { unmount } = render(board([EXISTING]));
    send('hello');
    await act(async () => {});

    unmount();
    await wait(LIST_RECHECK_MS);

    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a confirmed post', 201, SAVED, 1],
    ['a refused post (400)', 400, { error: 'Invalid message' }, 0],
    ['a rate-limited post (429)', 429, { error: 'Too many requests' }, 0],
  ])('never checks later after %s', async (_case, status, body, refreshes) => {
    h.fetch.mockResolvedValueOnce(answer(status, body));
    render(board([EXISTING]));
    send('hello');
    await act(async () => {});

    await wait(LIST_RECHECK_MS * 2);

    expect(h.refresh).toHaveBeenCalledTimes(refreshes);
  });
});

describe('when the sign-in is not accepted', () => {
  const SIGN_IN_AGAIN = /sign-in has expired.*Sign in again/;

  const REFUSED = { error: 'Sign in to post a message.' };
  const bearerOf = (call: number) =>
    new Headers((h.fetch.mock.calls[call] as [string, RequestInit])[1].headers).get(
      'authorization',
    );

  it('sends a 401 once more with a token Firebase refreshes on purpose, and posts it then', async () => {
    h.getIdToken.mockResolvedValueOnce(TOKEN).mockResolvedValueOnce('fresh-h.fresh-p.fresh-s');
    h.fetch.mockResolvedValueOnce(answer(401, REFUSED)).mockResolvedValueOnce(answer(201, SAVED));
    render(board([EXISTING]));

    send("It's me & you");
    await tokenFetched();
    await tokenFetched();

    expect(h.getIdToken.mock.calls).toEqual([[false], [true]]);
    expect(h.fetch).toHaveBeenCalledTimes(2);
    expect(bearerOf(0)).toBe(`Bearer ${TOKEN}`);
    expect(bearerOf(1)).toBe('Bearer fresh-h.fresh-p.fresh-s');
    expect(screen.getByRole('status')).toHaveTextContent('Posted.');
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('after a second 401, signs out, rolls back, keeps the text and says to sign in again', async () => {
    h.fetch.mockResolvedValueOnce(answer(401, REFUSED)).mockResolvedValueOnce(answer(401, REFUSED));
    render(board([EXISTING]));

    send("It's me & you");
    await tokenFetched();
    await tokenFetched();

    expect(h.fetch).toHaveBeenCalledTimes(2);
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(rows()).toHaveLength(1);
    expect(box()).toHaveValue("It's me & you");
    expect(screen.getByRole('alert')).toHaveTextContent(SIGN_IN_AGAIN);
    expect(screen.getByRole('alert')).toHaveTextContent('your message is kept');
    expect(box()).not.toHaveAttribute('aria-invalid');
    // Refused, so nothing was stored: no list refresh now or later.
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('answers a twice-refused post even when signing out never finishes', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.signOut.mockImplementationOnce(() => new Promise<void>(() => {}));
    h.fetch.mockResolvedValueOnce(answer(401, REFUSED)).mockResolvedValueOnce(answer(401, REFUSED));
    render(board([EXISTING]));

    send("It's me & you");
    await tokenFetched();
    await tokenFetched();
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(box()).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Posting…' })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(POST_TIMEOUT_MS);
    });

    expect(rows()).toHaveLength(1);
    expect(box()).toHaveValue("It's me & you");
    expect(box()).not.toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Post message' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(SIGN_IN_AGAIN);
    expect(h.refresh).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('sends nothing more after a 401 when there is no fresh token, and says to sign in again', async () => {
    h.getIdToken.mockResolvedValueOnce(TOKEN).mockResolvedValueOnce(null);
    h.fetch.mockResolvedValueOnce(answer(401, REFUSED));
    render(board([EXISTING]));

    send('Hello there');
    await tokenFetched();
    await tokenFetched();

    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(box()).toHaveValue('Hello there');
    expect(screen.getByRole('alert')).toHaveTextContent(SIGN_IN_AGAIN);
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('never sends anything but a 401 twice', async () => {
    h.fetch.mockResolvedValueOnce(answer(400, { error: 'Empty.' }));
    render(board([EXISTING]));

    send('Hello there');
    await tokenFetched();

    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.getIdToken).toHaveBeenCalledTimes(1);
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('sends nothing when there is no token, and says to sign in again', async () => {
    h.getIdToken.mockResolvedValueOnce(null);
    render(board([EXISTING]));

    send('Hello there');
    await tokenFetched();

    expect(h.fetch).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(1);
    expect(box()).toHaveValue('Hello there');
    expect(screen.getByRole('alert')).toHaveTextContent(SIGN_IN_AGAIN);
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it("sends nothing when the token can't be fetched, and says it wasn't posted", async () => {
    h.getIdToken.mockRejectedValueOnce(
      Object.assign(new Error('offline'), { code: 'auth/network-request-failed' }),
    );
    render(board([EXISTING]));

    send('Hello there');
    await tokenFetched();

    expect(h.fetch).not.toHaveBeenCalled();
    expect(box()).toHaveValue('Hello there');
    expect(screen.getByRole('alert')).toHaveTextContent("Your message wasn't posted");
    expect(screen.getByRole('alert')).not.toHaveTextContent(SIGN_IN_AGAIN);
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('asks for a fresh token for every post', async () => {
    h.fetch
      .mockResolvedValueOnce(answer(201, SAVED))
      .mockResolvedValueOnce(answer(201, { ...SAVED, id: 'new-2', message: 'Again' }));
    render(board([EXISTING]));

    send("It's me & you");
    await tokenFetched();
    send('Again');
    await tokenFetched();

    expect(h.getIdToken).toHaveBeenCalledTimes(2);
    expect(h.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('posting the same text again, which the API stores once', () => {
  const timedOut = () => new DOMException('signal timed out', 'TimeoutError');
  /** The requestId the post sent with fetch call `call`. */
  const requestIdOf = (call: number): unknown =>
    JSON.parse(String((h.fetch.mock.calls[call] as [string, RequestInit])[1].body)).requestId;
  const postAgain = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Post message' }));
    await act(async () => {});
  };
  const sendNow = async (text: string) => {
    send(text);
    await act(async () => {});
  };

  it.each([
    ['a timeout', () => h.fetch.mockRejectedValueOnce(timedOut())],
    ['a dropped connection', () => h.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))],
    ['a 500', () => h.fetch.mockResolvedValueOnce(answer(500, { error: 'boom' }))],
    [
      'an answer that is not a message',
      () => h.fetch.mockResolvedValueOnce(answer(201, { unexpected: true })),
    ],
  ])('sends the same request id with the same text after %s', async (_case, failFirst) => {
    failFirst();
    h.fetch.mockResolvedValueOnce(answer(201, SAVED));
    render(board([EXISTING]));
    await sendNow("It's me & you");
    expect(box()).toHaveValue("It's me & you");

    await postAgain();

    expect(h.fetch).toHaveBeenCalledTimes(2);
    expect(requestIdOf(0)).toMatch(UUID);
    expect(requestIdOf(1)).toBe(requestIdOf(0));
    expect(screen.getByRole('status')).toHaveTextContent('Posted.');
  });

  it('sends a new request id for every post once the last one is confirmed', async () => {
    h.fetch
      .mockRejectedValueOnce(timedOut())
      .mockResolvedValueOnce(answer(201, SAVED))
      .mockResolvedValueOnce(answer(201, { ...SAVED, id: 'new-2' }));
    render(board([EXISTING]));
    await sendNow("It's me & you");
    await postAgain();

    await sendNow("It's me & you");

    expect(requestIdOf(1)).toBe(requestIdOf(0));
    expect(requestIdOf(2)).toMatch(UUID);
    expect(requestIdOf(2)).not.toBe(requestIdOf(0));
  });

  it('sends a new request id when the text was changed', async () => {
    h.fetch.mockRejectedValueOnce(timedOut()).mockResolvedValueOnce(answer(201, SAVED));
    render(board([EXISTING]));
    await sendNow('hello');

    await sendNow('hello there');

    expect(requestIdOf(1)).toMatch(UUID);
    expect(requestIdOf(1)).not.toBe(requestIdOf(0));
  });

  it('keeps the unconfirmed post’s request id while other text is posted', async () => {
    h.fetch
      .mockRejectedValueOnce(timedOut())
      .mockResolvedValueOnce(answer(201, { ...SAVED, id: 'new-2', message: 'Something else' }))
      .mockResolvedValueOnce(answer(201, SAVED));
    render(board([EXISTING]));
    await sendNow('hello');
    await sendNow('Something else');

    await sendNow('hello');

    expect(requestIdOf(1)).not.toBe(requestIdOf(0));
    expect(requestIdOf(2)).toBe(requestIdOf(0));
  });

  it('keeps each unconfirmed post’s request id when another text is unconfirmed too', async () => {
    h.fetch
      .mockRejectedValueOnce(timedOut())
      .mockRejectedValueOnce(timedOut())
      .mockResolvedValueOnce(answer(201, { ...SAVED, message: 'hello' }))
      .mockResolvedValueOnce(answer(201, { ...SAVED, id: 'new-2', message: 'Something else' }));
    render(board([EXISTING]));
    await sendNow('hello');
    await sendNow('Something else');

    await sendNow('hello');
    await sendNow('Something else');

    expect(requestIdOf(1)).not.toBe(requestIdOf(0));
    expect(requestIdOf(2)).toBe(requestIdOf(0));
    expect(requestIdOf(3)).toBe(requestIdOf(1));
  });

  it('still says a rate-limited repeat of an unconfirmed post may be posted', async () => {
    h.fetch
      .mockRejectedValueOnce(timedOut())
      .mockResolvedValueOnce(answer(429, { error: 'Too many requests' }));
    render(board([EXISTING]));
    await sendNow('hello');
    expect(h.refresh).toHaveBeenCalledTimes(1);

    await postAgain();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("We couldn't confirm your message was posted");
    expect(alert).toHaveTextContent('a few minutes');
    expect(alert).not.toHaveTextContent("wasn't posted");
    expect(box()).toHaveValue('hello');
    // The list is checked again, so it shows the message if the first post stored it.
    expect(h.refresh).toHaveBeenCalledTimes(2);
  });

  it('keeps the request id through a rate-limited repeat, which stored nothing', async () => {
    h.fetch
      .mockRejectedValueOnce(timedOut())
      .mockResolvedValueOnce(answer(429, { error: 'Too many requests' }))
      .mockResolvedValueOnce(answer(201, SAVED));
    render(board([EXISTING]));
    await sendNow('hello');
    await postAgain();
    expect(screen.getByRole('alert')).toHaveTextContent('a few minutes');

    await postAgain();

    expect(requestIdOf(0)).toMatch(UUID);
    expect(requestIdOf(1)).toBe(requestIdOf(0));
    expect(requestIdOf(2)).toBe(requestIdOf(0));
  });

  it('says a refused repeat (409) was not posted, and sends a new request id next time', async () => {
    h.fetch
      .mockRejectedValueOnce(timedOut())
      .mockResolvedValueOnce(answer(409, { error: 'Already sent with other text.' }))
      .mockResolvedValueOnce(answer(201, SAVED));
    render(board([EXISTING]));
    await sendNow('hello');
    await postAgain();

    expect(screen.getByRole('alert')).toHaveTextContent("Your message wasn't posted");
    expect(box()).toHaveValue('hello');
    expect(h.refresh).toHaveBeenCalledTimes(1);

    await postAgain();

    expect(requestIdOf(1)).toBe(requestIdOf(0));
    expect(requestIdOf(2)).toMatch(UUID);
    expect(requestIdOf(2)).not.toBe(requestIdOf(0));
  });

  it('sends a post refused for its sign-in (401) once more with the same request id', async () => {
    h.getIdToken.mockResolvedValueOnce(TOKEN).mockResolvedValueOnce('fresh-h.fresh-p.fresh-s');
    h.fetch
      .mockResolvedValueOnce(answer(401, { error: 'Sign in to post a message.' }))
      .mockResolvedValueOnce(answer(201, SAVED));
    render(board([EXISTING]));

    send("It's me & you");
    await tokenFetched();
    await tokenFetched();

    expect(h.fetch).toHaveBeenCalledTimes(2);
    expect(requestIdOf(0)).toMatch(UUID);
    expect(requestIdOf(1)).toBe(requestIdOf(0));
  });

  it("keeps a visitor's unconfirmed request id to them when someone else signs in on this page", async () => {
    h.fetch
      .mockRejectedValueOnce(timedOut())
      .mockResolvedValueOnce(answer(201, { ...SAVED, id: 'new-grace', message: 'hello' }))
      .mockResolvedValueOnce(answer(201, { ...SAVED, message: 'hello' }));
    render(board([EXISTING]));
    await sendNow('hello');

    h.uid.current = 'uid-grace';
    await sendNow('hello');
    h.uid.current = 'uid-ada';
    await sendNow('hello');

    expect(requestIdOf(0)).toMatch(UUID);
    expect(requestIdOf(1)).toMatch(UUID);
    expect(requestIdOf(1)).not.toBe(requestIdOf(0));
    expect(requestIdOf(2)).toBe(requestIdOf(0));
  });

  it("doesn't promise a repeat is stored once when the post went without a request id", async () => {
    vi.stubGlobal('crypto', {});
    h.fetch.mockRejectedValueOnce(timedOut());
    render(board([EXISTING]));

    await sendNow('hello');

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("We couldn't confirm your message was posted");
    expect(alert).toHaveTextContent("if your message isn't there then, post it again");
    expect(alert).not.toHaveTextContent("won't add it twice");
    expect(box()).toHaveValue('hello');
  });

  it('posts without a request id where the browser cannot make one (not a secure context)', async () => {
    vi.stubGlobal('crypto', {});
    h.fetch.mockResolvedValueOnce(answer(201, SAVED));
    render(board([EXISTING]));

    await sendNow("It's me & you");

    const [, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ message: "It's me & you" });
    expect(screen.getByRole('status')).toHaveTextContent('Posted.');
  });
});

describe('isOutcomeUnknown', () => {
  it.each([
    ['a 400 (invalid text)', false, new PostFailedError(400)],
    ['a 422 (bad body)', false, new PostFailedError(422)],
    ['a 429 (rate limited)', false, new PostFailedError(429)],
    ['a 401 (sign-in refused)', false, new PostFailedError(401)],
    ['no token to send (signed out)', false, new PostNotSentError(true)],
    ['a token that could not be fetched', false, new PostNotSentError(false)],
    ['a 500', true, new PostFailedError(500)],
    ['a 503', true, new PostFailedError(503)],
    ['a network error', true, new TypeError('Failed to fetch')],
    ['a timeout', true, new DOMException('signal timed out', 'TimeoutError')],
    ['an answer that is not a message', true, new Error('not a message')],
  ])('%s: may it have been stored? %s', (_case, unknown, error) => {
    expect(isOutcomeUnknown(error)).toBe(unknown);
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
