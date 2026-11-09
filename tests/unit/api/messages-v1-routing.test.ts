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
 * @file /api/v1/messages in the real /api/v1 app (createElysiaApp with the utility routes and
 * every v1 route, as route.ts builds it). The list route is gone: GET answers the app's 404, while
 * the other v1 routes still answer and POST is still mounted (401 without a sign-in). A POST is
 * counted by the 'guestbook' limiter before routing, so a limited visitor gets 429 before the
 * token is checked or anything is written, and the same post sent again (its requestId) is
 * counted like any other.
 *
 * The guard's verdict and Firestore's write batch are fakes, and Google's securetoken keys are a
 * local key set (the token is signed in the test, then checked by the real verifier): nothing
 * reaches Redis, Google, Firebase Auth or the real guestbook, and no upstream API is called.
 */

import { createIdTokenSigner, type IdTokenSigner } from '@tests/setup/firebase-id-tokens';
import type { JWTVerifyGetKey } from 'jose';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  create: vi.fn(),
  commit: vi.fn(),
  keys: vi.fn(),
  guardCheck: vi.fn(),
}));

// No OTLP exporter or Vercel switch: the shared constants are replaced outright.
vi.mock('@/app/api/_elysia/constants', () => ({
  IS_VERCEL: true,
  otelResource: {},
  otlpExporter: undefined,
  batchSpanProcessor: undefined,
  version: '0.0.0-test',
}));
// t3-env validates every production variable on import. The two Firebase project ids (synthetic)
// are the only values the post needs.
vi.mock('@/env', () => {
  const values: Readonly<Record<string, string>> = {
    NODE_ENV: 'test',
    GCP_PROJECT_ID: 'test-project',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
  };
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (typeof key === 'string' ? values[key] : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/observability/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/observability/report')>()),
  nameApiTransaction: vi.fn(),
  reportApiFailure: vi.fn(),
  reportApiServerError: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
}));
vi.mock('@/core/firebase', () => ({ firestore: {} }));
vi.mock('@/core/firebase-admin', () => {
  const batch = {
    create: (ref: { readonly path: string }, data: unknown) => {
      h.create(ref.path, data);
      return batch;
    },
    commit: h.commit,
  };
  return {
    adminDb: {
      collection: (path: string) => ({
        doc: (id = 'new-doc') => ({ id, path: `${path}/${id}` }),
      }),
      batch: () => batch,
    },
    getServiceAccount: () => ({}),
  };
});
vi.mock('@/core/firebase-id-token', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/firebase-id-token')>()),
  googleIdTokenKeys: () => h.keys,
}));
vi.mock('@/lib/security/api-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/security/api-guard')>()),
  apiGuard: { check: h.guardCheck },
}));
// The Sanity routes come with the app; their client reads config through require() at import.
vi.mock('@/lib/sanity/client', () => ({
  sanityFetch: vi.fn(),
  sanityFetchWithToken: vi.fn(),
  urlFor: vi.fn(),
}));

import { createElysiaApp } from '@/app/api/_elysia/shared/config';
import { apiRoutes, utilityRoutes } from '@/app/api/v1/[[...route]]/elysia';
import { classifyRequest } from '@/lib/security/api-guard';

const TOKEN = 'test-header.test-payload.test-signature';

const app = createElysiaApp({ prefix: '/api/v1' }).use(utilityRoutes).use(apiRoutes);

const call = (path: string, init: RequestInit = {}) =>
  app.handle(
    new Request(`http://localhost${path}`, {
      ...init,
      headers: { 'x-real-ip': '203.0.113.9', ...init.headers },
    }),
  );

const postMessage = (authorization?: string, body: unknown = { message: 'Hello' }) =>
  call('/api/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
  });

const allow = () => h.guardCheck.mockResolvedValue({ kind: 'allow' });

let signer: IdTokenSigner;

