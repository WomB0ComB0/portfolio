// @vitest-environment node
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
 * @file keepAlive hands a background task to Next's after(), so a serverless host keeps running
 * it once the response has ended. after() gets a promise that never rejects (the caller reports
 * the task's own failure), and outside a request, where after() throws, the task simply runs on.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const next = vi.hoisted(() => ({ after: vi.fn() }));
vi.mock('next/server', () => next);

import { keepAlive } from '@/lib/cache/keep-alive';

afterEach(() => {
  next.after.mockReset();
});

describe('keepAlive', () => {
  it('hands the task to after() once, as a promise that settles with it', async () => {
    let finish: () => void = () => undefined;
    const task = new Promise<string>((resolve) => {
      finish = () => resolve('done');
    });

    keepAlive(task);

    expect(next.after).toHaveBeenCalledTimes(1);
    const kept = next.after.mock.calls[0]?.[0] as Promise<unknown>;
    expect(kept).toBeInstanceOf(Promise);
    let settled = false;
    void kept.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    finish();
    await kept;
    expect(settled).toBe(true);
  });

  it('never hands after() a rejection: the caller reports the failure itself', async () => {
    keepAlive(Promise.reject(new Error('upstream down')));

    const kept = next.after.mock.calls[0]?.[0] as Promise<unknown>;
    await expect(kept).resolves.toBeUndefined();
  });

  it('lets the task run on outside a request, where after() throws', async () => {
    next.after.mockImplementation(() => {
      throw new Error('`after` was called outside a request scope.');
    });
    let ran = false;
    const task = Promise.resolve().then(() => {
      ran = true;
    });

    expect(() => keepAlive(task)).not.toThrow();
    await task;
    expect(ran).toBe(true);
  });
});
