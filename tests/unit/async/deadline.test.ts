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

// @vitest-environment node

/**
 * @file withDeadline settles like its promise or rejects with a DeadlineError once the budget
 * runs out, never leaves a timer behind, and never turns a late rejection into an unhandled one.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DeadlineError, withDeadline } from '@/lib/async/deadline';

const BUDGET_MS = 1_000;
const LABEL = 'github activity';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets Node run its unhandled-rejection check, which happens after the microtask queue drains. */
const nextMacrotask = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('withDeadline', () => {
  beforeEach(() => {
    // Only the deadline's own timer is faked; setImmediate stays real for nextMacrotask.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the value when the promise settles before the deadline', async () => {
    const work = deferred<number>();
    const result = withDeadline(work.promise, BUDGET_MS, LABEL);

    await vi.advanceTimersByTimeAsync(BUDGET_MS - 1);
    work.resolve(42);

    await expect(result).resolves.toBe(42);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects with the promise’s own error when it fails before the deadline', async () => {
    const failure = new Error('upstream 502');
    const result = withDeadline(Promise.reject(failure), BUDGET_MS, LABEL);

    await expect(result).rejects.toBe(failure);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects with a DeadlineError carrying the label and budget once the timer wins', async () => {
    const work = deferred<number>();
    const result = withDeadline(work.promise, BUDGET_MS, LABEL);
    const settled = result.then(
      () => 'resolved',
      (error: unknown) => error,
    );

    await vi.advanceTimersByTimeAsync(BUDGET_MS - 1);
    await expect(Promise.race([settled, Promise.resolve('pending')])).resolves.toBe('pending');

    await vi.advanceTimersByTimeAsync(1);
    const error = await settled;

    expect(error).toBeInstanceOf(DeadlineError);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: 'DeadlineError',
      label: LABEL,
      ms: BUDGET_MS,
      message: `${LABEL} timed out after ${BUDGET_MS} ms`,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not turn a rejection that arrives after the deadline into an unhandled rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const work = deferred<number>();
      const result = withDeadline(work.promise, BUDGET_MS, LABEL);
      const timedOut = expect(result).rejects.toBeInstanceOf(DeadlineError);

      await vi.advanceTimersByTimeAsync(BUDGET_MS);
      await timedOut;

      work.reject(new Error('late upstream failure'));
      await nextMacrotask();
      await nextMacrotask();

      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('does not cancel the work: a late success still runs its continuation', async () => {
    const work = deferred<string>();
    const writeCache = vi.fn((value: string) => value);
    const filling = work.promise.then(writeCache);
    const result = withDeadline(filling, BUDGET_MS, LABEL);
    const timedOut = expect(result).rejects.toBeInstanceOf(DeadlineError);

    await vi.advanceTimersByTimeAsync(BUDGET_MS);
    await timedOut;
    work.resolve('fresh');
    await filling;

    expect(writeCache).toHaveBeenCalledExactlyOnceWith('fresh');
  });
});
