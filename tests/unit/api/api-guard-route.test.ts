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
 * @file The API guard as wired into createElysiaApp, driven through the real /api route handler
 * and a minimal /api/v1 app: a 'ban' verdict answers 403 and a 'limit' verdict 429 (with
 * Retry-After and RateLimit-* headers) before routing and the admin bearer check, both with
 * Cache-Control: no-store; an 'allow' verdict lets the request through unchanged.
 */

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.ADMIN_API_TOKEN = 'test-admin-token';
  // Skips the OTLP exporter and process signal handlers the route registers off Vercel.
  process.env.VERCEL = '1';
});

vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/core', () => ({ onRequestError: vi.fn() }));
vi.mock('@/lib/better-stack', () => ({}));
vi.mock('@/lib/security/banlist', () => ({
  banIp: vi.fn(),
  unbanIp: vi.fn(),
  slowIp: vi.fn(),
  unslowIp: vi.fn(),
  getBannedIps: vi.fn(async () => []),
  getSlowedIps: vi.fn(async () => []),
  getBanMetadata: vi.fn(),
}));
vi.mock('@/lib/security/banlist-cidr', () => ({
  banCidr: vi.fn(),
  unbanCidr: vi.fn(),
  getBannedCidrs: vi.fn(async () => []),
}));
vi.mock('@/lib/security/api-guard', () => ({
  apiGuard: { check: vi.fn(async () => ({ kind: 'allow' })) },
}));

import { createElysiaApp } from '@/app/api/_elysia/shared/config';
import { GET, POST } from '@/app/api/[[...route]]/route';
import { apiGuard } from '@/lib/security/api-guard';

const check = vi.mocked(apiGuard.check);

const adminBan = (token?: string) =>
  POST(
    new Request('http://localhost/api/admin/ban', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-real-ip': '203.0.113.9',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action: 'list' }),
    }),
  );

const v1App = createElysiaApp({ prefix: '/api/v1' }).get('/ping', () => ({ pong: true }));
const v1 = (path = '/api/v1/ping') =>
  v1App.handle(new Request(`http://localhost${path}`, { headers: { 'x-real-ip': '203.0.113.9' } }));

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  Reflect.deleteProperty(process.env, 'ADMIN_API_TOKEN');
  Reflect.deleteProperty(process.env, 'VERCEL');
});

describe('API guard hook', () => {
  it('answers 403 with no-store for a banned client, before routing and the bearer check', async () => {
    check.mockResolvedValueOnce({ kind: 'ban' });
    const res = await adminBan();
    expect(res.status).toBe(403);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: 'Forbidden' });
    expect(check).toHaveBeenCalledTimes(1);
    expect(new URL(check.mock.calls[0]?.[0].url ?? '').pathname).toBe('/api/admin/ban');
  });

  it('answers 403 for unknown paths too, since it runs before routing', async () => {
    check.mockResolvedValueOnce({ kind: 'ban' });
    const res = await GET(new Request('http://localhost/api/does-not-exist'));
    expect(res.status).toBe(403);
  });

  it('answers 429 with whole-second Retry-After and RateLimit headers when limited', async () => {
    check.mockResolvedValueOnce({ kind: 'limit', limit: 30, reset: Date.now() + 12_500 });
    const res = await adminBan('test-admin-token');
    expect(res.status).toBe(429);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('retry-after')).toBe('13');
    expect(res.headers.get('ratelimit-limit')).toBe('30');
    expect(res.headers.get('ratelimit-remaining')).toBe('0');
    expect(res.headers.get('ratelimit-reset')).toBe('13');
    expect(await res.json()).toEqual({ error: 'Too many requests' });
  });

  it('never sends Retry-After below 1 second', async () => {
    check.mockResolvedValueOnce({ kind: 'limit', limit: 5, reset: Date.now() - 5_000 });
    const res = await adminBan();
    expect(res.headers.get('retry-after')).toBe('1');
  });

  it('lets allowed requests through to the route (the bearer check still applies)', async () => {
    expect((await adminBan()).status).toBe(401);
    const res = await adminBan('test-admin-token');
    expect(res.status).toBe(200);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('guards the /api/v1 app the same way', async () => {
    check.mockResolvedValueOnce({ kind: 'ban' });
    expect((await v1()).status).toBe(403);

    check.mockResolvedValueOnce({ kind: 'limit', limit: 60, reset: Date.now() + 1_000 });
    expect((await v1()).status).toBe(429);

    const res = await v1();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: true });
  });

  it('leaves rate-limit headers to the guard: the in-process backstop sends none', async () => {
    const res = await v1();
    expect(res.status).toBe(200);
    expect(res.headers.get('ratelimit-limit')).toBeNull();
    expect(res.headers.get('ratelimit-remaining')).toBeNull();
  });
});
