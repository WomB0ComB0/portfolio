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
 * @file On the server the request queue must step aside. One server instance serves every
 * visitor, and the queue used to rate-limit and share requests across all of them: the sixth
 * /api/v1/sanity call in a minute slept out the rest of that minute, holding SSR streams open for
 * up to 58 s, and concurrent identical requests from different visitors shared one response.
 *
 * Runs in the node environment, where `window` is undefined, as it is during SSR.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestQueue } from '@/lib/http-clients/request-queue';

const SANITY_URL = '/api/v1/sanity/places';
/** The audit's repro: the 8th quick GET of /places streamed for 58.6 s. */
const REQUESTS = 8;
/** Enough microtask turns for an un-delayed request chain to settle. */
const MICROTASK_TURNS = 20;

/** True when `promise` settles while only microtasks run, i.e. without any timer firing. */
async function settlesWithoutTimers(promise: Promise<unknown>): Promise<boolean> {
  let settled = false;
  promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  for (let turn = 0; turn < MICROTASK_TURNS; turn++) await Promise.resolve();
  return settled;
}

/** A request whose result the test decides, to hold several requests in flight at once. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('requestQueue on the server', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs back-to-back requests to one Sanity URL without waiting on a rate limit', async () => {
    expect(globalThis.window).toBeUndefined();

    for (let visitor = 0; visitor < REQUESTS; visitor++) {
      const call = requestQueue.enqueue(SANITY_URL, 'GET', async () => visitor);
      expect(await settlesWithoutTimers(call)).toBe(true);
      await expect(call).resolves.toBe(visitor);
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never shares one visitor’s in-flight request with another', async () => {
    const pending = Array.from({ length: REQUESTS }, () => deferred<string>());
    const executors = pending.map(({ promise }) => vi.fn(() => promise));

    const calls = executors.map((executor) => requestQueue.enqueue(SANITY_URL, 'GET', executor));
    for (const executor of executors) expect(executor).toHaveBeenCalledTimes(1);

    pending.forEach(({ resolve }, visitor) => {
      resolve(`visitor-${visitor}`);
    });
    await expect(Promise.all(calls)).resolves.toEqual(
      pending.map((_, visitor) => `visitor-${visitor}`),
    );
  });

  it('keeps no state between requests: a 429 for one does not slow the next', async () => {
    const rateLimited = Object.assign(new Error('429 Too Many Requests'), { status: 429 });

    const first = requestQueue.enqueue(SANITY_URL, 'GET', () => Promise.reject(rateLimited));
    await expect(first).rejects.toBe(rateLimited);

    const next = requestQueue.enqueue(SANITY_URL, 'GET', async () => 'fresh');
    expect(await settlesWithoutTimers(next)).toBe(true);
    await expect(next).resolves.toBe('fresh');
  });
});
