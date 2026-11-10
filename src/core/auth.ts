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
 *
 * Firebase's watcher has the last word on who is signed in. A user it reports clears any sign-in
 * error, since Firebase can reject a popup as closed and then sign the visitor in all the same. A
 * popup that a newer press or a sign-out has superseded changes nothing when it settles. Two events
 * go to Sentry, and neither sends anything about the visitor: a failed sign-in, as its code,
 * provider and time to fail only (see reportSignInFailure); and a sign-in Firebase reports soon
 * after a closed popup, as the provider, the gap in ms and one flag only (see
 * reportSignInAfterClosedPopup). A log that cannot be sent never changes the card.
 */

import { useCallback, useState, useSyncExternalStore } from 'react';
import { withDeadline } from '@/lib/async/deadline';
import { reportSignInAfterClosedPopup, reportSignInFailure } from '@/lib/observability/report';
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
const SIGN_IN_PAGE_CLOSED =
  'The sign-in page closed before sign-in finished. Choose a sign-in option to try again.';

/** Firebase's code for a popup whose tab it found closed (8-10 s before it says so). */
const POPUP_CLOSED = 'auth/popup-closed-by-user';
/** How soon after a closed popup a user Firebase reports is logged as signing in after it. */
export const LATE_SIGN_IN_WINDOW_MS = 60_000;

