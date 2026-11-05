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

let cachedDb: Firestore | null = null;

export function getAdminFirestore(): Firestore {
  if (cachedDb) return cachedDb;

  if (getApps().length > 0) {
    cachedDb = getFirestore(getApp());
    return cachedDb;
  }

  const raw = getServiceAccount();
  const { project_id: projectId, client_email: clientEmail, private_key: privateKeyEscaped } = raw;

  const formattedKey = privateKeyEscaped?.replaceAll(/\\n/g, '\n') ?? '';

  const isValidPrivateKey =
    formattedKey.includes('-----BEGIN PRIVATE KEY-----') ||
    formattedKey.includes('-----BEGIN RSA PRIVATE KEY-----');

  const serviceAccount: ServiceAccount = { projectId, clientEmail, privateKey: formattedKey };
  const app: App = isValidPrivateKey
    ? initializeApp({ credential: cert(serviceAccount), projectId })
    : initializeApp({ projectId });

  cachedDb = getFirestore(app);
  return cachedDb;
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
