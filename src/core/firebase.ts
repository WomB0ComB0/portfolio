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

import { config } from '@/config';
import { onRequestError } from '@/instrumentation';
import { logger } from '@/utils';
import { type FirebaseApp, type FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import { type Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, type Firestore, getFirestore } from 'firebase/firestore';

/**
 * @readonly
 * @const
 * @type {FirebaseOptions}
 * @description
 * Firebase client-side configuration object. Used to initialize Firebase App.
 * Obtains all sensitive values from the application's configuration module.
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
 * @readonly
 * @const
 * @type {object}
 * @description
 * Google Cloud service account credentials required for server-side Firebase admin APIs.
 * Secrets are injected from environment configurations and not committed to the repo.
 * @author Mike Odnis
 * @see https://cloud.google.com/iam/docs/service-accounts
 * @private
 * @version 1.0.0
 */
const serviceAccount = {
  type: 'service_account',
  project_id: config.gcp.projectId,
  private_key_id: config.gcp.privateKeyId,
  private_key: config.gcp.privateKey.replace(/\\n/g, '\n'),
  client_email: config.gcp.clientEmail,
  client_id: config.gcp.clientId,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: config.gcp.clientX509CertUrl,
  universe_domain: 'googleapis.com',
};

/**
 * Initializes and configures Firebase App, Auth, and Firestore services.
 * In development, optionally connects to Firebase emulators for local testing.
 * Ensures singleton pattern so initialization happens only once per runtime.
 *
 * @function
 * @returns {{ app: FirebaseApp, auth: Auth, firestore: Firestore }} Initialized instances for Firebase
 * @throws {Error} If there is an error connecting to emulators or initializing Firebase, error is captured and rethrown after logging.
 * @web
 * @public
 * @author Mike Odnis
 * @version 1.1.0
 * @see https://firebase.google.com/docs/web/setup
 * @see https://firebase.google.com/docs/emulator-suite/connect_firestore
 * @example
 * const { app, auth, firestore } = initializeFirebase();
 */
function initializeFirebase(): { app: FirebaseApp; auth: Auth; firestore: Firestore } {
  const existingApp = getApps()[0];
  const app = existingApp ?? initializeApp(firebaseConfig);

  if (!existingApp) {
    logger.info('Firebase initialized successfully');
  }

  const auth = getAuth(app);
  const firestore = getFirestore(app);

  // Connect to emulators in development (only once)
  // Set NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true to enable
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' &&
    !existingApp
  ) {
    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      connectFirestoreEmulator(firestore, 'localhost', 8080);
      logger.info('Connected to Firebase emulators');
    } catch (error) {
      // Emulators already connected or not available
      console.warn('Firebase emulators connection warning:', error);
      onRequestError(error);
      /**
       * @throws {Error} If unable to connect to Firebase emulators, logs and emits error but does not halt execution.
       */
    }
  }

  return { app, auth, firestore };
}

/**
 * @readonly
 * @type {FirebaseApp}
 * @description Singleton Firebase app instance
 * @public
 */
const { app, auth, firestore } = initializeFirebase();

export { app, auth, firestore, serviceAccount };
