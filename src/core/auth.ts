'use client';

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
 * @file The visitor's sign-in state, without Firebase until it is asked for.
 *
 * This module imports no Firebase code. The SDK lives in ./firebase-auth, which `prepareSignIn`
 * imports on demand when a visitor presses Sign in. So rendering a page that offers sign-in makes
 * no Firebase request and loads no auth iframe, on desktop or mobile.
 *
 * A visitor who signed in on an earlier visit still has Firebase's saved session: pressing Sign
 * in restores it at once, with no popup. The page does not load Firebase on its own to look for
 * that session (after idle, say): it would cost every returning signer the SDK and a token
 * refresh on every visit, while one press gives the same result when they actually want to post.
 *
 * Phases: 'signed-out' (Firebase not loaded) -> 'preparing' (loading it) -> 'ready' (choose a
 * provider) -> 'signing-in' (the popup is open) -> 'signed-in'. Errors are kept as a sentence for
 * the card to show; nothing reloads the page.
 */

import { useCallback, useState, useSyncExternalStore } from 'react';
import { withDeadline } from '@/lib/async/deadline';
import { logger } from '@/utils/logging';
import type { SessionHandle, SessionUser, SignInMethod } from './auth.types';

export type { SessionHandle, SessionUser, SignInMethod } from './auth.types';

export type AuthPhase = 'signed-out' | 'preparing' | 'ready' | 'signing-in' | 'signed-in';

export interface AuthSnapshot {
  readonly phase: AuthPhase;
  readonly user: SessionUser | null;
  /** The provider whose popup is open while signing in. */
  readonly method: SignInMethod | null;
  /** What went wrong last, as a sentence for the visitor; cleared by the next action. */
  readonly error: string | null;
}

type FirebaseAuthModule = typeof import('./firebase-auth');

/** How long loading Firebase and reading its saved session may take before it counts as failed. */
const PREPARE_DEADLINE_MS = 15_000;

export const LOAD_FAILED = "Sign-in couldn't load. Check your connection and press Sign in again.";
const SIGN_OUT_FAILED = "Signing out didn't work. Please try again.";
const SIGN_IN_FAILED = "Sign-in didn't work. Please try again.";

/** Firebase's error codes the visitor can act on, in their words. */
const SIGN_IN_ERRORS: Readonly<Record<string, string>> = {
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/popup-blocked':
    'Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.',
  'auth/popup-closed-by-user': 'Sign-in cancelled.',
  'auth/cancelled-popup-request': 'Sign-in cancelled.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email. Sign in with the provider you used before.',
};

/** Firebase's codes for a session that has ended: the visitor must sign in again. */
const SESSION_ENDED: ReadonlySet<string> = new Set([
  'auth/user-token-expired',
  'auth/user-disabled',
  'auth/invalid-user-token',
  'auth/user-not-found',
]);

const codeOf = (error: unknown): unknown => (error as { code?: unknown } | null)?.code;

/** The sentence to show for a failed sign-in. */
export function signInErrorMessage(error: unknown): string {
  const code = codeOf(error);
  return (typeof code === 'string' && SIGN_IN_ERRORS[code]) || SIGN_IN_FAILED;
}

const INITIAL: AuthSnapshot = { phase: 'signed-out', user: null, method: null, error: null };

let snapshot: AuthSnapshot = INITIAL;
const listeners = new Set<() => void>();
let firebaseAuth: FirebaseAuthModule | null = null;
let preparing: Promise<void> | null = null;
let unwatch: (() => void) | null = null;
/** Bumped by every load and every failure, so a load that lost its deadline changes nothing. */
let attempt = 0;

