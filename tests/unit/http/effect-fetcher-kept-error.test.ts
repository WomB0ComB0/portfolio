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
 * @file What a kept error holds, against a fake upstream (no network). Before this, a kept error
 * held a 3 MB body alive, about 5 MB each on the schema and 404 JSON paths and 2.5 MB on the other
 * two, counting the body text V8 keeps outside its heap. Two things
 * held it: V8's unformatted stack (its frames keep the response) and the message's 200-character
 * quote (a V8 slice keeps the whole text). ValidationError.problems also quoted a rejected value
 * whole (3,145,794 characters for a 3 MB JSON array). Now the stack is formatted when the error
 * is built, every quote of a body is a copy, and problems keeps its first 2,000 characters and a
 * marker.
 */

import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { Effect, Result, Schema, SchemaIssue } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The fetcher only reads env for the Vercel bypass header; skip t3-env validation in tests.
vi.mock('@/env', () => ({ env: {}, default: {} }));

import {
  type FetcherError,
  type FetcherOptions,
  get,
  ValidationError,
} from '@/lib/http-clients/effect-fetcher';

const URL_UNDER_TEST = 'https://api.example.com/items';
/** Made-up credentials: the tests look for them in the formatted stack. */
const KEY = 'made-up-goog-api-key-0123456789';
const TOKEN = 'made-up-bearer-token-9876543210';
const HEADERS = { 'X-Goog-Api-Key': KEY, Authorization: `Bearer ${TOKEN}` };
/** The size of the bodies in the measured case (3 MB). */
const HUGE_CHARS = 3_145_752;
/** The most of problems an error keeps before its marker. */
const KEPT_CHARS = 2_000;
const ID_SCHEMA = Schema.Struct({ id: Schema.Number });

interface FailurePath {
  readonly status: number;
  readonly body: string;
  readonly type: string;
  readonly schema?: FetcherOptions['schema'];
}

const jsonNoId = `{"note":"${'x'.repeat(HUGE_CHARS - 11)}"}`;
const htmlPage = `<html>${'y'.repeat(HUGE_CHARS - 13)}</html>`;
const PATHS: readonly (readonly [string, FailurePath])[] = [
  [
    'a 2xx JSON body its schema rejects',
    {
      status: 200,
      body: jsonNoId,
      type: 'application/json',
      schema: ID_SCHEMA as FetcherOptions['schema'],
    },
  ],
  ['a 404 with a JSON body', { status: 404, body: jsonNoId, type: 'application/json' }],
  ['a 500 with an HTML page', { status: 500, body: htmlPage, type: 'text/html' }],
  ['a 2xx body that is not JSON', { status: 200, body: htmlPage, type: 'text/html' }],
];

/**
 * Runs one GET against an upstream answering `path`; the error it fails with and onError's calls.
 * The upstream is a plain function: a vi.fn would keep every Response (and its body) in its results.
 */
async function failure({ status, body, type, schema }: FailurePath) {
  vi.stubGlobal(
    'fetch',
    async () => new Response(body, { status, headers: { 'Content-Type': type } }),
  );
  const seen: unknown[] = [];
  const result = await Effect.runPromise(
    Effect.result(
      get(URL_UNDER_TEST, {
        retries: 0,
        headers: HEADERS,
        schema,
        onError: (error) => seen.push(error),
      }).pipe(Effect.provide(FetchHttpClient.layer)),
    ),
  );
  if (Result.isSuccess(result)) throw new Error('expected the request to fail');
  return { error: result.failure as FetcherError | ValidationError, seen };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('effect-fetcher: a failed request’s error has its stack formatted when it is built', () => {
  it.each(PATHS)('on %s', async (_, path) => {
    const formatted = new WeakSet<object>();
    const previous = Error.prepareStackTrace;
    Error.prepareStackTrace = (error, frames) => {
      formatted.add(error);
      return previous ? previous(error, frames) : `${error}\n    at ${frames.join('\n    at ')}`;
    };
    try {
      const { error, seen } = await failure(path);

      // Checked before anything here reads error.stack, which would format it.
      expect(formatted.has(error)).toBe(true);
      expect(seen).toEqual([error]);
      for (const secret of [KEY, TOKEN]) expect.soft(error.stack).not.toContain(secret);
    } finally {
      Error.prepareStackTrace = previous;
    }
  });
});

/** A full garbage collection (Node's gc, reached without the --expose-gc command-line flag). */
function collect(): void {
  setFlagsFromString('--expose-gc');
  const gc = runInNewContext('gc') as () => void;
  for (let round = 0; round < 4; round += 1) gc();
}

/** The heap and the memory outside it (a body read as text is a V8 external string) in use. */
const inUse = (): number => {
  const { heapUsed, external } = process.memoryUsage();
  return heapUsed + external;
};

/** Kilobytes that `kept` errors hold, each, measured by dropping them. */
async function heldPerError(path: FailurePath, kept: number): Promise<number> {
  const errors: unknown[] = [];
  for (let run = 0; run < kept; run += 1) errors.push((await failure(path)).error);
  collect();
  const holding = inUse();
  errors.length = 0;
  collect();
  return (holding - inUse()) / kept / 1_024;
}

describe('effect-fetcher: a kept error whose stack is never read', () => {
  it.each(PATHS)('holds no copy of the 3 MB body, on %s', async (_, path) => {
    await heldPerError(path, 1);

    // Before: about 5,133 KiB each on the schema and 404 JSON paths, 2,573 on the other two.
    expect(Math.round(await heldPerError(path, 6))).toBeLessThan(256);
  });
});

/** What Effect's formatter writes for `body`, retaining the fetcher's rejected-input detail. */
function formatted(body: string): string {
  const result = Schema.decodeUnknownResult(ID_SCHEMA, { reportInput: true })(JSON.parse(body));
  if (Result.isSuccess(result)) throw new Error('expected the schema to reject the body');
  return SchemaIssue.makeFormatterDefault()(result.failure.issue);
}

describe('effect-fetcher: ValidationError.problems', () => {
  it.each([
    ['a 3 MB JSON array', JSON.stringify(Array.from({ length: 1_572_876 }, (_, i) => i % 10))],
    ['an id that is a 3 MB string', `{"id":"${'x'.repeat(HUGE_CHARS - 9)}"}`],
  ])('keeps the first 2,000 characters and a marker for %s', async (_, body) => {
    const whole = formatted(body);
    const { error } = await failure({
      status: 200,
      body,
      type: 'application/json',
      schema: ID_SCHEMA as FetcherOptions['schema'],
    });

    expect(error).toBeInstanceOf(ValidationError);
    const { problems } = error as ValidationError;
    const marker = `… (${whole.length - KEPT_CHARS} more characters)`;
    // Lengths and ends first, so a failure does not print megabytes.
    expect(problems.length).toBe(KEPT_CHARS + marker.length);
    expect(problems.slice(KEPT_CHARS)).toBe(marker);
    expect(problems === `${whole.slice(0, KEPT_CHARS)}${marker}`).toBe(true);
    expect(JSON.stringify(error).length).toBeLessThan(3 * KEPT_CHARS);
  });

  it('keeps problems that fit whole, as before', async () => {
    const body = JSON.stringify({ id: 'seven' });
    const { error } = await failure({
      status: 200,
      body,
      type: 'application/json',
      schema: ID_SCHEMA as FetcherOptions['schema'],
    });

    expect((error as ValidationError).problems).toBe(formatted(body));
    expect((error as ValidationError).getProblemsString()).toBe(formatted(body));
  });
});
