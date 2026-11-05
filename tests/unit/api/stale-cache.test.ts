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
 * @file The stale-on-error cache behind the Sanity routes: a value younger than the TTL is served
 * from memory, an older one is reloaded, and a failed reload serves the last good value marked
 * stale. Errors are never cached, while real empty results ([] and null) are. After a failed
 * reload the last good value is served for a short backoff without asking the upstream again, so
 * a hanging upstream costs one slow request per backoff instead of one per request.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createStaleCache,
  STALE_RETRY_BACKOFF_MS,
} from '@/app/api/v1/[[...route]]/shared/stale-cache';

const TTL_MS = 1_000;

/** A cache on a clock the test moves by hand. */
const setup = <T>() => {
  let time = 0;
  const cache = createStaleCache<T>({ ttlMs: TTL_MS, now: () => time });
  const advance = (ms: number) => {
    time += ms;
  };
  return { cache, advance };
};

describe('createStaleCache', () => {
  it('loads a missing key and serves it from memory until the TTL is up', async () => {
    const { cache, advance } = setup<string[]>();
    const load = vi.fn(async () => ['a']);

    await expect(cache.get('list', load)).resolves.toEqual({ stale: false, data: ['a'] });
    advance(TTL_MS - 1);
    await expect(cache.get('list', load)).resolves.toEqual({ stale: false, data: ['a'] });

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reloads once the TTL is up', async () => {
    const { cache, advance } = setup<string>();
    await cache.get('key', async () => 'old');

    advance(TTL_MS);

    await expect(cache.get('key', async () => 'new')).resolves.toEqual({
      stale: false,
      data: 'new',
    });
  });

  it('serves the last good value, marked stale, when a reload fails', async () => {
    const { cache, advance } = setup<string>();
    await cache.get('key', async () => 'good');
    const failure = new Error('upstream down');

    advance(TTL_MS + 5);

    await expect(
      cache.get('key', async () => {
        throw failure;
      }),
    ).resolves.toEqual({ stale: true, data: 'good', error: failure, loadedAt: 0 });
  });

  it('rethrows the load error when nothing was ever cached', async () => {
    const { cache } = setup<string>();
    const failure = new Error('cold failure');

    await expect(
      cache.get('key', async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });

  it('never caches an error: the next request loads again', async () => {
    const { cache } = setup<string>();
    await cache
      .get('key', async () => {
        throw new Error('first try fails');
      })
      .catch(() => undefined);

    await expect(cache.get('key', async () => 'second')).resolves.toEqual({
      stale: false,
      data: 'second',
    });
  });

  it('caches real empty results like any other value', async () => {
    const { cache, advance } = setup<string[] | null>();
    const emptyList = vi.fn(async () => []);
    const missing = vi.fn(async () => null);

    await expect(cache.get('list', emptyList)).resolves.toEqual({ stale: false, data: [] });
    await expect(cache.get('list', emptyList)).resolves.toEqual({ stale: false, data: [] });
    await expect(cache.get('doc', missing)).resolves.toEqual({ stale: false, data: null });
    await expect(cache.get('doc', missing)).resolves.toEqual({ stale: false, data: null });
    expect(emptyList).toHaveBeenCalledTimes(1);
    expect(missing).toHaveBeenCalledTimes(1);

    advance(TTL_MS);
    await expect(
      cache.get('doc', async () => {
        throw new Error('down');
      }),
    ).resolves.toMatchObject({ stale: true, data: null });
  });

  it('keeps each key separate', async () => {
    const { cache } = setup<string>();
    await cache.get('a', async () => 'A');

    await expect(
      cache.get('b', async () => {
        throw new Error('b is down');
      }),
    ).rejects.toThrow('b is down');
    await expect(cache.get('a', async () => 'unused')).resolves.toEqual({
      stale: false,
      data: 'A',
    });
  });

  it('shares one load between concurrent requests for a key', async () => {
    const { cache } = setup<string>();
    let release: (value: string) => void = () => undefined;
    const load = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );

    const first = cache.get('key', load);
    const second = cache.get('key', load);
    await Promise.resolve();
    release('shared');

    await expect(Promise.all([first, second])).resolves.toEqual([
      { stale: false, data: 'shared' },
      { stale: false, data: 'shared' },
    ]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('turns a load that throws synchronously into a normal failure', async () => {
    const { cache } = setup<string>();
    const load = (): Promise<string> => {
      throw new Error('sync throw');
    };

    await expect(cache.get('key', load)).rejects.toThrow('sync throw');
  });

  it('forgets every value on clear()', async () => {
    const { cache } = setup<string>();
    await cache.get('key', async () => 'before');

    cache.clear();

    await expect(
      cache.get('key', async () => {
        throw new Error('down');
      }),
    ).rejects.toThrow('down');
  });
});

describe('createStaleCache after a failed reload', () => {
  const T0 = Date.UTC(2026, 10, 5, 12, 0, 0);
  const upstreamDown = new Error('upstream hangs');
  const failing = () =>
    vi.fn(async (): Promise<string> => {
      throw upstreamDown;
    });

  /** A cache on its default clock (Date.now), driven by fake timers, with one good value cached. */
  const withStaleValue = async () => {
    const cache = createStaleCache<string>({ ttlMs: TTL_MS });
    await cache.get('key', async () => 'good');
    vi.setSystemTime(T0 + TTL_MS);
    return cache;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('serves the last good value without asking the upstream again during the backoff', async () => {
    const cache = await withStaleValue();
    const load = failing();

    const first = await cache.get('key', load);
    vi.setSystemTime(T0 + TTL_MS + STALE_RETRY_BACKOFF_MS - 1);
    const second = await cache.get('key', load);

    expect(first).toEqual({ stale: true, data: 'good', error: upstreamDown, loadedAt: T0 });
    expect(second).toEqual(first);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('asks the upstream again once the backoff is over, and a good load replaces the stale value', async () => {
    const cache = await withStaleValue();
    await cache.get('key', failing());

    vi.setSystemTime(T0 + TTL_MS + STALE_RETRY_BACKOFF_MS);
    const recovered = vi.fn(async () => 'fresh');

    await expect(cache.get('key', recovered)).resolves.toEqual({ stale: false, data: 'fresh' });
    await expect(cache.get('key', recovered)).resolves.toEqual({ stale: false, data: 'fresh' });
    expect(recovered).toHaveBeenCalledTimes(1);
  });

  it('starts a new backoff when the retry fails too', async () => {
    const cache = await withStaleValue();
    const load = failing();
    await cache.get('key', load);

    vi.setSystemTime(T0 + TTL_MS + STALE_RETRY_BACKOFF_MS);
    await expect(cache.get('key', load)).resolves.toMatchObject({ stale: true, data: 'good' });
    vi.setSystemTime(T0 + TTL_MS + 2 * STALE_RETRY_BACKOFF_MS - 1);
    await expect(cache.get('key', load)).resolves.toMatchObject({ stale: true, data: 'good' });

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps asking for a key with nothing cached: there is nothing to serve during a backoff', async () => {
    const cache = createStaleCache<string>({ ttlMs: TTL_MS });
    const load = failing();

    await expect(cache.get('cold', load)).rejects.toBe(upstreamDown);
    await expect(cache.get('cold', load)).rejects.toBe(upstreamDown);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('honours a custom backoff', async () => {
    const cache = createStaleCache<string>({ ttlMs: TTL_MS, retryBackoffMs: 10 });
    await cache.get('key', async () => 'good');
    vi.setSystemTime(T0 + TTL_MS);
    const load = failing();
    await cache.get('key', load);

    vi.setSystemTime(T0 + TTL_MS + 10);
    await cache.get('key', load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('forgets the backoff on clear()', async () => {
    const cache = await withStaleValue();
    await cache.get('key', failing());

    cache.clear();
    const load = vi.fn(async () => 'after clear');

    await expect(cache.get('key', load)).resolves.toEqual({ stale: false, data: 'after clear' });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
