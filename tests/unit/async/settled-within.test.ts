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

// @vitest-environment node

/**
 * @file settledWithin waits until every promise has settled or its wait is over, whichever is
 * first; says what each had settled to then (a rejection as such, never a throw, a pending one
 * left out); leaves no timer behind; and tells the caller nothing that settled later.
 * fulfilledWithin keeps only the fulfilled values.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FIRST_FLUSH_WAIT_MS, fulfilledWithin, settledWithin } from '@/lib/async/settled-within';

const WAIT_MS = 500;

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

describe('settledWithin', () => {
  beforeEach(() => {
    // Only the wait's own timer is faked; setImmediate stays real for nextMacrotask.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers as soon as everything has settled, before the wait is over, and clears its timer', async () => {
    let answered = false;
    const pending = settledWithin(
      { a: Promise.resolve(1), b: Promise.reject(new Error('down')) },
      WAIT_MS,
    ).then((settled) => {
      answered = true;
      return settled;
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(answered).toBe(true);
    await expect(pending).resolves.toEqual({
      a: { status: 'fulfilled', value: 1 },
      b: { status: 'rejected', reason: new Error('down') },
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('answers once the wait is over with what had settled, leaving a pending one out', async () => {
    const slow = deferred<string>();
    let answered = false;
    const pending = settledWithin(
      { fast: Promise.resolve('in'), slow: slow.promise },
      WAIT_MS,
    ).then((settled) => {
      answered = true;
      return settled;
    });

    await vi.advanceTimersByTimeAsync(WAIT_MS - 1);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    const settled = await pending;
    expect(answered).toBe(true);
    expect(settled).toEqual({ fast: { status: 'fulfilled', value: 'in' } });
    expect('slow' in settled).toBe(false);
  });

  it('tells nothing that settled after the wait, and never cancels the late promise', async () => {
    const slow = deferred<string>();
    const pending = settledWithin({ slow: slow.promise }, WAIT_MS);
    await vi.advanceTimersByTimeAsync(WAIT_MS);
    const settled = await pending;

    slow.resolve('late');
    await expect(slow.promise).resolves.toBe('late');
    expect(settled).toEqual({});
  });

  it('never turns a rejection, early or late, into an unhandled one', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const late = deferred<never>();
      const pending = settledWithin(
        { early: Promise.reject(new Error('early')), late: late.promise },
        WAIT_MS,
      );
      await vi.advanceTimersByTimeAsync(WAIT_MS);
      await pending;
      late.reject(new Error('late'));
      await nextMacrotask();

      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('waits half a second for a streamed page, inside a good time to first byte', () => {
    expect(FIRST_FLUSH_WAIT_MS).toBe(500);
  });
});

describe('fulfilledWithin', () => {
  it('keeps the fulfilled values by key and leaves out rejected and pending ones', () => {
    expect(
      fulfilledWithin<{ a: Promise<number>; b: Promise<number>; c: Promise<number> }>({
        a: { status: 'fulfilled', value: 1 },
        b: { status: 'rejected', reason: new Error('down') },
      }),
    ).toEqual({ a: 1 });
  });
});
