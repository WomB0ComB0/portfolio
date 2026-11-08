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
 * token is checked or anything is written.
 *
 * The guard's verdict, verifyIdToken and Firestore's add are fakes: nothing reaches Redis,
 * Firebase Auth or the real guestbook, and no upstream API is called.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  add: vi.fn(),
  verifyIdToken: vi.fn(),
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
// t3-env validates every production variable on import.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
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
vi.mock('@/core/firebase-admin', () => ({
  adminDb: { collection: () => ({ add: h.add }) },
  getAdminAuth: () => ({ verifyIdToken: h.verifyIdToken }),
  getServiceAccount: () => ({}),
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

const postMessage = (authorization?: string) =>
  call('/api/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify({ message: 'Hello' }),
  });

const allow = () => h.guardCheck.mockResolvedValue({ kind: 'allow' });

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
    expect(h.add).not.toHaveBeenCalled();
  });

  it('counts a POST on the guestbook limiter and answers 429 before the token is checked', async () => {
    h.guardCheck.mockImplementation(async (request: Request) =>
      classifyRequest(request.method, new URL(request.url).pathname)?.limiter === 'guestbook'
        ? { kind: 'limit', limit: 5, reset: Date.now() + 60_000 }
        : { kind: 'allow' },
    );

    const response = await postMessage(`Bearer ${TOKEN}`);

    expect(response.status).toBe(429);
    expect(response.headers.get('ratelimit-limit')).toBe('5');
    expect(h.guardCheck).toHaveBeenCalledTimes(1);
    expect(h.verifyIdToken).not.toHaveBeenCalled();
    expect(h.add).not.toHaveBeenCalled();
  });

  it('stores a signed-in POST the guard allows, once', async () => {
    allow();
    h.verifyIdToken.mockResolvedValueOnce({
      uid: 'uid-ada',
      name: 'Ada Lovelace',
      firebase: { sign_in_provider: 'github.com', identities: {} },
    });
    h.add.mockResolvedValueOnce({ id: 'new-doc' });

    const response = await postMessage(`Bearer ${TOKEN}`);

    expect(response.status).toBe(201);
    expect(h.add).toHaveBeenCalledTimes(1);
    expect(h.add).toHaveBeenCalledWith(expect.objectContaining({ uid: 'uid-ada' }));
  });
});
