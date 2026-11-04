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
 * @file API errors in Sentry: BaseError issues say what failed, a route's handled failure is one
 * throttled issue per context, and a 500 from the API's root error handler is reported exactly
 * once, never on top of what the route already reported.
 */

import { Elysia } from 'elysia';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // Skips the OTLP exporter the shared constants create off Vercel.
  process.env.VERCEL = '1';
});

const sentry = vi.hoisted(() => {
  const scope = { setTransactionName: vi.fn() };
  const isolationScope = { setTransactionName: vi.fn() };
  return {
    scope,
    isolationScope,
    captureException: vi.fn(),
    withScope: vi.fn((callback: (s: typeof scope) => unknown) => callback(scope)),
    getIsolationScope: vi.fn(() => isolationScope),
  };
});

vi.mock('@sentry/nextjs', () => sentry);
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import { createElysiaApp } from '@/app/api/_elysia/shared/config';
import {
  createErrorHandler,
  createErrorHandlerWithDefault,
} from '@/app/api/_elysia/shared/middleware';
import { BaseError } from '@/classes/error';
import {
  API_REPORT_COOLDOWN_MS,
  isServerSideApiError,
  reportError,
  resetApiReportCooldowns,
} from '@/lib/observability/report';

beforeEach(() => {
  resetApiReportCooldowns();
  sentry.captureException.mockClear();
  sentry.scope.setTransactionName.mockClear();
  sentry.isolationScope.setTransactionName.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  Reflect.deleteProperty(process.env, 'VERCEL');
});

describe('BaseError message', () => {
  it('names the command and the cause, so the issue title says what failed', () => {
    const error = new BaseError(new Error('fetch failed'), 'fetching blogs');
    expect(error.message).toBe('fetching blogs: fetch failed');
    // Sentry titles an issue `${type}: ${value}`.
    expect(`${error.name}: ${error.message}`).toBe('BaseError: fetching blogs: fetch failed');
  });

  it('falls back to the command when the cause has no message', () => {
    expect(new BaseError(new Error(''), 'banlist:ban').message).toBe('banlist:ban');
  });

  it('keeps the plain cause message in toJSON for API responses', () => {
    expect(new BaseError(new Error('fetch failed'), 'fetching blogs').toJSON().message).toBe(
      'fetch failed',
    );
  });
});

describe('createErrorHandler', () => {
  it('reports once with the context as tag and fingerprint, and keeps the response body', () => {
    const handle = createErrorHandler({ context: 'fetch blogs' });
    const result = handle(new Error('upstream 502'));

    expect(result).toEqual({ error: 'Failed to fetch blogs', status: 500 });
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    const [reported, context] = sentry.captureException.mock.calls[0] ?? [];
    expect(reported).toBeInstanceOf(BaseError);
    expect((reported as BaseError).message).toBe('fetch blogs: upstream 502');
    expect(context).toEqual({
      level: 'error',
      tags: { 'api.context': 'fetch blogs' },
      fingerprint: ['api', 'fetch blogs', '{{ default }}'],
    });
  });

  it('reports a context at most once per cooldown window', () => {
    vi.useFakeTimers({ now: 0 });
    const handle = createErrorHandler({ context: 'fetch system status' });
    const other = createErrorHandler({ context: 'fetch top tracks' });

    handle(new Error('timeout'));
    handle(new Error('timeout'));
    other(new Error('timeout'));
    expect(sentry.captureException).toHaveBeenCalledTimes(2);

    vi.setSystemTime(API_REPORT_COOLDOWN_MS - 1);
    handle(new Error('timeout'));
    expect(sentry.captureException).toHaveBeenCalledTimes(2);

    vi.setSystemTime(API_REPORT_COOLDOWN_MS);
    handle(new Error('timeout'));
    expect(sentry.captureException).toHaveBeenCalledTimes(3);
  });

  it('uses the configured level for routes that serve a fallback', () => {
    createErrorHandler({ context: 'fetch system status', reportLevel: 'warning' })(
      new Error('down'),
    );
    expect(sentry.captureException.mock.calls[0]?.[1]).toMatchObject({ level: 'warning' });
  });
});

describe('createErrorHandlerWithDefault', () => {
  it('reports at warning level, since the route still answers with default data', () => {
    const handle = createErrorHandlerWithDefault({ context: 'fetch analytics' }, { views: 0 });
    expect(handle(new Error('quota exceeded'))).toMatchObject({
      views: 0,
      error: 'quota exceeded',
    });
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException.mock.calls[0]?.[1]).toMatchObject({
      level: 'warning',
      tags: { 'api.context': 'fetch analytics' },
    });
  });
});

describe('reportError', () => {
  it('sends an error once, and skips errors that wrap one already sent', () => {
    const original = new Error('redis down');
    expect(reportError(original)).toBe(true);
    expect(reportError(original)).toBe(false);
    expect(reportError(new Error('wrapped', { cause: original }))).toBe(false);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
  });
});

describe('isServerSideApiError', () => {
  it("leaves out errors that are the client's doing", () => {
    expect(isServerSideApiError('NOT_FOUND', new Error('NOT_FOUND'))).toBe(false);
    expect(isServerSideApiError('PARSE', new Error('Unexpected token'))).toBe(false);
    expect(isServerSideApiError('VALIDATION', { type: 'body' })).toBe(false);
    expect(isServerSideApiError(404, {})).toBe(false);
    expect(isServerSideApiError(429, {})).toBe(false);
  });

  it('keeps unexpected errors and handlers breaking their own response schema', () => {
    expect(isServerSideApiError('UNKNOWN', new Error('boom'))).toBe(true);
    expect(isServerSideApiError('INTERNAL_SERVER_ERROR', new Error('boom'))).toBe(true);
    expect(isServerSideApiError('VALIDATION', { type: 'response' })).toBe(true);
    expect(isServerSideApiError(503, {})).toBe(true);
    expect(isServerSideApiError(undefined, new Error('boom'))).toBe(true);
  });
});

describe('the API root error handler', () => {
  const routeHandled = createErrorHandler({ context: 'fetch places' });

  const app = createElysiaApp({ prefix: '/api' }).use(
    new Elysia()
      .get('/boom', () => {
        throw new Error('unexpected');
      })
      .get('/handled-then-thrown', () => {
        const error = new Error('upstream failed');
        routeHandled(error);
        throw error;
      })
      .post('/echo', ({ body }) => body),
  );
  const call = (path: string, init?: RequestInit) =>
    app.handle(new Request(`http://localhost${path}`, init));

  it('reports a 500 once, named after the real request path', async () => {
    const res = await call('/api/boom');
    expect(res.status).toBe(500);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    const [reported, context] = sentry.captureException.mock.calls[0] ?? [];
    expect((reported as Error).message).toBe('unexpected');
    expect(context).toEqual({ tags: { 'api.code': 'UNKNOWN' } });
    expect(sentry.scope.setTransactionName).toHaveBeenCalledWith('GET /api/boom');
  });

  it('names every API request after its path (for events from route handlers)', async () => {
    await call('/api/boom');
    expect(sentry.isolationScope.setTransactionName).toHaveBeenCalledWith('GET /api/boom');
  });

  it('does not report again what the route already reported', async () => {
    const res = await call('/api/handled-then-thrown');
    expect(res.status).toBe(500);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException.mock.calls[0]?.[1]).toMatchObject({
      tags: { 'api.context': 'fetch places' },
    });
  });

  it('does not report 404s', async () => {
    const res = await call('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('does not report malformed request bodies', async () => {
    const res = await call('/api/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(res.status).toBe(400);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});
