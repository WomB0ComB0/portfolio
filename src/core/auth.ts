'use client';

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
import { loadable } from 'jotai/utils';
import { atomEffect } from 'jotai-effect';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { app } from './firebase';

export const currentUserValue = atom<User | null | undefined>(undefined);

export const currentUserListener = atomEffect((_get, set) => {
  return getAuth(app).onAuthStateChanged((user) => {
    set(currentUserValue, user);
  });
});

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

export const currentUserLoadable = loadable(currentUserAsync);

export function useCurrentUser() {
  return useAtomValue(currentUserAsync);
}

export function useCurrentUserLoadable() {
  return useAtomValue(currentUserLoadable);
}

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
        console.error('Sign-in error:', error);

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
        console.error('Sign-out error:', error);
        toast.error('Failed to sign out. Please try again.');
      })
      .finally(() => setInFlight(false));
  }, []);

  return [signOut, inFlight] as const;
}

export type SignInMethod = 'google.com' | 'github.com' | 'anonymous';
