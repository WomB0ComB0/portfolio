import {
  GithubAuthProvider,
  GoogleAuthProvider,
  type User,
  type UserCredential,
  getAuth,
  signInAnonymously,
  signInWithPopup,
} from 'firebase/auth';
import { atom, useAtomValue } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { loadable } from 'jotai/utils';
import { useRouter } from 'next/navigation';
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
  } else {
    return user;
  }
});

export const currentUserLoadable = loadable(currentUserAsync);

export function useCurrentUser() {
  return useAtomValue(currentUserAsync);
}

export function useCurrentUserLoadable() {
  return useAtomValue(currentUserLoadable);
}

export function useSignIn(signInMethod: SignInMethod): [signIn: () => void, inFlight: boolean] {
  const router = useRouter();
  const [inFlight, setInFlight] = useState(false);

  const signIn = useCallback(() => {
    let p: Promise<UserCredential> | null = null;

    if (signInMethod === 'anonymous') {
      const auth = getAuth(app);
      p = signInAnonymously(auth);
    }

    if (signInMethod === 'google.com') {
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      provider.setCustomParameters({
        // loginHint: "",
        prompt: 'consent',
      });
      p = signInWithPopup(auth, provider);
    }

    if (signInMethod === 'github.com') {
      const auth = getAuth(app);
      const provider = new GithubAuthProvider();
      provider.addScope('read:user');
      p = signInWithPopup(auth, provider);
    }

    if (!p) throw new Error(`Not supported: ${signInMethod}`);

    setInFlight(true);
    p.then(() => {
      router.push('/');
      toast.success('Logged in successfully! 🎉');
    }).finally(() => setInFlight(false));
  }, [signInMethod, router]);

  return [signIn, inFlight] as const;
}

export function useSignOut(): [signOut: () => void, inFlight: boolean] {
  const router = useRouter();
  const [inFlight, setInFlight] = useState(false);

  const signOut = useCallback(() => {
    const auth = getAuth(app);
    setInFlight(true);
    auth
      .signOut()
      .then(() => {
        router.push('/');
        toast.success('Signed out successfully! 🎉');
      })
      .finally(() => setInFlight(false));
  }, [router]);

  return [signOut, inFlight] as const;
}

export type SignInMethod = 'google.com' | 'github.com' | 'anonymous';
export const signout: SignOutMethod = `Sign out`;
type SignOutMethod = 'Sign out';