/** Firebase's error codes the visitor can act on, in their words. */
const SIGN_IN_ERRORS: Readonly<Record<string, string>> = {
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  // Usually a late open, not a setting: when Firebase's early start of its popup helper failed, it
  // retries inside the click, and a slow retry gets the window blocked. The retry keeps the helper,
  // so the next press opens at once.
  'auth/popup-blocked':
    "Your browser blocked the sign-in window. Press the same button again. If it's still blocked, allow pop-ups for this site.",
  // Not always the visitor's doing. On a phone the popup is a tab, and Firebase says this 8-10 s
  // after the tab is gone, whatever closed it (it checks every 2 s, then waits 8 s), even when
  // sign-in was still finishing; then Firebase signs the visitor in, and the watcher's report
  // clears it.
  [POPUP_CLOSED]: SIGN_IN_PAGE_CLOSED,
  // Firebase cancels an open popup when another opens. A newer press or a sign-out supersedes the
  // older sign-in first (signInRun), so that one is never shown; this is a fallback.
  'auth/cancelled-popup-request': SIGN_IN_PAGE_CLOSED,
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

/** Firebase's codes for a popup that closed or was cancelled: nothing went wrong as such. */
const POPUP_GONE: ReadonlySet<string> = new Set([POPUP_CLOSED, 'auth/cancelled-popup-request']);

const codeOf = (error: unknown): unknown => (error as { code?: unknown } | null)?.code;

/** Firebase's error code, or 'unknown' when the error carries none. */
const codeText = (error: unknown): string => {
  const code = codeOf(error);
  return typeof code === 'string' ? code : 'unknown';
};

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
/**
 * Bumped by every sign-in and every sign-out, so a popup that a newer press or a sign-out has
 * superseded changes nothing when it settles. If it signed someone in, Firebase's watcher says so.
 */
let signInRun = 0;
/** The last popup Firebase reported closed, until Firebase next reports a user. */
let closedPopup: { readonly method: SignInMethod; readonly at: number } | null = null;

function update(next: Partial<AuthSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

/**
 * Sends a sign-in log. One that fails (a Sentry logger missing or changed) is never thrown: it must
 * not leave the card mid-sign-in or reject signIn. It goes to logger.error, which prints in the
 * browser only in development or with ENABLE_CLIENT_LOGS set, so in production it is dropped
 * silently.
 */
function record(send: () => void): void {
  try {
    send();
  } catch (error) {
    logger.error('Sign-in log not sent:', error);
  }
}

/**
 * When Firebase reports a user within LATE_SIGN_IN_WINDOW_MS of a closed popup, logs that it did,
 * once, before the card shows them. Nothing about the user is sent: only the closed popup's
 * provider, the gap in ms and whether a sign-in was under way (a popup, or a guest sign-in, which
 * opens none), which tells a press after the error from Firebase finishing the closed one on its
 * own.
 */
function noteSignInAfterClosedPopup(): void {
  const closed = closedPopup;
  closedPopup = null;
  if (!closed) return;
  const gapMs = Date.now() - closed.at;
  if (gapMs > LATE_SIGN_IN_WINDOW_MS) return;
  const signingIn = snapshot.phase === 'signing-in';
  record(() => reportSignInAfterClosedPopup({ method: closed.method, gapMs, signingIn }));
}

/** Follows Firebase's user from its first answer (the saved session, or none) onwards. */
function follow(module: FirebaseAuthModule, mine: number): Promise<void> {
  return new Promise<void>((resolve) => {
    unwatch = module.watchUser((user) => {
      if (mine !== attempt) return;
      if (user) {
        noteSignInAfterClosedPopup();
        update({ phase: 'signed-in', user, method: null, error: null });
      } else if (snapshot.phase !== 'signing-in')
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

/**
 * Where a failed sign-in leaves the card. With nobody signed in: the choices again, with the error.
 * With someone signed in meanwhile (a popup Firebase rejected that signed them in after all, or
 * another tab): they stay signed in, with no word for a closed or cancelled popup, but with any
 * other error (an account that exists with another provider, say).
 */
function afterFailedSignIn(error: unknown): Partial<AuthSnapshot> {
  if (!snapshot.user) return { phase: 'ready', method: null, error: signInErrorMessage(error) };
  const popupGone = POPUP_GONE.has(codeText(error));
  return { phase: 'signed-in', method: null, error: popupGone ? null : signInErrorMessage(error) };
}

/**
 * Signs in with `method`; the card shows the result. Loads Firebase first if it is not yet. A
 * sign-in that a newer press or a sign-out has superseded changes nothing when it settles (see
 * signInRun). Every failure is logged by its code, provider and timing, after the card is updated.
 */
export async function signIn(method: SignInMethod): Promise<void> {
  if (snapshot.phase === 'signing-in' || snapshot.phase === 'signed-in') return;
  await prepareSignIn();
  if (!firebaseAuth || snapshot.phase !== 'ready') return;
  signInRun += 1;
  const mine = signInRun;
  const pressedAt = Date.now();
  update({ phase: 'signing-in', method, error: null });
  try {
    const user = await firebaseAuth.signInWith(method);
    if (mine !== signInRun) return;
    update({ phase: 'signed-in', user, method: null });
  } catch (error) {
    logger.error('Sign-in error:', error);
    const code = codeText(error);
    const failedAt = Date.now();
    if (code === POPUP_CLOSED) closedPopup = { method, at: failedAt };
    if (mine === signInRun) update(afterFailedSignIn(error));
    record(() => reportSignInFailure({ code, method, elapsedMs: failedAt - pressedAt }));
  }
}

/**
 * Signs the visitor out; their saved session is cleared and the card offers the providers. If
 * someone has signed in again by the time Firebase is done (in another tab, say), Firebase's watcher
 * will show them, and they stay signed in here as they are in Firebase. A popup still open from an
 * earlier press no longer counts: whatever it settles to changes nothing here.
 */
export async function signOut(): Promise<void> {
  signInRun += 1;
  if (!firebaseAuth) {
    update(INITIAL);
    return;
  }
  try {
    await firebaseAuth.signOutUser();
    const someoneSignedIn = firebaseAuth.currentSession() !== null;
    update(
      someoneSignedIn ? { error: null } : { phase: 'ready', user: null, method: null, error: null },
    );
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
 * The signed-in visitor's Firebase uid, for state this page keeps per visitor (the guestbook's
 * unconfirmed posts, whose requestIds only their poster reuses); never sent, since the API reads the
 * uid from the verified token. Null when nobody is signed in, or Firebase is not loaded (this
 * never loads it).
 */
export function currentUid(): string | null {
  return firebaseAuth?.currentUid() ?? null;
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
  signInRun += 1;
  closedPopup = null;
  snapshot = INITIAL;
  firebaseAuth = null;
  preparing = null;
  unwatch = null;
  for (const listener of listeners) listener();
}
