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
 * @file Firebase loads only when a visitor asks to sign in. Rendering the compose card imports
 * neither firebase/app nor firebase/auth (so a visitor who never signs in makes no Firebase
 * request and gets no apis.google.com iframe); pressing Sign in loads them, picks up a session
 * the visitor already has, and otherwise offers the providers, whose popup then opens with the
 * auth iframe already warm. Failures are explained in the card.
 *
 * Focus follows the visitor, never the page load: signing in moves it to the message box and
 * signing out to the first choice, but a card that mounts already signed in (a client-side return
 * to /guestbook) leaves focus where it was. Buttons that are busy (Sign in while Firebase loads, a
 * provider while its popup is open, Sign out) stay focusable with aria-disabled, so focus never
 * drops to the page.
 *
 * Firebase's watcher has the last word on who is signed in. A popup that Firebase gave up on (it
 * reports the popup closed 8-10 s after the tab is gone) can still sign the visitor in: the watcher
 * then clears the error. A popup that a newer press or a sign-out superseded changes nothing when
 * it settles, and a failure while someone is signed in leaves them signed in (a real error is still
 * shown). Each failure is logged to Sentry with its code, provider and timing, and nothing else.
 *
 * The real auth store (src/core/auth.ts) and lazy module (src/core/firebase-auth.ts) run here;
 * only the Firebase SDK (and Sentry's logger) is faked, and each SDK fake records when it is first
 * imported.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeUser {
  readonly displayName: string | null;
  readonly isAnonymous: boolean;
}

const h = vi.hoisted(() => ({
  appLoaded: false,
  authLoaded: false,
  currentUser: null as FakeUser | null,
  listener: null as ((user: FakeUser | null) => void) | null,
  /** Makes the next subscription fail, as when Auth cannot start (offline, blocked storage). */
  failNextWatch: false,
  initializeAuth: vi.fn(),
  signInWithPopup: vi.fn(),
  signInAnonymously: vi.fn(),
  signOut: vi.fn(),
  /** Records each GoogleAuthProvider.setCustomParameters call. */
  googleParameters: vi.fn(),
  sentryWarn: vi.fn(),
  sentryInfo: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({ logger: { warn: h.sentryWarn, info: h.sentryInfo } }));

vi.mock('firebase/app', () => {
  h.appLoaded = true;
  return { getApps: () => [], initializeApp: () => ({ name: '[DEFAULT]' }) };
});
vi.mock('firebase/auth', () => {
  h.authLoaded = true;
  class GoogleAuthProvider {
    readonly providerId = 'google.com';
    addScope(): void {}
    setCustomParameters(parameters: Readonly<Record<string, string>>): void {
      h.googleParameters(parameters);
    }
  }
  class GithubAuthProvider {
    readonly providerId = 'github.com';
    addScope(): void {}
  }
  return {
    initializeAuth: h.initializeAuth,
    getAuth: () => ({ name: 'auth' }),
    connectAuthEmulator: vi.fn(),
    indexedDBLocalPersistence: { type: 'LOCAL' },
    browserLocalPersistence: { type: 'LOCAL' },
    browserPopupRedirectResolver: { resolver: true },
    onAuthStateChanged: (_auth: unknown, listener: (user: FakeUser | null) => void) => {
      if (h.failNextWatch) {
        h.failNextWatch = false;
        throw Object.assign(new Error('network'), { code: 'auth/network-request-failed' });
      }
      h.listener = listener;
      queueMicrotask(() => listener(h.currentUser));
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

import { ComposeCard } from '@/app/(routes)/(main)/(personal)/guestbook/_components/compose-card';
import { LATE_SIGN_IN_WINDOW_MS, resetAuthForTests, signIn } from '@/core/auth';

const onPost = vi.fn();

const renderCard = () => render(<ComposeCard onPost={onPost} />);

const pressSignIn = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

/** Synthetic visitors. */
const JANE: FakeUser = { displayName: 'Jane Example', isAnonymous: false };
const GUEST: FakeUser = { displayName: null, isAnonymous: true };

/** Firebase's watcher reports `user`, as after a late popup or a sign-in in another tab. */
const watcherReports = (user: FakeUser | null) => act(async () => h.listener?.(user));

/** The next popup stays open until the test settles it. */
function heldPopup() {
  const held: { resolve: (value: unknown) => void; reject: (error: unknown) => void } = {
    resolve: () => undefined,
    reject: () => undefined,
  };
  h.signInWithPopup.mockImplementationOnce(
    () =>
      new Promise((resolve, reject) => {
        held.resolve = resolve;
        held.reject = reject;
      }),
  );
  return {
    resolve: (value: unknown) => act(async () => held.resolve(value)),
    reject: (error: unknown) => act(async () => held.reject(error)),
  };
}

/** Presses `provider` once the choices show, and lets its popup open. */
const choose = async (provider: string) => {
  fireEvent.click(await screen.findByRole('button', { name: provider }));
  await act(async () => {});
};

/**
 * The store counts the visitor as signed in, not only the card: asked to sign in again, it opens
 * no popup (`popups` is how many opened before).
 */
const expectNoPopupWhileSignedIn = async (popups: number) => {
  expect(h.signInWithPopup).toHaveBeenCalledTimes(popups);
  await act(async () => signIn('github.com'));
  expect(h.signInWithPopup).toHaveBeenCalledTimes(popups);
};

beforeEach(() => {
  resetAuthForTests();
  vi.clearAllMocks();
  h.currentUser = null;
  h.failNextWatch = false;
  h.initializeAuth.mockReturnValue({ name: 'auth' });
});

afterEach(cleanup);

describe('the guestbook loads Firebase only on demand', () => {
  // Kept first: once any test presses Sign in, the SDK modules are loaded for the whole file.
  it('renders the sign-in card without importing firebase/app or firebase/auth', async () => {
    renderCard();
    await act(async () => {});

    expect(screen.getByRole('heading', { name: 'Sign the guestbook' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Google/ })).toBeNull();
    expect(h.appLoaded).toBe(false);
    expect(h.authLoaded).toBe(false);
  });

  it('loads Firebase Auth when Sign in is pressed, then offers the providers', async () => {
    renderCard();

    await pressSignIn();
    const google = await screen.findByRole('button', { name: 'Continue with Google' });

    expect(h.authLoaded).toBe(true);
    expect(h.initializeAuth).toHaveBeenCalledWith(expect.anything(), {
      persistence: [{ type: 'LOCAL' }, { type: 'LOCAL' }],
      popupRedirectResolver: { resolver: true },
    });
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Continue as guest' })).toBeEnabled();
    // Focus moves to the first choice, so a keyboard user is not left on a removed button.
    expect(google).toHaveFocus();
  });

  it('signs in through the provider popup and shows the compose box', async () => {
    h.signInWithPopup.mockResolvedValueOnce({
      user: { displayName: 'Jane Example', isAnonymous: false },
    });
    renderCard();
    await pressSignIn();

    fireEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));

    expect(await screen.findByLabelText('Your message')).toBeInTheDocument();
    expect(screen.getByText(/Signed in as Jane Example/)).toBeInTheDocument();
    expect(h.signInWithPopup).toHaveBeenCalledWith(
      { name: 'auth' },
      expect.objectContaining({ providerId: 'google.com' }),
    );
  });

  it("opens Google's account chooser, not its consent screen", async () => {
    h.signInWithPopup.mockResolvedValueOnce({ user: JANE });
    renderCard();
    await pressSignIn();

    fireEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));
    await screen.findByLabelText('Your message');

    // A returning visitor picks an account and skips the consent screen they already passed.
    expect(h.googleParameters).toHaveBeenCalledTimes(1);
    expect(h.googleParameters).toHaveBeenCalledWith({ prompt: 'select_account' });
  });

  it('picks up a session the visitor already has, with no popup', async () => {
    h.currentUser = { displayName: 'Jane Example', isAnonymous: false };
    renderCard();

    await pressSignIn();

    expect(await screen.findByLabelText('Your message')).toBeInTheDocument();
    expect(h.signInWithPopup).not.toHaveBeenCalled();
  });

  it('explains a closed popup and keeps the choices', async () => {
    h.signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    renderCard();
    await pressSignIn();

    fireEvent.click(await screen.findByRole('button', { name: 'Continue with GitHub' }));

    const alert = await screen.findByRole('alert');
    // On a phone the popup is a tab, and Firebase says this once the tab is gone for any reason.
    expect(alert).toHaveTextContent('The sign-in page closed before sign-in finished.');
    // Any choice works next, not only the one that closed.
    expect(alert).toHaveTextContent('Choose a sign-in option to try again.');
    expect(alert).not.toHaveTextContent('same button');
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeEnabled();
  });

  it('explains a failed guest sign-in and leaves the visitor signed out', async () => {
    h.signInAnonymously.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    renderCard();
    await pressSignIn();

    await choose('Continue as guest');

    expect(await screen.findByRole('alert')).toHaveTextContent('Network error');
    expect(screen.queryByLabelText('Your message')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue as guest' })).not.toHaveAttribute(
      'aria-disabled',
    );
    expect(h.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(h.signInWithPopup).not.toHaveBeenCalled();
    expect(h.sentryWarn).toHaveBeenCalledWith('Sign-in failed', {
      code: 'auth/network-request-failed',
      method: 'anonymous',
      elapsedMs: expect.any(Number),
    });
  });

  it('explains a blocked popup and opens it on the next press', async () => {
    // Firebase retries its popup helper inside the click when the early start failed; a slow
    // retry gets the window blocked, and the next press opens it at once.
    h.signInWithPopup
      .mockRejectedValueOnce({ code: 'auth/popup-blocked' })
      .mockResolvedValueOnce({ user: { displayName: 'Jane Example', isAnonymous: false } });
    renderCard();
    await pressSignIn();

    fireEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Press the same button again');
    expect(alert).toHaveTextContent('allow pop-ups');
    const google = screen.getByRole('button', { name: 'Continue with Google' });
    expect(google).toBeEnabled();
    expect(google).not.toHaveAttribute('aria-disabled');

    fireEvent.click(google);

    expect(await screen.findByLabelText('Your message')).toBeInTheDocument();
    expect(screen.getByText(/Signed in as Jane Example/)).toBeInTheDocument();
    expect(h.signInWithPopup).toHaveBeenCalledTimes(2);
  });

  it('says when sign-in could not load, and lets the visitor try again', async () => {
    h.failNextWatch = true;
    renderCard();

    await pressSignIn();

    expect(await screen.findByRole('alert')).toHaveTextContent("Sign-in couldn't load");
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();

    await pressSignIn();
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeEnabled();
  });

  it('moves focus to the message box when the visitor signs in', async () => {
    h.signInWithPopup.mockResolvedValueOnce({
      user: { displayName: 'Jane Example', isAnonymous: false },
    });
    renderCard();
    await pressSignIn();

    fireEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));

    expect(await screen.findByLabelText('Your message')).toHaveFocus();
  });

  it('leaves focus alone when the card mounts with the visitor already signed in', async () => {
    h.currentUser = { displayName: 'Jane Example', isAnonymous: false };
    renderCard();
    await pressSignIn();
    await screen.findByLabelText('Your message');
    cleanup();
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    elsewhere.focus();

    renderCard();
    await act(async () => {});

    expect(screen.getByLabelText('Your message')).not.toHaveFocus();
    expect(elsewhere).toHaveFocus();
    elsewhere.remove();
  });

  it('keeps Sign in focusable while Firebase loads, and focused when loading fails', async () => {
    h.failNextWatch = true;
    renderCard();
    const signIn = screen.getByRole('button', { name: 'Sign in' });
    signIn.focus();

    fireEvent.click(signIn);
    const preparing = screen.getByRole('button', { name: 'Preparing sign-in…' });

    expect(preparing).toBe(signIn);
    expect(preparing).toHaveAttribute('aria-disabled', 'true');
    expect(preparing).not.toBeDisabled();
    expect(await screen.findByRole('alert')).toHaveTextContent("Sign-in couldn't load");
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveFocus();
  });

  it('keeps a provider focusable while its popup is open, and focused when it is cancelled', async () => {
    let cancel: (error: unknown) => void = () => undefined;
    h.signInWithPopup.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          cancel = reject;
        }),
    );
    renderCard();
    await pressSignIn();
    const github = await screen.findByRole('button', { name: 'Continue with GitHub' });
    github.focus();

    fireEvent.click(github);
    await act(async () => {});

    expect(github).toHaveAttribute('aria-disabled', 'true');
    expect(github).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await act(async () => cancel({ code: 'auth/popup-closed-by-user' }));
    expect(github).toHaveFocus();
    expect(github).not.toHaveAttribute('aria-disabled');
  });

  it('signs out without a reload and goes back to the choices', async () => {
    h.currentUser = { displayName: 'Jane Example', isAnonymous: false };
    h.signOut.mockImplementationOnce(async () => {
      h.listener?.(null);
    });
    renderCard();
    await pressSignIn();
    await screen.findByLabelText('Your message');

    const signOut = screen.getByRole('button', { name: 'Sign out' });
    signOut.focus();
    fireEvent.click(signOut);

    const google = await screen.findByRole('button', { name: 'Continue with Google' });
    expect(google).toBeEnabled();
    // Focus goes to the first choice, not to the page, when Sign out's own button goes.
    expect(google).toHaveFocus();
    expect(screen.queryByLabelText('Your message')).toBeNull();
  });
});

