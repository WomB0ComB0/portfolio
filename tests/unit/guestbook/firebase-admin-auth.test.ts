// @vitest-environment node
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
 * @file The server's one Firebase Admin app (src/core/firebase-admin.ts), now shared by Firestore
 * (the guestbook's writes) and Auth (checking a poster's ID token). Both come from the same
 * initializeApp call, made once, with the project id; the service-account credential is used only
 * when the configured key is a real one, so checking tokens never needs it (verifyIdToken uses
 * the project id and Google's public certificates). An app that already exists is reused. Auth
 * refuses, naming the variables but not their values, when the Admin project is not the browser's
 * Firebase project (every token would be refused as a bad one); Firestore is unaffected.
 *
 * The Admin SDK and the environment are fakes with synthetic values: no key is read and nothing
 * is initialised for real.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  apps: [] as unknown[],
  initializeApp: vi.fn(),
  cert: vi.fn(),
  getApp: vi.fn(),
  getFirestore: vi.fn(),
  getAuth: vi.fn(),
  env: {} as Record<string, string>,
}));

vi.mock('firebase-admin/app', () => ({
  cert: h.cert,
  getApp: h.getApp,
  getApps: () => h.apps,
  initializeApp: h.initializeApp,
}));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: h.getFirestore }));
vi.mock('firebase-admin/auth', () => ({ getAuth: h.getAuth }));
vi.mock('@/env', () => ({ env: h.env }));

/** Synthetic, and deliberately not a PEM key. */
const SYNTHETIC_ENV = {
  GCP_PROJECT_ID: 'test-project',
  GCP_PRIVATE_KEY_ID: 'test-key-id',
  GCP_PRIVATE_KEY: 'not-a-key',
  GCP_CLIENT_EMAIL: 'robot@test-project.example',
  GCP_CLIENT_ID: '0',
  GCP_CLIENT_X509_CERT_URL: 'https://certs.example/robot',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
};

const APP = { name: '[DEFAULT]' };

/** A fresh copy of the module, so its cached app does not carry over between tests. */
const load = async () => {
  vi.resetModules();
  return import('@/core/firebase-admin');
};

beforeEach(() => {
  vi.clearAllMocks();
  h.apps = [];
  Object.assign(h.env, SYNTHETIC_ENV);
  h.initializeApp.mockReturnValue(APP);
  h.getApp.mockReturnValue(APP);
  h.getFirestore.mockReturnValue({ kind: 'firestore' });
  h.getAuth.mockReturnValue({ kind: 'auth' });
});

describe('getAdminAuth', () => {
  it('initialises the app with the project id only when there is no usable key', async () => {
    const { getAdminAuth } = await load();

    expect(getAdminAuth()).toEqual({ kind: 'auth' });

    expect(h.initializeApp).toHaveBeenCalledTimes(1);
    expect(h.initializeApp).toHaveBeenCalledWith({ projectId: 'test-project' });
    expect(h.cert).not.toHaveBeenCalled();
    expect(h.getAuth).toHaveBeenCalledWith(APP);
  });

  it('shares the one app with Firestore, whichever is asked for first', async () => {
    const { getAdminAuth, getAdminFirestore } = await load();

    getAdminAuth();
    getAdminFirestore();
    getAdminAuth();

    expect(h.initializeApp).toHaveBeenCalledTimes(1);
    expect(h.getFirestore).toHaveBeenCalledWith(APP);
    expect(h.getAuth).toHaveBeenCalledWith(APP);
  });

  it('reuses an app that already exists', async () => {
    h.apps = [APP];
    const { getAdminAuth } = await load();

    getAdminAuth();

    expect(h.initializeApp).not.toHaveBeenCalled();
    expect(h.getAuth).toHaveBeenCalledWith(APP);
  });

  it("refuses when the Admin project is not the browser's Firebase project, naming the variables only", async () => {
    h.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'other-project';
    const { getAdminAuth } = await load();

    let thrown: unknown;
    try {
      getAdminAuth();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const { message } = thrown as Error;
    expect(message).toMatch(/GCP_PROJECT_ID/);
    expect(message).toMatch(/NEXT_PUBLIC_FIREBASE_PROJECT_ID/);
    expect(message).not.toMatch(/test-project|other-project/);
    expect(h.getAuth).not.toHaveBeenCalled();
  });

  it('still gives Firestore when the projects differ, so the page keeps its list', async () => {
    h.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'other-project';
    const { getAdminFirestore } = await load();

    expect(getAdminFirestore()).toEqual({ kind: 'firestore' });
  });
});
