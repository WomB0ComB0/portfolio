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
 * Stale-While-Revalidate Cache Utility
 *
 * Provides a caching layer that serves stale data immediately while
 * fetching fresh data in the background.
 *
 * Benefits:
 * - Fast response times (serve from cache)
 * - Always eventually consistent (background refresh)
 * - Graceful degradation (serve stale on fetch failure)
 */

import { logger } from '@/utils';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isStale: boolean;
}

interface SWROptions<T = any> {
  /**
   * Time in ms before data is considered stale
   * @default 3600000 (1 hour)
   */
  ttl?: number;

  /**
   * Time in ms before cache entry expires completely
   * @default 86400000 (24 hours)
   */
  maxAge?: number;

  /**
   * Whether to serve stale data while revalidating
   * @default true
   */
  serveStale?: boolean;

  /**
   * Called when fresh data is successfully fetched
   */
  onSuccess?: (data: T) => void;

  /**
   * Called when background revalidation fails
   */
  onError?: (error: Error) => void;
}

class SWRCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();

  /**
   * Fetch data with stale-while-revalidate strategy
   */
  async fetch<T>(key: string, fetcher: () => Promise<T>, options: SWROptions = {}): Promise<T> {
    const {
      ttl = 3_600_000, // 1 hour
      maxAge = 86_400_000, // 24 hours
      serveStale = true,
      onSuccess,
      onError,
    } = options;

    const now = Date.now();
    const cached = this.cache.get(key);

    // Check if we have valid cached data
    if (cached) {
      const age = now - cached.timestamp;
      const isStale = age > ttl;
      const isExpired = age > maxAge;

      // If not expired, serve from cache
      if (!isExpired) {
        // If stale, trigger background revalidation
        if (isStale && serveStale) {
          this.revalidateInBackground(key, fetcher, ttl, onSuccess, onError);
        }

        return cached.data;
      }
    }

    // Check if there's already a pending request for this key
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending;
    }

    // No valid cache, must fetch
    const promise = this.fetchAndCache(key, fetcher, onSuccess, onError);
    this.pendingRequests.set(key, promise);

    try {
      const data = await promise;
      return data;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Fetch data and update cache
   */
  private async fetchAndCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    onSuccess?: (data: T) => void,
    onError?: (error: Error) => void,
  ): Promise<T> {
    try {
      const data = await fetcher();

      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        isStale: false,
      });

      onSuccess?.(data);
      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    }
  }

  /**
   * Revalidate in background without blocking
   */
  private revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    _ttl: number,
    onSuccess?: (data: T) => void,
    onError?: (error: Error) => void,
  ): void {
    // Don't start revalidation if one is already in progress
    if (this.pendingRequests.has(key)) {
      return;
    }

    const promise = this.fetchAndCache(key, fetcher, onSuccess, onError);
    this.pendingRequests.set(key, promise);

    promise
      .catch((error) => {
        // Silently log errors from background revalidation
        logger.error(`Background revalidation failed for ${key}:`, error);
      })
      .finally(() => {
        this.pendingRequests.delete(key);
      });
  }

  /**
   * Get cached data without fetching
   */
  get<T>(key: string): T | undefined {
    const cached = this.cache.get(key);
    return cached?.data;
  }

  /**
   * Check if cached data exists and is fresh
   */
  has(key: string, ttl: number = 3_600_000): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;

    const age = Date.now() - cached.timestamp;
    return age < ttl;
  }

  /**
   * Manually set cache entry
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      isStale: false,
    });
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.pendingRequests.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());

    return {
      total: entries.length,
      fresh: entries.filter(([_, v]) => now - v.timestamp < 3_600_000).length,
      stale: entries.filter(
        ([_, v]) => now - v.timestamp >= 3_600_000 && now - v.timestamp < 86_400_000,
      ).length,
      expired: entries.filter(([_, v]) => now - v.timestamp >= 86_400_000).length,
      pending: this.pendingRequests.size,
    };
  }
}

// Export singleton instance
export const swrCache = new SWRCache();

/**
 * Helper function for common use case
 */
export async function fetchWithSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 3_600_000,
): Promise<T> {
  return swrCache.fetch(key, fetcher, {
    ttl,
    onError: (error) => {
      logger.error(`[SWR] Failed to fetch ${key}:`, error.message);
    },
  });
}

/**
 * Example usage:
 *
 * ```typescript
 * import { fetchWithSWR } from '@/class/swr-cache';
 *
 * export async function getGitHubStats() {
 *   return fetchWithSWR(
 *     'github-stats',
 *     async () => {
 *       const response = await fetch('https://api.github.com/users/...');
 *       return response.json();
 *     },
 *     60 * 60 * 1000 // 1 hour TTL
 *   );
 * }
 * ```
 */
