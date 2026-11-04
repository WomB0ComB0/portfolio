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
 * @file Routes add their cache headers to the response headers instead of replacing them, so the
 * CORS and rate-limit headers set earlier in the request survive. /api/status is driven end to end;
 * a source check keeps every other route under src/app/api from reassigning `set.headers`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

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
// '@/core' initialises Firebase on import.
vi.mock('@/core', () => ({ onRequestError: vi.fn() }));
// The status middleware logs to Better Stack.
vi.mock('@/lib/better-stack', () => ({ logAPIRequest: vi.fn() }));
vi.mock('@/app/api/[[...route]]/status/handlers', () => ({ handleStatusCheck: vi.fn() }));

import { createElysiaApp } from '@/app/api/_elysia/shared/config';
import { CachePresets } from '@/app/api/_elysia/shared/middleware';
import { statusRoute } from '@/app/api/[[...route]]/status';
import { handleStatusCheck } from '@/app/api/[[...route]]/status/handlers';
import { getURL } from '@/utils';

// The shared app's CORS origin, so the test holds whatever NEXT_PUBLIC_SITE_URL is set to.
const ORIGIN = getURL();
const app = createElysiaApp({ prefix: '/api' }).use(statusRoute);
const getStatus = () =>
  app.handle(new Request('http://localhost/api/status', { headers: { origin: ORIGIN } }));

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  Reflect.deleteProperty(process.env, 'VERCEL');
});

describe('GET /api/status headers', () => {
  const expectMergedHeaders = (res: Response) => {
    expect(res.status).toBe(200);
    // The route's own cache preset.
    expect(res.headers.get('cache-control')).toBe(CachePresets.Short.cacheControl);
    expect(res.headers.get('content-type')).toContain('application/json');
    // Set by the shared app before the handler runs.
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  };

  it('keeps the CORS headers next to the cache headers', async () => {
    vi.mocked(handleStatusCheck).mockResolvedValue({
      state: 'operational',
      lastUpdated: '2026-11-04T00:00:00.000Z',
    });
    const res = await getStatus();
    expectMergedHeaders(res);
    expect(await res.json()).toMatchObject({ success: true, data: { state: 'operational' } });
  });

  it('keeps them on the fallback response too', async () => {
    vi.mocked(handleStatusCheck).mockRejectedValue(new Error('fetch failed'));
    const res = await getStatus();
    expectMergedHeaders(res);
    expect(await res.json()).toMatchObject({ success: true, data: { state: 'unknown' } });
  });
});

describe('API route sources', () => {
  // Every other cacheHeaders() route would need its upstream mocked, so guard the pattern instead.
  it('never replace the whole set.headers object', () => {
    const apiDir = path.resolve(__dirname, '../../../src/app/api');
    const offenders = readdirSync(apiDir, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) =>
        /\bset\.headers\s*=(?!=)/.test(readFileSync(path.join(apiDir, file), 'utf8')),
      );
    expect(offenders).toEqual([]);
  });
});
