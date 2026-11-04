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
 * @file The shared Elysia app factory. Security headers for /api come from next.config.ts
 * (src/config/security-headers.ts), so the app itself must not set them: on Vercel a header the
 * function sets replaces the next.config value for that key. Also covers the default error
 * handler's 404/500 bodies: one JSON object, with nothing taken from the thrown error.
 */

import { afterAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // Skips the OTLP exporter the shared constants create off Vercel.
  process.env.VERCEL = '1';
});

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
  reportApiServerError: vi.fn(),
}));

import { createElysiaApp, defaultErrorHandler } from '@/app/api/_elysia/shared/config';

afterAll(() => {
  Reflect.deleteProperty(process.env, 'VERCEL');
});

/** Headers that next.config.ts owns for /api responses. */
const NEXT_CONFIG_OWNED = [
  'strict-transport-security',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'x-xss-protection',
  'permissions-policy',
  'content-security-policy',
  'x-frame-options',
  'referrer-policy',
  'x-dns-prefetch-control',
  'x-nonce',
] as const;

const buildApp = () => {
  // Built in production mode, so a header that is only sent in production would show up here too.
  vi.stubEnv('NODE_ENV', 'production');
  try {
    return createElysiaApp({ prefix: '/api' })
      .get('/ping', () => ({ ok: true }))
      .get('/boom', () => {
        throw Object.assign(new Error('upstream said: secret-detail'), {
          response: { headers: { authorization: 'Bearer leaked-token' } },
        });
      });
  } finally {
    vi.unstubAllEnvs();
  }
};

const app = buildApp();
const get = (path: string) => app.handle(new Request(`http://localhost${path}`));

describe('createElysiaApp', () => {
  it('leaves the security headers to next.config.ts', async () => {
    const res = await get('/api/ping');
    expect(res.status).toBe(200);
    for (const key of NEXT_CONFIG_OWNED) {
      expect(res.headers.get(key), key).toBeNull();
    }
  });

  it("leaves the in-process backstop limiter's headers off (its counts are per instance)", async () => {
    const res = await get('/api/ping');
    expect(res.status).toBe(200);
    expect(res.headers.get('ratelimit-limit')).toBeNull();
    expect(res.headers.get('ratelimit-remaining')).toBeNull();
  });

  it('answers an unknown route with a single-encoded 404 body', async () => {
    const res = await get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(JSON.parse(await res.text())).toEqual({ error: 'Not found', status: 404 });
  });

  it('answers a thrown error with a generic 500 body', async () => {
    const res = await get('/api/boom');
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ error: 'Internal server error', status: 500 });
    expect(text).not.toMatch(/secret-detail|leaked-token|response/);
  });
});

describe('defaultErrorHandler', () => {
  const handle = (code: unknown, error: unknown) => {
    const set = { status: 200 };
    const body = JSON.parse(String(defaultErrorHandler({ code, error, set })));
    return { status: set.status, body };
  };

  it('returns one JSON object for 404 and 500', () => {
    expect(handle('NOT_FOUND', new Error('NOT_FOUND'))).toEqual({
      status: 404,
      body: { error: 'Not found', status: 404 },
    });
    expect(handle(404, { code: 404 })).toEqual({
      status: 404,
      body: { error: 'Not found', status: 404 },
    });
    expect(handle('UNKNOWN', { token: 'leaked-token', nested: { a: 1 } })).toEqual({
      status: 500,
      body: { error: 'Internal server error', status: 500 },
    });
  });

  it('keeps the 400 body for invalid requests', () => {
    expect(handle('PARSE', new Error('Unexpected token'))).toEqual({
      status: 400,
      body: { error: 'Malformed request body', status: 400 },
    });
    expect(handle('VALIDATION', { type: 'body' })).toEqual({
      status: 400,
      body: { error: 'Invalid request', status: 400 },
    });
  });
});
