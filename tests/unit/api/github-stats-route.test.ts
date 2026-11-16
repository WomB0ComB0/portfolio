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
 * @file GET /api/v1/github-stats when GitHub fails with nothing cached: 500 with one fixed
 * message, never the upstream's own text (GitHub's rate-limit message names the caller's IP, and
 * a failure can name the fetched address). The full error still goes to the error tracker.
 */

import { Elysia } from 'elysia';
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getGitHubStats: vi.fn(),
  reportApiFailure: vi.fn(() => true),
}));

vi.mock('@/app/api/v1/[[...route]]/github-stats/handlers', () => ({
  getGitHubStats: h.getGitHubStats,
}));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: h.reportApiFailure }));
vi.mock('@/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils')>()),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { githubStatsRoute } from '@/app/api/v1/[[...route]]/github-stats';

const get = () =>
  new Elysia({ prefix: '/api/v1' })
    .use(githubStatsRoute)
    .handle(new Request('http://localhost/api/v1/github-stats'));

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /github-stats with GitHub down and nothing cached', () => {
  it.each([
    ['a rate limit', 'HTTP 403: {"message":"API rate limit exceeded for 203.0.113.7."}'],
    ['a too-long list', 'More than 1000 repositories in one list'],
    [
      'a fetched address',
      'Transport error (GET https://api.github.com/users/someone/repos?page=2)',
    ],
  ])('answers 500 with the fixed message, not %s', async (_case, upstream) => {
    h.getGitHubStats.mockRejectedValue(new Error(upstream));

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to fetch GitHub stats' });
    expect(JSON.stringify(body)).not.toContain(upstream);
    // The tracker still gets the whole failure.
    expect(h.reportApiFailure).toHaveBeenCalledTimes(1);
  });
});
