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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLinkHealthStore,
  LINK_HEALTH_POLL_MS as POLL_MS,
} from '@/components/link-health/link-health-store';

const NOW = Date.UTC(2026, 10, 16, 12);
const URL = 'https://example.com/demo';
const DAY = 24 * 60 * 60 * 1000;
const answer = (status = 'unavailable', checkedAt = new Date(NOW).toISOString()) =>
  ({
    ok: true,
    json: async () => ({ links: { [URL]: { status, checkedAt } } }),
  }) as Response;
let visibility: DocumentVisibilityState = 'visible';
let releases: (() => void)[];
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  releases = [];
});
afterEach(() => {
  for (const release of releases) release();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('scope-shared link health client', () => {
  it('deduplicates subscribers and only requests the fixed scope endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(answer());
    const store = createLinkHealthStore('projects', fetcher);
    releases.push(store.subscribe(vi.fn()), store.subscribe(vi.fn()));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/link-health?scope=projects',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        signal: expect.any(AbortSignal),
      }),
    );
    expect(store.getSnapshot().links[URL]?.status).toBe('unavailable');
    await vi.advanceTimersByTimeAsync(POLL_MS - 1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('reads once per page load, then at most every fifteen minutes', () => {
    expect(POLL_MS).toBe(15 * 60_000);
  });

  it("uses the browser's default cache mode, so the request does not ask the CDN to skip its copy", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(answer());
    const store = createLinkHealthStore('media', fetcher);
    releases.push(store.subscribe(vi.fn()));
    await flush();
    const init = fetcher.mock.calls[0]?.[1];
    expect(init).toBeDefined();
    expect(init).not.toHaveProperty('cache');
  });

  it('keeps the initial request through StrictMode immediate resubscription without a new request', async () => {
    let finish: (response: Response) => void = () => undefined;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const store = createLinkHealthStore('projects', fetcher);
    const first = store.subscribe(vi.fn());
    const signal = fetcher.mock.calls[0]?.[1]?.signal;
    first();
    releases.push(store.subscribe(vi.fn()));
    await flush();
    expect(signal?.aborted).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
    finish(answer());
    await flush();
    expect(store.getSnapshot().links[URL]?.status).toBe('unavailable');
    await vi.advanceTimersByTimeAsync(POLL_MS - 1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not fetch while hidden, aborts an in-flight read on hiding and resumes on return', async () => {
    visibility = 'hidden';
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    const store = createLinkHealthStore('media', fetcher);
    releases.push(store.subscribe(vi.fn()));
    expect(fetcher).not.toHaveBeenCalled();
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fetcher).toHaveBeenCalledTimes(1);
    const signal = fetcher.mock.calls[0]?.[1]?.signal;
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(2 * POLL_MS);
    expect(fetcher).toHaveBeenCalledTimes(1);
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps one poll while subscribers remain, and stops all work after the last leaves', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(answer());
    const store = createLinkHealthStore('experience', fetcher);
    const a = store.subscribe(vi.fn());
    const b = store.subscribe(vi.fn());
    await flush();
    a();
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(fetcher).toHaveBeenCalledTimes(2);
    b();
    await vi.advanceTimersByTimeAsync(2 * POLL_MS);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reuses recent data on remount without fetching more often than fifteen minutes', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(answer());
    const store = createLinkHealthStore('projects', fetcher);
    const release = store.subscribe(vi.fn());
    await flush();
    release();
    await vi.advanceTimersByTimeAsync(10_000);
    releases.push(store.subscribe(vi.fn()));
    expect(store.getSnapshot().links[URL]?.status).toBe('unavailable');
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(POLL_MS - 10_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps a fresh warning through a failed read and retries on the next interval', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(answer())
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(answer('reachable'));
    const store = createLinkHealthStore('projects', fetcher);
    releases.push(store.subscribe(vi.fn()));
    await flush();
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(store.getSnapshot().links[URL]?.status).toBe('unavailable');
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(store.getSnapshot().links[URL]?.status).toBe('reachable');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('expires a warning exactly at twenty-four hours even when the next read fails', async () => {
    const checkedAt = new Date(NOW - DAY + 1000).toISOString();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(answer('unavailable', checkedAt));
    const store = createLinkHealthStore('certifications', fetcher);
    releases.push(store.subscribe(vi.fn()));
    await flush();
    expect(store.getSnapshot().links[URL]?.status).toBe('unavailable');
    await vi.advanceTimersByTimeAsync(999);
    expect(store.getSnapshot().links[URL]).toBeDefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(store.getSnapshot().links[URL]).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('releases a hung request at the deadline and ignores its late response', async () => {
    let finish: (value: Response) => void = () => undefined;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(answer('reachable'));
    const store = createLinkHealthStore('projects', fetcher);
    releases.push(store.subscribe(vi.fn()));
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(POLL_MS - 5000);
    expect(store.getSnapshot().links[URL]?.status).toBe('reachable');
    finish(answer('unavailable'));
    await flush();
    expect(store.getSnapshot().links[URL]?.status).toBe('reachable');
  });

  it('contains HTTP and malformed JSON failures instead of throwing to the page', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => null } as Response)
      .mockResolvedValueOnce(answer());
    const store = createLinkHealthStore('media', fetcher);
    releases.push(store.subscribe(vi.fn()));
    await flush();
    expect(store.getSnapshot().links).toEqual({});
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(store.getSnapshot().links).toEqual({});
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(store.getSnapshot().links[URL]?.status).toBe('unavailable');
  });
});
