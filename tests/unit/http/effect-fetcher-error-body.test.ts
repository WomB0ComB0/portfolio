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
 * @file The message of a non-2xx error quotes at most 200 characters of the upstream body, as the
 * parse failure's message does. Before this, the whole body went into the message, so a
 * multi-megabyte error page became a multi-megabyte message, logged and sent to Sentry. The
 * message is built from the status and the body only: no request header can reach it.
 */

import { FetchHttpClient } from '@effect/platform';
import { Effect, Either } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The fetcher only reads env for the Vercel bypass header; skip t3-env validation in tests.
vi.mock('@/env', () => ({ env: {}, default: {} }));

import { FetcherError, get } from '@/lib/http-clients/effect-fetcher';

const URL_UNDER_TEST = 'https://api.example.com/items';
/** Made-up credentials: the tests look for them in the message. */
const KEY = 'made-up-api-key-0123456789';
const TOKEN = 'made-up-token-9876543210';

const failWith = async (status: number, body: string): Promise<FetcherError> => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status, headers: { 'Content-Type': 'text/html' } })),
  );
  const result = await Effect.runPromise(
    Effect.either(
      get(URL_UNDER_TEST, {
        retries: 0,
        headers: { 'X-Goog-Api-Key': KEY, Authorization: `Bearer ${TOKEN}` },
      }).pipe(Effect.provide(FetchHttpClient.layer)),
    ),
  );
  if (Either.isRight(result)) throw new Error('expected the request to fail');
  expect(result.left).toBeInstanceOf(FetcherError);
  return result.left as FetcherError;
};

describe('effect-fetcher: the message of a non-2xx error', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('quotes the first 200 characters of a long body, then an ellipsis', async () => {
    const body = `<html><body>${'Internal error. '.repeat(100_000)}</body></html>`;
    const error = await failWith(500, body);

    expect(error.message).toBe(`HTTP 500: ${body.slice(0, 200)}...`);
    expect(error.message.length).toBe('HTTP 500: '.length + 203);
    expect(error.status).toBe(500);
  });

  it('quotes a body of 200 characters or fewer whole', async () => {
    const exact = 'x'.repeat(200);
    expect((await failWith(503, '<html>Internal error</html>')).message).toBe(
      'HTTP 503: <html>Internal error</html>',
    );
    expect((await failWith(404, exact)).message).toBe(`HTTP 404: ${exact}`);
  });

  it('carries no request header, whatever the status', async () => {
    for (const status of [400, 401, 403, 404, 500, 502]) {
      const { message } = await failWith(status, 'Request failed upstream');
      expect(message).toBe(`HTTP ${status}: Request failed upstream`);
      expect(message).not.toContain(KEY);
      expect(message).not.toContain(TOKEN);
    }
  });
});
