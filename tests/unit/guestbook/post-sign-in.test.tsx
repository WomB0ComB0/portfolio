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
 * @file Posting needs a sign-in the server accepts. The real auth store (src/core/auth.ts) and
 * lazy Firebase module run here, with the Firebase SDK faked and fetch stubbed (nothing reaches
 * Firebase or the guestbook):
 * - every post carries the signed-in visitor's ID token, a guest's included;
 * - when the session has ended (Firebase signs the visitor out while refreshing the token), nothing
 *   is sent, the card offers sign-in with a line saying why, and after signing in again the text
 *   is back in the box;
 * - a 401 is sent once more with a token Firebase refreshes on purpose; when that is refused too,
 *   the visitor is signed out, so the card offers sign-in with the line saying why, and signing in
 *   again brings the text back;
 * - a session Firebase reports as ended but leaves signed in (auth/invalid-user-token,
 *   auth/user-not-found) is signed out too, so the card never says "sign in again" beside
 *   "Signed in as";
 * - an unsent draft survives a sign-out and comes back on the next sign-in on this page;
 * - a post still being sent when the visitor signs out and someone signs in (here, or in another
 *   tab) belongs to the session that sent it: the new box stays read-only until it is answered,
 *   it is never resent with the new session's token, and neither a refusal nor a session-ended
 *   answer for it signs the new session out. It fails as not posted, with its text back in the box.
 *   A refused post is not resent at all once the session changed while its retry token was being
 *   refreshed (Firebase still hands that token over after a sign-out).
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeUser {
  readonly displayName: string | null;
  readonly isAnonymous: boolean;
  readonly getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

const h = vi.hoisted(() => ({
  auth: { name: 'auth', currentUser: null as FakeUser | null },
  listener: null as ((user: FakeUser | null) => void) | null,
  signInWithPopup: vi.fn(),
  signInAnonymously: vi.fn(),
  signOut: vi.fn(),
  refresh: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock('firebase/app', () => ({
  getApps: () => [],
  initializeApp: () => ({ name: '[DEFAULT]' }),
}));
vi.mock('firebase/auth', () => {
  class GoogleAuthProvider {
    readonly providerId = 'google.com';
    addScope(): void {}
    setCustomParameters(): void {}
  }
  class GithubAuthProvider {
    readonly providerId = 'github.com';
    addScope(): void {}
  }
  return {
    initializeAuth: () => h.auth,
    getAuth: () => h.auth,
    connectAuthEmulator: vi.fn(),
    indexedDBLocalPersistence: { type: 'LOCAL' },
    browserLocalPersistence: { type: 'LOCAL' },
    browserPopupRedirectResolver: { resolver: true },
    onAuthStateChanged: (_auth: unknown, listener: (user: FakeUser | null) => void) => {
      h.listener = listener;
      queueMicrotask(() => listener(h.auth.currentUser));
      return () => {
        h.listener = null;
      };
    },
    signInWithPopup: h.signInWithPopup,
    signInAnonymously: h.signInAnonymously,
    signOut: h.signOut,
    GoogleAuthProvider,
    GithubAuthProvider,
  };
});
vi.mock('@/config', () => ({
  config: {
    firebase: {
      apiKey: 'test-key',
      authDomain: 'test.example.com',
      projectId: 'test-project',
      appId: 'test-app',
    },
  },
}));

import { GuestbookBoard } from '@/app/(routes)/(main)/(personal)/guestbook/_components/guestbook-board';
import {
  POST_TIMEOUT_MS,
  PostNotSentError,
  postGuestbookMessage,
} from '@/app/(routes)/(main)/(personal)/guestbook/_lib/post';
import { resetAuthForTests, signIn, signOut } from '@/core/auth';

/** JWT-shaped, synthetic tokens. */
const GUEST_TOKEN = 'guest-header.guest-payload.guest-signature';
const JANE_TOKEN = 'jane-header.jane-payload.jane-signature';
const SIGN_IN_AGAIN = /sign-in has expired.*Sign in again/;

const user = (
  displayName: string | null,
  token: (forceRefresh?: boolean) => Promise<string>,
): FakeUser => ({
  displayName,
  isAnonymous: displayName === null,
  getIdToken: token,
});

/** Signs a user in, as Firebase does: the current user changes and listeners hear it. */
const becomes = (next: FakeUser | null) => {
  h.auth.currentUser = next;
  h.listener?.(next);
};

/** A session Firebase can no longer refresh: it signs the visitor out, then rejects. */
const endedSession = () =>
  user('Jane Example', async () => {
    becomes(null);
    throw Object.assign(new Error('expired'), { code: 'auth/user-token-expired' });
  });

/** A session Firebase reports as ended (`code`) without signing the visitor out itself. */
const unusableSession = (code: string) =>
  user('Jane Example', async () => {
    throw Object.assign(new Error('unusable'), { code });
  });

const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const settle = () => act(async () => {});
const box = () => screen.getByLabelText('Your message');
const rows = () => Array.from(document.querySelectorAll('li[data-message-row]'));

const renderBoard = () =>
  render(<GuestbookBoard knownIds={[]} listState="empty" notice={<p>No messages yet</p>} />);

const signInWith = async (name: RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  fireEvent.click(await screen.findByRole('button', { name }));
  await settle();
};

const send = async (text: string) => {
  fireEvent.change(box(), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Post message' }));
  await settle();
};

const NOT_POSTED = /wasn't posted, so it's back in the box/;
const refused = () => answer(401, { error: 'Sign in to post a message.' });
const sessionEnded = (code: string) => Object.assign(new Error('ended'), { code });

/** The next fetch answers only when the test releases it. */
const heldFetch = () => {
  let release: (response: Response) => void = () => undefined;
  h.fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  return (response: Response) => release(response);
};

/** Jane, whose token request answers only when the test settles it. */
const janeWithHeldToken = () => {
  let fail: (error: unknown) => void = () => undefined;
  const token = new Promise<string>((_resolve, reject) => {
    fail = reject;
  });
  h.signInWithPopup.mockImplementationOnce(async () => {
    const jane = user('Jane Example', () => token);
    becomes(jane);
    return { user: jane };
  });
  return fail;
};

/**
 * Jane, whose cached token comes at once and whose token refreshed on purpose only when the test
 * releases it. Firebase still gives that one after she signs out: it only skips saving it.
 */
const janeWithHeldRefresh = () => {
  let release: (token: string) => void = () => undefined;
  const fresh = new Promise<string>((resolve) => {
    release = resolve;
  });
  h.signInWithPopup.mockImplementationOnce(async () => {
    const jane = user('Jane Example', (forceRefresh) =>
      forceRefresh ? fresh : Promise.resolve(JANE_TOKEN),
    );
    becomes(jane);
    return { user: jane };
  });
  return () => release('fresh-h.fresh-p.fresh-s');
};

/** Signs out on the card, then signs in as a guest: another session while a post is in flight. */
const switchToGuest = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Continue as guest' }));
  await settle();
  expect(screen.getByText(/Signed in as Anonymous/)).toBeInTheDocument();
};

beforeEach(() => {
  resetAuthForTests();
  vi.clearAllMocks();
  h.auth.currentUser = null;
  h.listener = null;
  // Answers a test queued but never needed must not answer the next test's posts.
  h.fetch.mockReset();
  vi.stubGlobal('fetch', h.fetch);
  h.signOut.mockImplementation(async () => becomes(null));
  h.signInWithPopup.mockImplementation(async () => {
    const jane = user('Jane Example', async () => JANE_TOKEN);
    becomes(jane);
    return { user: jane };
  });
  h.signInAnonymously.mockImplementation(async () => {
    const guest = user(null, async () => GUEST_TOKEN);
    becomes(guest);
    return { user: guest };
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('posting with a sign-in token', () => {
  it("sends a guest's ID token, and only the text", async () => {
    h.fetch.mockResolvedValueOnce(
      answer(201, {
        id: 'new-1',
        authorName: 'Anonymous',
        message: 'Hello from a guest',
        createdAt: '2026-11-07T18:00:00.000Z',
      }),
    );
    renderBoard();
    await signInWith(/guest/);
    expect(screen.getByText(/Signed in as Anonymous/)).toBeInTheDocument();

    await send('Hello from a guest');

    const [url, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/messages');
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${GUEST_TOKEN}`);
    expect(JSON.parse(String(init.body))).toEqual({ message: 'Hello from a guest' });
    expect(screen.getByRole('status')).toHaveTextContent('Posted.');
  });

  it("sends a provider user's ID token", async () => {
    h.fetch.mockResolvedValueOnce(answer(500, { error: 'boom' }));
    renderBoard();
    await signInWith(/Google/);

    await send('Hello');

    const [, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${JANE_TOKEN}`);
  });
});

describe('a sign-in the server no longer accepts', () => {
  it('sends nothing when the session has ended, offers sign-in, and keeps the text for it', async () => {
    h.auth.currentUser = endedSession();
    renderBoard();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByLabelText('Your message');

    await send('Still here?');

    expect(h.fetch).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(0);
    expect(screen.queryByLabelText('Your message')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(SIGN_IN_AGAIN);

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await settle();

    expect(box()).toHaveValue('Still here?');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('posts with a token refreshed on purpose when the first is refused', async () => {
    const forced: boolean[] = [];
    h.signInWithPopup.mockImplementationOnce(async () => {
      const jane = user('Jane Example', async (forceRefresh) => {
        forced.push(forceRefresh === true);
        return forceRefresh ? 'fresh-h.fresh-p.fresh-s' : JANE_TOKEN;
      });
      becomes(jane);
      return { user: jane };
    });
    h.fetch.mockResolvedValueOnce(answer(401, { error: 'Sign in to post a message.' }));
    h.fetch.mockResolvedValueOnce(
      answer(201, {
        id: 'new-1',
        authorName: 'Jane Example',
        message: 'Hello again',
        createdAt: '2026-11-07T18:00:00.000Z',
      }),
    );
    renderBoard();
    await signInWith(/Google/);

    await send('Hello again');

    expect(forced).toEqual([false, true]);
    const [, retry] = h.fetch.mock.calls[1] as [string, RequestInit];
    expect(new Headers(retry.headers).get('authorization')).toBe('Bearer fresh-h.fresh-p.fresh-s');
    expect(screen.getByRole('status')).toHaveTextContent('Posted.');
    expect(screen.getByText(/Signed in as Jane Example/)).toBeInTheDocument();
  });

  it('signs out after a second 401, offers sign-in with the line, and keeps the text for it', async () => {
    h.fetch
      .mockResolvedValueOnce(answer(401, { error: 'Sign in to post a message.' }))
      .mockResolvedValueOnce(answer(401, { error: 'Sign in to post a message.' }));
    renderBoard();
    await signInWith(/Google/);

    await send('Hello again');

    expect(h.fetch).toHaveBeenCalledTimes(2);
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Your message')).toBeNull();
    expect(screen.queryByText(/Signed in as/)).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(SIGN_IN_AGAIN);

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await settle();
    expect(box()).toHaveValue('Hello again');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each(['auth/invalid-user-token', 'auth/user-not-found'])(
    'signs out a session Firebase reports as %s, sends nothing and offers sign-in',
    async (code) => {
      h.auth.currentUser = unusableSession(code);
      renderBoard();
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
      await screen.findByLabelText('Your message');

      await send('Still here?');

      expect(h.fetch).not.toHaveBeenCalled();
      expect(h.signOut).toHaveBeenCalledTimes(1);
      expect(screen.queryByLabelText('Your message')).toBeNull();
      expect(screen.getByRole('alert')).toHaveTextContent(SIGN_IN_AGAIN);

      fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
      await settle();
      expect(box()).toHaveValue('Still here?');
    },
  );

  it('keeps an unsent draft through a sign-out, without an alert', async () => {
    renderBoard();
    await signInWith(/Google/);
    fireEvent.change(box(), { target: { value: 'Half a thought' } });

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await settle();
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Continue as guest' }));
    await settle();
    expect(box()).toHaveValue('Half a thought');
  });
});

describe('a post still in flight when someone else signs in', () => {
  it('keeps the new box read-only until the earlier post is answered, then puts back what failed', async () => {
    const release = heldFetch();
    renderBoard();
    await signInWith(/guest/);
    await send('First post');

    await switchToGuest();
    expect(box()).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Posting…' })).toHaveAttribute('aria-busy', 'true');

    release(answer(503, { error: 'unavailable' }));
    await settle();

    expect(box()).toHaveValue('First post');
    expect(box()).not.toHaveAttribute('readonly');
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't confirm/);
  });

  it('frees the new box, empty and without an alert, when the earlier post is stored', async () => {
    const release = heldFetch();
    renderBoard();
    await signInWith(/guest/);
    await send('First post');

    await switchToGuest();
    release(
      answer(201, {
        id: 'new-1',
        authorName: 'Anonymous',
        message: 'First post',
        createdAt: '2026-11-07T18:00:00.000Z',
      }),
    );
    await settle();

    expect(box()).toHaveValue('');
    expect(box()).not.toHaveAttribute('readonly');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('never resends a refused post with the token of the session signed in since', async () => {
    const release = heldFetch();
    h.fetch.mockResolvedValueOnce(
      answer(201, {
        id: 'new-1',
        authorName: 'Anonymous',
        message: 'Hello again',
        createdAt: '2026-11-07T18:00:00.000Z',
      }),
    );
    renderBoard();
    await signInWith(/Google/);
    await send('Hello again');

    await switchToGuest();
    h.signOut.mockClear();
    release(refused());
    await settle();

    expect(h.fetch).toHaveBeenCalledTimes(1);
    const [, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${JANE_TOKEN}`);
    expect(h.signOut).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(0);
    expect(screen.getByText(/Signed in as Anonymous/)).toBeInTheDocument();
    expect(box()).toHaveValue('Hello again');
    expect(screen.getByRole('alert')).toHaveTextContent(NOT_POSTED);
  });

  it('does not sign the new session out when the resent post is refused again', async () => {
    h.fetch.mockResolvedValueOnce(refused());
    const release = heldFetch();
    renderBoard();
    await signInWith(/Google/);
    await send('Hello again');
    expect(h.fetch).toHaveBeenCalledTimes(2);

    await switchToGuest();
    h.signOut.mockClear();
    release(refused());
    await settle();

    expect(h.signOut).not.toHaveBeenCalled();
    expect(screen.getByText(/Signed in as Anonymous/)).toBeInTheDocument();
    expect(box()).toHaveValue('Hello again');
    expect(screen.getByRole('alert')).toHaveTextContent(NOT_POSTED);
  });

  describe('when the session changes while the retry token is refreshed', () => {
    const STORED_AS_JANE = {
      id: 'new-1',
      authorName: 'Jane Example',
      message: 'Hello again',
      createdAt: '2026-11-08T12:00:00.000Z',
    };

    /** Jane posts; the API refuses it, and its retry waits on the refreshed token. */
    const refusedWhileRefreshing = async () => {
      const refreshed = janeWithHeldRefresh();
      h.fetch.mockResolvedValueOnce(refused()).mockResolvedValueOnce(answer(201, STORED_AS_JANE));
      renderBoard();
      await signInWith(/Google/);
      await send('Hello again');
      expect(h.fetch).toHaveBeenCalledTimes(1);
      return refreshed;
    };

    it('does not resend a refused post when the visitor signs out meanwhile', async () => {
      const refreshed = await refusedWhileRefreshing();

      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
      await settle();
      refreshed();
      await settle();

      expect(h.fetch).toHaveBeenCalledTimes(1);
      expect(rows()).toHaveLength(0);
      expect(screen.getByRole('alert')).toHaveTextContent(SIGN_IN_AGAIN);
      fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
      await settle();
      expect(box()).toHaveValue('Hello again');
    });

    it('does not resend a refused post with the old token once someone else signed in', async () => {
      const refreshed = await refusedWhileRefreshing();

      await switchToGuest();
      h.signOut.mockClear();
      refreshed();
      await settle();

      expect(h.fetch).toHaveBeenCalledTimes(1);
      expect(h.signOut).not.toHaveBeenCalled();
      expect(rows()).toHaveLength(0);
      expect(screen.getByText(/Signed in as Anonymous/)).toBeInTheDocument();
      expect(box()).toHaveValue('Hello again');
      expect(screen.getByRole('alert')).toHaveTextContent(NOT_POSTED);
    });
  });

  it('still asks to sign in again when the visitor only signed out while it was sent', async () => {
    const release = heldFetch();
    renderBoard();
    await signInWith(/Google/);
    await send('Hello again');

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await settle();
    release(refused());
    await settle();

    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent(SIGN_IN_AGAIN);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await settle();
    expect(box()).toHaveValue('Hello again');
  });

  it.each(['auth/invalid-user-token', 'auth/user-not-found', 'auth/user-token-expired'])(
    'does not sign the new session out when the earlier token request ends with %s',
    async (code) => {
      const fail = janeWithHeldToken();
      renderBoard();
      await signInWith(/Google/);
      await send('Hello again');

      await switchToGuest();
      h.signOut.mockClear();
      fail(sessionEnded(code));
      await settle();

      expect(h.fetch).not.toHaveBeenCalled();
      expect(h.signOut).not.toHaveBeenCalled();
      expect(screen.getByText(/Signed in as Anonymous/)).toBeInTheDocument();
      expect(box()).toHaveValue('Hello again');
      expect(screen.getByRole('alert')).toHaveTextContent(NOT_POSTED);
    },
  );

  it.each([
    ['signs out nobody once someone else has signed in', true, 0],
    ['still signs out the same visitor, whose session has ended', false, 1],
  ])(
    'after the post gave up waiting for a token, a late session-ended answer %s',
    async (_case, switchFirst, signOuts) => {
      const fail = janeWithHeldToken();
      await signIn('google.com');
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const failure = postGuestbookMessage({ authorName: 'Jane Example', message: 'Hello' }).catch(
        (error: unknown) => error,
      );
      await vi.advanceTimersByTimeAsync(POST_TIMEOUT_MS);
      const error = await failure;
      expect(error).toBeInstanceOf(PostNotSentError);
      expect((error as PostNotSentError).signedOut).toBe(false);
      vi.useRealTimers();

      if (switchFirst) {
        await signOut();
        await signIn('anonymous');
      }
      const current = h.auth.currentUser;
      h.signOut.mockClear();
      fail(sessionEnded('auth/invalid-user-token'));
      await settle();

      expect(h.signOut).toHaveBeenCalledTimes(signOuts);
      expect(h.auth.currentUser).toBe(signOuts === 0 ? current : null);
    },
  );
});
