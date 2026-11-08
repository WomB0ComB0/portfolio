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
 * The real auth store (src/core/auth.ts) and lazy module (src/core/firebase-auth.ts) run here;
 * only the Firebase SDK is faked, and each fake records when it is first imported.
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
}));

vi.mock('firebase/app', () => {
  h.appLoaded = true;
  return { getApps: () => [], initializeApp: () => ({ name: '[DEFAULT]' }) };
});
vi.mock('firebase/auth', () => {
  h.authLoaded = true;
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
import { resetAuthForTests } from '@/core/auth';

const onPost = vi.fn();

const renderCard = () => render(<ComposeCard onPost={onPost} />);

const pressSignIn = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
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

    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in cancelled.');
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeEnabled();
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
