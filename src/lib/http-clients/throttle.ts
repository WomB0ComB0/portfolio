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
 * @fileoverview Throttle and debounce utilities for rate limiting
 *
 * Provides functions to limit the rate at which functions can be called.
 * Useful for preventing excessive API calls and managing request frequency.
 */

/**
 * Throttle options
 */
export interface ThrottleOptions {
  /** Whether to call the function on the leading edge */
  leading?: boolean;
  /** Whether to call the function on the trailing edge */
  trailing?: boolean;
}

/**
 * Throttle a function to only execute once per specified interval
 *
 * @param func Function to throttle
 * @param wait Wait time in milliseconds
 * @param options Throttle options
 * @returns Throttled function
 *
 * @example
 * ```ts
 * const fetchData = throttle(() => fetch('/api/data'), 1000);
 * fetchData(); // Executes immediately
 * fetchData(); // Ignored
 * fetchData(); // Ignored
 * // After 1000ms, next call will execute
 * ```
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: ThrottleOptions = {},
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let timeout: NodeJS.Timeout | null = null;
  let previous = 0;
  let result: ReturnType<T> | undefined;

  const { leading = true, trailing = true } = options;

  const later = (context: any, args: Parameters<T>) => {
    previous = leading === false ? 0 : Date.now();
    timeout = null;
    result = func.apply(context, args);
  };

  const throttled = function (this: any, ...args: Parameters<T>): ReturnType<T> | undefined {
    const now = Date.now();

    if (!previous && leading === false) {
      previous = now;
    }

    const remaining = wait - (now - previous);

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      result = func.apply(this, args);
    } else if (!timeout && trailing) {
      timeout = setTimeout(() => later(this, args), remaining);
    }

    return result;
  };

  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    previous = 0;
  };

  return throttled;
}

/**
 * Debounce options
 */
export interface DebounceOptions {
  /** Whether to call the function on the leading edge */
  leading?: boolean;
  /** Maximum time to wait before forcing execution */
  maxWait?: number;
}

/**
 * Debounce a function to only execute after it stops being called for specified time
 *
 * @param func Function to debounce
 * @param wait Wait time in milliseconds
 * @param options Debounce options
 * @returns Debounced function
 *
 * @example
 * ```ts
 * const search = debounce((query) => fetchSearchResults(query), 300);
 * search('a'); // Waiting...
 * search('ab'); // Waiting...
 * search('abc'); // Executes after 300ms of no calls
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: DebounceOptions = {},
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let lastCallTime = 0;
  let lastInvokeTime = 0;
  let result: ReturnType<T> | undefined;

  const { leading = false, maxWait } = options;

  const invokeFunc = (context: any, args: Parameters<T>) => {
    lastInvokeTime = Date.now();
    result = func.apply(context, args);
    return result;
  };

  const shouldInvoke = (time: number) => {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === 0 ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  };

  const timerExpired = function (this: any, args: Parameters<T>) {
    timeout = null;
    invokeFunc(this, args);
  };

  const debounced = function (this: any, ...args: Parameters<T>): void {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastCallTime = time;

    if (isInvoking && timeout === null && leading) {
      invokeFunc(this, args);
      timeout = setTimeout(() => timerExpired.call(this, args), wait);
      return;
    }

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => timerExpired.call(this, args), wait);
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    lastCallTime = 0;
    lastInvokeTime = 0;
  };

  debounced.flush = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}

/**
 * Per-key throttle manager for throttling by specific keys
 * Useful for throttling per-endpoint or per-user
 */
export class KeyedThrottle<T extends (...args: any[]) => any> {
  private throttles = new Map<string, ReturnType<typeof throttle<T>>>();
  private readonly func: T;
  private readonly wait: number;
  private readonly options: ThrottleOptions;

  constructor(func: T, wait: number, options: ThrottleOptions = {}) {
    this.func = func;
    this.wait = wait;
    this.options = options;
  }

