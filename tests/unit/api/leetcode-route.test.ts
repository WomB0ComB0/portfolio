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
 * @file GET /api/v1/leetcode works like its sibling routes: a CDN-cacheable 200 that keeps the
 * stats shape, and a 500 that the shared error handler logs and reports to Sentry.
 */

import { Elysia } from 'elysia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = vi.hoisted(() => ({ getLeetCodeStats: vi.fn() }));
const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock('@/app/api/v1/[[...route]]/leetcode/handlers', () => handlers);
vi.mock('@sentry/nextjs', () => sentry);
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import { CachePresets } from '@/app/api/_elysia/shared/middleware';
import { leetCodeStatsRoute } from '@/app/api/v1/[[...route]]/leetcode';
import { BaseError } from '@/classes/error';
import { resetApiReportCooldowns } from '@/lib/observability/report';
import { logger } from '@/utils';

const stats = {
  totalSolved: 692,
  easySolved: 215,
  mediumSolved: 379,
  hardSolved: 98,
  acceptanceRate: 73.46,
  ranking: 103_562,
};

const app = new Elysia().use(leetCodeStatsRoute);
const getLeetCode = () => app.handle(new Request('http://localhost/leetcode'));

beforeEach(() => {
  resetApiReportCooldowns();
  sentry.captureException.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /leetcode', () => {
  it('answers the stats with CDN cache headers', async () => {
    handlers.getLeetCodeStats.mockResolvedValueOnce(stats);

    const res = await getLeetCode();

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(CachePresets.Medium.cacheControl);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual(stats);
  });

  it('answers 500 with a fixed message and reports the failure once', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const error = new BaseError(new Error('LeetCode GraphQL returned 503'), 'leetcode:fetch');
    handlers.getLeetCodeStats.mockRejectedValueOnce(error);

    const res = await getLeetCode();

    expect(res.status).toBe(500);
    expect(res.headers.get('cache-control')).toBeNull();
    expect(await res.json()).toEqual({ error: 'Failed to fetch LeetCode stats' });
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(error, {
      level: 'error',
      tags: { 'api.context': 'fetch LeetCode stats' },
      fingerprint: ['api', 'fetch LeetCode stats', '{{ default }}'],
    });
  });
});