describe('when a popup and Firebase disagree', () => {
  it('opens no second popup for a press while one is open, and the first still signs in', async () => {
    const google = heldPopup();
    renderCard();
    await pressSignIn();
    await choose('Continue with Google');
    expect(h.signInWithPopup).toHaveBeenCalledTimes(1);

    // Straight to the store, past the card's aria-disabled buttons: the guard signInRun relies on.
    await act(async () => signIn('github.com'));
    await act(async () => signIn('google.com'));

    expect(h.signInWithPopup).toHaveBeenCalledTimes(1);
    // Those presses did not supersede the open popup, so its answer still counts.
    await google.resolve({ user: JANE });
    expect(screen.getByText(/Signed in as Jane Example/)).toBeInTheDocument();
  });

  it('drops the closed-popup error once Firebase signs the visitor in after all', async () => {
    h.signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    renderCard();
    await pressSignIn();
    await choose('Continue with Google');
    await screen.findByRole('alert');

    await watcherReports(JANE);

    expect(screen.getByLabelText('Your message')).toBeInTheDocument();
    expect(screen.getByText(/Signed in as Jane Example/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('stays signed in when the first popup lands while a second is open, and that one closes', async () => {
    h.signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    const second = heldPopup();
    h.signOut.mockImplementationOnce(async () => {
      h.listener?.(null);
    });
    renderCard();
    await pressSignIn();
    await choose('Continue with Google');
    await screen.findByRole('alert');
    await choose('Continue with Google');

    await watcherReports(JANE);
    await second.reject({ code: 'auth/popup-closed-by-user' });

    expect(screen.getByLabelText('Your message')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    await expectNoPopupWhileSignedIn(2);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeEnabled();
    expect(screen.queryByLabelText('Your message')).toBeNull();
  });

  it('keeps a newer popup open when an older one is cancelled after a sign-out', async () => {
    const google = heldPopup();
    heldPopup();
    h.signOut.mockImplementationOnce(async () => {
      h.listener?.(null);
    });
    renderCard();
    await pressSignIn();
    await choose('Continue with Google');
    await watcherReports(JANE);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await choose('Continue with GitHub');

    // Firebase cancels the older popup when the newer one opens.
    await google.reject({ code: 'auth/cancelled-popup-request' });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('signs in through the watcher, not through a popup that answers after a sign-out', async () => {
    const google = heldPopup();
    h.signOut.mockImplementationOnce(async () => {
      h.listener?.(null);
    });
    renderCard();
    await pressSignIn();
    await choose('Continue with Google');
    await watcherReports(JANE);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('button', { name: 'Continue with Google' });

    await google.resolve({ user: JANE });
    expect(screen.queryByLabelText('Your message')).toBeNull();

    await watcherReports(JANE);
    expect(screen.getByLabelText('Your message')).toBeInTheDocument();
  });

  it('still shows a real error when someone signed in meanwhile, and keeps them signed in', async () => {
    const google = heldPopup();
    renderCard();
    await pressSignIn();
    await choose('Continue with Google');
    // A guest signs in from another tab while the Google popup is open.
    await watcherReports(GUEST);

    await google.reject({ code: 'auth/account-exists-with-different-credential' });

    expect(screen.getByRole('alert')).toHaveTextContent('An account already exists');
    expect(screen.getByLabelText('Your message')).toBeInTheDocument();
    await expectNoPopupWhileSignedIn(1);
  });
});

describe('recording a failed sign-in', () => {
  it('logs the code, the provider and the timing, and nothing about the visitor', async () => {
    h.signInWithPopup.mockRejectedValueOnce({
      code: 'auth/popup-closed-by-user',
      message: 'Firebase: Error (auth/popup-closed-by-user).',
      customData: { email: 'jane@example.com' },
    });
    renderCard();
    await pressSignIn();
    await choose('Continue with GitHub');
    await screen.findByRole('alert');

    expect(h.sentryWarn).toHaveBeenCalledTimes(1);
    const [message, attributes] = h.sentryWarn.mock.calls[0] as [string, Record<string, unknown>];
    expect(message).toBe('Sign-in failed');
    expect(attributes).toEqual({
      code: 'auth/popup-closed-by-user',
      method: 'github.com',
      elapsedMs: expect.any(Number),
    });
    expect(attributes.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(h.sentryWarn.mock.calls)).not.toMatch(/jane|Firebase:/i);
  });

  it('logs nothing when sign-in works', async () => {
    h.signInWithPopup.mockResolvedValueOnce({ user: JANE });
    renderCard();
    await pressSignIn();
    await choose('Continue with Google');

    expect(await screen.findByLabelText('Your message')).toBeInTheDocument();
    expect(h.sentryWarn).not.toHaveBeenCalled();
    expect(h.sentryInfo).not.toHaveBeenCalled();
  });

  it('still shows the error and the choices when the log cannot be sent', async () => {
    h.sentryWarn.mockImplementationOnce(() => {
      throw new Error('Sentry logger unavailable');
    });
    h.signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    renderCard();
    await pressSignIn();
    await choose('Continue with Google');

    expect(await screen.findByRole('alert')).toHaveTextContent('The sign-in page closed');
    const google = screen.getByRole('button', { name: 'Continue with Google' });
    expect(google).not.toHaveAttribute('aria-disabled');
  });
});

describe('recording a sign-in that follows a closed popup', () => {
  it('logs the provider, the gap and that no sign-in was under way, once', async () => {
    h.signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    h.signOut.mockImplementationOnce(async () => {
      h.listener?.(null);
    });
    renderCard();
    await pressSignIn();
    await choose('Continue with Google');
    await screen.findByRole('alert');

    // Firebase signs the visitor in on its own after it reported the popup closed.
    await watcherReports(JANE);

    expect(h.sentryInfo).toHaveBeenCalledTimes(1);
    const [message, attributes] = h.sentryInfo.mock.calls[0] as [string, Record<string, unknown>];
    expect(message).toBe('Signed in after a closed-popup error');
    expect(attributes).toEqual({
      method: 'google.com',
      gapMs: expect.any(Number),
      signingIn: false,
    });
    expect(attributes.gapMs).toBeGreaterThanOrEqual(0);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('button', { name: 'Continue with Google' });
    await watcherReports(JANE);
    expect(h.sentryInfo).toHaveBeenCalledTimes(1);
  });

  it('says a sign-in was under way when the visitor had pressed again', async () => {
    h.signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    heldPopup();
    renderCard();
    await pressSignIn();
    await choose('Continue with Google');
    await screen.findByRole('alert');
    await choose('Continue with Google');

    await watcherReports(JANE);

    expect(h.sentryInfo).toHaveBeenCalledTimes(1);
    expect(h.sentryInfo.mock.calls[0]?.[1]).toMatchObject({
      method: 'google.com',
      signingIn: true,
    });
  });

  it('logs nothing when Firebase reports the visitor long after the popup closed', async () => {
    expect(LATE_SIGN_IN_WINDOW_MS).toBe(60_000);
    h.signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    renderCard();
    await pressSignIn();
    await choose('Continue with GitHub');
    await screen.findByRole('alert');
    const later = Date.now() + LATE_SIGN_IN_WINDOW_MS + 1;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(later);

    await watcherReports(JANE);
    clock.mockRestore();

    expect(screen.getByLabelText('Your message')).toBeInTheDocument();
    expect(h.sentryInfo).not.toHaveBeenCalled();
  });

  it('logs nothing for a sign-in after another kind of failure', async () => {
    h.signInWithPopup.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    renderCard();
    await pressSignIn();
    await choose('Continue with Google');
    await screen.findByRole('alert');

    await watcherReports(JANE);

    expect(h.sentryInfo).not.toHaveBeenCalled();
  });
});
