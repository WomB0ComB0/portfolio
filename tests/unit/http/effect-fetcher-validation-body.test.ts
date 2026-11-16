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
 * @file Against a fake upstream (no network): a 2xx body its schema
 * rejects is kept in the ValidationError by the same 2,000-character rule as a non-2xx body. It
 * was kept whole: a 3,145,752-character body made a 3,145,752-character responseData. onError
 * still runs once, no request header reaches the error, and an accepted body is returned as before.
 */

import { FetchHttpClient } from '@effect/platform';
import { Effect, Either, Schema } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The fetcher only reads env for the Vercel bypass header; skip t3-env validation in tests.
vi.mock('@/env', () => ({ env: {}, default: {} }));

import { type FetcherOptions, get, ValidationError } from '@/lib/http-clients/effect-fetcher';

const URL_UNDER_TEST = 'https://api.example.com/items';
/** Made-up credentials: the tests look for them in everything the error reaches. */
const KEY = 'made-up-goog-api-key-0123456789';
const TOKEN = 'made-up-bearer-token-9876543210';
const HEADERS = { 'X-Goog-Api-Key': KEY, Authorization: `Bearer ${TOKEN}` };
/** The most of a body an error keeps. */
const KEPT_CHARS = 2_000;
/** The size of the body in the measured case (3 MB). */
const HUGE_CHARS = 3_145_752;
/** The schema under test: every body below lacks a numeric id. */
const ID_SCHEMA = Schema.Struct({ id: Schema.Number }) as FetcherOptions['schema'];

/** Answers every request with a fresh 200 JSON `body`. */
function stubUpstream(body: string) {
  const fetchMock = vi.fn(
    async () =>
      new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Runs a GET with HEADERS and `schema`, counting onError calls. */
async function run(schema: FetcherOptions['schema'] = ID_SCHEMA) {
  const seen: unknown[] = [];
  const result = await Effect.runPromise(
    Effect.either(
      get(URL_UNDER_TEST, {
        retries: 0,
        headers: HEADERS,
        schema,
        onError: (error) => seen.push(error),
      }).pipe(Effect.provide(FetchHttpClient.layer)),
    ),
  );
  return { result, seen };
}

/** The failure of a run that must fail with a ValidationError, and its onError calls. */
async function rejected(body: string) {
  stubUpstream(body);
  const { result, seen } = await run();
  if (Either.isRight(result)) throw new Error('expected the schema to reject the body');
  expect(result.left).toBeInstanceOf(ValidationError);
  return { error: result.left as ValidationError, seen };
}

/** A JSON body of exactly `size` characters, with no id. */
function jsonBodyOf(size: number): string {
  const shell = JSON.stringify({ error: { code: 200, message: '' } });
  return JSON.stringify({ error: { code: 200, message: 'x'.repeat(size - shell.length) } });
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('effect-fetcher: what a ValidationError keeps of a 2xx body its schema rejects', () => {
  it('keeps the first 2,000 characters of a multi-megabyte body', async () => {
    const body = jsonBodyOf(HUGE_CHARS);
    expect(body.length).toBe(HUGE_CHARS);

    const { error, seen } = await rejected(body);

    expect(error.responseData).toEqual({ responseText: body.slice(0, KEPT_CHARS) });
    expect(JSON.stringify(error).length).toBeLessThan(3 * KEPT_CHARS);
    expect(error.message).toBe('Response validation failed');
    expect(error.problems).toContain('id');
    expect(seen).toEqual([error]);
  });

  it('keeps a body of 2,000 characters or fewer as parsed JSON, one more as text', async () => {
    const exact = jsonBodyOf(KEPT_CHARS);
    expect((await rejected(exact)).error.responseData).toEqual(JSON.parse(exact));

    const over = jsonBodyOf(KEPT_CHARS + 1);
    expect((await rejected(over)).error.responseData).toEqual({
      responseText: over.slice(0, KEPT_CHARS),
    });

    expect((await rejected(JSON.stringify({ id: 'seven' }))).error.responseData).toEqual({
      id: 'seven',
    });
  });

  it('keeps no request header, and runs onError once', async () => {
    const { error, seen } = await rejected(jsonBodyOf(HUGE_CHARS));

    expect(seen).toHaveLength(1);
    for (const secret of [KEY, TOKEN]) {
      expect.soft(error.message).not.toContain(secret);
      expect.soft(String(error)).not.toContain(secret);
      expect.soft(JSON.stringify(error)).not.toContain(secret);
      expect.soft(reaches(error, secret)).toBe(false);
    }
  });

  it('still returns a body the schema accepts, and never calls onError', async () => {
    stubUpstream(JSON.stringify({ id: 7, extra: 'kept out by the schema' }));

    const { result, seen } = await run();

    expect(result).toEqual(Either.right({ id: 7 }));
    expect(seen).toEqual([]);
  });
});
