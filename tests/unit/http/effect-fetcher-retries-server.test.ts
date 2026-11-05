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
 * @file The real effect-fetcher's retry budget on the server (node environment, no `window`).
 * The API integrations call upstreams from one place, so a 429 may still be retried there, but
 * only within the caller's `retries` budget. The browser rules are in effect-fetcher-retries.test.ts.
 */

import { FetchHttpClient } from '@effect/platform';
import { Effect, Either } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The fetcher only reads env for the Vercel bypass header; skip t3-env validation in tests.
vi.mock('@/env', () => ({ env: {}, default: {} }));

import { FetcherError, get } from '@/lib/http-clients/effect-fetcher';

const URL_UNDER_TEST = 'https://api.example.com/stats';

/** Answers every request with `status` and returns the mock so the attempts can be counted. */
const stubStatus = (status: number) => {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ error: 'upstream said no' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const runGet = (retries: number) =>
  Effect.runPromise(
    Effect.either(
      get(URL_UNDER_TEST, { retries, retryDelay: 1 }).pipe(Effect.provide(FetchHttpClient.layer)),
    ),
  );

const expectStatus = (result: Either.Either<unknown, unknown>, status: number) => {
  if (Either.isRight(result)) throw new Error('expected the request to fail');
  expect(result.left).toBeInstanceOf(FetcherError);
  expect((result.left as FetcherError).status).toBe(status);
};

describe('effect-fetcher retries on the server', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs without a browser window', () => {
    expect(globalThis.window).toBeUndefined();
  });

  it('makes exactly one request for a 429 when retries is 0', async () => {
    const fetchMock = stubStatus(429);
    expectStatus(await runGet(0), 429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 429 within the budget and no further', async () => {
    const fetchMock = stubStatus(429);
    expectStatus(await runGet(2), 429);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry other client errors', async () => {
    const fetchMock = stubStatus(404);
    expectStatus(await runGet(2), 404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 5xx up to the budget', async () => {
    const fetchMock = stubStatus(502);
    expectStatus(await runGet(1), 502);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