function update(next: Partial<AuthSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

/** Follows Firebase's user from its first answer (the saved session, or none) onwards. */
function follow(module: FirebaseAuthModule, mine: number): Promise<void> {
  return new Promise<void>((resolve) => {
    unwatch = module.watchUser((user) => {
      if (mine !== attempt) return;
      if (user) update({ phase: 'signed-in', user, method: null });
      else if (snapshot.phase !== 'signing-in')
        update({ phase: 'ready', user: null, method: null });
      resolve();
    });
  });
}

/**
 * Loads Firebase Auth (once) and reads the visitor's saved session: 'signed-in' when there is one,
 * else 'ready' to choose a provider. A failure goes back to 'signed-out' with LOAD_FAILED, so the
 * visitor can press Sign in again.
 */
export function prepareSignIn(): Promise<void> {
  if (preparing) return preparing;
  attempt += 1;
  const mine = attempt;
  update({ phase: 'preparing', error: null });
  const run = async () => {
    const module = await import('./firebase-auth');
    if (mine !== attempt) return;
    firebaseAuth = module;
    await follow(module, mine);
  };
  preparing = withDeadline(run(), PREPARE_DEADLINE_MS, 'firebase auth').catch((error: unknown) => {
    logger.error('Firebase Auth failed to load:', error);
    attempt += 1;
    unwatch?.();
    unwatch = null;
    firebaseAuth = null;
    preparing = null;
    update({ phase: 'signed-out', error: LOAD_FAILED });
  });
  return preparing;
}

/** Signs in with `method`; the card shows the result. Loads Firebase first if it is not yet. */
export async function signIn(method: SignInMethod): Promise<void> {
  if (snapshot.phase === 'signing-in' || snapshot.phase === 'signed-in') return;
  await prepareSignIn();
  if (!firebaseAuth || snapshot.phase !== 'ready') return;
  update({ phase: 'signing-in', method, error: null });
  try {
    const user = await firebaseAuth.signInWith(method);
    update({ phase: 'signed-in', user, method: null });
  } catch (error) {
    logger.error('Sign-in error:', error);
    update({ phase: 'ready', method: null, error: signInErrorMessage(error) });
  }
}

/** Signs the visitor out; their saved session is cleared and the card offers the providers. */
export async function signOut(): Promise<void> {
  if (!firebaseAuth) {
    update(INITIAL);
    return;
  }
  try {
    await firebaseAuth.signOutUser();
    update({ phase: 'ready', user: null, method: null, error: null });
  } catch (error) {
    logger.error('Sign-out error:', error);
    update({ error: SIGN_OUT_FAILED });
  }
}

const isSessionEnded = (error: unknown): boolean => {
  const code = codeOf(error);
  return typeof code === 'string' && SESSION_ENDED.has(code);
};

/**
 * The signed-in session, to compare by identity (`===`) with one taken earlier: the guestbook's
 * post checks that the session that sent it is still the one signed in before it acts on the
 * answer. Null when nobody is signed in, or Firebase is not loaded (this never loads it).
 */
export function currentSession(): SessionHandle | null {
  return firebaseAuth?.currentSession() ?? null;
}

/**
 * The signed-in visitor's Firebase ID token, for the API to verify (a fresh one: Firebase refreshes
 * it near expiry, or always with `forceRefresh`). Null when nobody is signed in, or when the
 * session has ended; then the visitor is signed out here (Firebase does that itself only for some
 * of those codes), so the card offers sign-in rather than a box that cannot post. Only the session
 * that asked is signed out: if someone else has signed in since (here or in another tab), theirs
 * has not ended, so this rejects with Firebase's error and leaves them signed in, as Firebase
 * does. Rejects too when Firebase cannot give a token for another reason (offline, say). Firebase
 * is already loaded whenever someone is signed in, so this never loads it.
 */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const firebase = firebaseAuth;
  if (!firebase) return null;
  const requester = firebase.currentSession();
  try {
    return await firebase.currentIdToken(forceRefresh);
  } catch (error) {
    if (!isSessionEnded(error)) throw error;
    const now = firebase.currentSession();
    if (now === null) return null; // Signed out already (by Firebase, or by the visitor).
    if (now !== requester) throw error;
    await signOut();
    return null;
  }
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = (): AuthSnapshot => snapshot;
/** The server, and the first client render, always see a signed-out visitor. */
const getServerSnapshot = (): AuthSnapshot => INITIAL;

/** The sign-in state; re-renders when it changes. */
export function useAuth(): AuthSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The signed-in visitor, or null. */
export function useCurrentUser(): SessionUser | null {
  return useAuth().user;
}

/** A sign-in callback for `method`, and whether its popup is open. */
export function useSignIn(method: SignInMethod): readonly [signIn: () => void, inFlight: boolean] {
  const { phase, method: current } = useAuth();
  const run = useCallback(() => {
    void signIn(method);
  }, [method]);
  return [run, phase === 'signing-in' && current === method] as const;
}

/** A sign-out callback, and whether it is running. */
export function useSignOut(): readonly [signOut: () => void, inFlight: boolean] {
  const [inFlight, setInFlight] = useState(false);
  const run = useCallback(() => {
    setInFlight(true);
    void signOut().finally(() => setInFlight(false));
  }, []);
  return [run, inFlight] as const;
}

/** Forgets the state and the loaded module's subscription. Tests only. */
export function resetAuthForTests(): void {
  unwatch?.();
  attempt += 1;
  snapshot = INITIAL;
  firebaseAuth = null;
  preparing = null;
  unwatch = null;
  for (const listener of listeners) listener();
}
