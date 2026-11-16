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
 * @file Kept bodies and onError, against a fake upstream (no network):
 * - a non-2xx error keeps at most 2,000 characters of the body in its responseData, as the parse
 *   failure does: a 3,145,752-character JSON error body was kept whole;
 * - onError runs exactly once for a failed request, whatever failed: every non-2xx response
 *   called it twice (and once more for each retried attempt), a schema mismatch twice, and a body
 *   that could not be serialised never;
 * - no request header (a made-up X-Goog-Api-Key and Authorization) reaches the error, its message,
 *   String(error), its JSON or its responseData.
 */

import { FetchHttpClient } from '@effect/platform';
import { Effect, Either, Schema } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The fetcher only reads env for the Vercel bypass header; skip t3-env validation in tests.
vi.mock('@/env', () => ({ env: {}, default: {} }));

import {
  FetcherError,
  type FetcherOptions,
  get,
  post,
  ValidationError,
} from '@/lib/http-clients/effect-fetcher';

const URL_UNDER_TEST = 'https://api.example.com/items';
/** Made-up credentials: the tests look for them in everything the error reaches. */
const KEY = 'made-up-goog-api-key-0123456789';
const TOKEN = 'made-up-bearer-token-9876543210';
const HEADERS = { 'X-Goog-Api-Key': KEY, Authorization: `Bearer ${TOKEN}` };
/** The most of a body an error keeps. */
const KEPT_CHARS = 2_000;
/** The size of the error body in the measured case (3 MB). */
const HUGE_CHARS = 3_145_752;

