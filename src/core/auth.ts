'use client';

import type { SignInMethod } from './auth.types';

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

import { logger } from '@/utils';
import type { FirebaseError } from 'firebase/app';
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  getAuth,
  signInAnonymously,
  signInWithPopup,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { atom, useAtomValue } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { loadable } from 'jotai/utils';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { app } from './firebase';

/**
 * @readonly
 * @public
 * @type {import('jotai').Atom<User | null | undefined>}
 * @description Jotai atom holding the current Firebase user, or undefined if not loaded. Used for state sync with Firebase Auth state.
 * @author Mike Odnis
 * @web
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 */
export const currentUserValue = atom<User | null | undefined>(undefined);

/**
 * @public
 * @type {import('jotai-effect').AtomEffect}
 * @description
 * Registers a listener for Firebase Auth state changes and updates the `currentUserValue` atom whenever the user changes.
 * Cleans up the listener on unmount.
 * @author Mike Odnis
 * @web
 * @see https://firebase.google.com/docs/auth/web/start#set_an_authentication_state_observer_and_get_user_data
 * @version 1.0.0
 * @returns {void}
 */
export const currentUserListener = atomEffect((_get, set) => {
  return getAuth(app).onAuthStateChanged((user) => {
    set(currentUserValue, user);
  });
});

/**
 * @readonly
 * @public
 * @description
 * Jotai atom for accessing the current Firebase user asynchronously.
 * Ensures the user's auth state is loaded before returning.
 * @author Mike Odnis
 * @async
 * @web
 * @see https://firebase.google.com/docs/reference/js/auth.auth#auth.currentuser
 * @returns {Promise<User | null>} Resolves to the current Firebase user or null if not signed in.
 * @version 1.0.0
 */
export const currentUserAsync = atom(async (get) => {
  get(currentUserListener);
  const user = get(currentUserValue);

  if (user === undefined) {
    const auth = getAuth(app);
    await auth.authStateReady();
    return auth.currentUser;
  }
  return user;
});

/**
 * @readonly
 * @public
 * @description
 * Loadable Jotai wrapping `currentUserAsync` for easier UI suspense and error handling.
 * @author Mike Odnis
 * @web
 * @see https://github.com/jotai-labs/jotai-loadable
 * @version 1.0.0
 */
export const currentUserLoadable = loadable(currentUserAsync);

/**
 * React hook for accessing the current Firebase user asynchronously.
 * Triggers re-renders when the user state changes.
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @returns {User | null} Current Firebase user, or null if not signed in.
 * @see https://github.com/jotai/jotai
 * @example
 * const user = useCurrentUser();
 */
export function useCurrentUser() {
  return useAtomValue(currentUserAsync);
}

/**
 * React hook for accessing the loadable state of the current user atom.
 * Returns a state machine: { state: 'hasData' | 'loading' | 'hasError', data?, error? }
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @returns {import('jotai').Loadable<User | null>} Loadable representation of the user loading state.
 * @see https://github.com/jotai/jotai
 * @example
 * const userLoadable = useCurrentUserLoadable();
 */
export function useCurrentUserLoadable() {
  return useAtomValue(currentUserLoadable);
}

/**
 * React hook providing a sign-in function for Firebase Auth using Google, GitHub, or an anonymous method.
 * Returns a memoized signIn method and an inFlight boolean for progress UI feedback.
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @param {SignInMethod} signInMethod - Sign-in strategy: 'google.com', 'github.com', or 'anonymous'.
 * @returns {[() => void, boolean]} A tuple: signIn callback and inFlight loading state.
 * @throws {Error} Throws if an unsupported sign-in method is provided.
 * @example
 * const [signIn, inFlight] = useSignIn('google.com');
 * <Button onClick={signIn}>Login with Google</Button>
 * @see https://github.com/firebase/firebase-js-sdk
 * @version 1.0.0
 */
export function useSignIn(
  signInMethod: SignInMethod,
): readonly [signIn: () => void, inFlight: boolean] {
  const [inFlight, setInFlight] = useState(false);

  const signIn = useCallback(() => {
    const auth = getAuth(app);
    let authPromise: Promise<UserCredential>;

    switch (signInMethod) {
      case 'anonymous':
        authPromise = signInAnonymously(auth);
        break;

      case 'google.com': {
        const provider = new GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        provider.setCustomParameters({
          prompt: 'consent',
        });
        authPromise = signInWithPopup(auth, provider);
        break;
      }

      case 'github.com': {
        const provider = new GithubAuthProvider();
        provider.addScope('read:user');
        authPromise = signInWithPopup(auth, provider);
        break;
      }

      default:
        throw new Error(`Unsupported sign-in method: ${signInMethod satisfies never}`);
    }

    setInFlight(true);
    authPromise
      .then(() => {
        toast.success('Logged in successfully! 🎉');
        window.location.reload();
      })
      .catch((error: FirebaseError) => {
        logger.error('Sign-in error:', error);

        const errorMessages: Record<string, string> = {
          'auth/network-request-failed':
            'Network error. Please check your internet connection and try again.',
          'auth/popup-blocked': 'Pop-up blocked. Please allow pop-ups for this site.',
          'auth/popup-closed-by-user': 'Sign-in cancelled.',
          'auth/cancelled-popup-request': 'Sign-in cancelled.',
          'auth/account-exists-with-different-credential':
            'An account already exists with this email.',
        };

        const errorMessage =
          errorMessages[error.code] ?? 'An error occurred during sign-in. Please try again.';
        toast.error(errorMessage);
      })
      .finally(() => setInFlight(false));
  }, [signInMethod]);

  return [signIn, inFlight] as const;
}

/**
 * React hook providing a sign-out function for Firebase Auth users.
 * Returns a memoized signOut function and an inFlight boolean for progress feedback in UI.
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @returns {[() => void, boolean]} Tuple: signOut callback and inFlight loading status.
 * @example
 * const [signOut, inFlight] = useSignOut();
 * <Button onClick={signOut}>Sign out</Button>
 * @see https://firebase.google.com/docs/auth/web/manage-users#sign_out_a_user
 * @version 1.0.0
 */
export function useSignOut(): readonly [signOut: () => void, inFlight: boolean] {
  const [inFlight, setInFlight] = useState(false);

  const signOut = useCallback(() => {
    const auth = getAuth(app);
    setInFlight(true);
    auth
      .signOut()
      .then(() => {
        toast.success('Signed out successfully! 🎉');
        window.location.reload();
      })
      .catch((error: FirebaseError) => {
        logger.error('Sign-out error:', error);
        toast.error('Failed to sign out. Please try again.');
      })
      .finally(() => setInFlight(false));
  }, []);

  return [signOut, inFlight] as const;
}
