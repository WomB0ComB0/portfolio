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

/** @vitest-environment node */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Effect, Schema } from 'effect';
// Use the real module, bypassing the test setup's barrel adapter for changing fetch mocks.
import * as FetchHttpClient from 'effect/http/FetchHttpClient';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({ env: {}, default: {} }));

import { FetcherError, type FetcherOptions, get } from '@/lib/http-clients/effect-fetcher';

const nativeFetch = globalThis.fetch;
const requests = new Map<string, number>();
const pending = new Map<string, { arrived: () => void; closed: () => void }>();
let server: Server;
let origin: string;

/** Wait for a real socket request and its cancellation, without polling or arbitrary sleeps. */
function observe(path: string) {
  const arrived = Promise.withResolvers<void>();
  const closed = Promise.withResolvers<void>();
  pending.set(path, { arrived: arrived.resolve, closed: closed.resolve });
  return { arrived: arrived.promise, closed: closed.promise };
}

function request(path: string, options: FetcherOptions = {}) {
  return get(`${origin}${path}`, { retries: 0, ...options }).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.provideService(FetchHttpClient.Fetch, nativeFetch),
  );
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = req.url ?? '/';
    requests.set(path, (requests.get(path) ?? 0) + 1);
    const observation = pending.get(path);
    if (observation) {
      res.once('close', observation.closed);
      observation.arrived();
      return; // The deadline or AbortSignal must close this unanswered response.
    }
    res.setHeader('Content-Type', 'application/json');
    if (path.startsWith('/status/')) {
      res.statusCode = Number(path.slice('/status/'.length));
      res.end(JSON.stringify({ message: 'x'.repeat(10_000) }));
      return;
    }
    res.end(JSON.stringify({ id: 7 }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  const closed = new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  server.closeAllConnections();
  await closed;
});

describe('Effect 4 fetcher over a real HTTP connection', () => {
  it('decodes a successful response through the native Fetch client', async () => {
    await expect(
      Effect.runPromise(request('/success', { schema: Schema.Struct({ id: Schema.Number }) })),
    ).resolves.toEqual({ id: 7 });
    expect(requests.get('/success')).toBe(1);
  });

  it.each([
    [404, 2, 1],
    [503, 1, 2],
  ])(
    'keeps a bounded, sanitized %i error after its retry budget',
    async (status, retries, count) => {
      const secret = `local-http-test-secret-${status}`;
      const onError = vi.fn();
      const error: unknown = await Effect.runPromise(
        request(`/status/${status}`, {
          retries,
          retryDelay: 1,
          headers: { Authorization: `Bearer ${secret}` },
          onError,
        }),
      ).catch((failure: unknown) => failure);

      expect(error).toBeInstanceOf(FetcherError);
      if (!(error instanceof FetcherError)) throw new Error('expected a typed HTTP error');
      expect(error.status).toBe(status);
      expect(error.responseData).toEqual({ responseText: expect.any(String) });
      expect((error.responseData as { responseText: string }).responseText).toHaveLength(2_000);
      expect(error.message).toHaveLength(`HTTP ${status}: `.length + 200 + 3);
      expect(JSON.stringify(error)).not.toContain(secret);
      expect(error.stack).not.toContain(secret);
      expect(error.cause).toBeUndefined();
      expect(onError).toHaveBeenCalledExactlyOnceWith(error);
      expect(requests.get(`/status/${status}`)).toBe(count);
    },
  );

  it('enforces the deadline and closes the upstream connection', async () => {
    const observed = observe('/deadline');
    const onError = vi.fn();
    const running = Effect.runPromise(request('/deadline', { timeout: 400, onError }));
    const rejected = expect(running).rejects.toMatchObject({
      name: 'FetcherError',
      message: 'Request timed out',
    });
    await observed.arrived;
    await rejected;
    await observed.closed;
    expect(requests.get('/deadline')).toBe(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('interrupts an in-flight fetch via runPromise AbortSignal without retrying', async () => {
    const observed = observe('/cancel');
    const controller = new AbortController();
    const onError = vi.fn();
    const running = Effect.runPromise(request('/cancel', { retries: 2, onError }), {
      signal: controller.signal,
    });
    const rejected = expect(running).rejects.toThrow();
    await observed.arrived;
    controller.abort();
    await rejected;
    await observed.closed;
    expect(requests.get('/cancel')).toBe(1);
    expect(onError).not.toHaveBeenCalled();
  });
});