/** Answers every request with a fresh `body`, so retried attempts can read it too. */
function stubUpstream(status: number, body: string, contentType = 'application/json') {
  const fetchMock = vi.fn(
    async () => new Response(body, { status, headers: { 'Content-Type': contentType } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Runs a GET with HEADERS, counting onError calls; resolves to the failure and the calls. */
async function failingGet(options: FetcherOptions = {}) {
  const seen: unknown[] = [];
  const result = await Effect.runPromise(
    Effect.either(
      get(URL_UNDER_TEST, {
        retries: 0,
        retryDelay: 1,
        headers: HEADERS,
        onError: (error) => seen.push(error),
        ...options,
      }).pipe(Effect.provide(FetchHttpClient.layer)),
    ),
  );
  if (Either.isRight(result)) throw new Error('expected the request to fail');
  return { error: result.left, seen };
}

/** A JSON error body of exactly `size` characters. */
function jsonBodyOf(size: number): string {
  const shell = JSON.stringify({ error: { code: 404, message: '' } });
  return JSON.stringify({ error: { code: 404, message: 'x'.repeat(size - shell.length) } });
}

/** Whether `secret` is in any string reachable from `value` by property access. */
function reaches(value: unknown, secret: string, seen = new Set<unknown>(), depth = 0): boolean {
  if (typeof value === 'string') return value.includes(secret);
  if (value === null || typeof value !== 'object' || seen.has(value) || depth > 12) return false;
  seen.add(value);
  return Reflect.ownKeys(value).some((key) => {
    let child: unknown;
    try {
      child = (value as Record<PropertyKey, unknown>)[key];
    } catch {
      return false;
    }
    return reaches(child, secret, seen, depth + 1);
  });
}

/** Every way the failure is read: message, String(), JSON, responseData, and by property. */
function expectNoCredentials(error: unknown): void {
  const failure = error as FetcherError;
  for (const secret of [KEY, TOKEN]) {
    expect.soft(failure.message).not.toContain(secret);
    expect.soft(String(failure)).not.toContain(secret);
    expect.soft(JSON.stringify(failure) ?? '').not.toContain(secret);
    expect.soft(JSON.stringify(failure.responseData) ?? '').not.toContain(secret);
    expect.soft(reaches(failure, secret)).toBe(false);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('effect-fetcher: what a non-2xx error keeps of the body', () => {
  it('keeps the first 2,000 characters of a multi-megabyte JSON body', async () => {
    const body = jsonBodyOf(HUGE_CHARS);
    expect(body.length).toBe(HUGE_CHARS);
    stubUpstream(404, body);

    const { error } = await failingGet();

    expect(error).toBeInstanceOf(FetcherError);
    expect((error as FetcherError).responseData).toEqual({
      responseText: body.slice(0, KEPT_CHARS),
    });
    expect(JSON.stringify(error).length).toBeLessThan(3 * KEPT_CHARS);
    expectNoCredentials(error);
  });

  it('keeps a JSON body of 2,000 characters or fewer as parsed JSON', async () => {
    const exact = jsonBodyOf(KEPT_CHARS);
    stubUpstream(404, exact);
    expect((await failingGet()).error).toMatchObject({ responseData: JSON.parse(exact) });

    stubUpstream(403, JSON.stringify({ error: { code: 403, message: 'Forbidden' } }));
    expect((await failingGet()).error).toMatchObject({
      status: 403,
      responseData: { error: { code: 403, message: 'Forbidden' } },
    });
  });

  it('keeps the start of a body that is not JSON as text, and nothing of an empty one', async () => {
    const page = `<html><body>${'Internal error. '.repeat(500)}</body></html>`;
    stubUpstream(500, page, 'text/html');
    expect((await failingGet()).error).toMatchObject({
      responseData: { responseText: page.slice(0, KEPT_CHARS) },
    });

    stubUpstream(404, '');
    const { error } = await failingGet();
    expect((error as FetcherError).responseData).toBeUndefined();
    expect((error as FetcherError).message).toBe('HTTP 404: ');
  });
});

describe('effect-fetcher: onError runs exactly once for a failed request', () => {
  it.each([400, 401, 403, 404, 429, 500, 502])('once for a %i', async (status) => {
    stubUpstream(status, JSON.stringify({ error: { code: status, message: 'upstream said no' } }));

    const { error, seen } = await failingGet();

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(error);
    expect((error as FetcherError).status).toBe(status);
    expectNoCredentials(error);
  });

  it('once for a 2xx body that is not JSON', async () => {
    stubUpstream(200, '<!DOCTYPE html><html><body>Moved</body></html>', 'text/html');

    const { error, seen } = await failingGet();

    expect(seen).toEqual([error]);
    expect((error as FetcherError).message).toContain('Failed to parse JSON response');
    expectNoCredentials(error);
  });

  it('once for a body the schema rejects', async () => {
    stubUpstream(200, JSON.stringify({ id: 'not a number' }));

    const { error, seen } = await failingGet({
      schema: Schema.Struct({ id: Schema.Number }) as FetcherOptions['schema'],
    });

    expect(error).toBeInstanceOf(ValidationError);
    expect(seen).toEqual([error]);
  });

  it('once after the retries run out, not once per attempt', async () => {
    const fetchMock = stubUpstream(500, JSON.stringify({ error: 'down' }));

    const { error, seen } = await failingGet({ retries: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(seen).toEqual([error]);
    expect((error as FetcherError).attempt).toBe(3);
  });

  it('once when the upstream cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    const { error, seen } = await failingGet();

    expect(seen).toEqual([error]);
    expectNoCredentials(error);
  });

  it('once when the request body cannot be serialised', async () => {
    const fetchMock = stubUpstream(200, '{}');
    const seen: unknown[] = [];

    const result = await Effect.runPromise(
      Effect.either(
        post(URL_UNDER_TEST, { big: 1n } as unknown as Record<string, unknown>, {
          headers: HEADERS,
          onError: (error) => seen.push(error),
        }).pipe(Effect.provide(FetchHttpClient.layer)),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(FetcherError);
    expect((seen[0] as FetcherError).message).toMatch(/^Failed to serialize request body/);
    expectNoCredentials(seen[0]);
  });
});
