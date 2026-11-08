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
 * @file The Firebase app and Firestore for the guestbook's server reads (src/lib/guestbook). No
 * Auth here: the browser loads Firebase Auth on demand from ./firebase-auth when a visitor signs
 * in, so importing this module never starts Auth (or its iframe) anywhere.
 */

import { type FirebaseApp, type FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, type Firestore, getFirestore } from 'firebase/firestore';
import { config } from '@/config';
import { reportError } from '@/lib/observability/report';
import { logger } from '@/utils';

/**
 * @readonly
 * @const
 * @type {FirebaseOptions}
 * @description
 * Firebase client-side configuration object. Used to initialize Firebase App.
 * Obtains all values from the application's configuration module (public keys only).
 * @author Mike Odnis
 * @see https://firebase.google.com/docs/web/setup
 * @version 1.0.0
 */
const firebaseConfig = {
  apiKey: config.firebase.apiKey,
  authDomain: config.firebase.authDomain,
  projectId: config.firebase.projectId,
  storageBucket: config.firebase.storageBucket,
  messagingSenderId: config.firebase.messagingSenderId,
  appId: config.firebase.appId,
  measurementId: config.firebase.measurementId,
} as const satisfies FirebaseOptions;

/**
 * Initializes the Firebase App and Firestore once per runtime. In development, optionally
 * connects Firestore to its emulator (NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true).
 *
 * @returns {{ app: FirebaseApp, firestore: Firestore }} The app and its Firestore.
 * @see https://firebase.google.com/docs/web/setup
 * @see https://firebase.google.com/docs/emulator-suite/connect_firestore
 */
function initializeFirebase(): { app: FirebaseApp; firestore: Firestore } {
  const existingApp = getApps()[0];
  const app = existingApp ?? initializeApp(firebaseConfig);

  if (!existingApp) {
    logger.info('Firebase initialized successfully');
  }

  const firestore = getFirestore(app);

  if (
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' &&
    !existingApp
  ) {
    try {
      connectFirestoreEmulator(firestore, 'localhost', 8080);
      logger.info('Connected to the Firestore emulator');
    } catch (error) {
      // Already connected, or the emulator is not running: reads go to Firestore instead.
      console.warn('Firestore emulator connection warning:', error);
      reportError(error);
    }
  }

  return { app, firestore };
}

/** The singleton Firebase app and Firestore. */
const { app, firestore } = initializeFirebase();

export { app, firestore };