beforeAll(async () => {
  signer = await createIdTokenSigner();
  h.keys.mockImplementation(((header, token) => signer.keys(header, token)) as JWTVerifyGetKey);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('/api/v1/messages after the list route was removed', () => {
  it('answers GET with the app 404 and reads nothing', async () => {
    allow();

    const response = await call('/api/v1/messages');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found', status: 404 });
  });

  it('keeps the other v1 routes answering', async () => {
    allow();

    const version = await call('/api/v1/version');
    const health = await call('/api/v1/health');

    expect(version.status).toBe(200);
    expect(health.status).toBe(200);
  });

  it('keeps POST mounted: without a sign-in it is a 401, not a 404', async () => {
    allow();

    const response = await postMessage();

    expect(response.status).toBe(401);
    expect(h.commit).not.toHaveBeenCalled();
  });

  it('counts a POST on the guestbook limiter and answers 429 before the token is checked', async () => {
    h.guardCheck.mockImplementation(async (request: Request) =>
      classifyRequest(request.method, new URL(request.url).pathname)?.limiter === 'guestbook'
        ? { kind: 'limit', limit: 5, reset: Date.now() + 60_000 }
        : { kind: 'allow' },
    );

    const response = await postMessage(`Bearer ${await signer.sign()}`);

    expect(response.status).toBe(429);
    expect(response.headers.get('ratelimit-limit')).toBe('5');
    expect(h.guardCheck).toHaveBeenCalledTimes(1);
    expect(h.keys).not.toHaveBeenCalled();
    expect(h.commit).not.toHaveBeenCalled();
  });

  it('counts the same post sent again (its requestId) on the guestbook limiter like any post', async () => {
    // The first post is allowed; the guestbook limiter is spent by the time it is sent again.
    h.guardCheck
      .mockResolvedValueOnce({ kind: 'allow' })
      .mockImplementationOnce(async (request: Request) =>
        classifyRequest(request.method, new URL(request.url).pathname)?.limiter === 'guestbook'
          ? { kind: 'limit', limit: 5, reset: Date.now() + 60_000 }
          : { kind: 'allow' },
      );
    h.commit.mockResolvedValueOnce([]);
    // Synthetic: the browser's id for one draft, sent again with the same text.
    const body = { message: 'Hello', requestId: '6f1c2a4e-8b3d-4c5e-9f7a-0b1c2d3e4f5a' };
    const authorization = `Bearer ${await signer.sign({ sub: 'uid-ada' })}`;

    const first = await postMessage(authorization, body);
    const again = await postMessage(authorization, body);

    expect(first.status).toBe(201);
    expect(again.status).toBe(429);
    expect(h.guardCheck).toHaveBeenCalledTimes(2);
    expect(h.keys).toHaveBeenCalledTimes(1);
    expect(h.commit).toHaveBeenCalledTimes(1);
  });

  it('answers a JWT-shaped string that is not a token with 401, not a 500', async () => {
    allow();

    const response = await postMessage(`Bearer ${TOKEN}`);

    expect(response.status).toBe(401);
    expect(h.commit).not.toHaveBeenCalled();
  });

  it('stores a signed-in POST the guard allows, once', async () => {
    allow();
    h.commit.mockResolvedValueOnce([]);
    const token = await signer.sign({
      sub: 'uid-ada',
      name: 'Ada Lovelace',
      firebase: { sign_in_provider: 'github.com', identities: {} },
    });

    const response = await postMessage(`Bearer ${token}`);

    expect(response.status).toBe(201);
    expect(h.commit).toHaveBeenCalledTimes(1);
    expect(h.create).toHaveBeenCalledWith(
      expect.stringMatching(/\/public\/data\/message\/new-doc$/),
      expect.not.objectContaining({ uid: expect.anything() }),
    );
    expect(h.create).toHaveBeenCalledWith(
      expect.stringMatching(/\/private\/data\/messagePoster\/new-doc$/),
      expect.objectContaining({ uid: 'uid-ada' }),
    );
  });
});
