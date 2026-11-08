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
 * a hanging upstream costs one slow request per backoff instead of one per request. peek answers
 * the last good value at once, however old, without loading or waiting.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStaleCache, STALE_RETRY_BACKOFF_MS } from '@/lib/cache/stale-cache';

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

describe('createStaleCache.peek', () => {
  it('is undefined for a key that was never loaded, and loads nothing', () => {
    const { cache } = setup<string>();

    expect(cache.peek('key')).toBeUndefined();
  });

  it('answers the last value loaded and when, without loading again once it is past the TTL', async () => {
    const { cache, advance } = setup<string>();
    advance(250);
    await cache.get('key', async () => 'good');
    advance(TTL_MS * 10);
    const load = vi.fn(async () => 'newer');

    expect(cache.peek('key')).toEqual({ data: 'good', loadedAt: 250 });
    expect(load).not.toHaveBeenCalled();
    // peek started nothing: the next get still has to load.
    await expect(cache.get('key', load)).resolves.toEqual({ stale: false, data: 'newer' });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('answers the old value at once while a slow reload is running, then the new one', async () => {
    const { cache, advance } = setup<string>();
    await cache.get('key', async () => 'old');
    advance(TTL_MS);
    let finish: (value: string) => void = () => undefined;
    const slow = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const reload = cache.get('key', () => slow);

    expect(cache.peek('key')).toEqual({ data: 'old', loadedAt: 0 });

    finish('new');
    await reload;
    expect(cache.peek('key')).toEqual({ data: 'new', loadedAt: TTL_MS });
  });

  it('keeps the last good value after a failed reload, and is undefined when nothing loaded', async () => {
    const { cache, advance } = setup<string>();
    await cache.get('key', async () => 'good');
    advance(TTL_MS);
    const down = async (): Promise<string> => {
      throw new Error('upstream down');
    };

    await cache.get('key', down);
    await expect(cache.get('cold', down)).rejects.toThrow('upstream down');

    expect(cache.peek('key')).toEqual({ data: 'good', loadedAt: 0 });
    expect(cache.peek('cold')).toBeUndefined();
  });

  it('is undefined after clear()', async () => {
    const { cache } = setup<string>();
    await cache.get('key', async () => 'before');

    cache.clear();

    expect(cache.peek('key')).toBeUndefined();
  });
});

/** A load that settles when the test says so. */
const held = <T>() => {
  let settle: (value: T | Error) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    settle = (value) => (value instanceof Error ? reject(value) : resolve(value));
  });
  return { load: () => promise, settle };
};

describe('createStaleCache.expire', () => {
  it('keeps the last good value: the next get reloads, and a failed reload serves it stale', async () => {
    const { cache, advance } = setup<string>();
    await cache.get('key', async () => 'before');
    advance(10);
    const failure = new Error('upstream down');

    cache.expire('key');
    const load = vi.fn(async (): Promise<string> => {
      throw failure;
    });

    await expect(cache.get('key', load)).resolves.toEqual({
      stale: true,
      data: 'before',
      error: failure,
      loadedAt: 0,
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.peek('key')).toEqual({ data: 'before', loadedAt: 0 });
  });

  it('reloads at once, inside the TTL and during a failed reload backoff', async () => {
    const { cache, advance } = setup<string>();
    await cache.get('key', async () => 'before');
    advance(TTL_MS);
    await cache.get('key', async () => {
      throw new Error('down');
    });

    cache.expire('key');

    await expect(cache.get('key', async () => 'after')).resolves.toEqual({
      stale: false,
      data: 'after',
    });
  });

  it('does nothing to a key that was never loaded, or to the other keys', async () => {
    const { cache } = setup<string>();
    await cache.get('other', async () => 'kept');

    cache.expire('cold');
    const load = vi.fn(async () => 'new');

    await expect(cache.get('other', load)).resolves.toEqual({ stale: false, data: 'kept' });
    expect(load).not.toHaveBeenCalled();
    expect(cache.peek('cold')).toBeUndefined();
  });

  it('never caches a load that started before it as fresh, even when that load ends last', async () => {
    const { cache } = setup<string>();
    const before = held<string>();
    const after = held<string>();
    const first = cache.get('key', before.load);
    await Promise.resolve();

    cache.expire('key');
    const second = cache.get('key', after.load);
    await after.settle('after the write');
    await before.settle('before the write');
    await Promise.all([first, second]);

    const load = vi.fn(async () => 'third');
    await expect(cache.get('key', load)).resolves.toEqual({
      stale: false,
      data: 'after the write',
    });
    expect(load).not.toHaveBeenCalled();
  });

  it('lets the load that started before it end without ending the newer one', async () => {
    const { cache } = setup<string>();
    const before = held<string>();
    const after = held<string>();
    const first = cache.get('key', before.load).catch((error: unknown) => error);
    await Promise.resolve();

    cache.expire('key');
    const second = cache.get('key', after.load);
    await before.settle(new Error('old read failed'));
    await first;
    // The newer load is still running: a caller now joins it instead of starting a third.
    const third = vi.fn(async () => 'third');
    const joined = cache.get('key', third);
    await after.settle('after the write');

    await expect(Promise.all([second, joined])).resolves.toEqual([
      { stale: false, data: 'after the write' },
      { stale: false, data: 'after the write' },
    ]);
    expect(third).not.toHaveBeenCalled();
  });

  it('starts no backoff when a load from before it fails', async () => {
    const { cache, advance } = setup<string>();
    await cache.get('key', async () => 'good');
    advance(TTL_MS);
    const before = held<string>();
    const first = cache.get('key', before.load);
    await Promise.resolve();

    cache.expire('key');
    await before.settle(new Error('old read failed'));
    await expect(first).resolves.toMatchObject({ stale: true, data: 'good' });

    await expect(cache.get('key', async () => 'fresh')).resolves.toEqual({
      stale: false,
      data: 'fresh',
    });
  });
});

describe('createStaleCache.clear while a load runs', () => {
  it('caches nothing from a load that started before clear()', async () => {
    const { cache } = setup<string>();
    const before = held<string>();
    const first = cache.get('key', before.load);
    await Promise.resolve();

    cache.clear();
    await before.settle('from before the clear');
    await first;

    expect(cache.peek('key')).toBeUndefined();
  });
});
