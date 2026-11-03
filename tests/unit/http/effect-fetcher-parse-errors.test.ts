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
 * @file Exercises the real effect-fetcher against stubbed `fetch` responses whose body is not
 * JSON. The detailed message (status, content type, body snippet) used to be swallowed by a
 * catch-all and replaced with "Failed to parse response: Decode error", which hid that
 * gql.hashnode.com had started returning an HTML page.
 */

import { FetchHttpClient } from '@effect/platform';
import { Effect, Either } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The fetcher only reads env for the Vercel bypass header; skip t3-env validation in tests.
vi.mock('@/env', () => ({ env: {}, default: {} }));

import { FetcherError, post } from '@/lib/http-clients/effect-fetcher';

const URL_UNDER_TEST = 'https://api.example.com/graphql';

const runPost = (response: Response) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response),
  );
  return Effect.runPromise(
    Effect.either(
      post(URL_UNDER_TEST, { query: '{ ok }' }, { retries: 0 }).pipe(
        Effect.provide(FetchHttpClient.layer),
      ),
    ),
  );
};

const expectFetcherError = (result: Either.Either<unknown, unknown>): FetcherError => {
  if (Either.isRight(result)) throw new Error('expected the request to fail');
  expect(result.left).toBeInstanceOf(FetcherError);
  return result.left as FetcherError;
};

describe('effect-fetcher: response bodies that are not JSON', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports the status, content type and a body snippet for an HTML page served with 200', async () => {
    const html = `<!DOCTYPE html><html><head><title>Moved</title></head><body>${'x'.repeat(5_000)}</body></html>`;
    const error = expectFetcherError(
      await runPost(
        new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
      ),
    );

    expect(error.message).toContain('Failed to parse JSON response');
    expect(error.message).toContain('Status: 200');
    expect(error.message).toContain('Content-Type: text/html; charset=utf-8');
    expect(error.message).toContain('Body: <!DOCTYPE html><html><head><title>Moved</title>');
    expect(error.message.endsWith('...')).toBe(true);
    expect(error.status).toBe(200);
    expect(error.url).toBe(URL_UNDER_TEST);

    const { responseText } = error.responseData as { responseText: string };
    expect(responseText.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(responseText.length).toBeLessThanOrEqual(2_000);
  });

  it('falls back to the generic message only when the body cannot be read at all', async () => {
    const broken = new ReadableStream({
      start(controller) {
        controller.error(new Error('connection reset'));
      },
    });
    const error = expectFetcherError(await runPost(new Response(broken, { status: 200 })));

    expect(error.message).toMatch(/^Failed to parse response: /);
    expect(error.message).not.toContain('Failed to parse JSON response');
  });

  it('still returns parsed JSON for a JSON body', async () => {
    const result = await runPost(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(result).toEqual(Either.right({ ok: true }));
  });
});
