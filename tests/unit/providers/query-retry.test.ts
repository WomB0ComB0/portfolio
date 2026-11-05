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
 * @file TanStack Query is the only retry layer for the site's queries. A failing query gets at
 * most one retry in the browser and none on the server, and client errors (4xx, 429 included,
 * and schema mismatches) are never retried. The cards used to stack the fetcher's `retries: 2`
 * on TanStack's default of 3 retries, so a failing card made 12 requests over about 20 s.
 */

import { FetchHttpClient } from '@effect/platform';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { Effect, Runtime } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The fetcher only reads env for the Vercel bypass header; skip t3-env validation in tests.
vi.mock('@/env', () => ({ env: {}, default: {} }));

import { FetcherError, get, ValidationError } from '@/lib/http-clients/effect-fetcher';
import {
  createQueryClient,
  makeQueryClient,
  shouldRetryQuery,
} from '@/providers/server/query-client';

const URL_UNDER_TEST = 'https://api.example.com/stats';

const httpError = (status: number) =>
  new FetcherError(`HTTP ${status}`, URL_UNDER_TEST, status, undefined, 1);

/** What a queryFn that awaits `Effect.runPromise` actually rejects with: a FiberFailure. */
const rejectionOf = (error: unknown): Promise<unknown> =>
  Effect.runPromise(Effect.fail(error)).then(
    () => {
      throw new Error('expected the effect to fail');
    },
    (rejection: unknown) => rejection,
  );

describe('shouldRetryQuery', () => {
  it.each([
    ['a 5xx response', httpError(503)],
    ['a timeout', new FetcherError('Request timed out', URL_UNDER_TEST, undefined, undefined, 1)],
    ['a network failure', new TypeError('Failed to fetch')],
    ['a body that is not JSON', httpError(200)],
  ])('retries %s once, then stops', (_label, error) => {
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(false);
    expect(shouldRetryQuery(2, error)).toBe(false);
  });

  it.each([400, 401, 403, 404, 422, 429])('never retries a %i', (status) => {
    expect(shouldRetryQuery(0, httpError(status))).toBe(false);
  });

  it('never retries a response that failed schema validation', () => {
    const error = new ValidationError('Response validation failed', URL_UNDER_TEST, 'bad', {});
    expect(shouldRetryQuery(0, error)).toBe(false);
  });

  it('reads the status through the FiberFailure that Effect.runPromise rejects with', async () => {
    const rateLimited = await rejectionOf(httpError(429));
    const notFound = await rejectionOf(httpError(404));
    const serverError = await rejectionOf(httpError(500));

    expect(Runtime.isFiberFailure(rateLimited)).toBe(true);
    expect(shouldRetryQuery(0, rateLimited)).toBe(false);
    expect(shouldRetryQuery(0, notFound)).toBe(false);
    expect(shouldRetryQuery(0, serverError)).toBe(true);
    expect(shouldRetryQuery(1, serverError)).toBe(false);
  });

  it.each([
    ['a string', 'boom'],
    ['null', null],
    ['undefined', undefined],
    ['an object with a non-numeric status', { status: '404' }],
  ])('treats %s like a transient failure: one retry', (_label, error) => {
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(false);
  });

  it('never retries on the server', () => {
    expect(shouldRetryQuery(0, httpError(503), true)).toBe(false);
    expect(shouldRetryQuery(0, new TypeError('fetch failed'), true)).toBe(false);
  });
});

describe('createQueryClient retry default', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses shouldRetryQuery for every query', () => {
    const queryClient = createQueryClient()();
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(shouldRetryQuery);
  });

  it('builds a new client with its own caches on every makeQueryClient() call', () => {
    const first = makeQueryClient();
    const second = makeQueryClient();

    expect(first).toBeInstanceOf(QueryClient);
    expect(second).not.toBe(first);
    expect(second.getQueryCache()).not.toBe(first.getQueryCache());
    expect(second.getMutationCache()).not.toBe(first.getMutationCache());
    expect(first.getDefaultOptions().queries?.retry).toBe(shouldRetryQuery);
    expect(second.getDefaultOptions().queries?.retry).toBe(shouldRetryQuery);

    // A query one client caches is invisible to the other (one server render never sees another's).
    first.setQueryData(['shared-key'], 'from the first request');
    expect(second.getQueryData(['shared-key'])).toBeUndefined();
  });

  /**
   * Runs a card-style query (fetcher `retries: 0`) against `status` the way useQuery does, through
   * a QueryObserver, until it settles as an error. Returns how many requests reached fetch.
   */
  const requestsForFailingCard = async (status: number) => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'upstream said no' }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const observer = new QueryObserver(createQueryClient()(), {
      queryKey: ['card', status],
      queryFn: () =>
        Effect.runPromise(
          get(URL_UNDER_TEST, { retries: 0 }).pipe(Effect.provide(FetchHttpClient.layer)),
        ),
      // Only the delay is shortened; whether to retry comes from the client's default.
      retryDelay: 1,
    });
    await new Promise<void>((resolve) => {
      const unsubscribe = observer.subscribe((result) => {
        if (result.status !== 'error') return;
        unsubscribe();
        resolve();
      });
    });
    return fetchMock.mock.calls.length;
  };

  it('makes at most two requests for a card whose upstream keeps failing', async () => {
    expect(await requestsForFailingCard(500)).toBe(2);
  });

  it.each([404, 429])('makes a single request for a card answered with %i', async (status) => {
    expect(await requestsForFailingCard(status)).toBe(1);
  });
});
