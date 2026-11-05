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
 * @file In the browser the request queue shares one in-flight request between concurrent
 * identical calls, and does nothing else: it caches no responses and no longer rate-limits. Its
 * old per-minute caps (5 Sanity calls per URL) stalled a visitor clicking back and forth between
 * pages for up to a minute, behind a full-screen loader.
 *
 * Runs under jsdom, where `window` is defined.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REQUEST_QUEUE_STALE_MS, requestQueue } from '@/lib/http-clients/request-queue';

/** More calls than the old per-minute cap allowed for one Sanity URL. */
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

/** A request whose result the test decides, to hold it in flight. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('requestQueue in the browser', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shares one in-flight GET between concurrent identical calls', async () => {
    expect(globalThis.window).toBeDefined();
    const { promise, resolve } = deferred<string[]>();
    const executor = vi.fn(() => promise);

    const first = requestQueue.enqueue('/api/v1/sanity/projects', 'GET', executor);
    const second = requestQueue.enqueue('/api/v1/sanity/projects', 'GET', executor);
    expect(executor).toHaveBeenCalledTimes(1);

    resolve(['proj-grepo']);
    await expect(first).resolves.toEqual(['proj-grepo']);
    await expect(second).resolves.toEqual(['proj-grepo']);
  });

  it('caches nothing: a call after the shared request settles runs again', async () => {
    const executor = vi.fn(async () => 'answer');

    await requestQueue.enqueue('/api/v1/sanity/experience', 'GET', executor);
    await requestQueue.enqueue('/api/v1/sanity/experience', 'GET', executor);

    expect(executor).toHaveBeenCalledTimes(2);
  });

  it('keeps calls apart when the URL, method or Authorization header differs', async () => {
    const executor = vi.fn(() => deferred<string>().promise);

    requestQueue.enqueue('/api/v1/messages', 'GET', executor);
    requestQueue.enqueue('/api/v1/messages', 'POST', executor, { body: { text: 'hi' } });
    requestQueue.enqueue('/api/v1/blog', 'GET', executor);
    requestQueue.enqueue('/api/v1/github-stats', 'GET', executor, {
      headers: { Authorization: 'Bearer visitor-a' },
    });
    requestQueue.enqueue('/api/v1/github-stats', 'GET', executor, {
      headers: { Authorization: 'Bearer visitor-b' },
    });

    expect(executor).toHaveBeenCalledTimes(5);
  });

  it('runs a call alone when it asks to bypass deduplication', () => {
    const executor = vi.fn(() => deferred<string>().promise);

    requestQueue.enqueue('/api/v1/wakatime', 'GET', executor);
    requestQueue.enqueue('/api/v1/wakatime', 'GET', executor, { bypassDeduplication: true });

    expect(executor).toHaveBeenCalledTimes(2);
  });

  it('does not hand a failed request to later calls', async () => {
    const failure = new Error('Sanity is down');
    const failing = requestQueue.enqueue('/api/v1/sanity/places', 'GET', () =>
      Promise.reject(failure),
    );
    await expect(failing).rejects.toBe(failure);

    await expect(
      requestQueue.enqueue('/api/v1/sanity/places', 'GET', async () => 'recovered'),
    ).resolves.toBe('recovered');
  });

  it('never makes a visitor clicking through pages wait on a per-minute cap', async () => {
    for (let visit = 0; visit < REQUESTS; visit++) {
      const call = requestQueue.enqueue('/api/v1/sanity/certifications', 'GET', async () => visit);
      expect(await settlesWithoutTimers(call)).toBe(true);
      await expect(call).resolves.toBe(visit);
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops sharing a request that never settles once it is stale', async () => {
    const hung = vi.fn(() => deferred<string>().promise);
    requestQueue.enqueue('/api/v1/sanity/resume', 'GET', hung);

    vi.advanceTimersByTime(REQUEST_QUEUE_STALE_MS + 1);
    const retry = vi.fn(async () => 'resume');

    await expect(requestQueue.enqueue('/api/v1/sanity/resume', 'GET', retry)).resolves.toBe(
      'resume',
    );
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
