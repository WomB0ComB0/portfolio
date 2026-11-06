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
 * @file settle (src/app/_components/home/data/tile-result.ts): a home tile's load never rejects.
 * - Within its deadline, the load's own result comes back unchanged and nothing is reported.
 * - A failure becomes { status: 'error' } with one error report naming the tile.
 * - A missed deadline becomes { status: 'error' } with a warning; the load keeps running, so a
 *   late answer still fills its cache and a late rejection is never unhandled.
 * - With onDeadline, a missed deadline shows what it answers (the source's last good value,
 *   stale) instead, still with the one warning; with nothing to answer, the error state.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SERVER_TILE_DEADLINE_MS,
  settle,
  staleTile,
  type TileResult,
} from '@/app/_components/home/data/tile-result';
import { isBaseError } from '@/classes/error';
import { DeadlineError, withDeadline } from '@/lib/async/deadline';

const report = vi.hoisted(() => ({ reportApiFailure: vi.fn() }));
vi.mock('@/lib/observability/report', () => report);

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;
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

const OK: TileResult<number> = { status: 'ok', data: 692, stale: false };

/** The options of every report sent, in order. */
const reportOptions = (): unknown[] => report.reportApiFailure.mock.calls.map((call) => call[1]);

/** The error and options of the only report sent. */
function onlyReport(): { error: unknown; options: unknown } {
  expect(report.reportApiFailure).toHaveBeenCalledTimes(1);
  const [error, options] = report.reportApiFailure.mock.calls[0] ?? [];
  return { error, options };
}

beforeEach(() => {
  report.reportApiFailure.mockReset();
  // Only the deadline's timer is faked; setImmediate stays real for nextMacrotask.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('settle', () => {
  it('returns an ok result from the load unchanged and reports nothing', async () => {
    await expect(settle('leetcode', async () => OK)).resolves.toBe(OK);
    expect(report.reportApiFailure).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns an empty result from the load unchanged', async () => {
    await expect(settle('roles', async () => ({ status: 'empty' }))).resolves.toEqual({
      status: 'empty',
    });
    expect(report.reportApiFailure).not.toHaveBeenCalled();
  });

  it('turns a rejection into the error state with one error report naming the tile', async () => {
    const failure = new Error('GraphQL: Bad credentials');

    await expect(settle('github', () => Promise.reject(failure))).resolves.toEqual({
      status: 'error',
    });

    const { error, options } = onlyReport();
    expect(isBaseError(error)).toBe(true);
    expect(error).toMatchObject({ command: 'home:github', cause: failure });
    expect(options).toEqual({ context: 'home github tile', level: 'error' });
  });

  it('turns a load that throws before returning a promise into the error state', async () => {
    const run = (): Promise<TileResult<number>> => {
      throw new Error('bad input');
    };

    await expect(settle('typing', run)).resolves.toEqual({ status: 'error' });
    expect(onlyReport().options).toEqual({ context: 'home typing tile', level: 'error' });
  });

  it('gives up at the 4 s deadline with a warning, not before', async () => {
    const work = deferred<TileResult<number>>();
    const result = settle('leetcode', () => work.promise);
    const settled = vi.fn();
    void result.then(settled);

    await vi.advanceTimersByTimeAsync(3_999);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ status: 'error' });

    const { error, options } = onlyReport();
    expect(options).toEqual({ context: 'home leetcode tile', level: 'warning' });
    expect(error).toMatchObject({ command: 'home:leetcode' });
    expect((error as { cause: unknown }).cause).toBeInstanceOf(DeadlineError);
    expect((error as { cause: DeadlineError }).cause).toMatchObject({
      label: 'home:leetcode',
      ms: SERVER_TILE_DEADLINE_MS,
    });
  });

  it('uses the deadline it is given', async () => {
    const work = deferred<TileResult<number>>();
    const result = settle('status', () => work.promise, { deadlineMs: 100 });

    await vi.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toEqual({ status: 'error' });
  });

  it('lets a late answer finish its work, such as filling the cache', async () => {
    const upstream = deferred<number>();
    const writeCache = vi.fn();
    const result = settle('github', async () => {
      const data = await upstream.promise;
      writeCache(data);
      return { status: 'ok', data, stale: false };
    });

    await vi.advanceTimersByTimeAsync(SERVER_TILE_DEADLINE_MS);
    await expect(result).resolves.toEqual({ status: 'error' });

    upstream.resolve(42);
    await nextMacrotask();

    expect(writeCache).toHaveBeenCalledExactlyOnceWith(42);
  });

  it('never turns a rejection after the deadline into an unhandled rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const work = deferred<TileResult<number>>();
      const result = settle('place', () => work.promise);

      await vi.advanceTimersByTimeAsync(SERVER_TILE_DEADLINE_MS);
      await expect(result).resolves.toEqual({ status: 'error' });

      work.reject(new Error('late Sanity failure'));
      await nextMacrotask();
      await nextMacrotask();

      expect(unhandled).not.toHaveBeenCalled();
      // The late failure is not reported again: the tile already reported its timeout.
      expect(report.reportApiFailure).toHaveBeenCalledTimes(1);
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});

