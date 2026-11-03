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
 * @file The admin ban API, driven through the real /api route handler (createElysiaApp and its
 * error handler included, as in production): mounted at the documented /api/admin/ban (it used
 * to be /api/api/admin/ban), 400 for invalid input without echoing the validator schema (it used
 * to be a 500 with the schema in the body), and 503 when the Redis-backed store fails (`list`
 * used to report success with empty data).
 */

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

const TOKEN = vi.hoisted(() => {
  const token = 'test-admin-token';
  process.env.ADMIN_API_TOKEN = token;
  // Skips the OTLP exporter and process signal handlers the route registers off Vercel.
  process.env.VERCEL = '1';
  return token;
});

// The route's import chain loads the env schema, which would demand every production variable.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// '@/core' initialises Firebase on import; the route chain only needs onRequestError from it.
vi.mock('@/core', () => ({ onRequestError: vi.fn() }));
// The /api app also mounts the status route, which talks to Better Stack.
vi.mock('@/lib/better-stack', () => ({}));
vi.mock('@/lib/security/banlist', () => ({
  banIp: vi.fn(),
  unbanIp: vi.fn(),
  slowIp: vi.fn(),
  unslowIp: vi.fn(),
  getBannedIps: vi.fn(),
  getSlowedIps: vi.fn(),
  getBanMetadata: vi.fn(),
}));
vi.mock('@/lib/security/banlist-cidr', () => ({
  banCidr: vi.fn(),
  unbanCidr: vi.fn(),
  getBannedCidrs: vi.fn(),
}));

import { POST } from '@/app/api/[[...route]]/route';
import * as banlist from '@/lib/security/banlist';
import * as banlistCidr from '@/lib/security/banlist-cidr';

const call = (body: unknown, { token = TOKEN, path = '/api/admin/ban' } = {}) =>
  POST(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  Reflect.deleteProperty(process.env, 'ADMIN_API_TOKEN');
  Reflect.deleteProperty(process.env, 'VERCEL');
});

describe('POST /api/admin/ban', () => {
  it('is mounted at the documented path, not /api/api/admin/ban', async () => {
    vi.mocked(banlist.getBannedIps).mockResolvedValue([]);
    vi.mocked(banlist.getSlowedIps).mockResolvedValue([]);
    expect((await call({ action: 'list' })).status).toBe(200);
    expect((await call({ action: 'list' }, { path: '/api/api/admin/ban' })).status).toBe(404);
  });

  it('rejects missing and wrong tokens with 401', async () => {
    expect((await call({ action: 'list' }, { token: '' })).status).toBe(401);
    expect((await call({ action: 'list' }, { token: 'wrong-token' })).status).toBe(401);
    expect(banlist.getBannedIps).not.toHaveBeenCalled();
  });

  it('lists bans', async () => {
    vi.mocked(banlist.getBannedIps).mockResolvedValue(['203.0.113.7']);
    vi.mocked(banlist.getSlowedIps).mockResolvedValue([]);
    const res = await call({ action: 'list' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
  });

  it('returns 503 when the ban store is unreachable instead of an empty success', async () => {
    vi.mocked(banlist.getBannedIps).mockRejectedValue(new Error('fetch failed'));
    vi.mocked(banlist.getSlowedIps).mockResolvedValue([]);
    const res = await call({ action: 'list' });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ success: false, error: 'Ban store unavailable' });
  });

  it('bans a valid IP', async () => {
    const res = await call({ action: 'ban', ip: '203.0.113.7', reason: 'test', seconds: 60 });
    expect(res.status).toBe(200);
    expect(banlist.banIp).toHaveBeenCalledWith('203.0.113.7', 'test', 60, undefined);
  });

  it('answers 400 with the reason for a missing or malformed IP', async () => {
    for (const ip of [undefined, 'not-an-ip', '999.1.1.1', 'anonymous']) {
      const res = await call({ action: 'ban', ip });
      expect(res.status, String(ip)).toBe(400);
      expect(await res.json()).toEqual({
        success: false,
        error: 'A valid IP address is required for ban action',
      });
    }
    expect(banlist.banIp).not.toHaveBeenCalled();
  });

  it('answers 400 for schema violations without echoing the validator schema', async () => {
    const invalid = [
      { action: 'ban', ip: '203.0.113.7', seconds: 0 },
      { action: 'ban', ip: '203.0.113.7', seconds: -5 },
      { action: 'ban', ip: '203.0.113.7', seconds: 1.5 },
      { action: 'ban', ip: '203.0.113.7', reason: 'x'.repeat(600) },
      { action: 'nope' },
    ];
    for (const body of invalid) {
      const res = await call(body);
      const text = await res.text();
      expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
      expect(text).not.toMatch(/anyOf|maxLength|"schema"/);
    }
    expect(banlist.banIp).not.toHaveBeenCalled();
  });

  it('does not leak the schema to unauthenticated callers either', async () => {
    const res = await call({ action: 'nope' }, { token: '' });
    expect(res.status).toBeLessThan(500);
    expect(await res.text()).not.toMatch(/anyOf|"schema"/);
  });

  it('validates CIDR ranges', async () => {
    expect((await call({ action: 'ban-cidr', cidr: '203.0.113.7' })).status).toBe(400);
    expect((await call({ action: 'ban-cidr', cidr: '10.0.0.0/33' })).status).toBe(400);
    expect(banlistCidr.banCidr).not.toHaveBeenCalled();

    expect((await call({ action: 'ban-cidr', cidr: '203.0.113.0/24' })).status).toBe(200);
    expect(banlistCidr.banCidr).toHaveBeenCalledWith('203.0.113.0/24', undefined);
  });
});