  /**
   * Execute function with throttling per key
   */
  public execute(key: string, ...args: Parameters<T>): ReturnType<T> | undefined {
    let throttled = this.throttles.get(key);

    if (!throttled) {
      throttled = throttle(this.func, this.wait, this.options);
      this.throttles.set(key, throttled);
    }

    return throttled(...args);
  }

  /**
   * Cancel throttle for specific key
   */
  public cancel(key: string): void {
    const throttled = this.throttles.get(key);
    if (throttled && 'cancel' in throttled) {
      (throttled as any).cancel();
    }
    this.throttles.delete(key);
  }

  /**
   * Cancel all throttles
   */
  public cancelAll(): void {
    for (const throttled of this.throttles.values()) {
      if ('cancel' in throttled) {
        (throttled as any).cancel();
      }
    }
    this.throttles.clear();
  }

  /**
   * Get number of active throttles
   */
  public size(): number {
    return this.throttles.size;
  }
}

/**
 * Per-key debounce manager for debouncing by specific keys
 * Useful for debouncing per-endpoint or per-user
 */
export class KeyedDebounce<T extends (...args: any[]) => any> {
  private debounces = new Map<string, ReturnType<typeof debounce<T>>>();
  private readonly func: T;
  private readonly wait: number;
  private readonly options: DebounceOptions;

  constructor(func: T, wait: number, options: DebounceOptions = {}) {
    this.func = func;
    this.wait = wait;
    this.options = options;
  }

  /**
   * Execute function with debouncing per key
   */
  public execute(key: string, ...args: Parameters<T>): void {
    let debounced = this.debounces.get(key);

    if (!debounced) {
      debounced = debounce(this.func, this.wait, this.options);
      this.debounces.set(key, debounced);
    }

    debounced(...args);
  }

  /**
   * Cancel debounce for specific key
   */
  public cancel(key: string): void {
    const debounced = this.debounces.get(key);
    if (debounced && 'cancel' in debounced) {
      (debounced as any).cancel();
    }
    this.debounces.delete(key);
  }

  /**
   * Flush debounce for specific key (execute immediately)
   */
  public flush(key: string): void {
    const debounced = this.debounces.get(key);
    if (debounced && 'flush' in debounced) {
      (debounced as any).flush();
    }
  }

  /**
   * Cancel all debounces
   */
  public cancelAll(): void {
    for (const debounced of this.debounces.values()) {
      if ('cancel' in debounced) {
        (debounced as any).cancel();
      }
    }
    this.debounces.clear();
  }

  /**
   * Get number of active debounces
   */
  public size(): number {
    return this.debounces.size;
  }
}

/**
 * Rate limiter using token bucket algorithm
 *
 * @example
 * ```ts
 * const limiter = new RateLimiter(5, 60000); // 5 requests per minute
 *
 * async function fetchData() {
 *   await limiter.acquire();
 *   return fetch('/api/data');
 * }
 * ```
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;
  private readonly refillInterval: number;
  private queue: Array<() => void> = [];

  /**
   * @param capacity Maximum number of tokens (requests)
   * @param windowMs Time window in milliseconds
   */
  constructor(capacity: number, windowMs: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.lastRefill = Date.now();
    this.refillRate = capacity;
    this.refillInterval = windowMs;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / this.refillInterval) * this.refillRate;

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Acquire a token (wait if none available)
   */
  public async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return Promise.resolve();
    }

    // Wait for token to become available
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.scheduleNextRelease();
    });
  }

  /**
   * Try to acquire a token without waiting
   */
  public tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Schedule next token release
   */
  private scheduleNextRelease(): void {
    if (this.queue.length === 0) return;

    const waitTime = this.refillInterval / this.refillRate;

    setTimeout(() => {
      this.refill();
      const resolve = this.queue.shift();
      if (resolve && this.tokens >= 1) {
        this.tokens -= 1;
        resolve();
      }
      this.scheduleNextRelease();
    }, waitTime);
  }

  /**
   * Get current available tokens
   */
  public getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Get queue size
   */
  public getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Reset the rate limiter
   */
  public reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.queue = [];
  }
}