describe('settle with onDeadline', () => {
  const LOADED_AT = '2026-11-06T02:50:00.000Z';
  const LAST_GOOD = staleTile(640, LOADED_AT);

  it('marks data stale with when it was loaded', () => {
    expect(LAST_GOOD).toEqual({ status: 'ok', data: 640, stale: true, asOf: LOADED_AT });
  });

  it('shows the last good value at the deadline, with the one warning', async () => {
    const work = deferred<TileResult<number>>();
    const onDeadline = vi.fn(() => LAST_GOOD);
    const result = settle('github', () => work.promise, { onDeadline });
    const settled = vi.fn();
    void result.then(settled);

    await vi.advanceTimersByTimeAsync(SERVER_TILE_DEADLINE_MS - 1);
    expect(settled).not.toHaveBeenCalled();
    expect(onDeadline).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe(LAST_GOOD);
    expect(onDeadline).toHaveBeenCalledTimes(1);
    const { error, options } = onlyReport();
    expect(options).toEqual({ context: 'home github tile', level: 'warning' });
    expect((error as { cause: unknown }).cause).toBeInstanceOf(DeadlineError);
  });

  it('is the error state at the deadline when nothing was ever loaded', async () => {
    const work = deferred<TileResult<number>>();
    const result = settle('typing', () => work.promise, { onDeadline: () => undefined });

    await vi.advanceTimersByTimeAsync(SERVER_TILE_DEADLINE_MS);

    await expect(result).resolves.toEqual({ status: 'error' });
    expect(onlyReport().options).toEqual({ context: 'home typing tile', level: 'warning' });
  });

  it('honours a custom deadline', async () => {
    const work = deferred<TileResult<number>>();
    const result = settle('counts', () => work.promise, {
      deadlineMs: 100,
      onDeadline: () => LAST_GOOD,
    });

    await vi.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toBe(LAST_GOOD);
  });

  it('is not asked when the load answers or fails in time', async () => {
    const onDeadline = vi.fn(() => LAST_GOOD);

    await expect(settle('roles', async () => OK, { onDeadline })).resolves.toBe(OK);
    await expect(
      settle('roles', () => Promise.reject(new Error('Sanity 503')), { onDeadline }),
    ).resolves.toEqual({ status: 'error' });

    expect(onDeadline).not.toHaveBeenCalled();
    expect(onlyReport().options).toEqual({ context: 'home roles tile', level: 'error' });
  });

  it("is not asked when the load's own, inner deadline fails it", async () => {
    const onDeadline = vi.fn(() => LAST_GOOD);
    const inner = deferred<number>();
    const run = async (): Promise<TileResult<number>> => ({
      status: 'ok',
      data: await withDeadline(inner.promise, 50, 'sanity talks with YouTube data'),
      stale: false,
    });

    const result = settle('project', run, { onDeadline });
    await vi.advanceTimersByTimeAsync(50);

    await expect(result).resolves.toEqual({ status: 'error' });
    expect(onDeadline).not.toHaveBeenCalled();
  });

  it('stays the error state, reported, when onDeadline throws', async () => {
    const work = deferred<TileResult<number>>();
    const bug = new TypeError('peek is not a function');
    const result = settle('place', () => work.promise, {
      onDeadline: () => {
        throw bug;
      },
    });

    await vi.advanceTimersByTimeAsync(SERVER_TILE_DEADLINE_MS);

    await expect(result).resolves.toEqual({ status: 'error' });
    expect(reportOptions()).toEqual([
      { context: 'home place tile', level: 'warning' },
      { context: 'home place tile', level: 'error' },
    ]);
    expect(report.reportApiFailure.mock.calls[1]?.[0]).toMatchObject({ cause: bug });
  });

  it('lets the late answer still fill the cache after the last good value was shown', async () => {
    const upstream = deferred<number>();
    const writeCache = vi.fn();
    const result = settle(
      'github',
      async () => {
        const data = await upstream.promise;
        writeCache(data);
        return { status: 'ok', data, stale: false };
      },
      { onDeadline: () => LAST_GOOD },
    );

    await vi.advanceTimersByTimeAsync(SERVER_TILE_DEADLINE_MS);
    await expect(result).resolves.toBe(LAST_GOOD);

    upstream.resolve(655);
    await nextMacrotask();

    expect(writeCache).toHaveBeenCalledExactlyOnceWith(655);
    expect(report.reportApiFailure).toHaveBeenCalledTimes(1);
  });
});
