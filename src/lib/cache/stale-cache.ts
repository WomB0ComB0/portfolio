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
 * @file An in-memory, per-instance cache that keeps the last good value per key.
 *
 * - A value younger than `ttlMs` is served without asking the upstream.
 * - An older (or missing) value is loaded again. Concurrent requests for a key share one load.
 * - When that load fails and an earlier value exists, the earlier value is served, marked stale,
 *   so the route can still answer while it reports the outage. With nothing cached, the load's
 *   error is rethrown.
 * - After such a failure the earlier value keeps being served, without loading, for
 *   `retryBackoffMs`. A hanging upstream then costs one slow request per backoff, not one per
 *   request. The first request after the backoff loads again; a good load replaces the value.
 * - `peek` answers the last good value without loading or waiting, for a caller that cannot wait
 *   for a slow reload (a page tile past its deadline).
 *
 * Whatever a successful load returns is cached, so a real empty list ([]) or a missing document
 * (null) is cached like any other value. A failure is never cached as a value: with nothing to
 * serve, the next request loads again.
 */

/** How long the last good value is served after a failed reload before the upstream is asked again. */
export const STALE_RETRY_BACKOFF_MS = 30_000;

export interface StaleCacheOptions {
  /** How long a loaded value is served before the next request loads it again. */
  readonly ttlMs: number;
  /**
   * After a failed reload, how long the last good value is served without loading again.
   * Defaults to {@link STALE_RETRY_BACKOFF_MS}.
   */
  readonly retryBackoffMs?: number;
  /** The clock. Tests pass their own. */
  readonly now?: () => number;
}

/** A value from the cache, or from a load that just succeeded. */
export interface FreshResult<T> {
  readonly stale: false;
  readonly data: T;
}

/** The last good value, served because the load that should have replaced it failed. */
export interface StaleResult<T> {
  readonly stale: true;
  readonly data: T;
  /** Why the load failed. */
  readonly error: unknown;
  /** When `data` was loaded, on the cache's clock. */
  readonly loadedAt: number;
}

export type StaleCacheResult<T> = FreshResult<T> | StaleResult<T>;

/** The last value a load returned for a key, and when. */
export interface CachedValue<T> {
  readonly data: T;
  /** When `data` was loaded, on the cache's clock. */
  readonly loadedAt: number;
}

export interface StaleCache<T> {
  /**
   * Answers the value for `key`, loading it with `load` when it is missing or older than the
   * TTL (and no failed reload's backoff is running). Rejects with the load's error only when no
   * earlier value exists.
   */
  get(key: string, load: () => Promise<T>): Promise<StaleCacheResult<T>>;
  /**
   * The last value loaded for `key` and when, however old, or undefined when none was. Never
   * loads and never waits, so a caller whose deadline ran out while `get` was still reloading
   * can show the last good value; that reload keeps running and still fills the cache.
   */
  peek(key: string): CachedValue<T> | undefined;
  /** Forgets every value. */
  clear(): void;
}

type Entry<T> = CachedValue<T>;

/** A failed reload of a cached key: why, and when the upstream may be asked again. */
interface Backoff {
  readonly error: unknown;
  readonly retryAt: number;
}

const staleResult = <T>({ data, loadedAt }: Entry<T>, error: unknown): StaleResult<T> => ({
  stale: true,
  data,
  error,
  loadedAt,
});

/** Creates an empty cache. Each route owns one, so its values live as long as the instance. */
export function createStaleCache<T>({
  ttlMs,
  retryBackoffMs = STALE_RETRY_BACKOFF_MS,
  now = Date.now,
}: StaleCacheOptions): StaleCache<T> {
  const entries = new Map<string, Entry<T>>();
  const backoffs = new Map<string, Backoff>();
  const inFlight = new Map<string, Promise<T>>();

  const isFresh = (entry: Entry<T>): boolean => now() - entry.loadedAt < ttlMs;

  /** The running backoff for `key`, if its last reload failed less than `retryBackoffMs` ago. */
  const activeBackoff = (key: string): Backoff | undefined => {
    const backoff = backoffs.get(key);
    return backoff && now() < backoff.retryAt ? backoff : undefined;
  };

  const remember = (key: string, data: T): T => {
    entries.set(key, { data, loadedAt: now() });
    backoffs.delete(key);
    return data;
  };

  /** Only a key with a value to serve backs off; a cold key loads again on the next request. */
  const backOff = (key: string, error: unknown): never => {
    if (entries.has(key)) backoffs.set(key, { error, retryAt: now() + retryBackoffMs });
    throw error;
  };

  /** Starts a load for `key`, or joins the one already running. */
  const loadShared = (key: string, load: () => Promise<T>): Promise<T> => {
    const running = inFlight.get(key);
    if (running) return running;

    // Promise.resolve().then(load) also turns a load that throws synchronously into a rejection.
    const started = Promise.resolve()
      .then(load)
      .then(
        (data) => remember(key, data),
        (error: unknown) => backOff(key, error),
      )
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, started);
    return started;
  };

  return {
    async get(key, load) {
      const cached = entries.get(key);
      if (cached && isFresh(cached)) return { stale: false, data: cached.data };

      const backoff = activeBackoff(key);
      if (cached && backoff) return staleResult(cached, backoff.error);

      try {
        return { stale: false, data: await loadShared(key, load) };
      } catch (error) {
        const lastGood = entries.get(key);
        if (!lastGood) throw error;
        return staleResult(lastGood, error);
      }
    },
    peek(key) {
      const cached = entries.get(key);
      if (!cached) return undefined;
      return { data: cached.data, loadedAt: cached.loadedAt };
    },
    clear() {
      entries.clear();
      backoffs.clear();
      inFlight.clear();
    },
  };
}
