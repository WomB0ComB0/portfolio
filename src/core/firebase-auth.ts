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
 * @file Firebase Auth in the browser, loaded on demand. Nothing imports this module statically:
 * src/core/auth.ts imports it with `import()` when a visitor presses Sign in, so the Firebase SDK
 * is its own chunk and a visitor who never signs in downloads none of it, makes no Firebase
 * request and never gets the apis.google.com auth iframe.
 *
 * Auth is initialized here, once, with the popup resolver. On phones and Safari, Firebase loads
 * its iframe as soon as Auth starts, so by the time the visitor picks a provider the popup can
 * open inside their click (Firebase waits for the iframe before opening it, and those browsers
 * block a popup that opens long after the click). If that early start fails, Firebase ignores the
 * failure and retries inside the click; a slow retry gets the popup blocked, and the next press
 * opens it, since the retry kept the iframe (src/core/auth.ts says so for auth/popup-blocked).
 * Firebase has no public way to check or redo the early start, and signInWithRedirect is no
 * fallback: with a firebaseapp.com auth domain it breaks under Safari's storage partitioning, and
 * the page would lose the draft. No Firestore in the browser: messages are read on the server and
 * posted through the API.
 */

import { getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  GithubAuthProvider,
  GoogleAuthProvider,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { config } from '@/config';
import type { SessionHandle, SessionUser, SignInMethod } from './auth.types';

const AUTH_EMULATOR_URL = 'http://localhost:9099';

let instance: Auth | null = null;

/** The Firebase options, from the public NEXT_PUBLIC_FIREBASE_* configuration. */
const firebaseOptions = () => ({
  apiKey: config.firebase.apiKey,
  authDomain: config.firebase.authDomain,
  projectId: config.firebase.projectId,
  storageBucket: config.firebase.storageBucket,
  messagingSenderId: config.firebase.messagingSenderId,
  appId: config.firebase.appId,
  measurementId: config.firebase.measurementId,
});

/** Auth, initialized on first use; a hot reload that already initialized it reuses that one. */
export function clientAuth(): Auth {
  if (instance) return instance;
  const app = getApps()[0] ?? initializeApp(firebaseOptions());
  let auth: Auth;
  try {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch (error) {
    if ((error as { code?: unknown }).code !== 'auth/already-initialized') throw error;
    auth = getAuth(app);
  }
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'
  ) {
    connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
  }
  instance = auth;
  return auth;
}

const toSessionUser = (user: User): SessionUser => ({
  displayName: user.displayName,
  isAnonymous: user.isAnonymous,
});

/**
 * Calls `listener` with the visitor (or null) once Auth has read its saved session, then on every
 * change. Returns the unsubscribe function.
 */
export function watchUser(listener: (user: SessionUser | null) => void): () => void {
  return onAuthStateChanged(clientAuth(), (user) => listener(user ? toSessionUser(user) : null));
}

function providerFor(method: 'google.com' | 'github.com'): GoogleAuthProvider | GithubAuthProvider {
  if (method === 'github.com') {
    const github = new GithubAuthProvider();
    github.addScope('read:user');
    return github;
  }
  const google = new GoogleAuthProvider();
  google.addScope('profile');
  google.addScope('email');
  google.setCustomParameters({ prompt: 'consent' });
  return google;
}

/** Signs in with a provider's popup, or anonymously as a guest. Rejects with Firebase's error. */
export async function signInWith(method: SignInMethod): Promise<SessionUser> {
  const auth = clientAuth();
  const credential =
    method === 'anonymous'
      ? await signInAnonymously(auth)
      : await signInWithPopup(auth, providerFor(method));
  return toSessionUser(credential.user);
}

/** Signs the visitor out. */
export function signOutUser(): Promise<void> {
  return signOut(clientAuth());
}

/**
 * The signed-in session: Firebase's user, which it keeps as one object through token refreshes
 * and across tabs, and replaces when the visitor signs out or someone else signs in. Null when
 * nobody is signed in. currentIdToken asks this same user when called in the same tick.
 */
export function currentSession(): SessionHandle | null {
  return clientAuth().currentUser;
}

/** The signed-in visitor's uid, or null when nobody is signed in. */
export function currentUid(): string | null {
  return clientAuth().currentUser?.uid ?? null;
}

/**
 * The signed-in visitor's ID token, for the API to verify, or null when nobody is signed in.
 * Firebase refreshes it first when it is about to expire, or always with `forceRefresh`. Rejects
 * with Firebase's error; when the session has ended with auth/user-token-expired or
 * auth/user-disabled, Firebase has signed the visitor out by then (not for the other codes).
 */
export function currentIdToken(forceRefresh = false): Promise<string | null> {
  const user = clientAuth().currentUser;
  return user ? user.getIdToken(forceRefresh) : Promise.resolve(null);
}
