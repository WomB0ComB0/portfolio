// @vitest-environment node
/**
 * Copyright 2026 Mike Odnis
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
 * @file /api/og draws a Satori card for every distinct title and description, so it runs the API
 * guard first (the per-IP sliding window /api uses, src/lib/security/api-guard.ts). Over the
 * limit it answers 429 with Retry-After, uncached; a banned client gets the API's 403. It fails
 * open: with Redis unset, failing, or the guard itself throwing, the card is still drawn.
 */

import { imageInfo } from '@tests/fixtures/image-size';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

// t3-env validates on import. Every value reads as unset, Upstash's URL and token included.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

const guard = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock('@/lib/security/api-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/security/api-guard')>()),
  apiGuard: guard,
}));

import { GET } from '@/app/api/og/route';
import { createApiGuard, type GuardBackend } from '@/lib/security/api-guard';

/** Rendering a card takes a few hundred milliseconds; the first also loads the fonts and wasm. */
const RENDER_TIMEOUT = 30_000;
const NOW = Date.UTC(2026, 10, 10, 12);

/** A request for a page card from a client on the open internet. */
const request = (): Request =>
  new Request('https://mikeodnis.dev/api/og?title=Projects&description=Things', {
    headers: { 'x-forwarded-for': '203.0.113.7' },
  });

/** Whether `response` is the 1200x630 card. */
async function isCard(response: Response): Promise<boolean> {
  if (response.status !== 200 || response.headers.get('content-type') !== 'image/png') return false;
  const { width, height } = imageInfo(Buffer.from(await response.arrayBuffer()));
  return width === 1200 && height === 630;
}

/** A Redis behind the guard whose every call fails. */
const down = (): Promise<never> => Promise.reject(new Error('Redis is down'));
const failingLimiter = { limit: down };
const failingRedis: GuardBackend = {
  bans: { lookup: down },
  limiters: {
    api: failingLimiter,
    apiv1: failingLimiter,
    auth: failingLimiter,
    guestbook: failingLimiter,
    slow: failingLimiter,
  },
};

afterEach(() => {
  guard.check.mockReset();
  vi.useRealTimers();
});

describe('the page card route (/api/og) under the API guard', () => {
  it('answers 429 with Retry-After, uncached, to a client over its limit, and draws nothing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    guard.check.mockResolvedValue({ kind: 'limit', limit: 30, reset: NOW + 12_500 });
    const sent = request();

    const response = await GET(sent);

    expect(guard.check).toHaveBeenCalledWith(sent);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('13');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).not.toBe('image/png');
  });

  it('answers 403, uncached, to a banned client', async () => {
    guard.check.mockResolvedValue({ kind: 'ban' });

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it(
    'draws the card when the guard allows the request',
    async () => {
      guard.check.mockResolvedValue({ kind: 'allow' });

      expect(await isCard(await GET(request()))).toBe(true);
    },
    RENDER_TIMEOUT,
  );

  it(
    'fails open: draws the card when Upstash is not configured',
    async () => {
      const actual = await vi.importActual<typeof import('@/lib/security/api-guard')>(
        '@/lib/security/api-guard',
      );
      guard.check.mockImplementation(actual.apiGuard.check);

      expect(await isCard(await GET(request()))).toBe(true);
    },
    RENDER_TIMEOUT,
  );

  it(
    'fails open: draws the card when every Redis call fails',
    async () => {
      const real = createApiGuard({ getBackend: () => failingRedis, report: () => undefined });
      guard.check.mockImplementation(real.check);

      expect(await isCard(await GET(request()))).toBe(true);
    },
    RENDER_TIMEOUT,
  );

  it(
    'fails open: draws the card when the guard itself throws',
    async () => {
      guard.check.mockRejectedValue(new Error('the guard broke'));

      expect(await isCard(await GET(request()))).toBe(true);
    },
    RENDER_TIMEOUT,
  );
});
