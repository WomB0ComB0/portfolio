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

import {
  type App,
  cert,
  getApp,
  getApps,
  initializeApp,
  type ServiceAccount,
} from 'firebase-admin/app';
import { type Auth, getAuth } from 'firebase-admin/auth';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';
import { env } from '@/env';

export function getServiceAccount() {
  return {
    type: 'service_account',
    project_id: env.GCP_PROJECT_ID,
    private_key_id: env.GCP_PRIVATE_KEY_ID,
    private_key: env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: env.GCP_CLIENT_EMAIL,
    client_id: env.GCP_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: env.GCP_CLIENT_X509_CERT_URL,
    universe_domain: 'googleapis.com',
  } as const;
}

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;

/** The Admin app, with the service account when its key is a real one, else the project id alone. */
function initializeAdminApp(): App {
  const raw = getServiceAccount();
  const { project_id: projectId, client_email: clientEmail, private_key: privateKeyEscaped } = raw;

  const formattedKey = privateKeyEscaped?.replaceAll(/\\n/g, '\n') ?? '';

  const isValidPrivateKey =
    formattedKey.includes('-----BEGIN PRIVATE KEY-----') ||
    formattedKey.includes('-----BEGIN RSA PRIVATE KEY-----');

  const serviceAccount: ServiceAccount = { projectId, clientEmail, privateKey: formattedKey };
  return isValidPrivateKey
    ? initializeApp({ credential: cert(serviceAccount), projectId })
    : initializeApp({ projectId });
}

/**
 * The server's one Firebase Admin app (GCP_PROJECT_ID, plus the GCP_* service account when its key
 * is set), shared by Firestore and Auth; an app that already exists is reused.
 */
export function getAdminApp(): App {
  cachedApp ??= getApps().length > 0 ? getApp() : initializeAdminApp();
  return cachedApp;
}

export function getAdminFirestore(): Firestore {
  cachedDb ??= getFirestore(getAdminApp());
  return cachedDb;
}

/**
 * The Admin app checks a token's audience and issuer against GCP_PROJECT_ID, and the browser signs
 * visitors in to NEXT_PUBLIC_FIREBASE_PROJECT_ID. Were they different projects, every token would
 * be refused as if it were a bad one (a 401 for every visitor, nothing reported). The message names
 * the variables, never their values.
 */
export class FirebaseProjectMismatchError extends Error {
  readonly name = 'FirebaseProjectMismatchError';

  constructor() {
    super(
      "GCP_PROJECT_ID and NEXT_PUBLIC_FIREBASE_PROJECT_ID name different Firebase projects, so visitors' sign-in tokens cannot be verified",
    );
  }
}

/**
 * Firebase Auth on the Admin app, for checking visitors' ID tokens. verifyIdToken needs only the
 * project id (it checks the signature against Google's public certificates), so it works with or
 * without the service-account credential. Throws a {@link FirebaseProjectMismatchError} when the
 * Admin project is not the browser's (Firestore is unaffected).
 */
export function getAdminAuth(): Auth {
  if (env.GCP_PROJECT_ID !== env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    throw new FirebaseProjectMismatchError();
  }
  return getAuth(getAdminApp());
}

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_target, prop, receiver) {
    const instance = getAdminFirestore();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});
